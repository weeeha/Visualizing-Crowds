import { describe, expect, it } from 'vitest';
import { bodyCone } from '../pile/volume';
import { heapDeaths, LEADERS } from './data';
import { lineUp, rowLength } from './layout';

describe('lineUp', () => {
  it('puts heaps edge to edge with the gap, centred on 0', () => {
    const p = lineUp([{ id: 'a', radius: 10 }, { id: 'b', radius: 5 }], 4);
    expect(p[1].x - p[1].radius - (p[0].x + p[0].radius)).toBeCloseTo(4);
    expect(p[0].x - p[0].radius).toBeCloseTo(-(p[1].x + p[1].radius));
    expect(rowLength(p)).toBeCloseTo(34);
  });

  it('adds the extra gap only before the marked id', () => {
    const p = lineUp([{ id: 'a', radius: 1 }, { id: 'b', radius: 1 }, { id: 'c', radius: 1 }], 2, new Set(['c']), 10);
    expect(p[1].x - p[0].x).toBeCloseTo(4);
    expect(p[2].x - p[1].x).toBeCloseTo(14);
  });
});

describe('ranking data', () => {
  it('has 17 ranked leaders and one unranked', () => {
    expect(LEADERS.filter((l) => l.rank !== null)).toHaveLength(17);
    expect(LEADERS.filter((l) => l.rank === null)).toHaveLength(1);
  });

  it('never has a low estimate above the high one', () => {
    for (const l of LEADERS) expect(heapDeaths(l, 'low')).toBeLessThanOrEqual(heapDeaths(l, 'high'));
  });

  it('sizes the largest heap (Mao, high) at about 128 m tall', () => {
    const mao = LEADERS.find((l) => l.id === 'mao')!;
    expect(bodyCone(heapDeaths(mao, 'high')).height).toBeGreaterThan(120);
    expect(bodyCone(heapDeaths(mao, 'high')).height).toBeLessThan(135);
  });
});
