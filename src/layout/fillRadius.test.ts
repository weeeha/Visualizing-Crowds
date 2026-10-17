import { describe, expect, it } from 'vitest';
import { buildCountProfile, fillRadius, spacingFor } from './fillRadius';
import { countOccupied } from './occupancy';
import { rasterize } from './raster';
import { PLACES } from '../places/index';
import { squarePlace } from '../test/fixtures';

const within2pct = (actual: number, expected: number) => expect(Math.abs(actual - expected) / expected).toBeLessThan(0.02);

describe('fillRadius on real places', () => {
  for (const place of PLACES) {
    const raster = rasterize(place);
    const profile = buildCountProfile(raster, 2.5);
    for (const count of [1_000, 100_000, 1_000_000]) {
      it(`${place.id} @ ${count.toLocaleString()} puts the right number of people down`, () => {
        const res = fillRadius(profile, count);
        const placed = countOccupied(raster, spacingFor(2.5), res.radius);
        if (count > res.capacity) {
          expect(res.overflow).toBe(true);
          within2pct(placed, res.capacity);
        } else {
          expect(res.overflow).toBe(false);
          within2pct(placed, count);
        }
      });
    }
  }

  it('open field @ 5M uses the area estimate and stays within 2%', () => {
    const open = PLACES[0];
    const raster = rasterize(open);
    const res = fillRadius(buildCountProfile(raster, 2.5), 5_000_000);
    within2pct(countOccupied(raster, spacingFor(2.5), res.radius), 5_000_000);
  });
});

describe('overflow boundary', () => {
  const raster = rasterize(squarePlace(50));
  const profile = buildCountProfile(raster, 1);

  it('count exactly at capacity is not overflow', () => {
    const cap = fillRadius(profile, 50).capacity;
    expect(fillRadius(profile, cap).overflow).toBe(false);
    expect(fillRadius(profile, cap + 1).overflow).toBe(true);
  });

  it('capacity equals the exact lattice count for small places', () => {
    const cap = fillRadius(profile, 50).capacity;
    expect(cap).toBe(countOccupied(raster, 1, 1e9));
  });

  it('radius grows with count', () => {
    expect(fillRadius(profile, 500).radius).toBeLessThan(fillRadius(profile, 5000).radius);
  });
});
