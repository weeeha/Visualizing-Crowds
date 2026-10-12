import { describe, expect, it } from 'vitest';
import { countToPos, formatCount, niceRound, parseCount, posToCount, shortCount } from './logScale';

describe('log slider', () => {
  it('maps the ends', () => {
    expect(posToCount(0)).toBe(50);
    expect(posToCount(1)).toBe(50_000_000);
    expect(countToPos(50)).toBe(0);
    expect(countToPos(50_000_000)).toBeCloseTo(1, 9);
  });

  it('round-trips within one slider step', () => {
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const c = posToCount(p);
      expect(Math.abs(countToPos(c) - p)).toBeLessThan(0.005);
      expect(posToCount(countToPos(c))).toBe(c);
    }
  });

  it('rounds to two significant digits above 100', () => {
    expect(niceRound(183_456)).toBe(180_000);
    expect(niceRound(87)).toBe(87);
  });
});

describe('parseCount', () => {
  it('reads plain numbers, commas and suffixes', () => {
    expect(parseCount('180000')).toBe(180_000);
    expect(parseCount('20,000,000')).toBe(20_000_000);
    expect(parseCount('1.5k')).toBe(1_500);
    expect(parseCount('2M')).toBe(2_000_000);
    expect(parseCount(' 300 ')).toBe(300);
  });

  it('clamps or rejects junk', () => {
    expect(parseCount('abc')).toBeNull();
    expect(parseCount('')).toBeNull();
    expect(parseCount('-5')).toBe(50);
    expect(parseCount('0')).toBe(50);
    expect(parseCount('1e12')).toBe(50_000_000);
  });
});

describe('formatting', () => {
  it('formats counts', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(shortCount(1_000)).toBe('1k');
    expect(shortCount(20_000_000)).toBe('20M');
    expect(shortCount(50)).toBe('50');
  });
});
