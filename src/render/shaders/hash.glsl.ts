/** GLSL ES 3.0 mirror of src/crowd/hash.ts. Unsigned multiply wraps mod 2^32 exactly like Math.imul. */
export const HASH_GLSL = /* glsl */ `
uint hash3(int x, int z, int seed) {
  uint h = (uint(x) * 0x27d4eb2du) ^ (uint(z) * 0x165667b1u) ^ (uint(seed) * 0x9e3779b1u);
  h = (h ^ (h >> 15u)) * 0x85ebca6bu;
  h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
  h ^= h >> 16u;
  return h;
}
float unitHash(uint h) { return float(h >> 8u) / 16777216.0; }
int pickIndex(uint h, int n) { return int(((h >> 8u) * uint(n)) >> 24u); }
`;
