import type { PlaceId } from './places/types';

export const DENSITIES = [1, 2.5, 4.5] as const;
export type Density = (typeof DENSITIES)[number];

export const COUNT_MIN = 50;
export const COUNT_MAX = 50_000_000;
export const clampCount = (n: number): number => Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(n)));

export interface SceneState {
  count: number;
  placeId: PlaceId;
  density: Density;
  highlight: null | { oneIn: number };
  camera: { preset: 'aerial' | 'eye'; nonce: number };
}

export const DEFAULT_STATE: SceneState = {
  count: 180_000,
  placeId: 'national-mall',
  density: 2.5,
  highlight: null,
  camera: { preset: 'aerial', nonce: 0 },
};

export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      subs.forEach((f) => f());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
