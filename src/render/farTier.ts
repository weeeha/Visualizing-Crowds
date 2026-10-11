import * as THREE from 'three';
import { GROUND } from '../crowd/palettes';
import { FAR_FRAG, FAR_VERT } from './shaders/far';
import type { CrowdParams, FrameContext, Layer, PlaceContext } from './types';
import { applyFog, fogUniforms, paletteUniforms } from './uniforms';

export class FarTier implements Layer {
  readonly kind = 'far' as const;
  readonly object = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh | null = null;
  private mask: THREE.DataTexture | null = null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FAR_VERT,
      fragmentShader: FAR_FRAG,
      depthWrite: false,
      uniforms: {
        uMask: { value: null },
        uMaskOrigin: { value: new THREE.Vector2() },
        uMaskCell: { value: 1 },
        uMaskRes: { value: new THREE.Vector2(1, 1) },
        uSpacing: { value: 1 },
        uRadius: { value: 0 },
        uSeed: { value: 0 },
        uLodCenter: { value: new THREE.Vector3() },
        uFadeStart: { value: 0 },
        uFadeEnd: { value: 1 },
        uHighlight: { value: 0 },
        uOneIn: { value: 50 },
        uGround: { value: new THREE.Color(GROUND) },
        ...paletteUniforms(),
        ...fogUniforms(),
      },
    });
  }

  setPlace(ctx: PlaceContext): void {
    this.disposeMesh();
    const r = ctx.raster;
    const mask = new THREE.DataTexture(r.mask, r.w, r.h, THREE.RedFormat, THREE.UnsignedByteType);
    mask.minFilter = THREE.NearestFilter;
    mask.magFilter = THREE.NearestFilter;
    mask.generateMipmaps = false;
    mask.unpackAlignment = 1;
    mask.needsUpdate = true;
    this.mask = mask;
    const u = this.material.uniforms;
    u.uMask.value = mask;
    (u.uMaskOrigin.value as THREE.Vector2).set(r.x0, r.z0);
    u.uMaskCell.value = r.cell;
    (u.uMaskRes.value as THREE.Vector2).set(r.w, r.h);
    u.uSeed.value = ctx.seed;
    const w = r.w * r.cell, h = r.h * r.cell;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), this.material);
    this.mesh.position.set(r.x0 + w / 2, 0.01, r.z0 + h / 2);
    this.mesh.renderOrder = 1;
    this.object.add(this.mesh);
  }

  setCrowd(p: CrowdParams): void {
    const u = this.material.uniforms;
    u.uSpacing.value = p.spacing;
    u.uRadius.value = p.radius;
    u.uHighlight.value = p.highlight ? 1 : 0;
    u.uOneIn.value = p.highlight?.oneIn ?? 50;
  }

  frame(f: FrameContext): void {
    const u = this.material.uniforms;
    (u.uLodCenter.value as THREE.Vector3).copy(f.lodCenter);
    u.uFadeStart.value = f.lod.midStart;
    u.uFadeEnd.value = f.lod.midEnd;
    applyFog(u, f);
  }

  count(): number {
    return 0;
  }

  dispose(): void {
    this.disposeMesh();
    this.material.dispose();
  }

  private disposeMesh(): void {
    if (this.mesh) {
      this.object.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    this.mask?.dispose();
    this.mask = null;
  }
}
