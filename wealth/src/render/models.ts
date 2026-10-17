// Procedural models: bill bundles, lying mannequins and shrouds for the heaps, standing figures for
// the person on top and the scale person. Built in code so there is no asset pipeline to maintain.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash01 } from '../pile/shell';

// ---------- cash ----------

/** $10k strap of $100 bills: 156 × 66 mm, 100 bills ≈ 11 mm. */
export const BUNDLE = { x: 0.156, y: 0.011, z: 0.066 };

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Stylized, low-detail note face. Deliberately not a reproduction of real currency. */
function billFaceTexture(): CanvasTexture {
  const [c, g] = canvas(256, 108);
  g.fillStyle = '#c4ccb6';
  g.fillRect(0, 0, 256, 108);
  g.strokeStyle = '#7d8a72';
  g.lineWidth = 3;
  g.strokeRect(6, 6, 244, 96);
  g.fillStyle = '#a9b49c';
  g.beginPath();
  g.ellipse(84, 54, 26, 34, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#5f6d57';
  g.font = 'bold 22px system-ui, sans-serif';
  g.fillText('100', 14, 30);
  g.fillText('100', 196, 96);
  // Mustard strap across the short side, the real colour for a $10,000 strap of $100s.
  g.fillStyle = '#c9a227';
  g.fillRect(150, 0, 30, 108);
  g.fillStyle = '#7a6114';
  g.font = 'bold 10px system-ui, sans-serif';
  g.save();
  g.translate(169, 80);
  g.rotate(-Math.PI / 2);
  g.fillText('$10,000', 0, 0);
  g.restore();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Stacked paper edges for the sides of a bundle. */
function billEdgeTexture(): CanvasTexture {
  const [c, g] = canvas(64, 64);
  for (let y = 0; y < 64; y += 2) {
    g.fillStyle = y % 4 === 0 ? '#d5dbc9' : '#b7c0a9';
    g.fillRect(0, y, 64, 2);
  }
  g.fillStyle = '#c9a227';
  g.fillRect(36, 0, 8, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function bundleGeometry(): BoxGeometry {
  return new BoxGeometry(BUNDLE.x, BUNDLE.y, BUNDLE.z);
}

/** Box face order: +x, −x, +y, −y, +z, −z. */
export function bundleMaterials(): MeshStandardMaterial[] {
  const face = new MeshStandardMaterial({ map: billFaceTexture(), roughness: 0.82 });
  const edge = new MeshStandardMaterial({ map: billEdgeTexture(), roughness: 0.9 });
  return [edge, edge, face, face, edge, edge];
}

/** Bundle-pattern material for the hidden core, so gaps in the shell show more money. */
export function cashCoreMaterial(): MeshStandardMaterial {
  const map = billFaceTexture();
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(220, 60);
  return new MeshStandardMaterial({ map, color: new Color('#a3ab95'), roughness: 0.95 });
}

// ---------- people ----------

type V3 = [number, number, number];

interface Pose {
  /** Directions in the standing frame (Y up, front +Z). Left side is +X. */
  upperArm: [V3, V3];
  foreArm: [V3, V3];
  thigh: [V3, V3];
  shin: [V3, V3];
  /** How the body lies on the surface. */
  lie: 'back' | 'front' | 'side';
}

export const POSES: Pose[] = [
  { upperArm: [[0.18, -1, 0], [-0.18, -1, 0]], foreArm: [[0.12, -1, 0.1], [-0.12, -1, 0.1]], thigh: [[0.06, -1, 0], [-0.06, -1, 0]], shin: [[0.04, -1, 0], [-0.04, -1, 0]], lie: 'back' },
  { upperArm: [[1, -0.35, 0], [-1, -0.25, 0]], foreArm: [[1, -0.1, 0.2], [-1, 0.15, 0]], thigh: [[0.22, -1, 0], [-0.18, -1, 0]], shin: [[0.2, -1, 0], [-0.12, -1, 0]], lie: 'back' },
  { upperArm: [[0.3, -1, 0], [-0.9, -0.6, 0]], foreArm: [[0.2, -1, 0.3], [-0.6, -1, 0]], thigh: [[0.08, -0.6, 0.8], [-0.08, -1, 0]], shin: [[0.05, -1, -0.15], [-0.05, -1, 0]], lie: 'back' },
  { upperArm: [[0.1, -0.4, 1], [-0.1, -0.5, 1]], foreArm: [[0, 0.6, 0.7], [0, 0.5, 0.8]], thigh: [[0.05, -0.35, 1], [-0.05, -0.45, 1]], shin: [[0, -1, -0.25], [0, -1, -0.2]], lie: 'side' },
  { upperArm: [[0.25, 1, 0], [-0.3, -1, 0]], foreArm: [[0.1, 1, 0], [-0.2, -1, 0.2]], thigh: [[0.1, -1, 0], [-0.15, -1, 0.1]], shin: [[0.05, -1, 0], [-0.1, -1, 0]], lie: 'front' },
];

export const STANDING: Pose = { upperArm: [[0.12, -1, 0], [-0.12, -1, 0]], foreArm: [[0.08, -1, 0.12], [-0.08, -1, 0.12]], thigh: [[0.05, -1, 0], [-0.05, -1, 0]], shin: [[0.03, -1, 0], [-0.03, -1, 0]], lie: 'back' };

export interface Outfit {
  skin: string;
  top: string;
  bottom: string;
  shoes: string;
}

const PLAIN: Outfit = { skin: '#ffffff', top: '#ffffff', bottom: '#ffffff', shoes: '#ffffff' };

function paint(g: BufferGeometry, hex: string): BufferGeometry {
  const c = new Color(hex);
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(a, 3));
  return g;
}

/** Capsule from a joint along a direction; returns the far end. */
export type Detail = 'hi' | 'lo';
// Segment counts per detail level: capsule cap / radial, sphere width / height.
const SEG = { hi: { cap: 2, rad: 7, sw: 10, sh: 8 }, lo: { cap: 1, rad: 4, sw: 5, sh: 4 } };
let seg = SEG.hi;

function limb(parts: BufferGeometry[], from: Vector3, dir: V3, len: number, r: number, hex: string): Vector3 {
  const d = new Vector3(...dir).normalize();
  const g = new CapsuleGeometry(r, Math.max(0.001, len - 2 * r), seg.cap, seg.rad);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d));
  const mid = from.clone().addScaledVector(d, len / 2);
  g.translate(mid.x, mid.y, mid.z);
  parts.push(paint(g.toNonIndexed(), hex));
  return from.clone().addScaledVector(d, len);
}

function blob(parts: BufferGeometry[], at: V3, r: number, scale: V3, hex: string, capLen = 0) {
  const g = capLen > 0 ? new CapsuleGeometry(r, capLen, seg.cap, seg.rad + 2) : new SphereGeometry(r, seg.sw, seg.sh);
  g.scale(...scale);
  g.translate(...at);
  parts.push(paint(g.toNonIndexed(), hex));
}

/** Faceless mannequin, 1.75 m, feet at y = 0, standing frame. */
export function mannequin(pose: Pose, o: Outfit = PLAIN, detail: Detail = 'hi'): BufferGeometry {
  seg = SEG[detail];
  const parts: BufferGeometry[] = [];
  blob(parts, [0, 1.62, 0.01], 0.105, [0.92, 1.08, 1], o.skin);
  if (detail === 'hi') blob(parts, [0, 1.49, 0], 0.05, [1, 1, 1], o.skin, 0.06);
  blob(parts, [0, 1.2, 0], 0.16, [1.12, 1, 0.66], o.top, 0.3);
  blob(parts, [0, 0.93, 0], 0.15, [1.1, 1, 0.7], o.bottom, 0.06);
  for (const side of [0, 1] as const) {
    const sx = side === 0 ? 1 : -1;
    const elbow = limb(parts, new Vector3(0.2 * sx, 1.38, 0), pose.upperArm[side], 0.29, 0.052, o.top);
    const wrist = limb(parts, elbow, pose.foreArm[side], 0.26, 0.044, o.top);
    if (detail === 'hi') blob(parts, [wrist.x, wrist.y, wrist.z], 0.045, [1, 1.2, 0.7], o.skin);
    const knee = limb(parts, new Vector3(0.09 * sx, 0.9, 0), pose.thigh[side], 0.44, 0.075, o.bottom);
    const ankle = limb(parts, knee, pose.shin[side], 0.42, 0.056, o.bottom);
    if (detail === 'hi') blob(parts, [ankle.x, ankle.y - 0.02, ankle.z + 0.06], 0.05, [1, 0.7, 2], o.shoes);
  }
  return mergeGeometries(parts)!;
}

/** Rotate a standing-frame body so it lies with its thickness along +Y, lowest point at y ≈ −0.04. */
function layDown(g: BufferGeometry, lie: Pose['lie']): BufferGeometry {
  g.translate(0, -0.9, 0); // center the body along its length
  if (lie === 'back') g.rotateX(-Math.PI / 2);
  else if (lie === 'front') g.rotateX(Math.PI / 2);
  else {
    g.rotateZ(Math.PI / 2);
  }
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y - 0.04, 0);
  return g;
}

