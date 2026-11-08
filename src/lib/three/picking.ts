import type { Camera, Vector3 } from "three";
import type { PositionStream } from "./positionStream";

/**
 * True when the straight line from the camera to `p` passes through the unit
 * sphere (the Earth) before reaching `p`, i.e. the point is hidden behind it.
 */
export function isOccluded(cam: Vector3, px: number, py: number, pz: number): boolean {
  const dx = px - cam.x;
  const dy = py - cam.y;
  const dz = pz - cam.z;
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (cam.x * dx + cam.y * dy + cam.z * dz);
  const c = cam.x * cam.x + cam.y * cam.y + cam.z * cam.z - 1;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t > 0 && t < 1;
}

const pos = { x: 0, y: 0, z: 0 };

/**
 * Nearest visible object to a screen point, within `radiusPx`.
 * Projects every point on the CPU (cheap at ~20k) instead of raycasting,
 * and skips anything hidden behind the planet.
 */
export function pickNearest(
  stream: PositionStream,
  camera: Camera,
  kinds: Uint8Array,
  clientX: number,
  clientY: number,
  rect: DOMRect,
  radiusPx: number,
): number | null {
  const e = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements;
  const w = rect.width;
  const h = rect.height;
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const alpha = stream.alpha();
  const cam = camera.position;

  let best = -1;
  let bestD2 = radiusPx * radiusPx;

  for (let i = 0; i < stream.count; i++) {
    stream.positionAt(i, alpha, pos);
    const { x, y, z } = pos;
    if (x === 0 && y === 0 && z === 0) continue;

    const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (cw <= 0) continue;
    const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw * 0.5 + 0.5) * w;
    const sy = (1 - ((e[1] * x + e[5] * y + e[9] * z + e[13]) / cw * 0.5 + 0.5)) * h;
    const dx = sx - mx;
    const dy = sy - my;
    // Weight stations so they win ties against dense debris clouds.
    const d2 = (dx * dx + dy * dy) / (kinds[i] === 3 ? 2.5 : 1);
    if (d2 >= bestD2) continue;
    if (isOccluded(cam, x, y, z)) continue;
    bestD2 = d2;
    best = i;
  }
  return best === -1 ? null : best;
}

/** Project a scene point to CSS pixels; returns null if behind the camera or the Earth. */
export function projectToScreen(
  camera: Camera,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (isOccluded(camera.position, x, y, z)) return null;
  const e = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements;
  const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
  if (cw <= 0) return null;
  const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / cw;
  const ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw;
  if (Math.abs(nx) > 1.1 || Math.abs(ny) > 1.1) return null;
  return { x: (nx * 0.5 + 0.5) * width, y: (1 - (ny * 0.5 + 0.5)) * height };
}
