import { describe, expect, it } from 'vitest';
import { PLACES } from './index';
import { validatePlace } from './validate';

const AREA_RANGES: Record<string, [number, number]> = {
  'open-field': [50e6, 53e6],
  'times-square': [4_000, 9_000],
  'national-mall': [800_000, 2_000_000],
  'michigan-stadium': [35_000, 60_000],
  manhattan: [50e6, 58e6],
};

describe('committed places', () => {
  it('lists the five v1 places in order', () => {
    expect(PLACES.map((p) => p.id)).toEqual(['open-field', 'times-square', 'national-mall', 'michigan-stadium', 'manhattan']);
  });
  for (const p of PLACES) {
    it(`${p.id} is valid`, () => expect(validatePlace(p)).toEqual([]));
    it(`${p.id} has a plausible area`, () => {
      const [lo, hi] = AREA_RANGES[p.id];
      expect(p.areaM2).toBeGreaterThanOrEqual(lo);
      expect(p.areaM2).toBeLessThanOrEqual(hi);
    });
  }
  it('national mall has its water features as holes', () => {
    expect(PLACES.find((p) => p.id === 'national-mall')!.holes.length).toBeGreaterThanOrEqual(2);
  });
});
