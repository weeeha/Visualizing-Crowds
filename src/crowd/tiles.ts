import { hash3, pickIndex, STREAM, unit } from './hash';
import { personAt } from './person';
import { SHIRT } from './palettes';
import { usableAt, type Raster } from '../layout/raster';

export const NEAR_TILE = 50;
export const MID_TILE = 100;

export function tileLatticeRange(t: number, size: number, spacing: number): [number, number] {
  return [Math.ceil((t * size) / spacing - 0.5), Math.ceil(((t + 1) * size) / spacing - 0.5)];
}

export interface NearTileData {
  count: number;
  person: Float32Array; // cx, cz, height, pose
  jitter: Float32Array; // jx, jz
  look: Float32Array; // shirt, pants, skin, hair
  rand: Float32Array; // lodRand, pickRand
}

export interface MidTileData {
  count: number;
  position: Float32Array; // cx, 0, cz
  jitter: Float32Array; // jx, jz
  shirt: Float32Array;
  rand: Float32Array; // lodRand, pickRand
}

export function buildNearTile(r: Raster, spacing: number, seed: number, tx: number, tz: number): NearTileData {
  const [i0, i1] = tileLatticeRange(tx, NEAR_TILE, spacing);
  const [k0, k1] = tileLatticeRange(tz, NEAR_TILE, spacing);
  const max = Math.max(0, (i1 - i0) * (k1 - k0));
  const person = new Float32Array(max * 4), jitter = new Float32Array(max * 2);
  const look = new Float32Array(max * 4), rand = new Float32Array(max * 2);
  let n = 0;
  for (let k = k0; k < k1; k++) {
    for (let i = i0; i < i1; i++) {
      if (!usableAt(r, (i + 0.5) * spacing, (k + 0.5) * spacing)) continue;
      const p = personAt(i, k, spacing, seed);
      person[n * 4] = p.cx; person[n * 4 + 1] = p.cz; person[n * 4 + 2] = p.height; person[n * 4 + 3] = p.pose;
      jitter[n * 2] = p.jx; jitter[n * 2 + 1] = p.jz;
      look[n * 4] = p.shirt; look[n * 4 + 1] = p.pants; look[n * 4 + 2] = p.skin; look[n * 4 + 3] = p.hair;
      rand[n * 2] = p.lodRand; rand[n * 2 + 1] = p.pickRand;
      n++;
    }
  }
  return { count: n, person: person.slice(0, n * 4), jitter: jitter.slice(0, n * 2), look: look.slice(0, n * 4), rand: rand.slice(0, n * 2) };
}

export function buildMidTile(r: Raster, spacing: number, seed: number, tx: number, tz: number): MidTileData {
  const [i0, i1] = tileLatticeRange(tx, MID_TILE, spacing);
  const [k0, k1] = tileLatticeRange(tz, MID_TILE, spacing);
  const max = Math.max(0, (i1 - i0) * (k1 - k0));
  const position = new Float32Array(max * 3), jitter = new Float32Array(max * 2);
  const shirt = new Float32Array(max), rand = new Float32Array(max * 2);
  let n = 0;
  for (let k = k0; k < k1; k++) {
    for (let i = i0; i < i1; i++) {
      const cx = (i + 0.5) * spacing, cz = (k + 0.5) * spacing;
      if (!usableAt(r, cx, cz)) continue;
      position[n * 3] = cx; position[n * 3 + 1] = 0; position[n * 3 + 2] = cz;
      jitter[n * 2] = (unit(hash3(i, k, seed + STREAM.jitterX)) - 0.5) * 0.8 * spacing;
      jitter[n * 2 + 1] = (unit(hash3(i, k, seed + STREAM.jitterZ)) - 0.5) * 0.8 * spacing;
      shirt[n] = pickIndex(hash3(i, k, seed + STREAM.shirt), SHIRT.length);
      rand[n * 2] = unit(hash3(i, k, seed + STREAM.lod));
      rand[n * 2 + 1] = unit(hash3(i, k, seed + STREAM.pick));
      n++;
    }
  }
  return { count: n, position: position.slice(0, n * 3), jitter: jitter.slice(0, n * 2), shirt: shirt.slice(0, n), rand: rand.slice(0, n * 2) };
}
