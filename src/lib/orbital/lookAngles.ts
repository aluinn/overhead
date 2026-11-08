import { R_EARTH_KM } from "./propagate";

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

// WGS-84 ellipsoid
const WGS84_A = 6378.137; // km
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

export interface ObserverBasis {
  /** Observer ECEF position, km. */
  x: number;
  y: number;
  z: number;
  /** Local East / North / Up unit vectors in ECEF. */
  east: readonly [number, number, number];
  north: readonly [number, number, number];
  up: readonly [number, number, number];
}

/** ECEF position and ENU frame for a geodetic observer (WGS-84). */
export function observerBasis(latDeg: number, lonDeg: number, altKm = 0): ObserverBasis {
  const lat = latDeg * RAD;
  const lon = lonDeg * RAD;
  const sl = Math.sin(lat);
  const cl = Math.cos(lat);
  const so = Math.sin(lon);
  const co = Math.cos(lon);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sl * sl);
  return {
    x: (n + altKm) * cl * co,
    y: (n + altKm) * cl * so,
    z: (n * (1 - WGS84_E2) + altKm) * sl,
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
    up: [cl * co, cl * so, sl],
  };
}

export interface LookAngle {
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
}

/** Azimuth (0° = N, clockwise), elevation and slant range of an ECEF point (km) from the observer. */
export function lookAngle(obs: ObserverBasis, x: number, y: number, z: number): LookAngle {
  const dx = x - obs.x;
  const dy = y - obs.y;
  const dz = z - obs.z;
  const e = dx * obs.east[0] + dy * obs.east[1] + dz * obs.east[2];
  const n = dx * obs.north[0] + dy * obs.north[1] + dz * obs.north[2];
  const u = dx * obs.up[0] + dy * obs.up[1] + dz * obs.up[2];
  const range = Math.hypot(dx, dy, dz);
  let az = Math.atan2(e, n) * DEG;
  if (az < 0) az += 360;
  return { azimuthDeg: az, elevationDeg: Math.asin(u / range) * DEG, rangeKm: range };
}

export interface VisibleSet {
  count: number;
  /** Catalog indices, sorted by elevation (highest first). */
  indices: Int32Array;
  azimuthDeg: Float32Array;
  elevationDeg: Float32Array;
  rangeKm: Float32Array;
}

export const EMPTY_VISIBLE: VisibleSet = {
  count: 0,
  indices: new Int32Array(0),
  azimuthDeg: new Float32Array(0),
  elevationDeg: new Float32Array(0),
  rangeKm: new Float32Array(0),
};

/**
 * Which objects are above `minElevationDeg` right now?
 *
 * Works directly on the renderer's scene-space position snapshots
 * (prev→next lerped by `alpha`; scene (x,y,z) = ECEF (X,Z,−Y) / R_earth), so
 * the list always agrees with what's drawn, and costs no extra SGP4 calls.
 * Objects parked at the origin (decayed / invalid) are skipped.
 */
export function computeVisible(
  prev: Float32Array,
  next: Float32Array,
  alpha: number,
  count: number,
  obs: ObserverBasis,
  minElevationDeg: number,
): VisibleSet {
  const sinMin = Math.sin(minElevationDeg * RAD);
  const hits: number[] = [];
  const els: number[] = [];

  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const sx = prev[o] + (next[o] - prev[o]) * alpha;
    const sy = prev[o + 1] + (next[o + 1] - prev[o + 1]) * alpha;
    const sz = prev[o + 2] + (next[o + 2] - prev[o + 2]) * alpha;
    if (sx === 0 && sy === 0 && sz === 0) continue;

    // scene → ECEF km
    const X = sx * R_EARTH_KM;
    const Y = -sz * R_EARTH_KM;
    const Z = sy * R_EARTH_KM;
    const dx = X - obs.x;
    const dy = Y - obs.y;
    const dz = Z - obs.z;
    const range = Math.hypot(dx, dy, dz);
    const u = dx * obs.up[0] + dy * obs.up[1] + dz * obs.up[2];
    if (u / range < sinMin) continue;
    hits.push(i);
    els.push(u / range);
  }

  // Sort by sin(elevation), descending (monotonic in elevation).
  const order = hits.map((_, k) => k).sort((a, b) => els[b] - els[a]);
  const n = order.length;
  const out: VisibleSet = {
    count: n,
    indices: new Int32Array(n),
    azimuthDeg: new Float32Array(n),
    elevationDeg: new Float32Array(n),
    rangeKm: new Float32Array(n),
  };
  for (let k = 0; k < n; k++) {
    const i = hits[order[k]];
    const o = i * 3;
    const sx = prev[o] + (next[o] - prev[o]) * alpha;
    const sy = prev[o + 1] + (next[o + 1] - prev[o + 1]) * alpha;
    const sz = prev[o + 2] + (next[o + 2] - prev[o + 2]) * alpha;
    const la = lookAngle(obs, sx * R_EARTH_KM, -sz * R_EARTH_KM, sy * R_EARTH_KM);
    out.indices[k] = i;
    out.azimuthDeg[k] = la.azimuthDeg;
    out.elevationDeg[k] = la.elevationDeg;
    out.rangeKm[k] = la.rangeKm;
  }
  return out;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** 16-point compass label for an azimuth in degrees. */
export function compass(azimuthDeg: number): string {
  return COMPASS[Math.round((((azimuthDeg % 360) + 360) % 360) / 22.5) % 16];
}

/** Horizon-to-horizon ground radius (degrees of arc) for an object at `altKm` seen above `minElevationDeg`. */
export function footprintAngleDeg(altKm: number, minElevationDeg: number): number {
  const el = minElevationDeg * RAD;
  return (Math.acos((R_EARTH_KM * Math.cos(el)) / (R_EARTH_KM + altKm)) - el) * DEG;
}
