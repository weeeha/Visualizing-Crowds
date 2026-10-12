import { makeOpenField } from './openField';
import { validatePlace } from './validate';
import type { Place, PlaceId } from './types';
import timesSquare from './data/times-square.json';
import nationalMall from './data/national-mall.json';
import michiganStadium from './data/michigan-stadium.json';
import manhattan from './data/manhattan.json';

const ALL: Place[] = [
  makeOpenField(),
  timesSquare as unknown as Place,
  nationalMall as unknown as Place,
  michiganStadium as unknown as Place,
  manhattan as unknown as Place,
];

/** Places that fail validation are left out of the chip list (spec: error handling). */
export const PLACES: Place[] = ALL.filter((p) => {
  const errs = validatePlace(p);
  if (errs.length) console.error(`Place ${p.id} skipped:`, errs);
  return errs.length === 0;
});

export function getPlace(id: PlaceId): Place {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown place ${id}`);
  return p;
}
