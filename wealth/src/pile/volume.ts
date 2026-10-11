// Turns a count of objects into the cone they settle into. Pure, no Three.js.

export const REPOSE_DEG = 35;
const TAN = Math.tan((REPOSE_DEG * Math.PI) / 180);

/** $100 bill: 156 × 66 × 0.11 mm. */
export const BILL_M3 = 0.156 * 0.066 * 0.00011;
export const BILL_USD = 100;
/** Piled body, averaged over adults and children (see spec, "Volume math"). */
export const BODY_M3 = 0.1;

export interface Cone {
  volume: number; // m³
  radius: number; // m, base
  height: number; // m
  slant: number; // m, apex to base edge
  area: number; // m², lateral surface
}

export function coneFromVolume(volume: number): Cone {
  const radius = Math.cbrt((3 * volume) / (Math.PI * TAN));
  const height = radius * TAN;
  const slant = Math.hypot(radius, height);
  return { volume, radius, height, slant, area: Math.PI * radius * slant };
}

export const cashCone = (usd: number): Cone => coneFromVolume((usd / BILL_USD) * BILL_M3);
export const bodyCone = (deaths: number): Cone => coneFromVolume(deaths * BODY_M3);
