import { MID_TILE, NEAR_TILE } from '../crowd/tiles';
import { nearDist, parseTileKey, tilesInRange } from './tileSet';

export interface LodRanges { nearStart: number; nearEnd: number; midStart: number; midEnd: number; }

export const MID_BUDGET = 1_500_000;
const PERSON_H = 1.75;

type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number };
type Cam = { x: number; z: number; h: number };

/**
 * 3D distance from the camera that a tier can reach before its budget runs out. Only tiles that
 * hold crowd count (inside the crowd disk and the place bounds), nearest first, so a camera
 * hovering beside a narrow place spends its budget on people instead of on empty ground.
 */
export function budgetReach(cam: Cam, maxR3d: number, crowdR: number, size: number, bounds: Bounds, density: number, budget: number): number {
  const perTile = size * size * density;
  let people = 0;
  for (const k of tilesInRange({ x: cam.x, z: cam.z }, groundRadius(maxR3d, cam.h), 0, crowdR, size, bounds)) {
    people += perTile;
    if (people > budget) {
      const [tx, tz] = parseTileKey(k);
      return Math.hypot(nearDist(cam.x, cam.z, tx * size, tz * size, (tx + 1) * size, (tz + 1) * size), cam.h);
    }
  }
  return maxR3d;
}

/**
 * 3D distances from the camera where sprites fade to dots and dots fade to the ground shader.
 * A tier ends where figures get too small on screen or where its budget of crowd tiles runs out.
 */
export function lodRanges(o: { density: number; nearBudget: number; midBudget: number; pxPerUnit: number; cam: Cam; crowdR: number; bounds: Bounds }): LodRanges {
  const byPixels = (px: number) => (PERSON_H * o.pxPerUnit) / px;
  const nearEnd = budgetReach(o.cam, byPixels(3), o.crowdR, NEAR_TILE, o.bounds, o.density, o.nearBudget);
  const midEnd = Math.max(nearEnd * 1.5, budgetReach(o.cam, byPixels(1), o.crowdR, MID_TILE, o.bounds, o.density, o.midBudget));
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
