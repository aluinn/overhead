import { eciToGeodetic, gstime, json2satrec, sgp4, type SatRec } from "satellite.js";
import type { CompactGp, GeodeticPoint } from "@/types";

/** Mean Earth radius (km): one scene unit. Matches `EARTH_RADIUS_KM` in lib/three/coords. */
export const R_EARTH_KM = 6371;
const MINUTES_PER_DAY = 1440;
const DEG = 180 / Math.PI;

/** Unix epoch ms → Julian date (UTC; the sub-minute UT1−UTC difference is irrelevant here). */
export function julianDate(ms: number): number {
  return ms / 86_400_000 + 2_440_587.5;
}

/** Rebuild a SatRec from the compact wire tuple. Returns null if SGP4 init rejects the elements. */
export function satrecFromCompact(gp: CompactGp): SatRec | null {
  try {
    const sat = json2satrec({
      OBJECT_NAME: gp[1],
      OBJECT_ID: "",
      EPOCH: new Date(gp[2]).toISOString(),
      MEAN_MOTION: gp[3],
      ECCENTRICITY: gp[4],
      INCLINATION: gp[5],
      RA_OF_ASC_NODE: gp[6],
      ARG_OF_PERICENTER: gp[7],
      MEAN_ANOMALY: gp[8],
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: "U",
      NORAD_CAT_ID: gp[0],
      ELEMENT_SET_NO: 999,
      REV_AT_EPOCH: 0,
      BSTAR: gp[9],
      MEAN_MOTION_DOT: gp[10],
      MEAN_MOTION_DDOT: gp[11],
    });
    return sat.error === 0 ? sat : null;
  } catch {
    return null;
  }
}

/** Orbital period in minutes from mean motion (rev/day). */
export function periodMinutes(gp: CompactGp): number {
  return MINUTES_PER_DAY / gp[3];
}

export interface EcefState {
  /** ECEF position, km. */
  x: number;
  y: number;
  z: number;
  /** Speed relative to the inertial frame, km/s. */
  speed: number;
}

/**
 * Propagate to `jd` and rotate TEME → ECEF using a precomputed GMST (rad).
 * Returns null when SGP4 reports an error (decayed, bad elements).
 * Skips the polar-motion correction: it is < 20 m, invisible at globe scale.
 */
export function ecefAt(sat: SatRec, jd: number, gmst: number): EcefState | null {
  const pv = sgp4(sat, (jd - sat.jdsatepoch) * MINUTES_PER_DAY);
  if (!pv || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
  const { x, y, z } = pv.position;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const c = Math.cos(gmst);
  const s = Math.sin(gmst);
  const v = pv.velocity;
  return {
    x: c * x + s * y,
    y: -s * x + c * y,
    z,
    speed: Math.hypot(v.x, v.y, v.z),
  };
}

/**
 * Write scene-space positions (Earth radii, Y-up; see lib/three/coords) for
 * satellites [start, end) into `out`. Failed objects are written as (0,0,0),
 * which sits inside the Earth mesh and so is never visible.
 */
export function fillScenePositions(
  sats: ReadonlyArray<SatRec | null>,
  timeMs: number,
  out: Float32Array,
  start = 0,
  end = sats.length,
): void {
  const jd = julianDate(timeMs);
  const gmst = gstime(jd);
  const c = Math.cos(gmst);
  const s = Math.sin(gmst);
  const inv = 1 / R_EARTH_KM;

  for (let i = start; i < end; i++) {
    const sat = sats[i];
    const o = i * 3;
    if (!sat) {
      out[o] = out[o + 1] = out[o + 2] = 0;
      continue;
    }
    const pv = sgp4(sat, (jd - sat.jdsatepoch) * MINUTES_PER_DAY);
    const p = pv ? pv.position : null;
    if (!p || typeof p === "boolean" || !Number.isFinite(p.x)) {
      out[o] = out[o + 1] = out[o + 2] = 0;
      continue;
    }
    // TEME → ECEF → scene (x, z, -y)
    out[o] = (c * p.x + s * p.y) * inv;
    out[o + 1] = p.z * inv;
    out[o + 2] = -(-s * p.x + c * p.y) * inv;
  }
}

export interface ObjectInfo extends GeodeticPoint {
  speedKmS: number;
  periodMin: number;
  inclinationDeg: number;
  eccentricity: number;
}

export function inspectObject(sat: SatRec, gp: CompactGp, timeMs: number): ObjectInfo | null {
  const jd = julianDate(timeMs);
  const gmst = gstime(jd);
  const pv = sgp4(sat, (jd - sat.jdsatepoch) * MINUTES_PER_DAY);
  if (!pv || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
  const geo = eciToGeodetic(pv.position, gmst);
  return {
    latDeg: geo.latitude * DEG,
    lonDeg: geo.longitude * DEG,
    altKm: geo.height,
    speedKmS: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z),
    periodMin: periodMinutes(gp),
    inclinationDeg: gp[5],
    eccentricity: gp[4],
  };
}

/**
 * Sample the object's path (Earth-fixed, scene space) from `startMs` for `spanMs`.
 * Because the scene is Earth-fixed, the result is the ground-relative track at
 * altitude, which is what you'd see tracing the object over the planet.
 */
export function sampleTrail(sat: SatRec, startMs: number, spanMs: number, steps: number): Float32Array {
  const out = new Float32Array((steps + 1) * 3);
  const inv = 1 / R_EARTH_KM;
  for (let i = 0; i <= steps; i++) {
    const t = startMs + (spanMs * i) / steps;
    const jd = julianDate(t);
    const st = ecefAt(sat, jd, gstime(jd));
    const o = i * 3;
    if (!st) {
      // Repeat the previous point so the line doesn't spike to the origin.
      if (i > 0) {
        out[o] = out[o - 3];
        out[o + 1] = out[o - 2];
        out[o + 2] = out[o - 1];
      }
      continue;
    }
    out[o] = st.x * inv;
    out[o + 1] = st.z * inv;
    out[o + 2] = -st.y * inv;
  }
  return out;
}
