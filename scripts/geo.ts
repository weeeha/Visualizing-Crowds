export type LonLat = [number, number];
type Pt = [number, number];

/** Equirectangular projection to local meters around the focus; +x east, +z south. */
export function projector(focusLat: number, focusLon: number) {
  const kx = 111320 * Math.cos((focusLat * Math.PI) / 180);
  const kz = 110540;
  return ([lon, lat]: LonLat): Pt => [(lon - focusLon) * kx, -(lat - focusLat) * kz];
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

function dpOpen(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts.slice();
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  const left = dpOpen(pts.slice(0, idx + 1), tol);
  return left.slice(0, -1).concat(dpOpen(pts.slice(idx), tol));
}

/** Douglas-Peucker for a closed ring: split at the point farthest from the start. */
export function simplify(ring: Pt[], tol: number): Pt[] {
  const open = ring.slice(0, -1);
  let far = 0, farD = -1;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > farD) { farD = d; far = i; }
  }
  const a = dpOpen(open.slice(0, far + 1), tol);
  const b = dpOpen(open.slice(far).concat([open[0]]), tol);
  return a.slice(0, -1).concat(b);
}
