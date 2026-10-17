import { describe, expect, it } from 'vitest';
import { parseUrlState, serializeUrlState } from './urlState';
import { DEFAULT_STATE } from './state';

describe('url state', () => {
  it('round-trips', () => {
    const s = { ...DEFAULT_STATE, placeId: 'manhattan' as const, count: 20_000_000, density: 4.5 as const, highlight: { oneIn: 100 } };
    expect(parseUrlState('?' + serializeUrlState(s), DEFAULT_STATE)).toEqual(s);
  });

  it('falls back on junk', () => {
    const s = parseUrlState('?place=mars&count=abc&density=3&hl=1', DEFAULT_STATE);
    expect(s).toEqual(DEFAULT_STATE);
  });

  it('clamps huge counts', () => {
    expect(parseUrlState('?count=999999999999', DEFAULT_STATE).count).toBe(50_000_000);
  });
});
