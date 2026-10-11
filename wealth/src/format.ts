export function money(usd: number): string {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(3).replace(/\.?0+$/, '')}T`;
  return `$${(usd / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
}

export const people = (n: number): string => n.toLocaleString('en-US');

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Building storeys at about 3 m each. */
export const storeys = (m: number): number => Math.round(m / 3);
