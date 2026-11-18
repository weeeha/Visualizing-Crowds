// Places heaps side by side along x, edge to edge with a gap, centred on the origin. Pure.

export interface Placed {
  id: string;
  x: number;
  radius: number;
}

/** gap: metres between neighbouring base edges. extraGapBefore: ids that get a wider gap before them (the unranked entry). */
export function lineUp(items: { id: string; radius: number }[], gap: number, extraGapBefore: Set<string> = new Set(), extra = 0): Placed[] {
  const out: Placed[] = [];
  let edge = 0;
  for (const it of items) {
    if (out.length) edge += gap + (extraGapBefore.has(it.id) ? extra : 0);
    out.push({ id: it.id, x: edge + it.radius, radius: it.radius });
    edge += it.radius * 2;
  }
  const mid = edge / 2;
  return out.map((p) => ({ ...p, x: p.x - mid }));
}

/** Total length from first left edge to last right edge. */
export const rowLength = (p: Placed[]): number => (p.length ? p[p.length - 1].x + p[p.length - 1].radius - (p[0].x - p[0].radius) : 0);
