import * as THREE from 'three';
import { buildMidTile, MID_TILE } from '../crowd/tiles';
import { rasterBounds } from '../layout/raster';
import { MID_FRAG, MID_VERT } from './shaders/mid';
import { TileManager, type BuiltTile } from './tileManager';
import { groundRadius } from './lod';
import { tilesInRange } from './tileSet';
import type { CrowdParams, FrameContext, Layer, PlaceContext } from './types';
import { applyFog, fogUniforms, paletteUniforms } from './uniforms';

export class MidTier implements Layer {
  readonly kind = 'mid' as const;
  readonly object: THREE.Group;
  private readonly tiles: TileManager;
  private readonly material: THREE.ShaderMaterial;
  private ctx: PlaceContext | null = null;
  private crowd: CrowdParams | null = null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MID_VERT,
      fragmentShader: MID_FRAG,
      uniforms: {
        uLodCenter: { value: new THREE.Vector3() },
        uNearStart: { value: 0 },
        uNearEnd: { value: 1 },
        uMidStart: { value: 2 },
        uMidEnd: { value: 3 },
        uRadius: { value: 0 },
        uPxPerUnit: { value: 1000 },
        uHighlight: { value: 0 },
        uOneIn: { value: 50 },
        ...paletteUniforms(),
        ...fogUniforms(),
      },
    });
    this.tiles = new TileManager((tx, tz) => this.buildTile(tx, tz));
    this.object = this.tiles.group;
  }

  setPlace(ctx: PlaceContext): void {
    this.ctx = ctx;
    this.tiles.clear();
  }

  setCrowd(p: CrowdParams): void {
    if (this.crowd?.spacing !== p.spacing) this.tiles.clear();
    this.crowd = p;
    const u = this.material.uniforms;
    u.uRadius.value = p.radius;
    u.uHighlight.value = p.highlight ? 1 : 0;
    u.uOneIn.value = p.highlight?.oneIn ?? 50;
  }

  frame(f: FrameContext): void {
    if (!this.ctx || !this.crowd) return;
    const u = this.material.uniforms;
    (u.uLodCenter.value as THREE.Vector3).copy(f.lodCenter);
    u.uNearStart.value = f.lod.nearStart;
    u.uNearEnd.value = f.lod.nearEnd;
    u.uMidStart.value = f.lod.midStart;
    u.uMidEnd.value = f.lod.midEnd;
    u.uPxPerUnit.value = f.pxPerUnit;
    applyFog(u, f);
    const h = f.lodCenter.y;
    const wanted = tilesInRange({ x: f.lodCenter.x, z: f.lodCenter.z }, groundRadius(f.lod.midEnd, h), groundRadius(f.lod.nearStart, h), this.crowd.radius, MID_TILE, rasterBounds(this.ctx.raster));
    this.tiles.sync(wanted, f.deadline);
  }

  count(): number {
    return this.tiles.count();
  }

  dispose(): void {
    this.tiles.clear();
    this.material.dispose();
  }

  private buildTile(tx: number, tz: number): BuiltTile | null {
    const d = buildMidTile(this.ctx!.raster, this.crowd!.spacing, this.ctx!.seed, tx, tz);
    if (d.count === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
    g.setAttribute('aJitter', new THREE.BufferAttribute(d.jitter, 2));
    g.setAttribute('aShirt', new THREE.BufferAttribute(d.shirt, 1));
    g.setAttribute('aRand', new THREE.BufferAttribute(d.rand, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((tx + 0.5) * MID_TILE, 1, (tz + 0.5) * MID_TILE), MID_TILE * 0.75 + 2);
    const pts = new THREE.Points(g, this.material);
    pts.renderOrder = 5;
    return { obj: pts, count: d.count };
  }
}
