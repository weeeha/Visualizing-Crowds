import * as THREE from 'three';
import { ACCENT, HAIR, NEUTRAL_PANTS, NEUTRAL_SHIRT, PANTS, SHIRT, SKIN, SKY } from '../crowd/palettes';
import type { FrameContext } from './types';

const colors = (hexes: readonly string[]) => hexes.map((h) => new THREE.Color(h));

export function paletteUniforms() {
  return {
    uShirt: { value: colors(SHIRT) },
    uPants: { value: colors(PANTS) },
    uSkin: { value: colors(SKIN) },
    uHair: { value: colors(HAIR) },
    uNeutral: { value: colors(NEUTRAL_SHIRT) },
    uNeutralPants: { value: colors(NEUTRAL_PANTS) },
    uAccent: { value: new THREE.Color(ACCENT) },
  };
}

export function fogUniforms() {
  return {
    uFogColor: { value: new THREE.Color(SKY) },
    uFogNear: { value: 1000 },
    uFogFar: { value: 10000 },
    uCamPos: { value: new THREE.Vector3() },
  };
}

export function applyFog(u: Record<string, THREE.IUniform>, f: FrameContext): void {
  u.uFogNear.value = f.fog.near;
  u.uFogFar.value = f.fog.far;
  (u.uCamPos.value as THREE.Vector3).copy(f.camera.position);
}
