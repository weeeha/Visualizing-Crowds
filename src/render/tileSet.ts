export const tileKey = (tx: number, tz: number): string => `${tx},${tz}`;
export const parseTileKey = (k: string): [number, number] => {
  const [a, b] = k.split(',').map(Number);
  return [a, b];
};

const nearDist = (px: number, pz: number, x0: number, z0: number, x1: number, z1: number) =>
  Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));
const farDist = (px: number, pz: number, x0: number, z0: number, x1: number, z1: number) =>
  Math.hypot(Math.max(Math.abs(px - x0), Math.abs(px - x1)), Math.max(Math.abs(pz - z0), Math.abs(pz - z1)));

/** Tiles touching the annulus [innerR, outerR] around center, inside the crowd disk and bounds. Nearest first. */
export function tilesInRange(
  center: { x: number; z: number },
  outerR: number,
  innerR: number,
  crowdR: number,
  size: number,
  b: { minX: number; minZ: number; maxX: number; maxZ: number },
): string[] {
  const x0 = Math.max(center.x - outerR, b.minX, -crowdR), x1 = Math.min(center.x + outerR, b.maxX, crowdR);
  const z0 = Math.max(center.z - outerR, b.minZ, -crowdR), z1 = Math.min(center.z + outerR, b.maxZ, crowdR);
  if (x0 >= x1 || z0 >= z1) return [];
  const out: { k: string; d: number }[] = [];
  for (let tx = Math.floor(x0 / size); tx * size < x1; tx++) {
    for (let tz = Math.floor(z0 / size); tz * size < z1; tz++) {
      const rx0 = tx * size, rz0 = tz * size, rx1 = rx0 + size, rz1 = rz0 + size;
      const d = nearDist(center.x, center.z, rx0, rz0, rx1, rz1);
      if (d > outerR) continue;
      if (farDist(center.x, center.z, rx0, rz0, rx1, rz1) < innerR) continue;
      if (nearDist(0, 0, rx0, rz0, rx1, rz1) >= crowdR) continue;
      out.push({ k: tileKey(tx, tz), d });
    }
  }
  return out.sort((a, c) => a.d - c.d).map((o) => o.k);
}
