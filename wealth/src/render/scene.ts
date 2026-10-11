// The only module that touches Three.js on behalf of the UI. update() is idempotent.
import {
  NeutralToneMapping,
  BackSide,
  MeshBasicMaterial,
  SphereGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { estimateById, personById, type EstimateId, type PersonId } from '../data/figures';
import { bodyCone, cashCone, type Cone } from '../pile/volume';
import { bodyHeap, cashHeap, type BodyStyle, type Heap } from './heaps';
import { figureMaterial, MUSK_OUTFIT, SCALE_OUTFIT, standingFigure } from './models';

export type Mode = 'cash' | 'bodies';
export type CameraPreset = 'close' | 'whole';

export interface WealthState {
  mode: Mode;
  personId: PersonId;
  estimateId: EstimateId;
  bodyStyle: BodyStyle;
  camera: CameraPreset;
}

export interface Stats {
  fps: number;
  ao: boolean;
  instances: number;
  heap: { radius: number; height: number };
}

export interface ScreenAnchor {
  x: number;
  y: number;
  visible: boolean;
}

export interface WealthScene {
  update(state: WealthState): void;
  dispose(): void;
  onStats(cb: (s: Stats) => void): void;
  /** Screen positions for HTML labels: the person on top and the scale person. */
  onAnchors(cb: (a: { top: ScreenAnchor; base: ScreenAnchor }) => void): void;
}

const PAPER = '#f4f2ee';
const GROUND = '#e3dfd7';
const PITCH_MIN = (10 * Math.PI) / 180;
const PITCH_MAX = (60 * Math.PI) / 180;
const EASE_MS = 600;
const SCALE_PERSON_M = 1.75;

export function coneFor(s: Pick<WealthState, 'mode' | 'personId' | 'estimateId'>): Cone {
  return s.mode === 'bodies' ? bodyCone(estimateById(s.estimateId).deaths) : cashCone(personById(s.personId).netWorthUsd);
}

/** The largest pile the current choices can show: Musk's cash, the chosen person's cash, the chosen estimate. */
export function frameFor(s: Pick<WealthState, 'personId' | 'estimateId'>): Cone {
  const cones = [cashCone(personById('musk').netWorthUsd), cashCone(personById(s.personId).netWorthUsd), bodyCone(estimateById(s.estimateId).deaths)];
  return cones.reduce((a, b) => (b.radius > a.radius ? b : a));
}

export function createWealthScene(host: HTMLElement): WealthScene {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.fog = new Fog(PAPER, 300, 2400);
  // A fogged dome instead of a flat background: it goes through the same fog and tone mapping as the
  // ground, so the horizon dissolves instead of showing a band.
  const sky = new Mesh(new SphereGeometry(3000, 32, 16), new MeshBasicMaterial({ color: PAPER, side: BackSide }));
  scene.add(sky);

  const camera = new PerspectiveCamera(40, 1, 0.1, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI / 2 - PITCH_MAX;
  controls.maxPolarAngle = Math.PI / 2 - PITCH_MIN;
  controls.minDistance = 3;

  scene.add(new HemisphereLight('#f6f1e7', '#8f8371', 0.9));
  const sun = new DirectionalLight('#fff1dc', 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const ground = new Mesh(new PlaneGeometry(8000, 8000), new MeshStandardMaterial({ color: GROUND, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const figMat = figureMaterial();
  const top = new Mesh(standingFigure(MUSK_OUTFIT, 1.88), figMat);
  top.castShadow = true;
  const base = new Mesh(standingFigure(SCALE_OUTFIT, SCALE_PERSON_M), figMat);
  base.castShadow = true;
  scene.add(top, base);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  // Ambient occlusion stays on unless the frame rate holds under 45 for two seconds.
  let aoOn = !new URLSearchParams(location.search).has('noao');
  let slowStats = 0;

  let heap: Heap | null = null;
  let heapKey = '';
  let cone: Cone = cashCone(1e12);
  let presetApplied: CameraPreset | null = null;
  let topHeight = 1.88;

  // Camera easing: target and position move together on preset or heap change.
  let ease: { t0: number; fromT: Vector3; toT: Vector3; fromP: Vector3; toP: Vector3 } | null = null;
  function easeTo(target: Vector3, position: Vector3) {
    ease = { t0: performance.now(), fromT: controls.target.clone(), toT: target, fromP: camera.position.clone(), toP: position };
  }

  const headOf = (c: Cone) => new Vector3(0, c.height + topHeight * 0.85, 0);

  /** Camera pose at a given distance from a target, keeping the current azimuth, at a given pitch. */
  function poseAround(target: Vector3, dist: number, pitch: number): Vector3 {
    const off = camera.position.clone().sub(controls.target);
    const az = Math.atan2(off.x, off.z);
    return new Vector3(
      target.x + Math.sin(az) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(az) * Math.cos(pitch) * dist,
    );
  }

  function wholeDistance(c: Cone): number {
    // Fit the full base diameter plus margin in the vertical field of view.
    const fov = (camera.fov * Math.PI) / 180;
    const span = Math.max(c.radius * 2.3, c.height * 1.6) / Math.min(1, camera.aspect);
    return span / (2 * Math.tan(fov / 2)) + c.radius * 0.5;
  }

  function insideHeap(p: Vector3, c: Cone): boolean {
    const rho = Math.hypot(p.x, p.z);
    return rho < c.radius + 1 && p.y < c.height * (1 - rho / c.radius) + 2;
  }

  function placeLights(c: Cone) {
    const reach = c.radius * 1.4 + 10;
    // Low, from the right of the default view, so the far-left flank falls into shade.
    sun.position.set(reach * 1.3, reach * 1.1, -reach * 0.2);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -reach;
    sc.right = sc.top = reach;
    sc.near = 1;
    sc.far = reach * 5;
    sc.updateProjectionMatrix();
  }

  function rebuild(s: WealthState) {
    const key = `${s.mode}|${s.mode === 'bodies' ? `${s.estimateId}|${s.bodyStyle}` : s.personId}`;
    if (key === heapKey) return false;
    heapKey = key;
    heap?.dispose();
    if (heap) scene.remove(heap.group);
    cone = coneFor(s);
    heap = s.mode === 'bodies' ? bodyHeap(cone, s.bodyStyle) : cashHeap(cone);
    scene.add(heap.group);

    topHeight = personById(s.mode === 'bodies' ? 'musk' : s.personId).heightM;
    top.scale.setScalar(topHeight / 1.88);
    top.position.set(0, cone.height - 0.12, 0);
    base.position.set(cone.radius + 2.5, 0, cone.radius * 0.35);
    base.rotation.y = -0.6;
    placeLights(cone);
    return true;
  }

  // "Whole pile" frames the largest pile in play, so toggling shows the size change instead of refitting it away.
  let frameKey = '';
  const wholeTarget = (f: Cone) => new Vector3(0, f.height * 0.4, 0);
  const wholePose = (f: Cone) => poseAround(wholeTarget(f), wholeDistance(f), 0.32);

  function update(s: WealthState) {
    const first = presetApplied === null;
    const changed = rebuild(s);
    const frame = frameFor(s);
    const frameChanged = frame.radius.toFixed(2) !== frameKey;
    frameKey = frame.radius.toFixed(2);
    controls.maxDistance = wholeDistance(frame) * 2.5;

    if (first) {
      const head = headOf(cone);
      controls.target.copy(head);
      camera.position.set(head.x + 5, head.y + 1.6, head.z + 6);
      if (s.camera === 'whole') {
        controls.target.copy(wholeTarget(frame));
        camera.position.copy(wholePose(frame));
      }
      presetApplied = s.camera;
      controls.update();
      return;
    }
    if (s.camera !== presetApplied) {
      presetApplied = s.camera;
      const head = headOf(cone);
      if (s.camera === 'whole') easeTo(wholeTarget(frame), wholePose(frame));
      else easeTo(head, poseAround(head, 8, 0.25));
      return;
    }
    if (!changed) return;
    if (s.camera === 'whole') {
      if (frameChanged) easeTo(wholeTarget(frame), wholePose(frame));
      return;
    }
    // Close view: keep the camera where it is so the size change reads; re-aim at the new peak,
    // and back off if the new heap would swallow the camera.
    const head = headOf(cone);
    let p = camera.position.clone();
    if (insideHeap(p, cone) || p.distanceTo(head) < controls.minDistance) {
      p = poseAround(head, Math.max(8, p.distanceTo(controls.target)), 0.3);
      while (insideHeap(p, cone)) p = poseAround(head, p.distanceTo(head) * 1.25, 0.3);
    }
    easeTo(head, p);
  }

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let statsCb: ((s: Stats) => void) | null = null;
  let anchorCb: ((a: { top: ScreenAnchor; base: ScreenAnchor }) => void) | null = null;
  let frames = 0;
  let lastStat = performance.now();
  let raf = 0;
  const v = new Vector3();

  function project(p: Vector3): ScreenAnchor {
    v.copy(p).project(camera);
    return {
      x: ((v.x + 1) / 2) * host.clientWidth,
      y: ((1 - v.y) / 2) * host.clientHeight,
      visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
    };
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (ease) {
      const k = Math.min(1, (now - ease.t0) / EASE_MS);
      const e = 1 - Math.pow(1 - k, 3);
      controls.target.lerpVectors(ease.fromT, ease.toT, e);
      camera.position.lerpVectors(ease.fromP, ease.toP, e);
      if (k === 1) ease = null;
    }
    controls.update();
    if (aoOn) composer.render();
    else renderer.render(scene, camera);

    anchorCb?.({
      top: project(new Vector3(0, top.position.y + topHeight + 0.35, 0)),
      base: project(new Vector3(base.position.x, SCALE_PERSON_M + 0.35, base.position.z)),
    });

    frames++;
    if (now - lastStat > 500) {
      const fps = (frames * 1000) / (now - lastStat);
      slowStats = aoOn && fps < 45 && !ease ? slowStats + 1 : 0;
      if (slowStats >= 4) aoOn = false;
      statsCb?.({
        fps: Math.round(fps),
        ao: aoOn,
        instances: heap?.instances ?? 0,
        heap: { radius: cone.radius, height: cone.height },
      });
      frames = 0;
      lastStat = now;
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    update,
    onStats: (cb) => (statsCb = cb),
    onAnchors: (cb) => (anchorCb = cb),
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      heap?.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
