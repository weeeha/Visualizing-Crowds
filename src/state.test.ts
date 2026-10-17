import { describe, expect, it, vi } from 'vitest';
import { clampCount, createStore, DEFAULT_STATE } from './state';

describe('createStore', () => {
  it('merges patches and notifies subscribers', () => {
    const store = createStore(DEFAULT_STATE);
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.set({ count: 500 });
    expect(store.get().count).toBe(500);
    expect(store.get().placeId).toBe(DEFAULT_STATE.placeId);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    store.set({ count: 600 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('clampCount', () => {
  it('clamps to 50..50M', () => {
    expect(clampCount(3)).toBe(50);
    expect(clampCount(9e9)).toBe(50_000_000);
    expect(clampCount(1234.6)).toBe(1235);
  });
});
