import { describe, expect, it } from 'vitest';
import { buildShell, type ShellOptions } from './shell';
import { bodyCone } from './volume';

const opts = (seed = 7): ShellOptions => ({
  cone: bodyCone(50_000),
  spacing: 0.7,
  layerDepth: 0.25,
  layers: 2,
  seed,
  variants: 5,
  tilt: 0.2,
  scale: (r) => 0.5 + r * 0.5,
});

describe('buildShell', () => {
  it('is deterministic for a seed', () => {
    const a = buildShell(opts());
    const b = buildShell(opts());
    expect(a.count).toBe(b.count);
    expect(Array.from(a.matrices.slice(0, 64))).toEqual(Array.from(b.matrices.slice(0, 64)));
  });

  it('changes with the seed', () => {
    expect(buildShell(opts(1)).matrices[12]).not.toBe(buildShell(opts(2)).matrices[12]);
  });

  it('places roughly area / spacing² pieces per layer', () => {
    const o = opts();
    const s = buildShell(o);
    const expected = (o.cone.area / o.spacing ** 2) * o.layers;
    expect(s.count / expected).toBeGreaterThan(0.9);
    expect(s.count / expected).toBeLessThan(1.1);
  });

  it('leaves no bare patch on the outer layer', () => {
    const o = opts();
    const s = buildShell(o);
    // Bins about 3 pieces wide along both surface directions.
    const bin = o.spacing * 3;
    const sBins = Math.floor(o.cone.slant / bin);
    const filled = new Set<string>();
    for (let i = 0; i < s.count; i++) {
      if (s.layer[i] !== 0) continue;
      const sb = Math.floor(s.slant[i] / bin);
      const ring = (2 * Math.PI * (s.slant[i] / o.cone.slant) * o.cone.radius) / bin;
      const tb = Math.floor((s.theta[i] / (Math.PI * 2)) * Math.max(1, Math.floor(ring)));
      filled.add(`${sb}:${tb}`);
    }
    let empty = 0;
    for (let sb = 1; sb < sBins; sb++) {
      const mid = (sb + 0.5) * bin;
      const ring = Math.max(1, Math.floor((2 * Math.PI * (mid / o.cone.slant) * o.cone.radius) / bin));
      for (let tb = 0; tb < ring; tb++) if (!filled.has(`${sb}:${tb}`)) empty++;
    }
    expect(empty).toBe(0);
  });

  it('keeps every piece on or just under the cone surface', () => {
    const o = opts();
    const s = buildShell(o);
    for (let i = 0; i < s.count; i += 97) {
      const x = s.matrices[i * 16 + 12];
      const y = s.matrices[i * 16 + 13];
      const z = s.matrices[i * 16 + 14];
      const rho = Math.hypot(x, z);
      const surfaceY = o.cone.height * (1 - rho / o.cone.radius);
      expect(y).toBeLessThan(surfaceY + 0.01);
      expect(y).toBeGreaterThan(surfaceY - o.layerDepth * o.layers * 1.5 - 0.01);
    }
  });
});
