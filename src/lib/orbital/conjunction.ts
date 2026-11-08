import { gstime, sgp4, type SatRec } from "satellite.js";
import type { CompactGp } from "@/types";
import { ObjectKind } from "@/types";
import { ecefAt, julianDate, R_EARTH_KM } from "./propagate";

const MIN_PER_DAY = 1440;

export interface LocalConjunction {
  /** Indices into the catalog the scan ran over. */
  indexA: number;
  indexB: number;
  tcaMs: number;
  rangeKm: number;
  relSpeedKmS: number;
}

export interface ScanOptions {
  startMs: number;
  durationMs: number;
  /** Coarse sampling step. Local minima of the pair distance are refined afterwards. */
  stepMs: number;
  /** Keep approaches closer than this (km). */
  thresholdKm: number;
  /** Ignore pairs slower than this (km/s): docked / co-orbiting objects. */
  minRelSpeedKmS?: number;
  limit?: number;
  /** Called between batches so a worker can yield to its event loop. */
  yieldEvery?: () => Promise<void>;
}

interface Vec {
  x: number;
  y: number;
  z: number;
}

/** TEME position and velocity (km, km/s) at `t`, or null if SGP4 fails. Distances are frame-independent. */
function stateAt(sat: SatRec, jd: number): { p: Vec; v: Vec } | null {
  const pv = sgp4(sat, (jd - sat.jdsatepoch) * MIN_PER_DAY);
  if (!pv || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
  return { p: pv.position, v: pv.velocity };
}

export interface PairResult {
  distanceKm: number;
  relSpeedKmS: number;
}

export function pairDistance(a: SatRec, b: SatRec, timeMs: number): PairResult | null {
  const jd = julianDate(timeMs);
  const sa = stateAt(a, jd);
  const sb = stateAt(b, jd);
  if (!sa || !sb) return null;
  return {
    distanceKm: Math.hypot(sa.p.x - sb.p.x, sa.p.y - sb.p.y, sa.p.z - sb.p.z),
    relSpeedKmS: Math.hypot(sa.v.x - sb.v.x, sa.v.y - sb.v.y, sa.v.z - sb.v.z),
  };
}

/**
 * Time and distance of closest approach for one pair inside [lo, hi] (ms),
 * by golden-section search on the (unimodal-in-a-bracket) separation.
 */
export function refineApproach(a: SatRec, b: SatRec, loMs: number, hiMs: number): { tcaMs: number } & PairResult {
  const phi = (Math.sqrt(5) - 1) / 2;
  const f = (t: number): number => pairDistance(a, b, t)?.distanceKm ?? Number.POSITIVE_INFINITY;
  let lo = loMs;
  let hi = hiMs;
  let x1 = hi - phi * (hi - lo);
  let x2 = lo + phi * (hi - lo);
  let f1 = f(x1);
  let f2 = f(x2);
  // 1 ms resolution is plenty: a LEO pair moves ~15 m in 1 ms.
  while (hi - lo > 1) {
    if (f1 < f2) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - phi * (hi - lo);
      f1 = f(x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + phi * (hi - lo);
      f2 = f(x2);
    }
  }
  const tcaMs = (lo + hi) / 2;
  const at = pairDistance(a, b, tcaMs) ?? { distanceKm: Number.POSITIVE_INFINITY, relSpeedKmS: 0 };
  return { tcaMs, ...at };
}

/**
 * Brute-force close-approach search among a *subset* of objects. This is the
 * fallback when SOCRATES is unreachable: it won't match SOCRATES' coverage
 * (which screens the entire catalog) but is exact for the objects it covers.
 *
 * Every pair's separation is sampled each `stepMs`; sampled local minima that
 * could hide an approach under `thresholdKm` are refined with a golden-section
 * search. Cost is O(steps · n²) distance checks plus O(steps · n) SGP4 calls.
 */
export async function scanConjunctions(
  sats: ReadonlyArray<SatRec | null>,
  indices: ReadonlyArray<number>,
  opts: ScanOptions,
): Promise<LocalConjunction[]> {
  const { startMs, durationMs, stepMs, thresholdKm, minRelSpeedKmS = 0.5, limit = 50, yieldEvery } = opts;
  const live = indices.filter((i) => sats[i] !== null);
  const n = live.length;
  if (n < 2) return [];

  const steps = Math.floor(durationMs / stepMs) + 1;
  const pairs = (n * (n - 1)) / 2;
  // An approach below `thresholdKm` can still sample as far as this at the nearest step.
  const capKm = Math.hypot(thresholdKm, 16 * (stepMs / 1000) * 0.5);

  const pos = new Float64Array(n * 3);
  let d2 = new Float32Array(pairs); // d(k-2)
  let d1 = new Float32Array(pairs); // d(k-1)
  let d0 = new Float32Array(pairs); // d(k)
  const found = new Map<string, LocalConjunction>();

  for (let k = 0; k < steps; k++) {
    const t = startMs + k * stepMs;
    const jd = julianDate(t);
    for (let a = 0; a < n; a++) {
      const sat = sats[live[a]];
      const s = sat ? stateAt(sat, jd) : null;
      if (s) {
        pos[a * 3] = s.p.x;
        pos[a * 3 + 1] = s.p.y;
        pos[a * 3 + 2] = s.p.z;
      } else {
        pos[a * 3] = pos[a * 3 + 1] = pos[a * 3 + 2] = 1e9; // far away: can never be "close"
      }
    }

    let p = 0;
    for (let a = 0; a < n - 1; a++) {
      const ax = pos[a * 3];
      const ay = pos[a * 3 + 1];
      const az = pos[a * 3 + 2];
      for (let b = a + 1; b < n; b++, p++) {
        d0[p] = Math.hypot(ax - pos[b * 3], ay - pos[b * 3 + 1], az - pos[b * 3 + 2]);
      }
    }

    if (k >= 2) {
      p = 0;
      for (let a = 0; a < n - 1; a++) {
        for (let b = a + 1; b < n; b++, p++) {
          // Sampled local minimum at step k-1, close enough to matter.
          if (d1[p] <= d2[p] && d1[p] < d0[p] && d1[p] < capKm) {
            const sa = sats[live[a]] as SatRec;
            const sb = sats[live[b]] as SatRec;
            const r = refineApproach(sa, sb, t - 2 * stepMs, t);
            if (r.distanceKm <= thresholdKm && r.relSpeedKmS >= minRelSpeedKmS) {
              const key = `${live[a]}-${live[b]}-${Math.round(r.tcaMs / 60_000)}`;
              if (!found.has(key)) {
                found.set(key, { indexA: live[a], indexB: live[b], tcaMs: r.tcaMs, rangeKm: r.distanceKm, relSpeedKmS: r.relSpeedKmS });
              }
            }
          }
        }
      }
    }

    [d2, d1, d0] = [d1, d0, d2];
    if (yieldEvery && k % 20 === 19) await yieldEvery();
  }

  return [...found.values()].sort((x, y) => x.rangeKm - y.rangeKm).slice(0, limit);
}

/**
 * Choose which objects the fallback scan covers: all stations, then a
 * deterministic spread of low-Earth-orbit debris and satellites (the objects
 * most likely to pass close), capped at `max` to bound the O(n²) cost.
 */
export function pickScanSubset(kinds: ArrayLike<number>, gps: ReadonlyArray<CompactGp>, max: number): number[] {
  const stations: number[] = [];
  const leo: number[] = [];
  for (let i = 0; i < gps.length; i++) {
    const kind = kinds[i];
    if (kind === ObjectKind.Station) stations.push(i);
    else if (kind !== ObjectKind.Starlink && gps[i][3] > 11.25) leo.push(i); // > 11.25 rev/day ≈ perigee < ~2,000 km
  }
  const room = Math.max(0, max - stations.length);
  const stride = Math.max(1, Math.ceil(leo.length / Math.max(1, room)));
  const picked = leo.filter((_, k) => k % stride === 0).slice(0, room);
  return [...stations, ...picked];
}

export interface PairState {
  /** Scene-space positions (Earth radii) of both objects at the time. */
  a: [number, number, number];
  b: [number, number, number];
  distanceKm: number;
  relSpeedKmS: number;
}

/** Where are two objects at `timeMs`, and how far apart? Used to aim the camera at a conjunction. */
export function pairState(a: SatRec, b: SatRec, timeMs: number): PairState | null {
  const jd = julianDate(timeMs);
  const gmst = gstime(jd);
  const ea = ecefAt(a, jd, gmst);
  const eb = ecefAt(b, jd, gmst);
  const d = pairDistance(a, b, timeMs);
  if (!ea || !eb || !d) return null;
  const inv = 1 / R_EARTH_KM;
  return {
    a: [ea.x * inv, ea.z * inv, -ea.y * inv],
    b: [eb.x * inv, eb.z * inv, -eb.y * inv],
    distanceKm: d.distanceKm,
    relSpeedKmS: d.relSpeedKmS,
  };
}
