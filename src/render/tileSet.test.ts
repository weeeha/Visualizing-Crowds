import { describe, expect, it } from 'vitest';
import { parseTileKey, tileKey, tilesInRange } from './tileSet';

const bounds = { minX: -1000, minZ: -1000, maxX: 1000, maxZ: 1000 };

describe('tilesInRange', () => {
  it('returns tiles around the center, nearest first', () => {
    const keys = tilesInRange({ x: 0, z: 0 }, 60, 0, 1e9, 50, bounds);
    expect(keys[0]).toMatch(/^(-1|0),(-1|0)$/);
    expect(keys).toContain('0,0');
    expect(keys).toContain('-2,0'); // nearest edge 50 m away
    expect(keys).not.toContain('-2,-2'); // nearest corner 70.7 m away
    expect(keys).not.toContain('2,0');
  });

  it('excludes tiles fully inside the inner radius', () => {
    const keys = tilesInRange({ x: 0, z: 0 }, 300, 200, 1e9, 50, bounds);
    expect(keys).not.toContain('0,0');
    expect(keys).toContain('5,0');
  });

  it('excludes tiles beyond the crowd radius', () => {
    const keys = tilesInRange({ x: 0, z: 0 }, 300, 0, 40, 50, bounds);
    expect(keys.every((k) => parseTileKey(k).every((t) => t >= -1 && t <= 0))).toBe(true);
  });

  it('round-trips keys', () => expect(parseTileKey(tileKey(-3, 7))).toEqual([-3, 7]));
});
