import { describe, expect, it } from 'vitest';
import { personAt, POSE_COUNT } from './person';
import { HAIR, PANTS, SHIRT, SKIN } from './palettes';

describe('personAt', () => {
  it('is deterministic', () => {
    expect(personAt(3, -4, 0.63, 99)).toEqual(personAt(3, -4, 0.63, 99));
  });

  it('places the lattice center and keeps jitter within ±40% of spacing', () => {
    const s = 0.63;
    for (let i = -20; i < 20; i++) {
      const p = personAt(i, 5, s, 7);
      expect(p.cx).toBeCloseTo((i + 0.5) * s, 9);
      expect(p.cz).toBeCloseTo(5.5 * s, 9);
      expect(Math.abs(p.jx)).toBeLessThanOrEqual(0.4 * s);
      expect(Math.abs(p.jz)).toBeLessThanOrEqual(0.4 * s);
    }
  });

  it('keeps attributes in range', () => {
    for (let i = 0; i < 2000; i++) {
      const p = personAt(i, i * 3, 0.5, 1234);
      expect(p.height).toBeGreaterThanOrEqual(1.55);
      expect(p.height).toBeLessThan(1.9);
      expect(p.shirt).toBeLessThan(SHIRT.length);
      expect(p.pants).toBeLessThan(PANTS.length);
      expect(p.skin).toBeLessThan(SKIN.length);
      expect(p.hair).toBeLessThan(HAIR.length);
      expect(p.pose).toBeLessThan(POSE_COUNT);
      expect(p.lodRand).toBeLessThan(1);
      expect(p.pickRand).toBeLessThan(1);
    }
  });
});