export function lyingMannequins(detail: Detail): BufferGeometry[] {
  return POSES.map((p) => layDown(mannequin(p, PLAIN, detail), p.lie));
}

const BONE = '#ffffff';
const SOCKET = '#2e2a25';

/** Skull with dark eye sockets and nasal opening painted into its vertex colours. */
function skull(parts: BufferGeometry[], detail: Detail) {
  const hi = detail === 'hi';
  const g = new SphereGeometry(0.1, hi ? 14 : 5, hi ? 10 : 4).toNonIndexed();
  g.scale(0.86, 1, 1.05);
  g.translate(0, 1.63, 0.005);
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const bone = new Color(BONE);
  const dark = new Color(SOCKET);
  const holes: [number, number, number][] = [
    [0.033, 1.635, 0.032], // eyes: x, y, radius
    [-0.033, 1.635, 0.032],
    [0, 1.595, 0.018], // nose
  ];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const inHole = hi && z > 0.06 && holes.some(([hx, hy, r]) => Math.hypot(x - hx, y - hy) < r);
    (inHole ? dark : bone).toArray(col, i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  parts.push(g);
  // Jaw
  if (hi) blob(parts, [0, 1.55, 0.03], 0.05, [1.15, 0.55, 1], BONE);
}

/** Rib pairs curving from the spine round to the sternum; the lowest pair floats free at the front. */
function ribcage(parts: BufferGeometry[], detail: Detail) {
  if (detail === 'lo') {
    blob(parts, [0, 1.24, -0.01], 0.14, [1.05, 1, 0.7], BONE, 0.1);
    return;
  }
  const widths = [0.105, 0.13, 0.145, 0.148, 0.14];
  widths.forEach((w, i) => {
    const y = 1.4 - i * 0.055;
    const drop = 0.1 + i * 0.012;
    for (const sx of [1, -1]) {
      const pts = [
        new Vector3(0.02 * sx, y, -0.075),
        new Vector3(0.75 * w * sx, y + 0.005, -0.06),
        new Vector3(w * sx, y - 0.03, 0),
        new Vector3(0.8 * w * sx, y - 0.07, 0.07),
      ];
      if (i < widths.length - 1) pts.push(new Vector3(0.035 * sx, y - drop, 0.095));
      const tube = new TubeGeometry(new CatmullRomCurve3(pts), 6, 0.009, 3, false);
      parts.push(paint(tube.toNonIndexed(), BONE));
    }
  });
  // Sternum
  limb(parts, new Vector3(0, 1.32, 0.1), [0, -1, -0.05], 0.2, 0.014, BONE);
}

/** Stylized skeleton in a pose, 1.75 m, feet at y = 0, standing frame. */
// Bones are thin, so they need far fewer segments than the mannequin's limbs.
const SEG_BONE = { hi: { cap: 1, rad: 5, sw: 6, sh: 4 }, lo: { cap: 1, rad: 3, sw: 4, sh: 3 } };

export function skeleton(pose: Pose, detail: Detail = 'hi'): BufferGeometry {
  seg = SEG_BONE[detail];
  const hi = detail === 'hi';
  const parts: BufferGeometry[] = [];
  skull(parts, detail);
  // Spine: neck to sacrum
  limb(parts, new Vector3(0, 1.53, -0.05), [0, -1, -0.04], 0.62, 0.02, BONE);
  ribcage(parts, detail);
  // Pelvis: a wide flattened ring
  if (hi) {
    const p = new TorusGeometry(0.1, 0.03, 4, 10);
    p.rotateX(Math.PI / 2 - 0.5);
    p.scale(1.25, 1, 0.75);
    p.translate(0, 0.94, 0);
    parts.push(paint(p.toNonIndexed(), BONE));
  } else {
    blob(parts, [0, 0.94, 0], 0.11, [1.3, 0.5, 0.8], BONE);
  }
  for (const side of [0, 1] as const) {
    const sx = side === 0 ? 1 : -1;
    // Clavicle
    if (hi) limb(parts, new Vector3(0.02 * sx, 1.43, 0.04), [sx, 0.05, -0.25], 0.17, 0.012, BONE);
    const shoulder = new Vector3(0.19 * sx, 1.4, 0);
    const elbow = limb(parts, shoulder, pose.upperArm[side], 0.29, 0.018, BONE);
    limb(parts, elbow, pose.foreArm[side], 0.26, 0.015, BONE);
    if (hi) {
      blob(parts, [elbow.x, elbow.y, elbow.z], 0.024, [1, 1, 1], BONE);
    }
    const hip = new Vector3(0.09 * sx, 0.9, 0);
    const knee = limb(parts, hip, pose.thigh[side], 0.44, 0.024, BONE);
    const ankle = limb(parts, knee, pose.shin[side], 0.42, 0.02, BONE);
    if (hi) {
      blob(parts, [knee.x, knee.y, knee.z], 0.032, [1, 1, 1], BONE);
    }
    if (hi) blob(parts, [ankle.x, ankle.y - 0.02, ankle.z + 0.06], 0.035, [0.9, 0.45, 2.2], BONE);
  }
  return mergeGeometries(parts)!;
}

export function lyingSkeletons(detail: Detail): BufferGeometry[] {
  return POSES.map((p) => layDown(skeleton(p, detail), p.lie));
}

/** Half-width of a wrapped body along its length (m), feet at 0, crown at 1.75. */
const SHROUD_PROFILE: [number, number][] = [
  [0, 0.05], [0.05, 0.1], [0.25, 0.11], [0.5, 0.13], [0.75, 0.16], [0.95, 0.19], [1.1, 0.18],
  [1.3, 0.21], [1.42, 0.22], [1.5, 0.13], [1.55, 0.09], [1.62, 0.11], [1.7, 0.1], [1.75, 0.04], [1.77, 0],
];
const TIES = [0.22, 0.97, 1.55]; // aligned to the hi-detail rings

function profileAt(y: number): number {
  for (let i = 1; i < SHROUD_PROFILE.length; i++) {
    const [y1, w1] = SHROUD_PROFILE[i];
    const [y0, w0] = SHROUD_PROFILE[i - 1];
    if (y <= y1) return w0 + ((y - y0) / (y1 - y0)) * (w1 - w0);
  }
  return 0;
}

/** Wrapped bodies: elliptical cross-sections along a body profile, cloth folds, three ties. */
export function shrouds(detail: Detail): BufferGeometry[] {
  const hi = detail === 'hi';
  const rings = hi ? 40 : 12;
  const around = hi ? 16 : 6;
  return [0, 1, 2, 3, 4].map((v) => {
    const pos: number[] = [];
    const col: number[] = [];
    const cloth = new Color('#ffffff');
    const tie = new Color('#a39a8a');
    const ring = (j: number) => {
      const y = (j / rings) * 1.77;
      const w = profileAt(y);
      const head = y > 1.5;
      const pts: [number, number, number][] = [];
      for (let k = 0; k < around; k++) {
        const a = (k / around) * Math.PI * 2;
        const fold = hi ? 1 + 0.06 * Math.sin(a * 3 + y * 17 + v) + 0.04 * (hash01(j, k, v, 9) - 0.5) : 1;
        // Flatter front to back on the body, rounder at the head.
        pts.push([Math.cos(a) * w * fold, y, Math.sin(a) * w * (head ? 0.95 : 0.6) * fold]);
      }
      return { pts, isTie: TIES.some((t) => Math.abs(y - t) < 0.018) };
    };
    let prev = ring(0);
    for (let j = 1; j <= rings; j++) {
      const cur = ring(j);
      const c = prev.isTie || cur.isTie ? tie : cloth;
      for (let k = 0; k < around; k++) {
        const k2 = (k + 1) % around;
        pos.push(...prev.pts[k], ...cur.pts[k], ...cur.pts[k2], ...prev.pts[k], ...cur.pts[k2], ...prev.pts[k2]);
        for (let n = 0; n < 6; n++) col.push(c.r, c.g, c.b);
      }
      prev = cur;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
    const smooth = mergeVertices(g);
    smooth.computeVertexNormals();
    return layDown(smooth, v % 2 === 0 ? 'back' : 'side');
  });
}

/** Far from the peak a body is a few pixels tall: one soft lying form and a head, about 80 triangles. */
export function farBody(): BufferGeometry {
  const body = new CapsuleGeometry(0.15, 1.15, 1, 5).toNonIndexed();
  body.scale(1, 1, 0.6);
  body.translate(0, 0.78, 0);
  const head = new SphereGeometry(0.1, 5, 4).toNonIndexed();
  head.translate(0, 1.6, 0.01);
  const g = mergeGeometries([paint(body, '#ffffff'), paint(head, '#ffffff')])!;
  return layDown(g, 'back');
}

export function figureMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
}

export const MUSK_OUTFIT: Outfit = { skin: '#c9a58a', top: '#2b2925', bottom: '#2f2d29', shoes: '#1d1c1a' };
export const SCALE_OUTFIT: Outfit = { skin: '#b98d6e', top: '#4f6d8f', bottom: '#3a3a3a', shoes: '#2b2925' };

export function standingFigure(outfit: Outfit, heightM: number): BufferGeometry {
  const g = mannequin(STANDING, outfit);
  g.scale(heightM / 1.75, heightM / 1.75, heightM / 1.75);
  return g;
}

// ---------- the person on top ----------

/** Smooth body section: elliptical rings along y. Each profile row is [y, half-width, half-depth]. */
function loft(profile: [number, number, number][], hex: string, around = 20): BufferGeometry {
  const pos: number[] = [];
  const ring = ([y, w, d]: [number, number, number]) =>
    Array.from({ length: around }, (_, k) => {
      const a = (k / around) * Math.PI * 2;
      return [Math.cos(a) * w, y, Math.sin(a) * d] as const;
    });
  for (let j = 1; j < profile.length; j++) {
    const lo = ring(profile[j - 1]);
    const hi = ring(profile[j]);
    for (let k = 0; k < around; k++) {
      const k2 = (k + 1) % around;
      pos.push(...lo[k], ...hi[k2], ...hi[k], ...lo[k], ...lo[k2], ...hi[k2]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  const smooth = mergeVertices(g);
  smooth.computeVertexNormals();
  return paint(smooth.toNonIndexed(), hex);
}

export type TopVariant = 'plain' | 'raised' | 'hips';

const TOP_POSES: Record<TopVariant, Pick<Pose, 'upperArm' | 'foreArm' | 'thigh' | 'shin'>> = {
  plain: { upperArm: [[0.12, -1, 0], [-0.12, -1, 0]], foreArm: [[0.06, -1, 0.15], [-0.06, -1, 0.15]], thigh: [[0.06, -1, 0], [-0.06, -1, 0]], shin: [[0.03, -1, 0], [-0.03, -1, 0]] },
  raised: { upperArm: [[0.55, 1, 0.1], [-0.55, 1, 0.1]], foreArm: [[0.25, 1, 0], [-0.25, 1, 0]], thigh: [[0.12, -1, 0], [-0.12, -1, 0]], shin: [[0.05, -1, 0], [-0.05, -1, 0]] },
  hips: { upperArm: [[0.6, -0.8, -0.12], [-0.6, -0.8, -0.12]], foreArm: [[-0.78, -0.57, 0.25], [0.78, -0.57, 0.25]], thigh: [[0.1, -1, 0], [-0.1, -1, 0]], shin: [[0.04, -1, 0], [-0.04, -1, 0]] },
};

const TOP = { skin: '#c9a58a', tee: '#232220', jeans: '#2f3a4f', boots: '#1a1918', hair: '#4a3a2c', cap: '#1d1c1b' };

/**
 * The person on top: a broad build in a black t-shirt, dark jeans and boots, with hair, ears and a
 * nose but no facial features, so it reads as a person and never as a likeness. 1.75 m, feet at 0.
 */
export function topFigure(variant: TopVariant, heightM: number): BufferGeometry {
  seg = SEG.hi;
  const pose = TOP_POSES[variant];
  const parts: BufferGeometry[] = [];
  // Jeans at the hips, t-shirt above; a little fuller through the middle.
  parts.push(loft([[0.82, 0.13, 0.09], [0.9, 0.16, 0.105], [1.0, 0.158, 0.11]], TOP.jeans));
  parts.push(loft([[0.98, 0.16, 0.115], [1.08, 0.158, 0.122], [1.18, 0.165, 0.12], [1.28, 0.183, 0.12], [1.36, 0.198, 0.118], [1.42, 0.19, 0.105], [1.46, 0.12, 0.08], [1.48, 0.06, 0.05]], TOP.tee));
  limb(parts, new Vector3(0, 1.45, 0), [0, 1, 0.08], 0.12, 0.055, TOP.skin);
  // Head, ears, nose
  blob(parts, [0, 1.64, 0.005], 0.105, [0.86, 1.05, 0.95], TOP.skin);
  blob(parts, [0.088, 1.635, -0.005], 0.022, [0.45, 1, 0.75], TOP.skin);
  blob(parts, [-0.088, 1.635, -0.005], 0.022, [0.45, 1, 0.75], TOP.skin);
  limb(parts, new Vector3(0, 1.645, 0.088), [0, -0.6, 1], 0.035, 0.013, TOP.skin);
  if (variant === 'raised') {
    const crown = new SphereGeometry(0.113, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.47).toNonIndexed();
    crown.scale(0.88, 0.95, 0.98);
    crown.translate(0, 1.655, 0);
    parts.push(paint(crown, TOP.cap));
    const brim = new CylinderGeometry(0.075, 0.075, 0.008, 16).toNonIndexed();
    brim.scale(1.1, 1, 0.85);
    brim.rotateX(0.12);
    brim.translate(0, 1.685, 0.115);
    parts.push(paint(brim, TOP.cap));
  } else {
    const hair = new SphereGeometry(0.109, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42).toNonIndexed();
    hair.scale(0.88, 1.05, 0.97);
    hair.rotateX(-0.28);
    hair.translate(0, 1.645, -0.005);
    parts.push(paint(hair, TOP.hair));
  }
  for (const side of [0, 1] as const) {
    const sx = side === 0 ? 1 : -1;
    const shoulder = new Vector3(0.18 * sx, 1.385, 0);
    // One skin capsule for the whole upper arm, with the sleeve over its top half, so there is no gap.
    const elbow = limb(parts, shoulder, pose.upperArm[side], 0.3, 0.045, TOP.skin);
    limb(parts, shoulder.clone().addScaledVector(new Vector3(...pose.upperArm[side]).normalize(), -0.02), pose.upperArm[side], 0.17, 0.058, TOP.tee);
    const wrist = limb(parts, elbow.clone().addScaledVector(new Vector3(...pose.foreArm[side]).normalize(), -0.03), pose.foreArm[side], 0.29, 0.041, TOP.skin);
    blob(parts, [wrist.x, wrist.y, wrist.z], 0.045, [0.8, 1.25, 0.6], TOP.skin);
    const knee = limb(parts, new Vector3(0.095 * sx, 0.88, 0), pose.thigh[side], 0.45, 0.082, TOP.jeans);
    const ankle = limb(parts, knee, pose.shin[side], 0.42, 0.064, TOP.jeans);
    blob(parts, [ankle.x, ankle.y - 0.025, ankle.z + 0.055], 0.055, [1, 0.75, 2], TOP.boots);
  }
  parts.forEach((p) => p.deleteAttribute('uv'));
  const g = mergeGeometries(parts)!;
  g.scale(heightM / 1.75, heightM / 1.75, heightM / 1.75);
  return g;
}
