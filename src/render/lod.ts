export interface LodRanges { nearStart: number; nearEnd: number; midStart: number; midEnd: number; }

export const MID_BUDGET = 1_500_000;
const PERSON_H = 1.75;

/**
 * Distances (from the LOD center) where sprites fade to dots and dots fade to the ground shader.
 * Each tier ends where its budget runs out or the figure gets too small to matter, whichever is first.
 */
export function lodRanges(o: { density: number; nearBudget: number; midBudget: number; pxPerUnit: number }): LodRanges {
  const byBudget = (b: number) => Math.sqrt(b / (Math.PI * o.density));
  const byPixels = (px: number) => (PERSON_H * o.pxPerUnit) / px;
  const nearEnd = Math.min(byBudget(o.nearBudget), byPixels(3));
  const midEnd = Math.max(nearEnd * 1.5, Math.min(byBudget(o.midBudget), byPixels(1)));
  return { nearStart: nearEnd * 0.85, nearEnd, midStart: midEnd * 0.85, midEnd };
}

export class BudgetGovernor {
  budget: number;
  private lowSince: number | null = null;

  constructor(initial = 400_000, private readonly floor = 50_000) {
    this.budget = initial;
  }

  /** Feed an fps sample; returns true when the budget dropped. */
  sample(fps: number, nowMs: number): boolean {
    if (fps >= 50) {
      this.lowSince = null;
      return false;
    }
    if (this.lowSince === null) {
      this.lowSince = nowMs;
      return false;
    }
    if (nowMs - this.lowSince >= 2000 && this.budget > this.floor) {
      this.budget = Math.max(this.floor, Math.round(this.budget * 0.75));
      this.lowSince = nowMs;
      return true;
    }
    return false;
  }
}
