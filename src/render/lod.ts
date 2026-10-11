export interface LodRanges { nearStart: number; nearEnd: number; midStart: number; midEnd: number; }

export const MID_BUDGET = 1_500_000;
const PERSON_H = 1.75;

/**
 * 3D distances from the camera where sprites fade to dots and dots fade to the ground shader.
 * A tier ends where the figure gets too small on screen, or where the ground circle it covers
 * (seen from camHeight) would exceed its budget, whichever comes first.
 */
export function lodRanges(o: { density: number; nearBudget: number; midBudget: number; pxPerUnit: number; camHeight: number }): LodRanges {
  const byBudget = (b: number) => Math.hypot(Math.sqrt(b / (Math.PI * o.density)), o.camHeight);
  const byPixels = (px: number) => (PERSON_H * o.pxPerUnit) / px;
  const nearEnd = Math.min(byBudget(o.nearBudget), byPixels(3));
  const midEnd = Math.max(nearEnd * 1.5, Math.min(byBudget(o.midBudget), byPixels(1)));
  return { nearStart: nearEnd * 0.85, nearEnd, midStart: midEnd * 0.85, midEnd };
}

/** Radius of the ground circle within 3D distance r of a camera at height h. */
export const groundRadius = (r: number, h: number): number => Math.sqrt(Math.max(0, r * r - h * h));

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
