import type { PlaceId } from '../src/places/types';

export interface Recipe {
  id: Exclude<PlaceId, 'open-field'>;
  name: string;
  /** [lat, lon], or the bbox center of the first outer feature. */
  focus: [number, number] | 'centroid';
  outer: string[];
  /** Keep the inner rings of outer features as holes (Manhattan lakes). */
  keepOwnHoles?: boolean;
  /** Add a strip spanning the outer features east-west, at the feature's north-south band padded by padNS. */
  corridor?: { around: string; padNS: number };
  holes: string[];
  /** Douglas-Peucker tolerance in meters. */
  tolerance: number;
}

export const RECIPES: Recipe[] = [
  { id: 'times-square', name: 'Times Square', focus: 'centroid', outer: ['W702540318'], holes: [], tolerance: 0.3 },
  {
    id: 'national-mall',
    name: 'National Mall',
    focus: [38.8898, -77.0115],
    outer: ['W1558212097', 'W1552426509', 'R21050367', 'W1332068226'],
    corridor: { around: 'W990979896', padNS: 45 },
    holes: ['W990979896', 'R359559', 'W24238580'],
    tolerance: 0.5,
  },
  { id: 'michigan-stadium', name: 'Michigan Stadium', focus: 'centroid', outer: ['R1637002'], holes: [], tolerance: 0.3 },
  { id: 'manhattan', name: 'Manhattan', focus: [40.7644, -73.973], outer: ['R3954665'], keepOwnHoles: true, holes: [], tolerance: 4 },
];
