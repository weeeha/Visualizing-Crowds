// Three.js for the ranking page: one to-scale heap per leader, side by side, each leader standing on top.
// Every heap carries real skeletons at its peak and foot; the selected one is covered from top to bottom.
import {
  BackSide,
  CanvasTexture,
  ConeGeometry,
  DirectionalLight,
  Fog,
  FrontSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { bodyCone, type Cone } from '../pile/volume';
import { hash01 } from '../pile/shell';
import type { Heap } from '../render/heaps';
import { figureMaterial, SCALE_OUTFIT, standingFigure } from '../render/models';
import { boneHeap } from './boneHeap';
import { leaderFigure } from './figures';
import { heapDeaths, LEADERS, type Estimate } from './data';
import { lineUp, rowLength, type Placed } from './layout';

export type RankCamera = 'close' | 'heap' | 'row';

export interface RankingState {
  selected: string;
  estimate: Estimate;
  camera: RankCamera;
}

export interface Anchor {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface RankingScene {
  update(s: RankingState): void;
  onAnchors(cb: (a: Anchor[], base: Anchor) => void): void;
  /** Debug: render n orbiting frames synchronously; median ms per frame and pieces drawn. */
  bench(n: number): { ms: number; pieces: number; triangles: number };
  dispose(): void;
}

const PAPER = '#f4f2ee';
const GROUND = '#e3dfd7';
const GAP_M = 30;
const UNRANKED_EXTRA_M = 120;
const TILE_M = 16; // one texture tile covers 16 × 16 m of slope
const PERSON_M = 1.75;
const EASE_MS = 700;

/**
 * A tile of whole skeletons lying two deep on a dark ground, at the same size and density as the modelled
 * ones, so a slope reads the same where it is drawn and where it is only textured.
 */
function boneTexture(): CanvasTexture {
  const n = 2048;
  const px = n / TILE_M; // pixels per metre
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = '#28241f';
  g.fillRect(0, 0, n, n);
  g.lineCap = 'round';
  const line = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    g.lineWidth = w * px;
    g.beginPath();
    g.moveTo(x1 * px, y1 * px);
    g.lineTo(x2 * px, y2 * px);
    g.stroke();
  };
  const glyph = (r: (k: number) => number) => {
    // Head at -0.8 m, feet at +0.85 m, along y.
    g.beginPath();
    g.arc(0, -0.78 * px, 0.1 * px, 0, Math.PI * 2);
    g.fill();
    line(0, -0.66, 0, -0.08, 0.035);
    for (let i = 0; i < 5; i++) line(-0.13, -0.58 + i * 0.07, 0.13, -0.58 + i * 0.07, 0.022);
    line(-0.12, -0.05, 0.12, -0.05, 0.07);
    for (const sx of [1, -1]) {
      const ax = sx * (0.25 + r(6 + sx) * 0.35);
      line(sx * 0.17, -0.62, ax, -0.33, 0.028);
      line(ax, -0.33, ax + (r(8 + sx) - 0.5) * 0.4, -0.08, 0.024);
      const kx = sx * (0.1 + r(10 + sx) * 0.2);
      line(sx * 0.08, 0, kx, 0.43, 0.036);
      line(kx, 0.43, kx + (r(12 + sx) - 0.5) * 0.3, 0.84, 0.03);
    }
  };
  const perLayer = Math.round((TILE_M * TILE_M) / (0.68 * 0.68) / 2);
  const layers: [string[], number][] = [
    [['#7d735f', '#6f6654', '#877c66'], 5],
    [['#e6dcc4', '#d9cdb1', '#ece4d0', '#cfc1a2', '#c4b594'], 6],
  ];
  for (const [palette, salt] of layers) {
    for (let i = 0; i < perLayer; i++) {
      const r = (k: number) => hash01(i, k, salt, 77);
      const x = r(0) * n, y = r(1) * n, a = r(2) * Math.PI * 2, sc = r(3) < 0.2 ? 0.7 : 0.95 + r(4) * 0.12;
      g.fillStyle = g.strokeStyle = palette[Math.floor(r(5) * palette.length)];
      // Draw each at its wrapped neighbours too, so the tile repeats without seams.
      for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) {
        g.setTransform(Math.cos(a) * sc, Math.sin(a) * sc, -Math.sin(a) * sc, Math.cos(a) * sc, x + dx, y + dy);
        glyph(r);
      }
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function createRankingScene(host: HTMLElement): RankingScene {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.fog = new Fog(PAPER, 2000, 9000);
  scene.add(new Mesh(new SphereGeometry(30000, 32, 16), new MeshBasicMaterial({ color: PAPER, side: BackSide })));

  const camera = new PerspectiveCamera(40, 1, 0.1, 60000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minPolarAngle = Math.PI / 2 - (70 * Math.PI) / 180;
  controls.maxPolarAngle = Math.PI / 2 - (4 * Math.PI) / 180;
  controls.minDistance = 3;
  controls.maxDistance = 12000;

  scene.add(new HemisphereLight('#f6f1e7', '#8f8371', 0.9));
  const sun = new DirectionalLight('#fff1dc', 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const ground = new Mesh(new PlaneGeometry(80000, 80000), new MeshStandardMaterial({ color: GROUND, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const tex = boneTexture();
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const figMat = figureMaterial();
  const scalePerson = new Mesh(standingFigure(SCALE_OUTFIT, PERSON_M), figMat);
  scalePerson.castShadow = true;
  scene.add(scalePerson);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
  const aoSetSize = ao.setSize.bind(ao);
  ao.setSize = (w: number, h: number) => aoSetSize(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  let dirty = true;
  let settled = false;
  let lastMove = 0;
  const invalidate = () => {
    dirty = true;
    settled = false;
    lastMove = performance.now();
  };
  controls.addEventListener('change', invalidate);

  /** Textured cone material, tiled so one tile spans TILE_M of slope whatever the heap size. */
  function coreMaterial(c: Cone): MeshStandardMaterial {
    const t = tex.clone();
    t.repeat.set(Math.max(1, Math.round((2 * Math.PI * c.radius) / TILE_M)), Math.max(1, c.slant / TILE_M));
    t.needsUpdate = true;
    return new MeshStandardMaterial({ map: t, roughness: 1 });
  }

  // ---- built per estimate: one heap and one figure per leader ----
  let row = new Group();
  scene.add(row);
  let placed: Placed[] = [];
  let cones = new Map<string, Cone>();
  let heaps = new Map<string, Heap>();
  let tops = new Map<string, Mesh>();
  let rowKey = '';
  let detailed = '';

  function disposeRow() {
    heaps.forEach((h) => {
      row.remove(h.group);
      h.dispose();
    });
    row.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m.material === figMat) return;
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    });
    tops.forEach((t) => t.geometry.dispose());
  }

  function setHeap(id: string, selected: boolean) {
    const old = heaps.get(id);
    if (old) {
      row.remove(old.group);
      old.dispose();
    }
    const c = cones.get(id)!;
    const h = boneHeap(c, { selected, core: coreMaterial(c) });
    h.group.position.x = placed.find((p) => p.id === id)!.x;
    row.add(h.group);
    heaps.set(id, h);
  }

  function buildRow(est: Estimate) {
    if (est === rowKey) return false;
    rowKey = est;
    detailed = '';
    scene.remove(row);
    disposeRow();
    row = new Group();
    heaps = new Map();
    cones = new Map(LEADERS.map((l) => [l.id, bodyCone(heapDeaths(l, est))]));
    placed = lineUp(LEADERS.map((l) => ({ id: l.id, radius: cones.get(l.id)!.radius })), GAP_M, new Set(['genghis']), UNRANKED_EXTRA_M);
    tops = new Map();
    for (const p of placed) {
      const l = LEADERS.find((x) => x.id === p.id)!;
      const c = cones.get(p.id)!;
      setHeap(p.id, false);

      // In the low view, a faint shell shows how big the heap gets at the high estimate.
      if (est === 'low' && l.low !== null && l.high > l.low) {
        const hc = bodyCone(l.high);
        const ghost = new Mesh(
          new ConeGeometry(hc.radius, hc.height, 96, 1, true),
          new MeshBasicMaterial({ color: '#8f8371', transparent: true, opacity: 0.22, depthWrite: false, side: FrontSide }),
        );
        ghost.position.set(p.x, hc.height / 2, 0);
        row.add(ghost);
      }

      const top = new Mesh(leaderFigure(p.id), figMat);
      top.position.set(p.x, c.height - 0.1, 0);
      top.rotation.y = 0.5;
      top.castShadow = true;
      row.add(top);
      tops.set(p.id, top);
    }
    scene.add(row);

    const L = rowLength(placed);
    const reach = L / 2 + 300;
    sun.position.set(reach * 0.5, reach * 0.9, reach * 0.6);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -reach;
    sc.right = sc.top = reach;
    sc.near = 1;
    sc.far = reach * 4;
    sc.updateProjectionMatrix();
    (scene.fog as Fog).near = L * 0.9;
    (scene.fog as Fog).far = L * 3.5;
    return true;
  }

  // ---- the selected heap is covered in skeletons from peak to ground ----
  function buildDetail(s: RankingState) {
    if (s.selected === detailed) return false;
    if (detailed) setHeap(detailed, false);
    setHeap(s.selected, true);
    detailed = s.selected;
    const c = cones.get(s.selected)!;
    const p = placed.find((x) => x.id === s.selected)!;
    scalePerson.position.set(p.x + c.radius * 0.72 + 1.2, 0, c.radius * 0.72 + 1.2);
    scalePerson.rotation.y = -0.8;
    return true;
  }

  // ---- camera ----
  let ease: { t0: number; fromT: Vector3; toT: Vector3; fromP: Vector3; toP: Vector3 } | null = null;
  const easeTo = (t: Vector3, p: Vector3) =>
    (ease = { t0: performance.now(), fromT: controls.target.clone(), toT: t, fromP: camera.position.clone(), toP: p });
  const headOf = (id: string) => {
    const t = tops.get(id)!;
    return new Vector3(t.position.x, t.position.y + PERSON_M * 0.85, 0);
  };
  const closePose = (id: string): [Vector3, Vector3] => {
    const h = headOf(id);
    return [h, h.clone().add(new Vector3(5, 1.8, 7))];
  };
  /** The selected heap alone, peak to foot. */
  const heapPose = (id: string): [Vector3, Vector3] => {
    const c = cones.get(id)!;
    const x = placed.find((p) => p.id === id)!.x;
    const t = new Vector3(x, c.height * 0.4, 0);
    const span = Math.max(c.radius * 2.3, c.height * 1.6) / Math.min(1, camera.aspect);
    const dist = span / (2 * Math.tan((camera.fov * Math.PI) / 360)) + c.radius * 0.5;
    const az = 0.5, pitch = 0.3;
    return [t, t.clone().add(new Vector3(Math.sin(az) * Math.cos(pitch), Math.sin(pitch), Math.cos(az) * Math.cos(pitch)).multiplyScalar(dist))];
  };
  /** Oblique view down the row from in front of the big heaps, so size falls away into the distance. */
  const rowPose = (): [Vector3, Vector3] => {
    const L = rowLength(placed);
    const x0 = placed[0].x - placed[0].radius;
    const t = new Vector3(x0 + L * 0.3, 0, 0);
    const az = (66 * Math.PI) / 180;
    const pitch = 0.1;
    const dir = new Vector3(-Math.sin(az) * Math.cos(pitch), Math.sin(pitch), Math.cos(az) * Math.cos(pitch));
    const ends = [new Vector3(x0, cones.get(placed[0].id)!.height, 0), new Vector3(x0 + L, 0, 0)];
    // Back off along a fixed diagonal until both ends of the row are on screen.
    const probe = camera.clone();
    let d = L * 0.2;
    for (let i = 0; i < 60; i++, d *= 1.08) {
      probe.position.copy(t).addScaledVector(dir, d);
      probe.lookAt(t);
      probe.updateMatrixWorld();
      if (ends.every((e) => Math.abs(e.clone().project(probe).x) < 0.9)) break;
    }
    return [t, t.clone().addScaledVector(dir, d)];
  };

  let applied: { camera: RankCamera; selected: string } | null = null;

  function update(s: RankingState) {
    const rowChanged = buildRow(s.estimate);
    const detailChanged = buildDetail(s);
    if (rowChanged || detailChanged) {
      renderer.shadowMap.needsUpdate = true;
      invalidate();
    }
    const [t, p] = s.camera === 'row' ? rowPose() : s.camera === 'heap' ? heapPose(s.selected) : closePose(s.selected);
    if (!applied) {
      controls.target.copy(t);
      camera.position.copy(p);
      controls.update();
    } else if (applied.camera !== s.camera || (s.camera !== 'row' && (applied.selected !== s.selected || rowChanged))) {
      easeTo(t, p);
    }
    applied = { camera: s.camera, selected: s.selected };
  }

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let anchorCb: ((a: Anchor[], base: Anchor) => void) | null = null;
  const v = new Vector3();
  const project = (id: string, p: Vector3): Anchor => {
    v.copy(p).project(camera);
    return {
      id,
      x: ((v.x + 1) / 2) * host.clientWidth,
      y: ((1 - v.y) / 2) * host.clientHeight,
      visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05,
    };
  };

  let raf = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (ease) {
      const k = Math.min(1, (now - ease.t0) / EASE_MS);
      const e = 1 - Math.pow(1 - k, 3);
      controls.target.lerpVectors(ease.fromT, ease.toT, e);
      camera.position.lerpVectors(ease.fromP, ease.toP, e);
      if (k === 1) ease = null;
      invalidate();
    }
    controls.update();
    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
      anchorCb?.(
        [...tops].map(([id, t]) => project(id, new Vector3(t.position.x, t.position.y + PERSON_M + 0.4, 0))),
        project('scale', new Vector3(scalePerson.position.x, PERSON_M + 0.4, scalePerson.position.z)),
      );
    } else if (!settled && now - lastMove > 160) {
      composer.render();
      settled = true;
    }
  }
  raf = requestAnimationFrame(frame);

  function bench(n: number) {
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    const saved = camera.position.clone();
    const ms: number[] = [];
    for (let i = 0; i < n; i++) {
      camera.position.sub(controls.target).applyAxisAngle(new Vector3(0, 1, 0), 0.05).add(controls.target);
      camera.lookAt(controls.target);
      const t0 = performance.now();
      renderer.render(scene, camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // wait for the GPU
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    camera.position.copy(saved);
    invalidate();
    let pieces = 0;
    heaps.forEach((h) => (pieces += h.instances));
    return { ms: Math.round(ms[ms.length >> 1] * 10) / 10, pieces, triangles: renderer.info.render.triangles };
  }

  return {
    update,
    bench,
    onAnchors: (cb) => (anchorCb = cb),
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeRow();
      tex.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
