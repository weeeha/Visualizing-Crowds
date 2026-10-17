import { rasterBounds, usableAt, type Raster } from './raster';

export const spacingFor = (density: number): number => 1 / Math.sqrt(density);

export interface CountProfile {
  spacing: number;
  density: number;
  /** Exact lattice counts by distance, 1 cm bins, up to exactMaxR. */
  exactBin: number;
  exactCum: Float64Array;
  exactMaxR: number;
  /** Area by texel-center distance, texel-sized bins, for counts beyond exactMaxR. */
  coarseBin: number;
  coarseCum: Float64Array;
  maxDist: number;
  totalArea: number;
}

export interface FillResult { radius: number; overflow: boolean; capacity: number; }

const EXACT_BIN = 0.01;

function cumulative(bins: Float64Array): Float64Array {
  const c = new Float64Array(bins.length + 1);
  for (let i = 0; i < bins.length; i++) c[i + 1] = c[i] + bins[i];
  return c;
}

function interp(cum: Float64Array, bin: number, r: number): number {
  const t = r / bin;
  const i = Math.floor(t);
  if (i >= cum.length - 1) return cum[cum.length - 1];
  return cum[i] + (cum[i + 1] - cum[i]) * (t - i);
}

const coarseArea = (p: Pick<CountProfile, 'coarseCum' | 'coarseBin'>, r: number) => interp(p.coarseCum, p.coarseBin, r);

/**
 * Counts people exactly (lattice points) out to the radius holding ~exactLimit people,
 * and estimates by area beyond that, where edge effects are a tiny fraction of the total.
 */
export function buildCountProfile(raster: Raster, density: number, exactLimit = 2_000_000): CountProfile {
  const spacing = spacingFor(density);
  const b = rasterBounds(raster);
  const maxDist = Math.hypot(Math.max(Math.abs(b.minX), Math.abs(b.maxX)), Math.max(Math.abs(b.minZ), Math.abs(b.maxZ)));

  const coarseBin = raster.cell;
  const coarse = new Float64Array(Math.ceil(maxDist / coarseBin) + 1);
  const cellArea = raster.cell * raster.cell;
  for (let row = 0; row < raster.h; row++) {
    const z = raster.z0 + (row + 0.5) * raster.cell;
    for (let c = 0; c < raster.w; c++) {
      if (raster.mask[row * raster.w + c] !== 1) continue;
      const x = raster.x0 + (c + 0.5) * raster.cell;
      coarse[Math.floor(Math.hypot(x, z) / coarseBin)] += cellArea;
    }
  }
  const coarseCum = cumulative(coarse);
  const totalArea = raster.usableArea;

  // Radius that holds ~10% more than exactLimit by area estimate.
  const targetArea = Math.min(totalArea, (exactLimit * 1.1) / density);
  let lo = 0, hi = maxDist;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (coarseArea({ coarseCum, coarseBin }, mid) < targetArea) lo = mid; else hi = mid;
  }
  const exactMaxR = targetArea >= totalArea ? maxDist : hi;

  const exact = new Float64Array(Math.ceil(exactMaxR / EXACT_BIN) + 1);
  const iMin = Math.floor(Math.max(-exactMaxR, b.minX) / spacing) - 1;
  const iMax = Math.ceil(Math.min(exactMaxR, b.maxX) / spacing) + 1;
  const kMin = Math.floor(Math.max(-exactMaxR, b.minZ) / spacing) - 1;
  const kMax = Math.ceil(Math.min(exactMaxR, b.maxZ) / spacing) + 1;
  for (let k = kMin; k <= kMax; k++) {
    const cz = (k + 0.5) * spacing;
    for (let i = iMin; i <= iMax; i++) {
      const cx = (i + 0.5) * spacing;
      const d = Math.hypot(cx, cz);
      if (d < exactMaxR && usableAt(raster, cx, cz)) exact[Math.floor(d / EXACT_BIN)]++;
    }
  }

  return { spacing, density, exactBin: EXACT_BIN, exactCum: cumulative(exact), exactMaxR, coarseBin, coarseCum, maxDist, totalArea };
}

export function fillRadius(p: CountProfile, count: number): FillResult {
  const exactTotal = p.exactCum[p.exactCum.length - 1];
  const capacity = p.exactMaxR >= p.maxDist ? exactTotal : Math.floor(p.totalArea * p.density);
  if (count > capacity) return { radius: p.maxDist, overflow: true, capacity };

  if (count <= exactTotal) {
    // Smallest bin j with exactCum[j + 1] >= count; everyone in bins 0..j has d < (j + 1) * bin.
    let lo = 0, hi = p.exactCum.length - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (p.exactCum[mid + 1] >= count) hi = mid; else lo = mid + 1;
    }
    return { radius: (lo + 1) * p.exactBin, overflow: false, capacity };
  }

  const target = count / p.density;
  let lo = p.exactMaxR, hi = p.maxDist;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (coarseArea(p, mid) < target) lo = mid; else hi = mid;
  }
  return { radius: hi, overflow: false, capacity };
}
