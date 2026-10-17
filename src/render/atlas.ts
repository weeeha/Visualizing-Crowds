import * as THREE from 'three';
import { POSE_COUNT } from '../crowd/person';

export const ATLAS_W = 256;
export const ATLAS_H = 256;
export const CELL_W = 64;
export const CELL_H = 160;
export const PX_PER_M = 80; // 160 px cell = 2.0 m

// Pure mask colors; the shader replaces each with the person's palette color.
const MASK = { shirt: '#ff0000', pants: '#00ff00', skin: '#0000ff', hair: '#000000' };
const H = 1.75; // reference figure height in meters (scaled per person in the shader)

export interface Atlas { weights: THREE.DataTexture; shadow: THREE.DataTexture; }

type Ctx = CanvasRenderingContext2D;
const m = (v: number) => v * PX_PER_M;
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}
function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Style B "simple human": hair, arms, two legs. Pose 0 arms down, 1 phone up, 2 wide stance, 3 hands in pockets. */
export function drawFigure(ctx: Ctx, pose: number, ox: number): void {
  const fx = ox + CELL_W / 2;
  const fy = ATLAS_H - 4; // feet line
  const top = fy - m(H - 0.22); // shoulders
  const stance = pose === 2 ? 0.05 : 0;

  ctx.fillStyle = MASK.pants;
  rr(ctx, fx - m(0.15 + stance), fy - m(0.86), m(0.13), m(0.86), m(0.03));
  rr(ctx, fx + m(0.02 + stance), fy - m(0.86), m(0.13), m(0.86), m(0.03));

  ctx.fillStyle = MASK.shirt;
  rr(ctx, fx - m(0.21), top, m(0.42), m(H - 1.04), m(0.07));

  const armDown = (x: number) => {
    ctx.fillStyle = MASK.shirt;
    rr(ctx, x, top + m(0.03), m(0.09), m(0.58), m(0.04));
    ctx.fillStyle = MASK.skin;
    circle(ctx, x + m(0.045), top + m(0.64), m(0.045));
  };
  if (pose === 0 || pose === 2) {
    armDown(fx - m(0.29));
    armDown(fx + m(0.2));
  } else if (pose === 1) {
    ctx.fillStyle = MASK.shirt;
    rr(ctx, fx - m(0.29), top - m(0.34), m(0.09), m(0.4), m(0.04));
    ctx.fillStyle = MASK.skin;
    circle(ctx, fx - m(0.245), top - m(0.36), m(0.045));
    armDown(fx + m(0.2));
  } else {
    ctx.fillStyle = MASK.shirt;
    rr(ctx, fx - m(0.28), top + m(0.03), m(0.09), m(0.45), m(0.04));
    rr(ctx, fx + m(0.19), top + m(0.03), m(0.09), m(0.45), m(0.04));
  }

  const hy = fy - m(H - 0.12);
  ctx.fillStyle = MASK.skin;
  circle(ctx, fx, hy, m(0.11));
  ctx.fillStyle = MASK.hair;
  ctx.beginPath();
  ctx.arc(fx, hy, m(0.115), Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
}

function drawShadow(ctx: Ctx, ox: number): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(ox + CELL_W / 2 + m(0.06), ATLAS_H - 4, m(0.3), m(0.07), 0, 0, Math.PI * 2);
  ctx.fill();
}

function canvas(): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

function texture(data: Uint8Array, format: THREE.PixelFormat): THREE.DataTexture {
  const t = new THREE.DataTexture(data, ATLAS_W, ATLAS_H, format, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

export function createAtlas(): Atlas {
  const [, fig] = canvas();
  const [, sh] = canvas();
  for (let pose = 0; pose < POSE_COUNT; pose++) {
    drawFigure(fig, pose, pose * CELL_W);
    drawShadow(sh, pose * CELL_W);
  }
  const f = fig.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
  const s = sh.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
  const weights = new Uint8Array(ATLAS_W * ATLAS_H * 4);
  const shadow = new Uint8Array(ATLAS_W * ATLAS_H);
  for (let row = 0; row < ATLAS_H; row++) {
    const src = (ATLAS_H - 1 - row) * ATLAS_W; // flip: data row 0 is the bottom (v = 0)
    for (let x = 0; x < ATLAS_W; x++) {
      const i = (src + x) * 4, o = row * ATLAS_W + x;
      const a = f[i + 3] / 255, r = f[i] / 255, g = f[i + 1] / 255, b = f[i + 2] / 255;
      weights[o * 4] = Math.round(r * a * 255);
      weights[o * 4 + 1] = Math.round(g * a * 255);
      weights[o * 4 + 2] = Math.round(b * a * 255);
      weights[o * 4 + 3] = Math.round(Math.max(0, 1 - (r + g + b)) * a * 255);
      shadow[o] = s[i + 3];
    }
  }
  return { weights: texture(weights, THREE.RGBAFormat), shadow: texture(shadow, THREE.RedFormat) };
}
