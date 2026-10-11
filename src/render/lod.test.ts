import { describe, expect, it } from 'vitest';
import { BudgetGovernor, budgetReach, groundRadius, lodRanges } from './lod';

describe('lodRanges', () => {
  const bounds = { minX: -5000, minZ: -5000, maxX: 5000, maxZ: 5000 };
  const base = { density: 2.5, nearBudget: 400_000, midBudget: 1_500_000, pxPerUnit: 1000, cam: { x: 0, z: 0, h: 20 }, crowdR: 1e9, bounds };

  it('keeps near sprites within budget on the ground', () => {
    const r = lodRanges(base);
    const g = groundRadius(r.nearEnd, base.cam.h);
    expect(Math.PI * g ** 2 * base.density).toBeLessThanOrEqual(400_000 * 1.0001);
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

  it('draws no sprites or dots from high above, where people are under a pixel', () => {
    const r = lodRanges({ ...base, cam: { x: 0, z: 0, h: 5000 } });
    expect(groundRadius(r.nearEnd, 5000)).toBe(0);
    expect(groundRadius(r.midEnd, 5000)).toBe(0);
  });
});

describe('budgetReach', () => {
  const bounds = { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 };

  it('spends the budget on crowd tiles, so a camera beside the crowd still reaches it', () => {
    // Camera hovers 600 m east of a 200 m crowd at 600 m height; the whole crowd (~314k) fits a 400k budget.
    const r = budgetReach({ x: 600, z: 0, h: 600 }, 2000, 200, 50, bounds, 2.5, 400_000);
    expect(groundRadius(r, 600)).toBeGreaterThan(800);
  });

  it('stops at the first tile that would exceed the budget', () => {
    const r = budgetReach({ x: 0, z: 0, h: 10 }, 5000, 5000, 50, bounds, 2.5, 100_000);
    const people = Math.PI * groundRadius(r, 10) ** 2 * 2.5;
    expect(people).toBeLessThan(100_000 * 1.2);
    expect(people).toBeGreaterThan(100_000 * 0.5);
  });

  it('returns the pixel limit when everything fits', () => {
    expect(budgetReach({ x: 0, z: 0, h: 10 }, 300, 50, 50, bounds, 2.5, 400_000)).toBe(300);
  });
});

describe('groundRadius', () => {
  it('is the ground circle a 3D sphere cuts at camera height', () => {
    expect(groundRadius(50, 30)).toBeCloseTo(40, 9);
    expect(groundRadius(20, 30)).toBe(0);
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
