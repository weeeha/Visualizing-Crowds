import { hash3, pickIndex, STREAM, unit } from './hash';
import { HAIR, PANTS, SHIRT, SKIN } from './palettes';

export const POSE_COUNT = 4;

export interface Person {
  cx: number; // lattice center x (m)
  cz: number; // lattice center z (m)
  jx: number; // visual jitter x (m)
  jz: number; // visual jitter z (m)
  height: number; // m
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  pose: number;
  lodRand: number; // dissolve threshold shared by every LOD tier
  pickRand: number; // highlight "1 in N" threshold
}

export function personAt(i: number, k: number, spacing: number, seed: number): Person {
  const h = (stream: number) => hash3(i, k, seed + stream);
  return {
    cx: (i + 0.5) * spacing,
    cz: (k + 0.5) * spacing,
    jx: (unit(h(STREAM.jitterX)) - 0.5) * 0.8 * spacing,
    jz: (unit(h(STREAM.jitterZ)) - 0.5) * 0.8 * spacing,
    height: 1.55 + unit(h(STREAM.height)) * 0.35,
    shirt: pickIndex(h(STREAM.shirt), SHIRT.length),
    pants: pickIndex(h(STREAM.pants), PANTS.length),
    skin: pickIndex(h(STREAM.skin), SKIN.length),
    hair: pickIndex(h(STREAM.hair), HAIR.length),
    pose: pickIndex(h(STREAM.pose), POSE_COUNT),
    lodRand: unit(h(STREAM.lod)),
    pickRand: unit(h(STREAM.pick)),
  };
}
