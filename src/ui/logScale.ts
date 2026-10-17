import { clampCount, COUNT_MAX, COUNT_MIN } from '../state';

const SPAN = Math.log(COUNT_MAX / COUNT_MIN);

export const countToPos = (count: number): number =>
  Math.min(1, Math.max(0, Math.log(clampCount(count) / COUNT_MIN) / SPAN));

/** Two significant digits above 100 so slider values read as round numbers. */
export function niceRound(n: number): number {
  if (n < 100) return Math.round(n);
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

export const posToCount = (pos: number): number =>
  clampCount(niceRound(COUNT_MIN * Math.exp(Math.min(1, Math.max(0, pos)) * SPAN)));

export function parseCount(text: string): number | null {
  const m = text.trim().replace(/,/g, '').match(/^(-?\d*\.?\d+(?:e\d+)?)\s*([kKmM]?)$/);
  if (!m) return null;
  const mult = { '': 1, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2] as '' | 'k' | 'K' | 'm' | 'M'];
  const n = Number(m[1]) * mult;
  return Number.isFinite(n) ? clampCount(n) : null;
}

export const formatCount = (n: number): string => Math.round(n).toLocaleString('en-US');

export function shortCount(n: number): string {
  if (n >= 1e6) return `${n / 1e6}M`;
  if (n >= 1e3) return `${n / 1e3}k`;
  return String(n);
}
