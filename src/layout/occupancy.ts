import { rasterBounds, usableAt, type Raster } from './raster';

/** Brute-force count of people present at this radius. Slow; for tests and checks only. */
export function countOccupied(r: Raster, spacing: number, radius: number): number {
  const b = rasterBounds(r);
  const iMin = Math.floor(Math.max(-radius, b.minX) / spacing) - 1;
  const iMax = Math.ceil(Math.min(radius, b.maxX) / spacing) + 1;
  const kMin = Math.floor(Math.max(-radius, b.minZ) / spacing) - 1;
  const kMax = Math.ceil(Math.min(radius, b.maxZ) / spacing) + 1;
  let n = 0;
  for (let k = kMin; k <= kMax; k++) {
    const cz = (k + 0.5) * spacing;
    for (let i = iMin; i <= iMax; i++) {
      const cx = (i + 0.5) * spacing;
      if (Math.hypot(cx, cz) < radius && usableAt(r, cx, cz)) n++;
    }
  }
  return n;
}
