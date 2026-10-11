import { describe, expect, it } from 'vitest';
import { bbox, pointInRing, ringArea, ringSelfIntersects } from './geometry';
import type { Ring } from './types';

const square: Ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const bowtie: Ring = [[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]];

describe('geometry', () => {
  it('computes area', () => expect(Math.abs(ringArea(square))).toBe(100));
  it('tests points', () => {
    expect(pointInRing([5, 5], square)).toBe(true);
    expect(pointInRing([15, 5], square)).toBe(false);
  });
  it('computes bbox', () => expect(bbox(square)).toEqual({ minX: 0, minZ: 0, maxX: 10, maxZ: 10 }));
  it('detects self-intersection', () => {
    expect(ringSelfIntersects(square)).toBe(false);
    expect(ringSelfIntersects(bowtie)).toBe(true);
  });
});
