import type * as THREE from 'three';
import type { Place } from '../places/types';
import type { Raster } from '../layout/raster';
import type { SceneState } from '../state';
import type { LodRanges } from './lod';

export interface SceneStats {
  fps: number;
  nearSprites: number;
  midPoints: number;
  overflow: boolean;
  capacity: number;
  radius: number;
}

export interface CrowdScene {
  update(state: SceneState): void;
  dispose(): void;
  onStats(cb: (s: SceneStats) => void): () => void;
}

export interface PlaceContext { place: Place; raster: Raster; seed: number; }
export interface CrowdParams { radius: number; spacing: number; highlight: null | { oneIn: number }; }

export interface FrameContext {
  camera: THREE.PerspectiveCamera;
  lodCenter: THREE.Vector2;
  lod: LodRanges;
  pxPerUnit: number;
  fog: { color: THREE.Color; near: number; far: number };
  /** performance.now() value by which tile building must stop this frame. */
  deadline: number;
}

export interface Layer {
  readonly kind: 'near' | 'mid' | 'far';
  readonly object: THREE.Object3D;
  setPlace(ctx: PlaceContext): void;
  setCrowd(p: CrowdParams): void;
  frame(f: FrameContext): void;
  count(): number;
  dispose(): void;
}

declare global {
  interface Window {
    __crowdStats?: SceneStats;
    __hashParity?: { ok: boolean; mismatches: number; total: number };
  }
}
