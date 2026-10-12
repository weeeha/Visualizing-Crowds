import { describe, expect, it } from 'vitest';
import { compareLines, formatRatio, VENUES } from './venues';

const V = [
  { name: 'Big', people: 100_000, source: 'x' },
  { name: 'Mid', people: 20_000, source: 'x' },
  { name: 'Small', people: 5_000, source: 'x' },
];

describe('compareLines', () => {
  it('picks the two closest venues in log space', () => {
    expect(compareLines(180_000, V)).toEqual(['≈ 1.8 × Big', '≈ 9 × Mid']);
  });
  it('says nothing when every venue dwarfs the crowd', () => {
    expect(compareLines(50, V)).toEqual([]);
  });
});

describe('formatRatio', () => {
  it('formats', () => {
    expect(formatRatio(1.0, 'Big')).toBe('≈ Big');
    expect(formatRatio(2.04, 'Big')).toBe('≈ 2 × Big');
    expect(formatRatio(37.4, 'Big')).toBe('≈ 37 × Big');
    expect(formatRatio(0.25, 'Big')).toBe('≈ 25% of Big');
  });
});

describe('VENUES', () => {
  it('every venue cites a source URL', () => {
    for (const v of VENUES) expect(v.source).toMatch(/^https:\/\//);
  });
});
