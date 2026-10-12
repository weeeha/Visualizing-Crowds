export interface Venue { name: string; people: number; source: string; }

// Each figure was confirmed on its source page on 2026-10-11. Venues whose official
// site did not state a capacity (Royal Albert Hall, The O2, Wembley) were left out.
export const VENUES: Venue[] = [
  { name: 'Michigan Stadium', people: 107_601, source: 'https://mgoblue.com/sports/2017/6/16/facilities-michigan-stadium-html' },
  { name: 'Chicago (2020 census)', people: 2_746_388, source: 'https://www.census.gov/quickfacts/fact/table/chicagocityillinois/POP010220' },
  { name: 'New York City (2020 census)', people: 8_804_190, source: 'https://www.census.gov/quickfacts/fact/table/newyorkcitynewyork/POP010220' },
];

const trim = (s: string) => s.replace(/\.0$/, '');

export function formatRatio(r: number, name: string): string {
  if (r >= 0.95 && r < 1.05) return `≈ ${name}`;
  if (r >= 1) return `≈ ${r < 10 ? trim(r.toFixed(1)) : Math.round(r).toLocaleString('en-US')} × ${name}`;
  return `≈ ${Math.round(r * 100)}% of ${name}`;
}

export function compareLines(count: number, venues: Venue[] = VENUES, n = 2): string[] {
  return venues
    .filter((v) => count / v.people >= 0.05)
    .map((v) => ({ v, score: Math.abs(Math.log(count / v.people)) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map(({ v }) => formatRatio(count / v.people, v.name));
}
