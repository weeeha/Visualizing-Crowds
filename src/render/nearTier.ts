import * as THREE from 'three';
import { SHADOW } from '../crowd/palettes';
import { buildNearTile, NEAR_TILE } from '../crowd/tiles';
import { rasterBounds } from '../layout/raster';
import type { Atlas } from './atlas';
import { NEAR_FRAG, NEAR_VERT } from './shaders/near';
import { TileManager, type BuiltTile } from './tileManager';
import { tilesInRange } from './tileSet';
import type { CrowdParams, FrameContext, Layer, PlaceContext } from './types';
import { applyFog, fogUniforms, paletteUniforms } from './uniforms';

export class NearTier implements Layer {
  readonly kind = 'near' as const;
  readonly object: THREE.Group;
  private readonly tiles: TileManager;
  private readonly material: THREE.ShaderMaterial;
  private readonly quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  private ctx: PlaceContext | null = null;
  private crowd: CrowdParams | null = null;

  constructor(atlas: Atlas) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: NEAR_VERT,
      fragmentShader: NEAR_FRAG,
      uniforms: {
        uAtlas: { value: atlas.weights },
        uShadow: { value: atlas.shadow },
        uLodCenter: { value: new THREE.Vector2() },
        uFadeStart: { value: 0 },
        uFadeEnd: { value: 1 },
        uRadius: { value: 0 },
        uOneIn: { value: 50 },
        uHighlight: { value: 0 },
        uShadowColor: { value: new THREE.Color(SHADOW) },
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
    (u.uLodCenter.value as THREE.Vector2).copy(f.lodCenter);
    u.uFadeStart.value = f.lod.nearStart;
    u.uFadeEnd.value = f.lod.nearEnd;
    applyFog(u, f);
    const wanted = tilesInRange({ x: f.lodCenter.x, z: f.lodCenter.y }, f.lod.nearEnd, 0, this.crowd.radius, NEAR_TILE, rasterBounds(this.ctx.raster));
    this.tiles.sync(wanted, f.deadline);
  }

  count(): number {
    return this.tiles.count();
  }

  dispose(): void {
    this.tiles.clear();
    this.material.dispose();
    this.quad.dispose();
  }

  private buildTile(tx: number, tz: number): BuiltTile | null {
    const d = buildNearTile(this.ctx!.raster, this.crowd!.spacing, this.ctx!.seed, tx, tz);
    if (d.count === 0) return null;
    const g = new THREE.InstancedBufferGeometry();
    g.index = this.quad.index;
    g.setAttribute('position', this.quad.getAttribute('position'));
    g.setAttribute('aPerson', new THREE.InstancedBufferAttribute(d.person, 4));
    g.setAttribute('aJitter', new THREE.InstancedBufferAttribute(d.jitter, 2));
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(d.look, 4));
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(d.rand, 2));
    g.instanceCount = d.count;
    // Instanced geometry has no useful bounds of its own; give it the tile's so frustum culling works.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((tx + 0.5) * NEAR_TILE, 1, (tz + 0.5) * NEAR_TILE), NEAR_TILE * 0.75 + 2);
    const mesh = new THREE.Mesh(g, this.material);
    mesh.renderOrder = 10;
    return { obj: mesh, count: d.count };
  }
}
