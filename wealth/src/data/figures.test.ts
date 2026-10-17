import { describe, expect, it } from 'vitest';
import { BLOOMBERG_MUSK, ESTIMATES, LOWER_ESTIMATES_NOTE, PEOPLE } from './figures';

describe('figures', () => {
  it('every figure carries a source, an https URL and an ISO date', () => {
    for (const f of [...PEOPLE, ...ESTIMATES, LOWER_ESTIMATES_NOTE, BLOOMBERG_MUSK]) {
      expect(f.source.length).toBeGreaterThan(0);
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('the default estimate is the lowest', () => {
    expect(ESTIMATES[0].deaths).toBe(Math.min(...ESTIMATES.map((e) => e.deaths)));
  });
});
