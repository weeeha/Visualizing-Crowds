import { describe, expect, it } from 'vitest';
import { occupiedCentroid } from './occupancy';
import { rasterize } from './raster';
import { squarePlace } from '../test/fixtures';
import type { Place } from '../places/types';

describe('occupiedCentroid', () => {
  it('is the focus when the crowd surrounds it', () => {
    const [x, z] = occupiedCentroid(rasterize(squarePlace(100)), 50);
    expect(Math.abs(x)).toBeLessThan(1);
    expect(Math.abs(z)).toBeLessThan(1);
  });

  it('moves into the place when the focus sits outside it', () => {
    // Place spans x ∈ [20, 220]: the crowd can only stand east of the focus.
    const p: Place = { ...squarePlace(100), outer: [[20, -100], [220, -100], [220, 100], [20, 100], [20, -100]], areaM2: 40_000 };
    const [x, z] = occupiedCentroid(rasterize(p), 60);
    expect(x).toBeGreaterThan(20);
    expect(x).toBeLessThan(60);
    expect(Math.abs(z)).toBeLessThan(2);
  });

  it('falls back to the focus when nobody is placed', () => {
    expect(occupiedCentroid(rasterize(squarePlace(100, 50)), 10)).toEqual([0, 0]);
  });
});
