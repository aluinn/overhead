import { Vector3 } from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { PerspectiveCamera } from "three";

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Flight {
  fromDir: Vector3;
  toDir: Vector3;
  fromDist: number;
  toDist: number;
  fromTarget: Vector3;
  toTarget: Vector3;
  start: number;
  duration: number;
}

/**
 * Tween-based camera director. Interpolates the *direction* of the camera
 * (spherical slerp) and its distance separately, so flights arc around the
 * globe instead of cutting through it.
 */
export class CameraRig {
  private flight: Flight | null = null;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly controls: OrbitControls,
  ) {}

  get isFlying(): boolean {
    return this.flight !== null;
  }

  /** Fly so the camera looks at `lookAt` from along `direction` at `distance` scene units. */
  flyTo(direction: Vector3, distance: number, lookAt = new Vector3(), durationMs = 1800): void {
    const fromTarget = this.controls.target.clone();
    this.flight = {
      fromDir: this.camera.position.clone().sub(fromTarget).normalize(),
      toDir: direction.clone().normalize(),
      fromDist: this.camera.position.distanceTo(fromTarget),
      toDist: distance,
      fromTarget,
      toTarget: lookAt.clone(),
      start: performance.now(),
      duration: durationMs,
    };
  }

  cancel(): void {
    this.flight = null;
  }

  /** Advance the active flight. Call once per frame, before `controls.update()`. */
  update(now: number): void {
    const f = this.flight;
    if (!f) return;
    const raw = Math.min(1, (now - f.start) / f.duration);
    const t = easeInOutCubic(raw);

    const dir = slerpUnit(f.fromDir, f.toDir, t);
    const dist = f.fromDist + (f.toDist - f.fromDist) * t;
    this.controls.target.lerpVectors(f.fromTarget, f.toTarget, t);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);

    if (raw >= 1) this.flight = null;
  }
}

function slerpUnit(a: Vector3, b: Vector3, t: number): Vector3 {
  const dot = Math.max(-1, Math.min(1, a.dot(b)));
  const omega = Math.acos(dot);
  if (omega < 1e-4) return b.clone();
  const sinOmega = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinOmega;
  const wb = Math.sin(t * omega) / sinOmega;
  return a.clone().multiplyScalar(wa).addScaledVector(b, wb).normalize();
}
