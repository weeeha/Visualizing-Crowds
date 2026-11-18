// Deaths attributed to leaders, from Nick's ranking list (2026-11-11). Sources are cited as the list gives them;
// the list carries no URLs, so none are invented here.

export interface Leader {
  id: string;
  name: string;
  /** Rank in the source list; null for the unranked entry. */
  rank: number | null;
  /** Low and high estimates in deaths. low is null when the source gives only an upper bound. */
  low: number | null;
  high: number;
  /** How the source states the figure, shown as is. */
  stated: string;
  note: string;
  source: string;
}

const M = 1e6;

export const LEADERS: Leader[] = [
  { id: 'hitler', rank: 1, name: 'Adolf Hitler', low: 36.5 * M, high: 36.5 * M, stated: '~36.5 million', note: "European war deaths. Hitler's invasion of Poland began World War II in Europe. The toll includes 6 million Jews murdered in the Holocaust.", source: 'Postwar, U.S. Holocaust Memorial Museum' },
  { id: 'mao', rank: 2, name: 'Mao Zedong', low: 16.5 * M, high: 45 * M, stated: '16.5–45 million', note: "Excess or premature deaths during the Great Leap Forward, chiefly from famine driven by his government's policies.", source: 'The China Quarterly, Dikötter' },
  { id: 'hong', rank: 3, name: 'Hong Xiuquan', low: 20 * M, high: 20 * M, stated: 'at least 20 million', note: "Deaths in China's Taiping Civil War, fought between the rebellion he led and the Qing dynasty.", source: 'Wiley historical encyclopedia' },
  { id: 'hirohito', rank: 4, name: 'Emperor Hirohito', low: 14 * M, high: 14 * M, stated: 'at least 14 million', note: "Chinese deaths in Japan's war against China. Historians differ on how much control Hirohito exercised over military decisions.", source: 'Historian Rana Mitter, National Museum of Nuclear Science & History' },
  { id: 'stalin', rank: 5, name: 'Joseph Stalin', low: 6 * M, high: 9 * M, stated: '~6–9 million', note: 'Deaths from famine, executions, deportations, and imprisonment, depending on which deaths are included.', source: 'Historian Timothy Snyder' },
  { id: 'lenin', rank: 6, name: 'Vladimir Lenin', low: 5 * M, high: 6 * M, stated: '~5–6 million', note: 'Deaths in the Russian famine of 1921–22. Forced grain requisition worsened a crisis already driven by drought and civil war.', source: 'PBS, Hoover Institution' },
  { id: 'kim', rank: 7, name: 'Kim Il-sung', low: 2.5 * M, high: 3 * M, stated: '~2.5–3 million', note: 'Military and civilian deaths on all sides of the Korean War, which began with his invasion of South Korea.', source: 'Britannica, U.S. Air Force history' },
  { id: 'napoleon', rank: 8, name: 'Napoleon Bonaparte', low: 2 * M, high: 3 * M, stated: '~2–3 million', note: 'Soldiers who died across the Napoleonic Wars. Civilian losses are harder to estimate.', source: 'Cambridge history, Fondation Napoléon' },
  { id: 'churchill', rank: 9, name: 'Winston Churchill', low: 1.5 * M, high: 3 * M, stated: '~1.5–3 million', note: "Deaths in the Bengal famine. His wartime government's relief and shipping decisions were among several factors, alongside crop damage and wartime disruption.", source: 'Cambridge University Press, Cormac Ó Gráda' },
  { id: 'polpot', rank: 10, name: 'Pol Pot', low: 1.7 * M, high: 2 * M, stated: '~1.7–2 million', note: "Deaths under Cambodia's Khmer Rouge from execution, forced labor, starvation, and disease.", source: 'Yale Cambodian Genocide Program, Yale research report' },
  { id: 'gowon', rank: 11, name: 'Yakubu Gowon', low: null, high: 2 * M, stated: 'up to 2 million', note: 'Deaths in the Nigerian Civil War, mostly from starvation and disease in Biafra. The federal blockade under Gowon contributed to the famine.', source: 'Oxford University Press' },
  { id: 'talaat', rank: 12, name: 'Talaat Pasha', low: 664_000, high: 1.2 * M, stated: '664,000–1.2 million', note: 'Deaths in the Armenian genocide. Talaat was a principal organizer of the Ottoman deportations and killings.', source: 'U.S. Holocaust Memorial Museum, Princeton University Press' },
  { id: 'chiang', rank: 13, name: 'Chiang Kai-shek', low: 800_000, high: 800_000, stated: 'more than 800,000', note: 'Deaths in one historical estimate of the 1938 Yellow River flood and its aftermath. His government breached the dikes to slow Japan’s advance.', source: 'Chronicles of Modern China' },
  { id: 'kambanda', rank: 14, name: 'Jean Kambanda', low: 800_000, high: 800_000, stated: '~800,000', note: 'People killed in the Rwandan genocide. Kambanda was prime minister during the genocide and pleaded guilty to his role.', source: 'United Nations, International Criminal Tribunal for Rwanda' },
  { id: 'yahya', rank: 15, name: 'Yahya Khan', low: 560_000, high: 560_000, stated: '~560,000', note: 'Excess deaths among refugees in India alone, according to one study of the 1971 Bangladesh war. Yahya ordered the military crackdown that preceded the mass flight.', source: 'PLOS One, U.S. diplomatic archives' },
  { id: 'saddam', rank: 16, name: 'Saddam Hussein', low: 500_000, high: 500_000, stated: '~500,000', note: 'Killed on both sides of the Iran–Iraq War, which Saddam began by invading Iran in 1980.', source: 'European Union Agency for Asylum' },
  { id: 'suharto', rank: 17, name: 'Suharto', low: 500_000, high: 500_000, stated: '~500,000', note: "Killed in Indonesia's army-led anti-communist massacres of 1965–66 as Suharto rose to power.", source: 'National Security Archive, Historian Geoffrey Robinson' },
  { id: 'genghis', rank: null, name: 'Genghis Khan', low: null, high: 40 * M, stated: '40 million, often cited', note: 'The often-cited 40 million refers to decades of Mongol conquests, including campaigns carried out by his successors after his death in 1227.', source: 'World history text, Metropolitan Museum of Art' },
];

export type Estimate = 'low' | 'high';

/**
 * How many deaths a leader's heap holds under the chosen estimate.
 * Where the source gives only an upper bound ("up to 2 million"), the low view still needs a heap; this uses
 * the stated bound in both views and the sidebar shows the wording, rather than drawing nothing.
 */
export function heapDeaths(l: Leader, e: Estimate): number {
  return e === 'low' ? (l.low ?? l.high) : l.high;
}

export const leaderById = (id: string): Leader => LEADERS.find((l) => l.id === id) ?? LEADERS[0];
