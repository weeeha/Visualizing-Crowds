// Every number shown on the page comes from this file. No entry without a source URL and date.

export type PersonId = 'musk' | 'bezos' | 'page' | 'zuckerberg' | 'ellison';
export type EstimateId = 'cgd-low' | 'bu-counter' | 'lancet-2030';

export interface Sourced {
  source: string;
  url: string;
  asOf: string; // ISO date
}

export interface Person extends Sourced {
  id: PersonId;
  name: string;
  netWorthUsd: number;
  heightM: number;
}

export interface Estimate extends Sourced {
  id: EstimateId;
  label: string;
  deaths: number;
  status: string;
}

const FORBES_RT = 'https://www.forbes.com/real-time-billionaires/';

export const PEOPLE: Person[] = [
  { id: 'musk', name: 'Elon Musk', netWorthUsd: 1.004e12, heightM: 1.88, source: 'Forbes real-time', url: 'https://www.forbes.com/profile/elon-musk/', asOf: '2026-10-10' },
  { id: 'bezos', name: 'Jeff Bezos', netWorthUsd: 380.8e9, heightM: 1.71, source: 'Forbes real-time', url: FORBES_RT, asOf: '2026-10-11' },
  { id: 'page', name: 'Larry Page', netWorthUsd: 287.9e9, heightM: 1.8, source: 'Forbes real-time', url: FORBES_RT, asOf: '2026-10-11' },
  { id: 'zuckerberg', name: 'Mark Zuckerberg', netWorthUsd: 246.5e9, heightM: 1.71, source: 'Forbes real-time', url: FORBES_RT, asOf: '2026-10-11' },
  { id: 'ellison', name: 'Larry Ellison', netWorthUsd: 183.5e9, heightM: 1.78, source: 'Forbes real-time', url: FORBES_RT, asOf: '2026-10-11' },
];

export const ESTIMATES: Estimate[] = [
  {
    id: 'cgd-low',
    label: 'CGD, low end',
    deaths: 500_000,
    status: 'Modeled estimate to date. CGD range: 500,000 to 1,000,000.',
    source: 'Center for Global Development',
    url: 'https://www.cgdev.org/blog/update-lives-lost-usaid-cuts',
    asOf: '2026-10-09',
  },
  {
    id: 'bu-counter',
    label: 'BU Impact Counter',
    deaths: 750_000,
    status: 'Modeled, not peer-reviewed. Brooke Nichols, Boston University.',
    source: 'Taipei Times, reporting the Impact Counter',
    url: 'https://www.taipeitimes.com/News/world/archives/2026/01/21/2003850973',
    asOf: '2026-01-21',
  },
  {
    id: 'lancet-2030',
    label: 'Lancet, by 2030',
    deaths: 9_400_000,
    status: 'Peer-reviewed projection to 2030, all aid cuts, not only USAID.',
    source: 'The Lancet / ISGlobal, via CNN',
    url: 'https://www.cnn.com/2026/02/04/world/lancet-usaid-global-aid-cuts-intl',
    asOf: '2026-02-04',
  },
];

export const LOWER_ESTIMATES_NOTE: Sourced = {
  source: 'WBUR Here & Now',
  url: 'https://www.wbur.org/hereandnow/2026/07/21/usaid-cuts',
  asOf: '2026-07-21',
};

export const BLOOMBERG_MUSK: Sourced & { netWorthUsd: number } = {
  netWorthUsd: 914e9,
  source: 'Bloomberg Billionaires Index',
  url: 'https://en.wikipedia.org/wiki/Bloomberg_Billionaires_Index',
  asOf: '2026-10-02',
};

export const personById = (id: PersonId): Person => PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];
export const estimateById = (id: EstimateId): Estimate => ESTIMATES.find((e) => e.id === id) ?? ESTIMATES[0];
