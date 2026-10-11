import * as THREE from 'three';
import { SKY } from '../crowd/palettes';
import { fillRadius, spacingFor, type FillResult } from '../layout/fillRadius';
import { occupiedCentroid } from '../layout/occupancy';
import type { SceneState } from '../state';
import { createAtlas } from './atlas';
import { CameraRig } from './camera';
import { BudgetGovernor, lodRanges, MID_BUDGET } from './lod';
import { FarTier } from './farTier';
import { MidTier } from './midTier';
import { NearTier } from './nearTier';
import { countProfile, placeContext } from './placeCache';
import type { CrowdScene, FrameContext, Layer, PlaceContext, SceneStats } from './types';
import { supportsWebGL2 } from './webgl';
import { createGround, createPlaceFeatures, disposeObject } from './world';

// Hex colors pass through untouched so the render matches the approved mockups.
THREE.ColorManagement.enabled = false;

const FRAME_BUILD_MS = 4;

export function createScene(container: HTMLElement): CrowdScene | null {
  if (!supportsWebGL2()) return null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const fog = new THREE.Fog(SKY, 1000, 10000);
  scene.fog = fog;

  const rig = new CameraRig(renderer.domElement);
  scene.add(createGround());

  // Order matters: near builds first each frame so it gets the tile-building budget.
  const layers: Layer[] = [new NearTier(createAtlas()), new MidTier(), new FarTier()];
  for (const l of layers) scene.add(l.object);

  let current: SceneState | null = null;
  let ctx: PlaceContext | null = null;
  let features: THREE.Group | null = null;
  let fill: FillResult = { radius: 0, overflow: false, capacity: 0 };
  const governor = new BudgetGovernor();
  const subs = new Set<(s: SceneStats) => void>();

  function update(next: SceneState): void {
    const prev = current;
    current = next;
    const placeChanged = !prev || prev.placeId !== next.placeId;
    if (placeChanged) {
      ctx = placeContext(next.placeId);
      if (features) {
        scene.remove(features);
        disposeObject(features);
      }
      features = createPlaceFeatures(ctx.place);
      scene.add(features);
      rig.setBounds(ctx.place);
      for (const l of layers) l.setPlace(ctx);
    }
    fill = fillRadius(countProfile(next.placeId, next.density), next.count);
    for (const l of layers) l.setCrowd({ radius: fill.radius, spacing: spacingFor(next.density), highlight: next.highlight });
    if (placeChanged || prev!.camera.nonce !== next.camera.nonce) {
      // Aim at where people stand, which is not the focus when the focus lies outside the place.
      const center = occupiedCentroid(ctx!.raster, fill.radius);
      const extent = Math.max(15, fill.radius - Math.hypot(center[0], center[1]));
      rig.flyTo(next.camera.preset, center, extent, performance.now());
    }
  }

  function resize(): void {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    rig.resize(w, h);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let frames = 0, lastStats = performance.now(), raf = 0;

  function emitStats(fps: number): void {
    if (!current) return;
    const sum = (kind: Layer['kind']) => layers.filter((l) => l.kind === kind).reduce((s, l) => s + l.count(), 0);
    const stats: SceneStats = {
      fps: Math.round(fps),
      nearSprites: sum('near'),
      midPoints: sum('mid'),
      overflow: fill.overflow,
      capacity: fill.capacity,
      radius: fill.radius,
    };
    window.__crowdStats = stats;
    subs.forEach((cb) => cb(stats));
  }

  function loop(now: number): void {
    raf = requestAnimationFrame(loop);
    rig.tick(now);
    const cam = rig.camera, target = rig.controls.target;
    const d = cam.position.distanceTo(target);
    fog.near = d * 3;
    fog.far = d * 14 + 500;
    const pxPerUnit = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const f: FrameContext = {
      camera: cam,
      lodCenter: cam.position,
      lod: lodRanges({ density: current?.density ?? 2.5, nearBudget: governor.budget, midBudget: MID_BUDGET, pxPerUnit, camHeight: cam.position.y }),
      pxPerUnit,
      fog: { color: fog.color, near: fog.near, far: fog.far },
      deadline: performance.now() + FRAME_BUILD_MS,
    };
    for (const l of layers) l.frame(f);
    renderer.render(scene, cam);
    frames++;
    if (now - lastStats >= 500) {
      const fps = (frames * 1000) / (now - lastStats);
      frames = 0;
      lastStats = now;
      governor.sample(fps, now);
      emitStats(fps);
    }
  }
  raf = requestAnimationFrame(loop);

  return {
    update,
    onStats(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const l of layers) l.dispose();
      if (features) disposeObject(features);
      rig.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      subs.clear();
    },
  };
}
