// The figure on top of each heap. Each leader is told apart by period dress, headwear, build and stance.
// Faces are left blank, as on the first pile: these are figures in costume, not likenesses.
// All are drawn 1.75 m tall; the list gives no heights and none are assumed.
import { SphereGeometry, type BufferGeometry, Vector3 } from 'three';
import { Parts, v, type V3 } from '../render/geo';

type Hat = 'peaked' | 'softcap' | 'flat' | 'bicorne' | 'homburg' | 'fez' | 'beret' | 'peci' | 'fur' | 'crown';
type Stance = 'plain' | 'behind' | 'coat' | 'hips';

interface Look {
  coat: string;
  /** Where the coat ends: at the hip, mid-thigh, the knee, or the ankle. */
  cut: 'jacket' | 'tunic' | 'long' | 'robe';
  trousers: string;
  boots: string;
  tallBoots?: boolean;
  hat?: Hat;
  hatColor?: string;
  hatBand?: string;
  hair?: string | null;
  /** 1 is average; above 1 is stouter. */
  build?: number;
  stance: Stance;
  belt?: string;
  buttons?: string;
  epaulettes?: string;
  /** White shirt front and dark tie under an open jacket. */
  shirt?: boolean;
  scarf?: string;
  collar?: string;
  wideSleeves?: boolean;
}

const SKIN = '#c2a892';
const BLACK = '#161514';
const GOLD = '#c9a43a';
const LEATHER = '#3f2d1f';

const LOOKS: Record<string, Look> = {
  hitler: { coat: '#7a5c3c', cut: 'tunic', trousers: '#1f1d1b', boots: BLACK, tallBoots: true, hat: 'peaked', hatColor: '#7a5c3c', hatBand: '#3a2a1e', hair: '#2a211b', stance: 'behind', belt: LEATHER, shirt: true },
  mao: { coat: '#6f7a72', cut: 'tunic', trousers: '#6f7a72', boots: '#1c1b1a', hat: 'softcap', hatColor: '#6f7a72', hair: '#1b1a19', build: 1.12, stance: 'plain', buttons: '#565e58' },
  hong: { coat: '#d4a82a', cut: 'robe', trousers: '#8a2a1e', boots: BLACK, hat: 'crown', hatColor: '#c9952b', hatBand: '#a3261c', hair: '#1b1a19', stance: 'plain', belt: '#a3261c', collar: '#a3261c', wideSleeves: true },
  hirohito: { coat: '#5e5c3e', cut: 'tunic', trousers: '#5e5c3e', boots: '#2a1f17', tallBoots: true, hat: 'peaked', hatColor: '#5e5c3e', hatBand: '#8a1f1a', hair: '#1b1a19', stance: 'plain', belt: LEATHER, buttons: GOLD, epaulettes: GOLD },
  stalin: { coat: '#cfc9b8', cut: 'tunic', trousers: '#2b3350', boots: BLACK, tallBoots: true, hat: 'peaked', hatColor: '#cfc9b8', hatBand: '#8a1f1a', hair: '#3a3632', build: 1.06, stance: 'coat', buttons: GOLD, epaulettes: GOLD },
  lenin: { coat: '#26262a', cut: 'jacket', trousers: '#26262a', boots: BLACK, hat: 'flat', hatColor: '#34312d', hair: null, stance: 'plain', shirt: true },
  kim: { coat: '#2c2f36', cut: 'tunic', trousers: '#2c2f36', boots: BLACK, hair: '#151414', build: 1.12, stance: 'behind', buttons: '#1e2025' },
  napoleon: { coat: '#22335c', cut: 'tunic', trousers: '#e6e1d4', boots: BLACK, tallBoots: true, hat: 'bicorne', hatColor: BLACK, hair: '#2a211b', build: 1.06, stance: 'coat', epaulettes: GOLD, buttons: GOLD, collar: '#a3261c' },
  churchill: { coat: '#222226', cut: 'long', trousers: '#2a2a2e', boots: BLACK, hat: 'homburg', hatColor: '#1c1c1e', hair: null, build: 1.26, stance: 'plain', shirt: true },
  polpot: { coat: '#1b1b1c', cut: 'jacket', trousers: '#1b1b1c', boots: '#2a2520', hat: 'softcap', hatColor: '#1b1b1c', hair: '#151414', stance: 'behind', scarf: '#b8473c' },
  gowon: { coat: '#4a5a3a', cut: 'tunic', trousers: '#4a5a3a', boots: BLACK, hat: 'peaked', hatColor: '#4a5a3a', hatBand: '#8a1f1a', hair: '#151414', stance: 'plain', belt: LEATHER, epaulettes: '#8a1f1a', buttons: GOLD },
  talaat: { coat: '#1f1f24', cut: 'long', trousers: '#2a2a2e', boots: BLACK, hat: 'fez', hatColor: '#a3261c', hair: '#1b1a19', build: 1.22, stance: 'plain', shirt: true },
  chiang: { coat: '#6b6a45', cut: 'tunic', trousers: '#6b6a45', boots: '#2a1f17', tallBoots: true, hat: 'peaked', hatColor: '#6b6a45', hair: null, stance: 'behind', belt: LEATHER, buttons: GOLD },
  kambanda: { coat: '#5a5d66', cut: 'jacket', trousers: '#5a5d66', boots: BLACK, hair: '#151414', build: 1.08, stance: 'plain', shirt: true },
  yahya: { coat: '#8a7d58', cut: 'tunic', trousers: '#8a7d58', boots: '#2a1f17', hat: 'peaked', hatColor: '#8a7d58', hatBand: '#7a1f1a', hair: '#2a2622', build: 1.14, stance: 'plain', belt: LEATHER, epaulettes: GOLD, buttons: GOLD },
  saddam: { coat: '#4f5a3c', cut: 'tunic', trousers: '#4f5a3c', boots: BLACK, hat: 'beret', hatColor: '#141414', hair: '#151414', build: 1.08, stance: 'hips', belt: '#2a221a' },
  suharto: { coat: '#8a8060', cut: 'tunic', trousers: '#8a8060', boots: BLACK, hat: 'peci', hatColor: '#141414', hair: '#1b1a19', build: 1.06, stance: 'plain', buttons: GOLD },
  genghis: { coat: '#3d5a78', cut: 'robe', trousers: '#5a4632', boots: '#3a2a1e', hat: 'fur', hatColor: '#5a4632', hatBand: '#8a2a1e', hair: '#151414', build: 1.12, stance: 'hips', belt: '#b8862b', collar: '#5a4632', wideSleeves: true },
};
const PLAIN_LOOK: Look = { coat: '#2c2a27', cut: 'jacket', trousers: '#2c2a27', boots: BLACK, hair: '#2a2622', stance: 'plain' };

