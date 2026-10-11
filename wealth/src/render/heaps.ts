// A heap = hidden core cone + two instanced layers over its surface.
import {
  Color,
  ConeGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { buildShell, hash01 } from '../pile/shell';
import { REPOSE_DEG, type Cone } from '../pile/volume';
import { BUNDLE, bundleGeometry, bundleMaterials, cashCoreMaterial, figureMaterial, lyingMannequins, shrouds, type Detail } from './models';

export type BodyStyle = 'mannequin' | 'shroud';

export interface Heap {
  group: Group;
  instances: number;
  dispose(): void;
}

const PHI = (REPOSE_DEG * Math.PI) / 180;

function core(cone: Cone, depth: number, material: Material): Mesh {
  const h = cone.height - depth / Math.cos(PHI);
  const r = cone.radius - depth / Math.sin(PHI);
  const m = new Mesh(new ConeGeometry(r, h, 160, 1, true), material);
  m.position.y = h / 2;
  m.receiveShadow = true;
  return m;
}

function tints(count: number, palette: string[], seed: number, jitter: number): InstancedBufferAttribute {
  const cols = palette.map((p) => new Color(p));
  const a = new Float32Array(count * 3);
  const c = new Color();
  for (let i = 0; i < count; i++) {
    c.copy(cols[Math.floor(hash01(i, 0, 1, seed) * cols.length)]);
    c.offsetHSL(0, 0, (hash01(i, 0, 2, seed) - 0.5) * jitter);
    c.toArray(a, i * 3);
  }
  return new InstancedBufferAttribute(a, 3);
}

export function cashHeap(cone: Cone): Heap {
  const layers = 2;
  const layerDepth = BUNDLE.y * 1.6;
  const shell = buildShell({
    cone,
    spacing: Math.sqrt(BUNDLE.x * BUNDLE.z) * 0.85,
    layerDepth,
    layers,
    seed: 11,
    variants: 1,
    tilt: 0.28,
    scale: () => 1,
  });
  const geo = bundleGeometry();
  const mats = bundleMaterials();
  const mesh = new InstancedMesh(geo, mats, shell.count);
  mesh.instanceMatrix.array.set(shell.matrices);
  mesh.instanceColor = tints(shell.count, ['#ffffff', '#f2f0e6', '#e6eadc'], 5, 0.12);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();

  const coreMat = cashCoreMaterial();
  const group = new Group();
  group.add(core(cone, layers * layerDepth + 0.01, coreMat), mesh);
  return {
    group,
    instances: shell.count,
    dispose() {
      geo.dispose();
      mats.forEach((m) => {
        (m as MeshStandardMaterial).map?.dispose();
        m.dispose();
      });
      coreMat.map?.dispose();
      coreMat.dispose();
      group.traverse((o) => (o as Mesh).geometry?.dispose());
      mesh.dispose();
    },
  };
}

const CLAY = ['#b9b1a6', '#a89f94', '#c7c0b6', '#9d958b', '#8f877d'];
const CLOTH = ['#e8e2d6', '#ddd6c8', '#d2cab9', '#e3dccd'];

const HI_DETAIL_SLANT_M = 20;

export function bodyHeap(cone: Cone, style: BodyStyle): Heap {
  const layers = 2;
  const layerDepth = 0.26;
  const shell = buildShell({
    cone,
    spacing: 0.68,
    layerDepth,
    layers,
    seed: 23,
    variants: 5,
    tilt: 0.3,
    // More than half of the estimated deaths are children: 55% child-sized, 45% adult-sized.
    scale: (r) => (r < 0.55 ? 0.5 + (r / 0.55) * 0.3 : 0.9 + ((r - 0.55) / 0.45) * 0.15),
  });

  // The camera always orbits the peak, so only bodies near it are ever seen up close.
  // Those get full detail and cast shadows; the rest of the flank uses a light mesh.
  const build = (d: Detail) => (style === 'mannequin' ? lyingMannequins(d) : shrouds(d));
  const geos: Record<Detail, BufferGeometry[]> = { hi: build('hi'), lo: build('lo') };
  const mat = figureMaterial();
  const group = new Group();
  const meshes: InstancedMesh[] = [];
  const m = new Matrix4();
  const detailOf = (i: number): Detail => (shell.slant[i] < HI_DETAIL_SLANT_M ? 'hi' : 'lo');

  for (const d of ['hi', 'lo'] as const) {
    for (let v = 0; v < geos[d].length; v++) {
      const pick = (i: number) => shell.variants[i] === v && detailOf(i) === d;
      let n = 0;
      for (let i = 0; i < shell.count; i++) if (pick(i)) n++;
      if (n === 0) continue;
      const mesh = new InstancedMesh(geos[d][v], mat, n);
      let k = 0;
      for (let i = 0; i < shell.count; i++) {
        if (!pick(i)) continue;
        m.fromArray(shell.matrices, i * 16);
        mesh.setMatrixAt(k++, m);
      }
      mesh.instanceColor = tints(n, style === 'mannequin' ? CLAY : CLOTH, 31 + v + (d === 'lo' ? 7 : 0), 0.08);
      mesh.castShadow = d === 'hi';
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
      group.add(mesh);
    }
  }

  const coreMat = new MeshStandardMaterial({ color: style === 'mannequin' ? '#4a4540' : '#6b655b', roughness: 1 });
  group.add(core(cone, layers * layerDepth + 0.05, coreMat));
  return {
    group,
    instances: shell.count,
    dispose() {
      [...geos.hi, ...geos.lo].forEach((g) => g.dispose());
      meshes.forEach((x) => x.dispose());
      mat.dispose();
      coreMat.dispose();
      group.traverse((o) => (o as Mesh).geometry?.dispose());
    },
  };
}
