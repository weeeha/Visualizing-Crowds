import '../render/types';
import { hash3, seedFromId } from '../crowd/hash';
import { HASH_GLSL } from '../render/shaders/hash.glsl';

const SIZE = 64;
const SEEDS = [0, 12345, seedFromId('manhattan'), 1073741823];

const VERT = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `#version 300 es
precision highp float; precision highp int;
uniform int uSeed; out vec4 o;
${HASH_GLSL}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  uint h = hash3(c.x - 32, c.y - 32, uSeed);
  o = vec4(float(h & 255u), float((h >> 8u) & 255u), float((h >> 16u) & 255u), float(h >> 24u)) / 255.0;
}`;

function run(): { ok: boolean; mismatches: number; total: number } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('no webgl2');
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, SIZE, SIZE);

  let mismatches = 0, total = 0;
  const px = new Uint8Array(SIZE * SIZE * 4);
  for (const seed of SEEDS) {
    gl.uniform1i(gl.getUniformLocation(prog, 'uSeed'), seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const o = (y * SIZE + x) * 4;
        const gpu = (px[o] | (px[o + 1] << 8) | (px[o + 2] << 16) | (px[o + 3] << 24)) >>> 0;
        if (gpu !== hash3(x - 32, y - 32, seed)) mismatches++;
        total++;
      }
    }
  }
  return { ok: mismatches === 0, mismatches, total };
}

const result = run();
window.__hashParity = result;
document.getElementById('out')!.textContent = JSON.stringify(result);