// Arm directions in the standing frame; index 0 is the left arm (+X).
const STANCES: Record<Stance, { upper: [V3, V3]; fore: [V3, V3] }> = {
  plain: { upper: [[0.12, -1, 0], [-0.12, -1, 0]], fore: [[0.06, -1, 0.15], [-0.06, -1, 0.15]] },
  behind: { upper: [[0.12, -1, -0.22], [-0.12, -1, -0.22]], fore: [[-0.75, -0.5, -0.42], [0.75, -0.5, -0.42]] },
  // One hand tucked into the coat front, the other behind the back.
  coat: { upper: [[0.12, -1, -0.22], [-0.1, -1, 0.25]], fore: [[-0.75, -0.5, -0.42], [0.85, 0.25, 0.3]] },
  hips: { upper: [[0.6, -0.8, -0.12], [-0.6, -0.8, -0.12]], fore: [[-0.78, -0.57, 0.25], [0.78, -0.57, 0.25]] },
};

const HEM: Record<Look['cut'], number> = { jacket: 0.84, tunic: 0.76, long: 0.42, robe: 0.08 };

function hat(P: Parts, L: Look) {
  const c = L.hatColor ?? BLACK;
  const band = L.hatBand ?? c;
  switch (L.hat) {
    case 'peaked':
      P.cyl(v(0, 1.722, 0), 0.105, 0.104, 0.05, band, [1, 1, 1.08]);
      P.cyl(v(0, 1.772, 0.004), 0.136, 0.108, 0.05, c, [1, 1, 1.08], -0.12);
      P.cyl(v(0, 1.706, 0.108), 0.08, 0.08, 0.01, BLACK, [1.15, 1, 0.8], 0.28);
      break;
    case 'softcap':
      P.cyl(v(0, 1.735, 0), 0.108, 0.103, 0.075, c, [1, 1, 1.08]);
      P.ball(v(0, 1.772, 0), 0.108, c, [1, 0.22, 1.08]);
      P.cyl(v(0, 1.708, 0.105), 0.07, 0.07, 0.01, c, [1.1, 1, 0.7], 0.25);
      break;
    case 'flat':
      P.ball(v(0, 1.738, 0.012), 0.118, c, [1, 0.34, 1.12]);
      P.cyl(v(0, 1.712, 0.112), 0.065, 0.065, 0.01, c, [1.1, 1, 0.6], 0.22);
      break;
    case 'bicorne':
      P.cyl(v(0, 1.72, 0), 0.104, 0.104, 0.04, c, [1, 1, 1.06]);
      P.ball(v(0, 1.775, 0), 0.115, c, [1.95, 0.78, 0.46]);
      break;
    case 'homburg':
      P.cyl(v(0, 1.722, 0), 0.152, 0.152, 0.012, c, [1, 1, 1.1]);
      P.cyl(v(0, 1.78, 0), 0.09, 0.1, 0.11, c, [1, 1, 1.08]);
      P.cyl(v(0, 1.738, 0), 0.102, 0.102, 0.025, '#3a3a3e', [1, 1, 1.08]);
      break;
    case 'fez':
      P.cyl(v(0, 1.782, 0), 0.07, 0.092, 0.12, c);
      P.bone(v(0, 1.842, 0), v(0.06, 1.77, -0.03), 0.006, BLACK, 3);
      break;
    case 'beret':
      P.ball(v(0.018, 1.742, 0), 0.122, c, [1.12, 0.34, 1.05]);
      P.cyl(v(0, 1.722, 0), 0.103, 0.103, 0.022, c, [1, 1, 1.07]);
      break;
    case 'peci':
      P.cyl(v(0, 1.765, 0), 0.094, 0.098, 0.09, c, [0.92, 1, 1.12]);
      break;
    case 'fur':
      P.cyl(v(0, 1.728, 0), 0.122, 0.118, 0.07, c, [1, 1, 1.06]);
      P.cyl(v(0, 1.815, 0), 0.012, 0.098, 0.11, band);
      break;
    case 'crown':
      P.cyl(v(0, 1.75, 0), 0.112, 0.1, 0.08, c, [1, 1, 1.06]);
      P.ball(v(0, 1.812, 0), 0.036, band);
      for (const sx of [1, -1]) P.ball(v(0.118 * sx, 1.74, -0.02), 0.03, c, [0.5, 1.6, 1]);
      break;
  }
}

