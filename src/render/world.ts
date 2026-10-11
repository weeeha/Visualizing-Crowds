import * as THREE from 'three';
import { EDGE, FEATURE, GROUND } from '../crowd/palettes';
import type { Place } from '../places/types';

/** Huge flat ground. Ground layers never write depth, so draw order (renderOrder) decides stacking. */
export function createGround(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(200_000, 200_000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: GROUND, depthWrite: false }),
  );
  mesh.renderOrder = 0;
  return mesh;
}

/** Holes as flat fills plus a thin outline of the place boundary. */
export function createPlaceFeatures(place: Place): THREE.Group {
  const group = new THREE.Group();
  const holeMat = new THREE.MeshBasicMaterial({ color: FEATURE, depthWrite: false });
  for (const h of place.holes) {
    const shape = new THREE.Shape(h.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z)));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), holeMat);
    mesh.position.y = 0.03;
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(place.outer.map(([x, z]) => new THREE.Vector3(x, 0.05, z))),
    new THREE.LineBasicMaterial({ color: EDGE, depthWrite: false }),
  );
  line.renderOrder = 3;
  group.add(line);
  return group;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
