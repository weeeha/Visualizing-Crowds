import { describe, expect, it } from 'vitest';
import { hash3, pickIndex, seedFromId, unit } from './hash';

describe('hash3', () => {
  it('matches frozen golden values (GLSL parity depends on these)', () => {
    expect(hash3(0, 0, 0)).toBe(0);
    expect(hash3(1, 2, 3)).toBe(1631111411);
    expect(hash3(-5, 7, 42)).toBe(1108561844);
    expect(hash3(-1, -1, 1073741823)).toBe(3257144788);
  });

  it('is deterministic and distinguishes neighbours', () => {
    expect(hash3(10, 20, 5)).toBe(hash3(10, 20, 5));
    expect(hash3(10, 20, 5)).not.toBe(hash3(11, 20, 5));
    expect(hash3(-10, 20, 5)).not.toBe(hash3(10, 20, 5));
  });
});

describe('unit', () => {
  it('stays in [0, 1) with mean near 0.5', () => {
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const u = unit(hash3(i % 317, Math.floor(i / 317), 9));
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      sum += u;
    }
    expect(Math.abs(sum / 100_000 - 0.5)).toBeLessThan(0.01);
  });
});

describe('pickIndex', () => {
  it('spreads evenly over n buckets', () => {
    const n = 14;
    const buckets = new Array(n).fill(0);
    for (let i = 0; i < 140_000; i++) buckets[pickIndex(hash3(i, 7, 3), n)]++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(1_000);
  });
});

describe('seedFromId', () => {
  it('gives stable non-negative 30-bit seeds', () => {
    expect(seedFromId('manhattan')).toBe(46164787);
    expect(seedFromId('national-mall')).toBe(229345312);
    expect(seedFromId('open-field')).toBeLessThan(2 ** 30);
  });
});