export function leaderFigure(id: string): BufferGeometry {
  const L = LOOKS[id] ?? PLAIN_LOOK;
  const b = L.build ?? 1;
  const P = new Parts(8, 12, 9);
  // How far the middle pushes out at a given height: nothing at the shoulders, most at the belt.
  const belly = (y: number) => Math.max(0, 1 - Math.abs(y - 1.1) / 0.3);
  const w = (y: number, half: number) => half * (1 + (b - 1) * (0.6 + 0.8 * belly(y)));
  const d = (y: number, half: number) => half * (b + (b - 1) * 2.2 * belly(y));
  const row = (y: number, hw: number, hd: number): V3 => [y, w(y, hw), d(y, hd)];

  // Legs and feet
  for (const sx of [1, -1]) {
    const hip = v(0.095 * sx * Math.min(b, 1.12), 0.9, 0);
    const knee = v(hip.x + 0.02 * sx, 0.47, 0);
    const ankle = v(knee.x + 0.012 * sx, 0.075, 0);
    P.bone(hip, knee, 0.084 * Math.sqrt(b), L.trousers);
    P.bone(knee, ankle, L.tallBoots ? 0.07 : 0.064, L.tallBoots ? L.boots : L.trousers);
    P.ball(v(ankle.x, 0.045, 0.055), 0.058, L.boots, [1, 0.75, 2]);
  }

  // Hips, torso, then the coat's skirt down to its hem
  P.loft([row(0.8, 0.13, 0.09), row(0.9, 0.16, 0.105), row(1.0, 0.158, 0.11)], L.trousers);
  const torso: V3[] = [row(0.98, 0.165, 0.118), row(1.08, 0.162, 0.125), row(1.18, 0.168, 0.122), row(1.28, 0.186, 0.122), row(1.36, 0.2, 0.118), row(1.42, 0.19, 0.105), row(1.46, 0.12, 0.08), row(1.49, 0.06, 0.05)];
  P.loft(torso, L.coat, 22);
  const hem = HEM[L.cut];
  const flare = (1 - hem) * 0.09;
  P.loft([row(hem, 0.176 + flare, 0.13 + flare), row((hem + 1) / 2, 0.172 + flare * 0.5, 0.127 + flare * 0.5), row(1.0, 0.168, 0.122)], L.coat, 22);

  const front = (y: number) => d(y, 0.122);
  if (L.belt) P.loft([row(1.0, 0.172, 0.127), row(1.045, 0.172, 0.13)], L.belt, 22);
  if (L.buttons) for (const y of [1.1, 1.19, 1.28, 1.37]) P.ball(v(0, y, front(y) + 0.003), 0.011, L.buttons);
  if (L.shirt) {
    P.ball(v(0, 1.37, d(1.37, 0.113)), 0.05, '#e9e5da', [0.62, 1.5, 0.16]);
    P.ball(v(0, 1.355, d(1.355, 0.118)), 0.022, '#2b2325', [0.6, 3, 0.2]);
  }
  P.loft([[1.44, 0.076, 0.071], [1.5, 0.066, 0.062]], L.collar ?? L.coat, 16);
  if (L.scarf) {
    P.loft([[1.42, 0.1, 0.09], [1.47, 0.106, 0.096], [1.52, 0.084, 0.078]], L.scarf, 16);
    P.bone(v(0.05, 1.45, 0.1), v(0.07, 1.2, front(1.2) + 0.02), 0.03, L.scarf);
  }

  // Neck and head: ears and a nose, no face
  P.bone(v(0, 1.44, 0), v(0, 1.57, 0.01), 0.055, SKIN);
  P.ball(v(0, 1.64, 0.005), 0.105, SKIN, [0.86, 1.05, 0.95]);
  for (const sx of [1, -1]) P.ball(v(0.088 * sx, 1.635, -0.005), 0.022, SKIN, [0.45, 1, 0.75]);
  P.bone(v(0, 1.648, 0.086), v(0, 1.63, 0.116), 0.013, SKIN, 5);
  if (L.hair) {
    const hair = new SphereGeometry(0.109, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.44);
    hair.scale(0.88, 1.05, 0.97);
    hair.rotateX(L.hat ? -0.5 : -0.28);
    hair.translate(0, 1.645, -0.005);
    P.add(hair, L.hair);
  }
  hat(P, L);

  // Arms
  const shoulderX = 0.186 * (1 + (b - 1) * 0.5);
  const st = STANCES[L.stance];
  ([0, 1] as const).forEach((side) => {
    const sx = side === 0 ? 1 : -1;
    const shoulder = v(shoulderX * sx, 1.385, 0);
    const u = new Vector3(...st.upper[side]).normalize();
    const f = new Vector3(...st.fore[side]).normalize();
    const elbow = shoulder.clone().addScaledVector(u, 0.3);
    const wrist = elbow.clone().addScaledVector(f, 0.27);
    P.bone(shoulder.clone().addScaledVector(u, -0.03), elbow, 0.06 * Math.sqrt(b), L.coat);
    P.bone(elbow, wrist, L.wideSleeves ? 0.068 : 0.05, L.coat);
    P.ball(wrist.clone().addScaledVector(f, 0.035), 0.045, SKIN, [0.8, 1.25, 0.6]);
    if (L.epaulettes) P.ball(v(shoulderX * 0.94 * sx, 1.432, 0), 0.05, L.epaulettes, [1.35, 0.26, 0.9]);
  });

  return P.merge();
}
