import { NEUTRAL_SHIRT, SHIRT } from '../../crowd/palettes';

export const MID_VERT = /* glsl */ `
in vec2 aJitter;
in float aShirt;
in vec2 aRand; // lod dissolve, highlight pick
uniform vec3 uLodCenter; // camera position
uniform float uNearStart;
uniform float uNearEnd;
uniform float uMidStart;
uniform float uMidEnd;
uniform float uRadius;
uniform float uPxPerUnit;
uniform vec3 uCamPos;
uniform int uHighlight;
uniform float uOneIn;
uniform vec3 uShirt[${SHIRT.length}];
uniform vec3 uNeutral[${NEUTRAL_SHIRT.length}];
uniform vec3 uAccent;
out vec3 vColor;
out float vFogDist;
void main() {
  vec2 center = position.xz;
  float d = distance(vec3(center.x, 0.0, center.y), uLodCenter);
  float nearFade = smoothstep(uNearStart, uNearEnd, d);
  float midFade = smoothstep(uMidStart, uMidEnd, d);
  if (length(center) >= uRadius || aRand.x >= nearFade || aRand.x < midFade) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec3 world = vec3(center.x + aJitter.x, 0.9, center.y + aJitter.y);
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(0.5 * uPxPerUnit / -mv.z, 1.0, 6.0);
  int shirt = int(aShirt);
  if (uHighlight == 1) vColor = aRand.y < 1.0 / uOneIn ? uAccent : uNeutral[shirt % ${NEUTRAL_SHIRT.length}];
  else vColor = uShirt[shirt];
  vFogDist = distance(world, uCamPos);
}
`;

export const MID_FRAG = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
in vec3 vColor;
in float vFogDist;
out vec4 fragColor;
void main() {
  fragColor = vec4(mix(vColor, uFogColor, smoothstep(uFogNear, uFogFar, vFogDist)), 1.0);
}
`;
