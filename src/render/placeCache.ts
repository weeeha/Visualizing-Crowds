import { getPlace } from '../places/index';
import type { PlaceId } from '../places/types';
import { rasterize } from '../layout/raster';
import { buildCountProfile, type CountProfile } from '../layout/fillRadius';
import { seedFromId } from '../crowd/hash';
import type { Density } from '../state';
import type { PlaceContext } from './types';

const contexts = new Map<PlaceId, PlaceContext>();
const profiles = new Map<string, CountProfile>();

export function placeContext(id: PlaceId): PlaceContext {
  let ctx = contexts.get(id);
  if (!ctx) {
    const place = getPlace(id);
    ctx = { place, raster: rasterize(place), seed: seedFromId(id) };
    contexts.set(id, ctx);
  }
  return ctx;
}

export function countProfile(id: PlaceId, density: Density): CountProfile {
  const key = `${id}@${density}`;
  let p = profiles.get(key);
  if (!p) {
    p = buildCountProfile(placeContext(id).raster, density);
    profiles.set(key, p);
  }
  return p;
}
