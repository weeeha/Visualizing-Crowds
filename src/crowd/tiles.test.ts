import { describe, expect, it } from 'vitest';
import { buildMidTile, buildNearTile, tileLatticeRange } from './tiles';
import { personAt } from './person';
import { rasterize, usableAt } from '../layout/raster';
import { squarePlace } from '../test/fixtures';

const raster = rasterize(squarePlace(300, 20));
const s = 0.63;

describe('tileLatticeRange', () => {
  it('covers centers in [t*size, (t+1)*size)', () => {
    const [i0, i1] = tileLatticeRange(1, 50, s);
    expect((i0 + 0.5) * s).toBeGreaterThanOrEqual(50);
    expect((i0 - 0.5) * s).toBeLessThan(50);
    expect((i1 - 0.5) * s).toBeLessThan(100);
    expect((i1 + 0.5) * s).toBeGreaterThanOrEqual(100);
  });
});

describe('buildNearTile', () => {
  it('is deterministic and only contains usable centers', () => {
    const a = buildNearTile(raster, s, 42, 0, 0);
    expect(a).toEqual(buildNearTile(raster, s, 42, 0, 0));
    expect(a.count).toBeGreaterThan(0);
    for (let n = 0; n < a.count; n++) {
      expect(usableAt(raster, a.person[n * 4], a.person[n * 4 + 1])).toBe(true);
    }
  });

  it('skips the hole', () => {
    // The 40 m hole is centered on the origin: tile (0,0) covers [0,50)², so ~400 m² of it is hole.
    const t = buildNearTile(raster, s, 42, 0, 0);
    expect(t.count).toBeLessThan((50 * 50 - 300) / (s * s));
  });

  it('matches personAt for the first person', () => {
    const t = buildNearTile(raster, s, 42, 2, 2);
    const [i0] = tileLatticeRange(2, 50, s);
    const [k0] = tileLatticeRange(2, 50, s);
    const p = personAt(i0, k0, s, 42);
    expect(t.person[0]).toBeCloseTo(p.cx, 4);
    expect(t.look[0]).toBe(p.shirt);
    expect(t.rand[0]).toBeCloseTo(p.lodRand, 6);
  });
});

describe('buildMidTile', () => {
  it('contains exactly the people of the four near tiles it covers', () => {
    const near = [[2, 2], [3, 2], [2, 3], [3, 3]].reduce((sum, [x, z]) => sum + buildNearTile(raster, s, 7, x, z).count, 0);
    expect(buildMidTile(raster, s, 7, 1, 1).count).toBe(near);
  });
});
