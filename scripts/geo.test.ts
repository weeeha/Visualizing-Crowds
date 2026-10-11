import { describe, expect, it } from 'vitest';
import { projector, simplify } from './geo';

describe('projector', () => {
  it('maps the focus to the origin and north to -z', () => {
    const p = projector(38.89, -77.01);
    const [x0, z0] = p([-77.01, 38.89]);
    expect(x0).toBeCloseTo(0, 9);
    expect(z0).toBeCloseTo(0, 9);
    const [x, z] = p([-77.01, 38.891]);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-110.54, 1);
  });
});

describe('simplify', () => {
  it('drops collinear points and keeps the ring closed', () => {
    const ring: [number, number][] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [0, 10], [0, 0]];
    const out = simplify(ring, 0.1);
    expect(out).toEqual([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
  });
});
