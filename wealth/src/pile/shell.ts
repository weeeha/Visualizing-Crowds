// Scatters pieces over the outside of a heap. Only the visible shell is generated; the core cone
// stands in for everything underneath. Uses three's math classes only, no rendering.
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Cone } from './volume';
import { REPOSE_DEG } from './volume';

export interface ShellOptions {
  cone: Cone;
  /** Center-to-center spacing on the surface, m. */
  spacing: number;
  /** Depth between layers, m. */
  layerDepth: number;
  layers: number;
  seed: number;
  variants: number;
  /** Max random tilt off the slope, radians. */
  tilt: number;
  scale: (rand: number) => number;
}

export interface Shell {
  count: number;
  matrices: Float32Array; // 16 per piece, column-major
  variants: Uint8Array;
  /** Per piece: angle around the heap (rad) and slant distance from apex (m), for tests and LOD. */
  theta: Float32Array;
  slant: Float32Array;
  layer: Uint8Array;
}

/** Deterministic 32-bit hash → [0, 1). */
export function hash01(a: number, b: number, c: number, seed: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= Math.imul(c + seed * 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const PHI = (REPOSE_DEG * Math.PI) / 180;
const UP = new Vector3(0, 1, 0);

export function buildShell(o: ShellOptions): Shell {
  const { cone, spacing: d } = o;
  const rows = Math.max(1, Math.round(cone.slant / d));

  // Count first so arrays are allocated once.
  const perRow: number[] = [];
  let total = 0;
  for (let r = 0; r < rows; r++) {
    const s = (r + 0.5) * d;
    const ring = (2 * Math.PI * (s / cone.slant) * cone.radius) / d;
    const n = Math.max(1, Math.round(ring));
    perRow.push(n);
    total += n;
  }
  total *= o.layers;

  const matrices = new Float32Array(total * 16);
  const variants = new Uint8Array(total);
  const theta = new Float32Array(total);
  const slant = new Float32Array(total);
  const layer = new Uint8Array(total);

  const m = new Matrix4();
  const q = new Quaternion();
  const qYaw = new Quaternion();
  const qTilt = new Quaternion();
  const pos = new Vector3();
  const normal = new Vector3();
  const axis = new Vector3();
  const scl = new Vector3();

  let k = 0;
  for (let L = 0; L < o.layers; L++) {
    for (let r = 0; r < rows; r++) {
      const n = perRow[r];
      for (let i = 0; i < n; i++) {
        const h = (salt: number) => hash01(r, i, L * 16 + salt, o.seed);
        // Jitter by up to ±45% of spacing so rows never read as rings.
        const s = Math.min(cone.slant, Math.max(0, (r + 0.5 + (h(0) - 0.5) * 0.9) * d));
        const th = ((i + 0.5 + (h(1) - 0.5) * 0.9) / n) * Math.PI * 2 + L * 0.37;

        const t = s / cone.slant;
        normal.set(Math.cos(th) * Math.sin(PHI), Math.cos(PHI), Math.sin(th) * Math.sin(PHI));
        pos.set(Math.cos(th) * t * cone.radius, cone.height * (1 - t), Math.sin(th) * t * cone.radius);
        pos.addScaledVector(normal, -L * o.layerDepth);

        q.setFromUnitVectors(UP, normal);
        qYaw.setFromAxisAngle(normal, h(2) * Math.PI * 2);
        axis.set(h(3) - 0.5, 0, h(4) - 0.5).normalize().applyQuaternion(q);
        qTilt.setFromAxisAngle(axis, (h(5) - 0.5) * 2 * o.tilt);
        q.premultiply(qYaw).premultiply(qTilt);

        const sc = o.scale(h(6));
        scl.set(sc, sc, sc);
        m.compose(pos, q, scl);
        m.toArray(matrices, k * 16);

        variants[k] = Math.floor(h(7) * o.variants);
        theta[k] = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        slant[k] = s;
        layer[k] = L;
        k++;
      }
    }
  }
  return { count: k, matrices, variants, theta, slant, layer };
}
