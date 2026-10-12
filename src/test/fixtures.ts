import { ringArea } from '../places/geometry';
import type { Place, Ring } from '../places/types';

const sq = (h: number, cx = 0, cz = 0): Ring => [
  [cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h], [cx - h, cz - h],
];

/** Square place of side 2*half centered on the focus, optional centered square hole of side 2*hole. */
export function squarePlace(half: number, hole?: number): Place {
  const outer = sq(half);
  const holes = hole ? [sq(hole)] : [];
  const areaM2 = Math.abs(ringArea(outer)) - holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);
  return { id: 'open-field', name: 'Test square', outer, holes, focus: [0, 0], areaM2, source: 'test' };
}
