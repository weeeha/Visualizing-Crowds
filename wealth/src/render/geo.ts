// Small builder for vertex-coloured procedural models. Every part ends up non-indexed with
// position, normal and colour, so the parts merge into one geometry.
import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];
export const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const UP = new Vector3(0, 1, 0);

export class Parts {
  private list: BufferGeometry[] = [];

  /** rad: radial segments of limbs. sw, sh: sphere segments. */
  constructor(private rad = 6, private sw = 8, private sh = 6) {}

  add(g: BufferGeometry, hex: string): this {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    if (!n.getAttribute('normal')) n.computeVertexNormals();
    const c = new Color(hex);
    const count = n.getAttribute('position').count;
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) a.set([c.r, c.g, c.b], i * 3);
    n.setAttribute('color', new BufferAttribute(a, 3));
    this.list.push(n);
    return this;
  }

  /** Round-ended rod between two points. */
  bone(a: Vector3, b: Vector3, r: number, hex: string, rad = this.rad): this {
    const d = b.clone().sub(a);
    const len = d.length();
    const g = new CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 1, rad);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()));
    const m = a.clone().add(b).multiplyScalar(0.5);
    g.translate(m.x, m.y, m.z);
    return this.add(g, hex);
  }

  ball(at: Vector3, r: number, hex: string, scale: V3 = [1, 1, 1], rotY = 0, rotX = 0): this {
    const g = new SphereGeometry(r, this.sw, this.sh);
    g.scale(...scale);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    g.translate(at.x, at.y, at.z);
    return this.add(g, hex);
  }

  tube(pts: Vector3[], r: number, hex: string, segs = 6, rad = 4): this {
    return this.add(new TubeGeometry(new CatmullRomCurve3(pts), segs, r, rad, false), hex);
  }

  /** Capped cylinder or cone frustum, centred at `at`. */
  cyl(at: Vector3, rTop: number, rBot: number, h: number, hex: string, scale: V3 = [1, 1, 1], rotX = 0, rad = 16): this {
    const g = new CylinderGeometry(rTop, rBot, h, rad);
    g.scale(...scale);
    if (rotX) g.rotateX(rotX);
    g.translate(at.x, at.y, at.z);
    return this.add(g, hex);
  }

  /** Smooth body section: elliptical rings along y. Each row is [y, half-width, half-depth]. */
  loft(profile: V3[], hex: string, around = 18): this {
    const pos: number[] = [];
    const ring = ([y, w, d]: V3) =>
      Array.from({ length: around }, (_, k) => {
        const a = (k / around) * Math.PI * 2;
        return [Math.cos(a) * w, y, Math.sin(a) * d] as const;
      });
    for (let j = 1; j < profile.length; j++) {
      const lo = ring(profile[j - 1]);
      const hi = ring(profile[j]);
      for (let k = 0; k < around; k++) {
        const k2 = (k + 1) % around;
        pos.push(...lo[k], ...hi[k2], ...hi[k], ...lo[k], ...lo[k2], ...hi[k2]);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    const smooth = mergeVertices(g);
    smooth.computeVertexNormals();
    return this.add(smooth, hex);
  }

  merge(): BufferGeometry {
    const g = mergeGeometries(this.list)!;
    this.list.forEach((p) => p.dispose());
    return g;
  }
}
