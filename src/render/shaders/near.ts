import { HAIR, NEUTRAL_PANTS, NEUTRAL_SHIRT, PANTS, SHIRT, SKIN } from '../../crowd/palettes';
import { CELL_H, ATLAS_H, CELL_W, ATLAS_W, PX_PER_M } from '../atlas';

const QUAD_W = CELL_W / PX_PER_M; // 0.8 m
const QUAD_H = CELL_H / PX_PER_M; // 2.0 m
const FOOT = 4 / PX_PER_M; // feet sit 4 px above the cell bottom

export const NEAR_VERT = /* glsl */ `
in vec4 aPerson; // center x, center z, height (m), pose
in vec2 aJitter;
in vec4 aLook;   // shirt, pants, skin, hair
in vec2 aRand;   // lod dissolve, highlight pick
uniform vec3 uCamPos;
uniform vec3 uLodCenter; // camera position
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uRadius;
uniform float uOneIn;
uniform int uHighlight;
out vec2 vUv;
out float vFogDist;
flat out ivec4 vLook;
flat out int vPick;
void main() {
  vec2 center = aPerson.xy;
  float fade = smoothstep(uFadeStart, uFadeEnd, distance(vec3(center.x, 0.0, center.y), uLodCenter));
  if (length(center) >= uRadius || aRand.x < fade) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 base = vec3(center.x + aJitter.x, 0.0, center.y + aJitter.y);
  vec2 toCam = normalize(uCamPos.xz - base.xz);
  vec3 right = vec3(toCam.y, 0.0, -toCam.x);
  float s = aPerson.z / 1.75;
  vec3 world = base + right * (position.x * ${QUAD_W.toFixed(4)} * s)
             + vec3(0.0, (position.y * ${QUAD_H.toFixed(4)} - ${FOOT.toFixed(4)}) * s, 0.0);
  vUv = vec2((aPerson.w + position.x + 0.5) * ${(CELL_W / ATLAS_W).toFixed(4)}, position.y * ${(CELL_H / ATLAS_H).toFixed(4)});
  vLook = ivec4(aLook);
  vPick = (uHighlight == 1 && aRand.y < 1.0 / uOneIn) ? 1 : 0;
  vFogDist = distance(world, uCamPos);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const NEAR_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform sampler2D uShadow;
uniform vec3 uShirt[${SHIRT.length}];
uniform vec3 uPants[${PANTS.length}];
uniform vec3 uSkin[${SKIN.length}];
uniform vec3 uHair[${HAIR.length}];
uniform vec3 uNeutral[${NEUTRAL_SHIRT.length}];
uniform vec3 uNeutralPants[${NEUTRAL_PANTS.length}];
uniform vec3 uAccent;
uniform int uHighlight;
uniform vec3 uShadowColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
in vec2 vUv;
in float vFogDist;
flat in ivec4 vLook;
flat in int vPick;
out vec4 fragColor;
void main() {
  vec4 w = texture(uAtlas, vUv);
  float cov = w.r + w.g + w.b + w.a;
  vec3 col;
  if (cov >= 0.5) {
    vec3 shirt = uShirt[vLook.x];
    vec3 pants = uPants[vLook.y];
    if (uHighlight == 1) {
      shirt = vPick == 1 ? uAccent : uNeutral[vLook.x % ${NEUTRAL_SHIRT.length}];
      pants = uNeutralPants[vLook.y % ${NEUTRAL_PANTS.length}];
    }
    col = (shirt * w.r + pants * w.g + uSkin[vLook.z] * w.b + uHair[vLook.w] * w.a) / cov;
  } else if (texture(uShadow, vUv).r >= 0.5) {
    col = uShadowColor;
  } else {
    discard;
  }
  fragColor = vec4(mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDist)), 1.0);
}
`;
