import { ESTIMATES, PEOPLE, type EstimateId, type PersonId } from './data/figures';
import type { WealthState } from './render/scene';

export const DEFAULT_STATE: WealthState = {
  mode: 'cash',
  personId: 'musk',
  estimateId: 'cgd-low',
  bodyStyle: 'skeleton',
  camera: 'close',
};

const oneOf = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T =>
  v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export function readHash(hash: string): WealthState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const s: WealthState = {
    mode: oneOf(p.get('pile'), ['cash', 'bodies'] as const, DEFAULT_STATE.mode),
    personId: oneOf<PersonId>(p.get('person'), PEOPLE.map((x) => x.id), DEFAULT_STATE.personId),
    estimateId: oneOf<EstimateId>(p.get('estimate'), ESTIMATES.map((x) => x.id), DEFAULT_STATE.estimateId),
    bodyStyle: oneOf(p.get('figures'), ['skeleton', 'mannequin', 'shroud'] as const, DEFAULT_STATE.bodyStyle),
    camera: oneOf(p.get('view'), ['close', 'whole'] as const, DEFAULT_STATE.camera),
  };
  return normalize(s);
}

/** Bodies only exist for Musk; choosing anyone else means the cash pile. */
export function normalize(s: WealthState): WealthState {
  return s.mode === 'bodies' && s.personId !== 'musk' ? { ...s, mode: 'cash' } : s;
}

export function writeHash(s: WealthState): string {
  const p = new URLSearchParams({ pile: s.mode, person: s.personId, estimate: s.estimateId, figures: s.bodyStyle, view: s.camera });
  return `#${p.toString()}`;
}
