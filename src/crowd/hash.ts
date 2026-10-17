/**
 * 32-bit integer hash of a lattice cell. Mirrored exactly in
 * src/render/shaders/hash.glsl.ts; any change here must change both
 * and the golden values in hash.test.ts.
 */
export function hash3(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1 | 0);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b | 0);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35 | 0);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform float in [0, 1) from the top 24 bits; exact in float32 so GLSL agrees. */
export const unit = (h: number): number => (h >>> 8) / 16777216;

/** Integer in [0, n) from the top 24 bits using integer math only (n <= 255). */
export const pickIndex = (h: number, n: number): number => Math.floor(((h >>> 8) * n) / 16777216);

/** FNV-1a of the place id, masked to 30 bits so `seed + stream` never overflows int32. */
export function seedFromId(id: string): number {
  let h = 0x811c9dc5;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h & 0x3fffffff;
}

/** Independent random streams per person: hash3(i, k, seed + STREAM.x). */
export const STREAM = {
  jitterX: 0,
  jitterZ: 1,
  height: 2,
  shirt: 3,
  pants: 4,
  skin: 5,
  hair: 6,
  lod: 7,
  pick: 8,
  pose: 9,
} as const;
