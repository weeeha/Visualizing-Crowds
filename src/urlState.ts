import { PLACE_IDS, type PlaceId } from './places/types';
import { clampCount, DENSITIES, type Density, type SceneState } from './state';

export function parseUrlState(search: string, fallback: SceneState): SceneState {
  const q = new URLSearchParams(search);
  const place = q.get('place') ?? '';
  const count = Number(q.get('count'));
  const density = Number(q.get('density'));
  const hl = Number(q.get('hl'));
  return {
    ...fallback,
    placeId: (PLACE_IDS as readonly string[]).includes(place) ? (place as PlaceId) : fallback.placeId,
    count: Number.isFinite(count) && count > 0 ? clampCount(count) : fallback.count,
    density: (DENSITIES as readonly number[]).includes(density) ? (density as Density) : fallback.density,
    highlight: Number.isFinite(hl) && hl >= 2 ? { oneIn: Math.round(hl) } : fallback.highlight,
  };
}

export function serializeUrlState(s: SceneState): string {
  const q = new URLSearchParams({ place: s.placeId, count: String(s.count), density: String(s.density) });
  if (s.highlight) q.set('hl', String(s.highlight.oneIn));
  return q.toString();
}
