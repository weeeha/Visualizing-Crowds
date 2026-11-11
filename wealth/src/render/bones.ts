// Skeletons for the ranking heaps. Fuller anatomy than the first pile's: a two-part skull with a jaw,
// a curved spine with vertebrae, nine rib pairs, shoulder blades, a winged pelvis, paired forearm and
// shin bones, hands and feet. 1.75 m, feet at y = 0, standing frame (Y up, front +Z, left +X).
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, SphereGeometry, Vector3 } from 'three';
import { POSES } from './models';
import { Parts, v, type V3 } from './geo';

type Pose = (typeof POSES)[number];

// Three more ways to lie, so a slope of a few hundred skeletons repeats less.
const EXTRA_POSES: Pose[] = [
  { upperArm: [[0.7, 0.7, 0], [-0.5, 0.85, 0]], foreArm: [[0.2, 1, 0.1], [-0.6, 0.6, 0.2]], thigh: [[0.3, -1, 0], [-0.05, -1, 0]], shin: [[0.5, -1, 0], [-0.3, -1, 0]], lie: 'back' },
  { upperArm: [[0.2, -0.6, 1], [-0.15, -1, 0.2]], foreArm: [[0.1, 0.2, 1], [-0.1, -0.7, 0.7]], thigh: [[0.1, -0.2, 1], [-0.05, -0.7, 0.7]], shin: [[0, -1, 0.1], [0, -1, -0.4]], lie: 'side' },
  { upperArm: [[0.9, -0.4, 0], [-0.9, -0.4, 0]], foreArm: [[0.6, 0.8, 0], [-0.5, -0.9, 0]], thigh: [[0.35, -1, 0], [-0.35, -1, 0]], shin: [[-0.2, -1, 0], [0.25, -1, 0]], lie: 'front' },
];
export const BONE_POSES: Pose[] = [...POSES, ...EXTRA_POSES];

const B = '#ffffff'; // tinted per instance
const D = '#2a2622'; // sockets
const dir = (d: V3) => new Vector3(...d).normalize();

