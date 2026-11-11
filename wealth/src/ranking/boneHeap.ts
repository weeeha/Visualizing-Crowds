// One leader's heap. Real skeletons lie over the slope; a bone-textured cone underneath stands in for
// everything below the surface. Detail is spent where the camera can get: the selected heap is covered
// from peak to ground, the others get skeletons at the peak and round the foot, where the outline shows.
import { Color, ConeGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, type BufferGeometry, type MeshStandardMaterial } from 'three';
import { buildShell, hash01, type Shell } from '../pile/shell';
import { REPOSE_DEG, type Cone } from '../pile/volume';
import { figureMaterial, lyingSkeletons as coarseSkeletons } from '../render/models';
import type { Heap } from '../render/heaps';
import { farSkeleton, lyingSkeletons } from '../render/bones';

const PHI = (REPOSE_DEG * Math.PI) / 180;
const BONE = ['#e6dcc4', '#d9cdb1', '#ece4d0', '#cfc1a2', '#c4b594'];

// Distances down the slope from the peak, m.
const CLOSE_M = 8; // full anatomy
const MID_M = 20; // the same build, fewer pieces
const COARSE_M = 42; // the first pile's light skeleton
const PEAK_ONLY_M = 9; // unselected heaps: skeletons this far down from the peak...
const FOOT_M = 7; // ...and this far up from the ground
const SPACING = 0.68;
const FAR_SPACING = 0.78;
const FAR_SPACING_SPARSE = 1.3; // for the ring round the foot of an unselected heap
const FAR_BUDGET = 90_000; // simple skeletons on the biggest selected heap
const LAYER_DEPTH = 0.26;

export interface BoneHeapOptions {
  selected: boolean;
  /** Textured material for the cone under the skeletons. */
  core: MeshStandardMaterial;
}

/** The top of a cone is itself a cone: same apex, same slope, shorter slant. */
function tip(cone: Cone, slant: number): Cone {
  if (slant >= cone.slant) return cone;
  const radius = slant * Math.cos(PHI);
  return { volume: 0, radius, height: slant * Math.sin(PHI), slant, area: Math.PI * radius * slant };
}

function tints(count: number, seed: number): InstancedBufferAttribute {
  const cols = BONE.map((p) => new Color(p));
  const a = new Float32Array(count * 3);
  const c = new Color();
  for (let i = 0; i < count; i++) {
    c.copy(cols[Math.floor(hash01(i, 0, 1, seed) * cols.length)]);
    c.offsetHSL(0, 0, (hash01(i, 0, 2, seed) - 0.5) * 0.1);
    c.toArray(a, i * 3);
  }
  return new InstancedBufferAttribute(a, 3);
}

// Geometry is shared by every heap and built once.
let shared: { hi: BufferGeometry[]; mid: BufferGeometry[]; lo: BufferGeometry[]; far: BufferGeometry } | null = null;
const geos = () => (shared ??= { hi: lyingSkeletons(2), mid: lyingSkeletons(1), lo: coarseSkeletons('lo'), far: farSkeleton() });

export function boneHeap(cone: Cone, o: BoneHeapOptions): Heap {
  const g = geos();
  const mat = figureMaterial();
  const group = new Group();
  const meshes: InstancedMesh[] = [];
  const m = new Matrix4();
  let drawn = 0;

  function place(geo: BufferGeometry, shell: Shell, pick: (i: number) => boolean, y: number, seed: number, cast: boolean) {
    let n = 0;
    for (let i = 0; i < shell.count; i++) if (pick(i)) n++;
    if (n === 0) return;
    const mesh = new InstancedMesh(geo, mat, n);
    let k = 0;
    for (let i = 0; i < shell.count; i++) {
      if (!pick(i)) continue;
      m.fromArray(shell.matrices, i * 16);
      mesh.setMatrixAt(k++, m);
    }
    mesh.instanceColor = tints(n, seed);
    mesh.position.y = y;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
    group.add(mesh);
    drawn += n;
  }

  // Near the peak: two layers at body spacing, built on the cone's tip only.
  const nearSlant = Math.min(cone.slant, o.selected ? COARSE_M : PEAK_ONLY_M);
  const top = tip(cone, nearSlant);
  const near = buildShell({
    cone: top,
    spacing: SPACING,
    layerDepth: LAYER_DEPTH,
    layers: 2,
    seed: 23,
    variants: 8,
    tilt: 0.32,
    // Mostly adults, about one in five child-sized.
    scale: (r) => (r < 0.2 ? 0.55 + (r / 0.2) * 0.25 : 0.9 + ((r - 0.2) / 0.8) * 0.16),
  });
  const lift = cone.height - top.height;
  const tierOf = (i: number): 'hi' | 'mid' | 'lo' | null => {
    const sl = near.slant[i];
    if (!o.selected) return 'lo';
    if (sl < CLOSE_M) return 'hi';
    if (sl < MID_M) return 'mid';
    return near.layer[i] === 0 ? 'lo' : null;
  };
  for (const tier of ['hi', 'mid', 'lo'] as const) {
    g[tier].forEach((geo, vIdx) =>
      place(geo, near, (i) => tierOf(i) === tier && near.variants[i] % g[tier].length === vIdx, lift, 31 + vIdx + (tier === 'lo' ? 7 : 0), tier !== 'lo'),
    );
  }

  // Below that: one layer of simple skeletons. All the way down on the selected heap, a ring at the foot otherwise.
  if (cone.slant > nearSlant) {
    // Body spacing where the heap is small enough; wider on the giants, so one heap never costs more than the budget.
    const spacing = o.selected ? Math.max(FAR_SPACING, Math.sqrt(cone.area / FAR_BUDGET)) : FAR_SPACING_SPARSE;
    const far = buildShell({ cone, spacing, layerDepth: LAYER_DEPTH, layers: 1, seed: 57, variants: 1, tilt: 0.35, scale: (r) => 0.85 + r * 0.3 });
    const from = o.selected ? nearSlant - 0.4 : Math.max(nearSlant, cone.slant - FOOT_M);
    place(g.far, far, (i) => far.slant[i] > from, 0, 91, false);
  }

  // The cone underneath, set in by the depth of the layers above it.
  const depth = 2 * LAYER_DEPTH + 0.05;
  const h = cone.height - depth / Math.cos(PHI);
  const r = cone.radius - depth / Math.sin(PHI);
  const core = new Mesh(new ConeGeometry(r, h, 160, 1, true), o.core);
  core.position.y = h / 2;
  core.castShadow = core.receiveShadow = true;
  group.add(core);

  return {
    group,
    instances: drawn,
    dispose() {
      meshes.forEach((x) => x.dispose());
      mat.dispose();
      core.geometry.dispose();
      o.core.map?.dispose();
      o.core.dispose();
    },
  };
}
