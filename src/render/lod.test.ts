import { describe, expect, it } from 'vitest';
import { BudgetGovernor, lodRanges } from './lod';

describe('lodRanges', () => {
  const base = { density: 2.5, nearBudget: 400_000, midBudget: 1_500_000, pxPerUnit: 1000 };

  it('keeps near sprites within budget', () => {
    const r = lodRanges(base);
    expect(Math.PI * r.nearEnd ** 2 * base.density).toBeLessThanOrEqual(400_000 * 1.0001);
  });

  it('orders the bands', () => {
    const r = lodRanges(base);
    expect(r.nearStart).toBeLessThan(r.nearEnd);
    expect(r.nearEnd).toBeLessThan(r.midStart);
    expect(r.midStart).toBeLessThan(r.midEnd);
  });

  it('shrinks with a smaller budget', () => {
    expect(lodRanges({ ...base, nearBudget: 100_000 }).nearEnd).toBeLessThan(lodRanges(base).nearEnd);
  });
});

describe('BudgetGovernor', () => {
  it('drops 25% after 2 s under 50 fps and never below the floor', () => {
    const g = new BudgetGovernor(400_000, 50_000);
    expect(g.sample(30, 0)).toBe(false);
    expect(g.sample(30, 1000)).toBe(false);
    expect(g.sample(30, 2000)).toBe(true);
    expect(g.budget).toBe(300_000);
    for (let t = 2500; t < 60_000; t += 500) g.sample(10, t);
    expect(g.budget).toBe(50_000);
  });

  it('resets when fps recovers', () => {
    const g = new BudgetGovernor();
    g.sample(30, 0);
    g.sample(60, 1500);
    expect(g.sample(30, 2000)).toBe(false);
    expect(g.budget).toBe(400_000);
  });
});
