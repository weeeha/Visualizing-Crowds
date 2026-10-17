import { ringArea } from './geometry';
import type { Place, Ring } from './types';

const RADIUS = 4050; // m; 128-gon area ≈ 51.5 km², room for 50M at 1/m²
const SIDES = 128;

export function makeOpenField(): Place {
  const outer: Ring = [];
  for (let i = 0; i <= SIDES; i++) {
    const a = ((i % SIDES) / SIDES) * Math.PI * 2;
    outer.push([Math.round(RADIUS * Math.cos(a) * 100) / 100, Math.round(RADIUS * Math.sin(a) * 100) / 100]);
  }
  return {
    id: 'open-field',
    name: 'Open field',
    outer,
    holes: [],
    focus: [0, 0],
    areaM2: Math.round(Math.abs(ringArea(outer))),
    source: `Generated ${SIDES}-gon, radius ${RADIUS} m`,
  };
}