/** q 2: close-up detail. q 1: the same build with fewer pieces, for the middle distance. */
export function skeleton(pose: Pose, q: 1 | 2): BufferGeometry {
  const hi = q === 2;
  const P = hi ? new Parts(5, 7, 5) : new Parts(3, 5, 3);

  // Skull: braincase, face, sockets, jaw
  P.ball(v(0, 1.655, -0.012), 0.095, B, [0.82, 0.9, 1.04]);
  P.ball(v(0, 1.6, 0.045), 0.062, B, [0.95, 1, 0.75]);
  for (const sx of [1, -1]) P.ball(v(0.032 * sx, 1.632, 0.08), 0.024, D, [1, 1, 0.55]);
  P.ball(v(0, 1.598, 0.093), 0.012, D, [1, 1.5, 0.6]);
  P.tube([v(-0.06, 1.588, -0.01), v(-0.05, 1.547, 0.04), v(0, 1.536, 0.086), v(0.05, 1.547, 0.04), v(0.06, 1.588, -0.01)], 0.011, B, hi ? 8 : 4, hi ? 4 : 3);
  if (hi) {
    P.bone(v(-0.028, 1.566, 0.089), v(0.028, 1.566, 0.089), 0.008, B, 3); // teeth
    for (const sx of [1, -1]) P.bone(v(0.052 * sx, 1.612, 0.062), v(0.076 * sx, 1.615, 0.002), 0.008, B, 3); // cheekbone
  }

  // Spine: neck leans forward, chest curves back, lower back comes forward again
  const sp = [v(0, 1.56, -0.03), v(0, 1.47, -0.05), v(0, 1.33, -0.088), v(0, 1.15, -0.072), v(0, 1.02, -0.045), v(0, 0.94, -0.065)];
  P.tube(sp, 0.015, B, hi ? 10 : 5, hi ? 5 : 3);
  if (hi) {
    const c = new CatmullRomCurve3(sp);
    for (let i = 0; i < 13; i++) P.ball(c.getPoint((i + 0.5) / 13), 0.024, B, [1.15, 0.42, 1.15]);
  }

  // Ribs: nine pairs at close range, five further out. The lowest two float free at the front.
  const widths = hi ? [0.075, 0.105, 0.125, 0.138, 0.145, 0.148, 0.145, 0.135, 0.12] : [0.095, 0.13, 0.146, 0.146, 0.128];
  const step = hi ? 0.038 : 0.068;
  widths.forEach((w, i) => {
    const y = 1.44 - i * step;
    for (const sx of [1, -1]) {
      const pts = [v(0.018 * sx, y, -0.078), v(0.72 * w * sx, y + 0.005, -0.072), v(w * sx, y - 0.025, -0.008), v(0.8 * w * sx, y - 0.06, 0.062)];
      if (i < widths.length - 2) pts.push(v(0.03 * sx, y - 0.085 - 0.006 * i, 0.088));
      P.tube(pts, hi ? 0.0075 : 0.011, B, hi ? 7 : 4, hi ? 4 : 3);
    }
  });
  P.ball(v(0, 1.33, 0.092), 0.02, B, [1, 4.4, 0.5]); // sternum

  // Pelvis: two flared wings, sacrum, pubic arch
  for (const sx of [1, -1]) {
    P.ball(v(0.085 * sx, 0.985, -0.02), 0.085, B, [0.9, 1, 0.28], 0.6 * sx);
    if (hi) P.ball(v(0.06 * sx, 0.865, -0.01), 0.026, B);
  }
  P.ball(v(0, 0.95, -0.062), 0.045, B, [1, 1.3, 0.5]);
  P.tube([v(-0.085, 0.9, 0.015), v(0, 0.876, 0.062), v(0.085, 0.9, 0.015)], 0.012, B, 4, 3);

  ([0, 1] as const).forEach((side) => {
    const sx = side === 0 ? 1 : -1;
    // Collar bone and shoulder blade
    P.bone(v(0.02 * sx, 1.43, 0.07), v(0.17 * sx, 1.44, -0.01), 0.009, B, 3);
    P.ball(v(0.11 * sx, 1.34, -0.098), 0.06, B, [0.9, 1.25, 0.16]);

    // Arm: humerus, then radius and ulna side by side, then the hand
    const shoulder = v(0.185 * sx, 1.41, -0.01);
    const u = dir(pose.upperArm[side]);
    const f = dir(pose.foreArm[side]);
    const elbow = shoulder.clone().addScaledVector(u, 0.3);
    const wrist = elbow.clone().addScaledVector(f, 0.25);
    P.bone(shoulder, elbow, 0.013, B);
    P.ball(shoulder, 0.023, B);
    P.ball(elbow, 0.02, B, [1.25, 1, 1]);
    const across = new Vector3().crossVectors(f, v(0, 0, 1));
    if (across.lengthSq() < 0.01) across.set(1, 0, 0);
    across.normalize();
    for (const k of [1, -1]) P.bone(elbow.clone().addScaledVector(across, 0.012 * k), wrist.clone().addScaledVector(across, 0.014 * k), 0.008, B, 3);
    P.ball(wrist.clone().addScaledVector(f, 0.025), 0.024, B, [1, 1, 0.5]);
    if (hi) {
      const base = wrist.clone().addScaledVector(f, 0.04);
      for (const k of [-0.36, -0.12, 0.12, 0.36]) P.bone(base, base.clone().add(f.clone().addScaledVector(across, k).normalize().multiplyScalar(0.085)), 0.0055, B, 3);
      P.bone(base, base.clone().add(f.clone().addScaledVector(across, 0.95 * sx).normalize().multiplyScalar(0.05)), 0.0055, B, 3);
    }

    // Leg: femur, kneecap, tibia with the thin fibula outside it, then the foot
    const hip = v(0.085 * sx, 0.9, 0);
    const t = dir(pose.thigh[side]);
    const s = dir(pose.shin[side]);
    const knee = hip.clone().addScaledVector(t, 0.44);
    const ankle = knee.clone().addScaledVector(s, 0.41);
    P.bone(hip, knee, 0.017, B);
    P.ball(hip, 0.027, B);
    P.ball(knee, 0.028, B, [1.5, 1, 1]);
    P.bone(knee, ankle, 0.014, B);
    P.bone(knee.clone().add(v(0.024 * sx, -0.02, -0.005)), ankle.clone().add(v(0.02 * sx, 0, -0.005)), 0.007, B, 3);
    P.ball(ankle.clone().add(v(0, -0.03, -0.02)), 0.026, B); // heel
    if (hi) {
      P.ball(knee.clone().add(v(0, 0, 0.03)), 0.016, B);
      const base = ankle.clone().add(v(0, -0.035, 0.02));
      for (const k of [-0.03, -0.015, 0, 0.015, 0.03]) P.bone(base, base.clone().add(v(k * 1.6, -0.01, 0.15 - Math.abs(k) * 0.6)), 0.006, B, 3);
    } else {
      P.ball(ankle.clone().add(v(0, -0.035, 0.08)), 0.03, B, [1, 0.4, 2.4]);
    }
  });
  return P.merge();
}

/** Rotate a standing body so it lies with its thickness along +Y and its lowest point just under y = 0. */
function layDown(g: BufferGeometry, lie: Pose['lie']): BufferGeometry {
  g.translate(0, -0.9, 0);
  if (lie === 'back') g.rotateX(-Math.PI / 2);
  else if (lie === 'front') g.rotateX(Math.PI / 2);
  else g.rotateZ(Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y - 0.04, 0);
  return g;
}

export const lyingSkeletons = (q: 1 | 2): BufferGeometry[] => BONE_POSES.map((p) => layDown(skeleton(p, q), p.lie));

/** Far down a slope a skeleton is a few pixels: a skull, a rib block, crossed arms and a leg bar. About 60 triangles. */
export function farSkeleton(): BufferGeometry {
  const P = new Parts(3, 5, 3);
  const box = (w: number, h: number, d: number, at: V3, rotY = 0) => {
    const g = new BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(...at);
    P.add(g, B);
  };
  P.add(new SphereGeometry(0.1, 5, 3).translate(0, 0.09, -0.78), B);
  box(0.27, 0.13, 0.44, [0, 0.07, -0.42]);
  box(0.95, 0.04, 0.05, [0, 0.05, -0.5], 0.35);
  box(0.11, 0.05, 0.86, [0.07, 0.04, 0.3], 0.12);
  box(0.11, 0.05, 0.86, [-0.09, 0.04, 0.28], -0.2);
  return P.merge();
}
