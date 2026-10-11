import { rasterBounds, usableAt, type Raster } from './raster';

/** Center of the usable area within `radius` of the focus; [0, 0] if that area is empty. */
export function occupiedCentroid(r: Raster, radius: number): [number, number] {
  let sx = 0, sz = 0, n = 0;
  for (let row = 0; row < r.h; row++) {
    const z = r.z0 + (row + 0.5) * r.cell;
    if (Math.abs(z) >= radius) continue;
    for (let c = 0; c < r.w; c++) {
      if (r.mask[row * r.w + c] !== 1) continue;
      const x = r.x0 + (c + 0.5) * r.cell;
      if (x * x + z * z >= radius * radius) continue;
      sx += x;
      sz += z;
      n++;
    }
  }
  return n === 0 ? [0, 0] : [sx / n, sz / n];
}

/** Brute-force count of people present at this radius. Slow; for tests and checks. */
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
