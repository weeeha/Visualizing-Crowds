import { describe, expect, it } from 'vitest';
import { validatePlace } from './validate';
import { makeOpenField } from './openField';
import { squarePlace } from '../test/fixtures';

describe('validatePlace', () => {
  it('accepts a square with a hole', () => expect(validatePlace(squarePlace(100, 10))).toEqual([]));

  it('rejects an open ring', () => {
    const p = squarePlace(100);
    p.outer = p.outer.slice(0, -1);
    expect(validatePlace(p).join()).toMatch(/not closed/);
  });

  it('rejects a hole outside the outer ring', () => {
    const p = squarePlace(100);
    p.holes = [[[200, 200], [210, 200], [210, 210], [200, 210], [200, 200]]];
    p.areaM2 -= 100;
    expect(validatePlace(p).join()).toMatch(/not inside outer/);
  });

  it('rejects a wrong areaM2', () => {
    const p = squarePlace(100);
    p.areaM2 = 1;
    expect(validatePlace(p).join()).toMatch(/areaM2/);
  });

  it('rejects a non-zero focus', () => {
    const p = squarePlace(100);
    p.focus = [1, 0];
    expect(validatePlace(p).join()).toMatch(/focus/);
  });
});

describe('makeOpenField', () => {
  it('is valid and holds 50M people at 1/m²', () => {
    const f = makeOpenField();
    expect(validatePlace(f)).toEqual([]);
    expect(f.areaM2).toBeGreaterThan(50_000_000);
  });
});
