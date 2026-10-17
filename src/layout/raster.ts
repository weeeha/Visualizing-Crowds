import { bbox } from '../places/geometry';
import type { Place } from '../places/types';

export interface Raster {
  x0: number; // world x of column 0's left edge
  z0: number; // world z of row 0's top edge
  cell: number; // m per texel
  w: number;
  h: number;
  mask: Uint8Array; // 1 = usable (inside outer, outside holes)
  usableArea: number; // m²
}

/** Texel size so the mask stays ≤ 2048 on its long side, never finer than 0.5 m. */
export const cellSizeFor = (maxDim: number): number => Math.max(0.5, maxDim / 2040);

/** Scanline even-odd fill over outer + holes, sampling texel centers. */
export function rasterize(place: Place): Raster {
  const b = bbox(place.outer);
  const cell = cellSizeFor(Math.max(b.maxX - b.minX, b.maxZ - b.minZ));
  const x0 = b.minX - cell;
  const z0 = b.minZ - cell;
  const w = Math.ceil((b.maxX - x0) / cell) + 1;
  const h = Math.ceil((b.maxZ - z0) / cell) + 1;
  const mask = new Uint8Array(w * h);
  const rings = [place.outer, ...place.holes];
  const xs: number[] = [];
  let usable = 0;
  for (let row = 0; row < h; row++) {
    const z = z0 + (row + 0.5) * cell;
    xs.length = 0;
    for (const r of rings) {
      for (let i = 0; i < r.length - 1; i++) {
        const [ax, az] = r[i];
        const [bx, bz] = r[i + 1];
        if ((az <= z && bz > z) || (bz <= z && az > z)) xs.push(ax + ((z - az) / (bz - az)) * (bx - ax));
      }
    }
    xs.sort((a, c) => a - c);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const c0 = Math.max(0, Math.ceil((xs[j] - x0) / cell - 0.5));
      const c1 = Math.min(w, Math.ceil((xs[j + 1] - x0) / cell - 0.5));
      for (let c = c0; c < c1; c++) {
        mask[row * w + c] = 1;
        usable++;
      }
    }
  }
  return { x0, z0, cell, w, h, mask, usableArea: usable * cell * cell };
}

export function usableAt(r: Raster, x: number, z: number): boolean {
  const c = Math.floor((x - r.x0) / r.cell);
  const row = Math.floor((z - r.z0) / r.cell);
  if (c < 0 || row < 0 || c >= r.w || row >= r.h) return false;
  return r.mask[row * r.w + c] === 1;
}

export const rasterBounds = (r: Raster) => ({
  minX: r.x0,
  minZ: r.z0,
  maxX: r.x0 + r.w * r.cell,
  maxZ: r.z0 + r.h * r.cell,
});
