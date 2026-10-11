import { describe, expect, it } from 'vitest';
import { bodyCone, cashCone } from './volume';

// Fixtures from the spec's volume table.
describe('heap dimensions', () => {
  it.each([
    ['cash $1.004T', cashCone(1.004e12), 24.9, 17.5],
    ['cash $914B', cashCone(914e9), 24.2, 16.9],
    ['bodies 500k', bodyCone(500_000), 40.9, 28.6],
    ['bodies 750k', bodyCone(750_000), 46.8, 32.7],
    ['bodies 9.4M', bodyCone(9_400_000), 108.6, 76.1],
  ])('%s', (_name, cone, r, h) => {
    expect(Math.abs(cone.radius - r)).toBeLessThan(0.1);
    expect(Math.abs(cone.height - h)).toBeLessThan(0.1);
  });

  it('bodies heap at the default estimate is taller than the cash heap', () => {
    expect(bodyCone(500_000).height / cashCone(1.004e12).height).toBeGreaterThan(1.6);
  });
});
