import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, readHash, writeHash } from './urlState';

describe('url state', () => {
  it('round-trips', () => {
    const s = { ...DEFAULT_STATE, mode: 'bodies' as const, estimateId: 'lancet-2030' as const, bodyStyle: 'shroud' as const };
    expect(readHash(writeHash(s))).toEqual(s);
  });

  it('falls back to defaults on junk', () => {
    expect(readHash('#pile=gold&person=nobody')).toEqual(DEFAULT_STATE);
  });

  it('switches to cash when bodies are asked for someone other than Musk', () => {
    expect(readHash('#pile=bodies&person=bezos').mode).toBe('cash');
  });
});
