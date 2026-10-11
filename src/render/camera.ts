import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bbox } from '../places/geometry';
import type { Place } from '../places/types';

const FOV = 45;
const MIN_POLAR = THREE.MathUtils.degToRad(30); // pitch 60°
const MAX_POLAR = THREE.MathUtils.degToRad(80); // pitch 10°
const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Flight { t0: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; }

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 80_000);
  readonly controls: OrbitControls;
  private bounds = { minX: -100, minZ: -100, maxX: 100, maxZ: 100 };
  private flight: Flight | null = null;

  constructor(dom: HTMLElement) {
    this.camera.position.set(0, 300, 300);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.minPolarAngle = MIN_POLAR;
    this.controls.maxPolarAngle = MAX_POLAR;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 6;
  }

  setBounds(place: Place): void {
    const b = bbox(place.outer);
    const padX = (b.maxX - b.minX) * 0.2, padZ = (b.maxZ - b.minZ) * 0.2;
    this.bounds = { minX: b.minX - padX, minZ: b.minZ - padZ, maxX: b.maxX + padX, maxZ: b.maxZ + padZ };
    const halfDiag = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
    this.controls.maxDistance = Math.max(200, (2.5 * halfDiag) / TAN_HALF);
  }

  flyTo(preset: 'aerial' | 'eye', crowdRadius: number, nowMs: number): void {
    const target = new THREE.Vector3(0, 0, 0);
    const az = this.controls.getAzimuthalAngle();
    const polar = preset === 'aerial' ? THREE.MathUtils.degToRad(45) : MAX_POLAR;
    const dist =
      preset === 'aerial'
        ? THREE.MathUtils.clamp((1.4 * Math.max(crowdRadius, 15)) / TAN_HALF, 30, this.controls.maxDistance)
        : 30;
    const toPos = new THREE.Vector3().setFromSphericalCoords(dist, polar, az).add(target);
    this.flight = { t0: nowMs, dur: 1200, fromPos: this.camera.position.clone(), toPos, fromTarget: this.controls.target.clone(), toTarget: target };
    this.controls.enabled = false;
  }

  tick(nowMs: number): void {
    const f = this.flight;
    if (f) {
      const t = Math.min(1, (nowMs - f.t0) / f.dur);
      const k = ease(t);
      this.camera.position.lerpVectors(f.fromPos, f.toPos, k);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, k);
      if (t >= 1) {
        this.flight = null;
        this.controls.enabled = true;
      }
    }
    this.controls.update();
    // Keep the orbit target on the ground and near the place.
    const tg = this.controls.target;
    const cx = THREE.MathUtils.clamp(tg.x, this.bounds.minX, this.bounds.maxX);
    const cz = THREE.MathUtils.clamp(tg.z, this.bounds.minZ, this.bounds.maxZ);
    const dx = cx - tg.x, dy = -tg.y, dz = cz - tg.z;
    if (dx || dy || dz) {
      tg.set(cx, 0, cz);
      this.camera.position.add(new THREE.Vector3(dx, dy, dz));
    }
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
