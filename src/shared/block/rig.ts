// Orbit camera driven by script tracks (HANDOFF §8.12): azimuth, elevation, distance and target, with a slow idle
// drift so the frame breathes even when the scroll is still.

import { PerspectiveCamera, Vector3 } from 'three/webgpu';

export interface RigPose {
  /** Radians around the time axis (0 looks along −z). */
  az: number;
  /** Radians above the x–y plane. */
  el: number;
  dist: number;
  tx: number;
  tt: number;
  ty: number;
  fov?: number;
}

export class OrbitRig {
  readonly camera: PerspectiveCamera;
  private readonly target = new Vector3();
  drift = 1;

  constructor(fov = 34) {
    this.camera = new PerspectiveCamera(fov, 1, 0.02, 400);
  }

  apply(p: RigPose, elapsed: number): void {
    const az = p.az + Math.sin(elapsed * 0.045) * 0.05 * this.drift;
    const el = p.el + Math.sin(elapsed * 0.031 + 1.3) * 0.025 * this.drift;
    const ce = Math.cos(el);
    this.target.set(p.tx, p.tt, p.ty);
    this.camera.position.set(p.tx + p.dist * ce * Math.sin(az), p.tt + p.dist * Math.sin(el), p.ty + p.dist * ce * Math.cos(az));
    this.camera.lookAt(this.target);
    if (p.fov !== undefined && Math.abs(this.camera.fov - p.fov) > 1e-3) {
      this.camera.fov = p.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
