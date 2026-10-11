import { pointInRing, ringArea, ringSelfIntersects } from './geometry';
import type { Place, Ring } from './types';

export function validatePlace(p: Place): string[] {
  const errs: string[] = [];
  const checkRing = (r: Ring, label: string) => {
    if (r.length < 4) errs.push(`${label}: fewer than 4 points`);
    const a = r[0], b = r[r.length - 1];
    if (!a || !b || a[0] !== b[0] || a[1] !== b[1]) errs.push(`${label}: not closed`);
    else if (ringSelfIntersects(r)) errs.push(`${label}: self-intersects`);
  };
  checkRing(p.outer, 'outer');
  p.holes.forEach((h, i) => {
    checkRing(h, `hole ${i}`);
    if (!h.every((pt) => pointInRing(pt, p.outer))) errs.push(`hole ${i}: not inside outer`);
  });
  if (p.focus[0] !== 0 || p.focus[1] !== 0) errs.push('focus must be [0, 0] (coordinates are relative to the focus)');
  const area = Math.abs(ringArea(p.outer)) - p.holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);
  if (Math.abs(area - p.areaM2) > area * 0.01) errs.push(`areaM2 ${p.areaM2} differs from computed ${Math.round(area)}`);
  return errs;
}
