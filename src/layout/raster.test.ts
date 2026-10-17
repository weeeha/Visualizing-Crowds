import { describe, expect, it } from 'vitest';
import { rasterize, usableAt } from './raster';
import { squarePlace } from '../test/fixtures';

describe('rasterize', () => {
  it('measures a 200 m square within 1%', () => {
    const r = rasterize(squarePlace(100));
    expect(Math.abs(r.usableArea - 40_000) / 40_000).toBeLessThan(0.01);
  });

  it('subtracts holes', () => {
    const r = rasterize(squarePlace(100, 10));
    expect(Math.abs(r.usableArea - 39_600) / 39_600).toBeLessThan(0.01);
    expect(usableAt(r, 0, 0)).toBe(false);
    expect(usableAt(r, 50, 50)).toBe(true);
    expect(usableAt(r, 500, 0)).toBe(false);
  });

  it('keeps textures within 2048 texels', () => {
    const r = rasterize(squarePlace(10_000));
    expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(2048);
  });
});
