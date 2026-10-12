import { NEUTRAL_SHIRT, SHIRT } from '../../crowd/palettes';
import { STREAM } from '../../crowd/hash';
import { HASH_GLSL } from './hash.glsl';

export const FAR_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const FAR_FRAG = /* glsl */ `
precision highp int;
uniform sampler2D uMask;
uniform vec2 uMaskOrigin;
uniform float uMaskCell;
uniform ivec2 uMaskRes;
uniform float uSpacing;
uniform float uRadius;
uniform int uSeed;
uniform vec3 uLodCenter; // camera position
uniform float uFadeStart;
uniform float uFadeEnd;
uniform vec3 uShirt[${SHIRT.length}];
uniform vec3 uNeutral[${NEUTRAL_SHIRT.length}];
uniform vec3 uAccent;
uniform int uHighlight;
uniform float uOneIn;
uniform vec3 uGround;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCamPos;
in vec3 vWorld;
out vec4 fragColor;
${HASH_GLSL}
const vec3 CROWD_MEAN = vec3(0.47, 0.45, 0.42);

bool usable(vec2 p) {
  ivec2 c = ivec2(floor((p - uMaskOrigin) / uMaskCell));
  if (c.x < 0 || c.y < 0 || c.x >= uMaskRes.x || c.y >= uMaskRes.y) return false;
  return texelFetch(uMask, c, 0).r > 0.0;
}

vec3 personColor(ivec2 ik) {
  int shirt = pickIndex(hash3(ik.x, ik.y, uSeed + ${STREAM.shirt}), ${SHIRT.length});
  if (uHighlight == 1) {
    if (unitHash(hash3(ik.x, ik.y, uSeed + ${STREAM.pick})) < 1.0 / uOneIn) return uAccent;
    return uNeutral[shirt % ${NEUTRAL_SHIRT.length}];
  }
  return uShirt[shirt];
}

// Color of one speckle cell at level l (cell = spacing * 2^l), fading toward the crowd mean as cells grow.
vec3 speckle(vec2 p, float l) {
  ivec2 ik = ivec2(floor(p / (uSpacing * exp2(l))));
  return mix(personColor(ik), CROWD_MEAN, clamp(l / 5.0, 0.0, 0.6));
}

void main() {
  vec2 p = vWorld.xz;
  float foot = max(fwidth(p.x), fwidth(p.y));
  vec3 col;
  float alpha;
  if (foot < uSpacing) {
    // One cell per person: same occupancy rule and dissolve as the CPU tiers.
    ivec2 ik = ivec2(floor(p / uSpacing));
    vec2 center = (vec2(ik) + 0.5) * uSpacing;
    if (length(center) >= uRadius || !usable(center)) discard;
    float fade = smoothstep(uFadeStart, uFadeEnd, distance(vec3(center.x, 0.0, center.y), uLodCenter));
    if (unitHash(hash3(ik.x, ik.y, uSeed + ${STREAM.lod})) >= fade) discard;
    col = personColor(ik);
    alpha = 0.8;
  } else {
    // Many people per pixel: speckle at power-of-two multiples of the spacing (stable while orbiting),
    // blending the two nearest levels so there is no visible line where the cell size doubles.
    if (length(p) >= uRadius || !usable(p)) discard;
    float fade = smoothstep(uFadeStart, uFadeEnd, distance(vec3(p.x, 0.0, p.y), uLodCenter));
    float l = log2(foot / uSpacing);
    float l0 = floor(l);
    col = mix(speckle(p, l0), speckle(p, l0 + 1.0), l - l0);
    alpha = 0.8 * fade;
  }
  vec3 c = mix(uGround, col, alpha);
  fragColor = vec4(mix(c, uFogColor, smoothstep(uFogNear, uFogFar, distance(vWorld, uCamPos))), 1.0);
}
`;
