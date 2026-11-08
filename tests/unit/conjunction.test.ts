import type { SatRec } from "satellite.js";
import { describe, expect, it } from "vitest";
import { pairDistance, pairState, pickScanSubset, refineApproach, scanConjunctions } from "@/lib/orbital/conjunction";
import { satrecFromCompact } from "@/lib/orbital/propagate";
import { ObjectKind, type CompactGp } from "@/types";

const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
const MEAN_MOTION = 15.2; // rev/day, ~500 km circular
const N_RAD_S = (2 * Math.PI * MEAN_MOTION) / 86_400;

/** Ground truth: scan the actual SGP4 separation on a 1 ms grid. */
function bruteForceMinimum(a: SatRec, b: SatRec, fromMs: number, toMs: number) {
  let best = { t: fromMs, d: Infinity };
  for (let t = fromMs; t <= toMs; t += 1) {
    const d = pairDistance(a, b, t)!.distanceKm;
    if (d < best.d) best = { t, d };
  }
  return best;
}

/**
 * Two circular orbits that cross at the ascending node: A equatorial, B polar.
 * B is delayed by `delaySec`, so they pass the crossing point about that far apart.
 * (Ideal Keplerian circles would miss by v·δ/√2; SGP4's J2 short-period terms
 * move each orbit by a few km, so tests compare against a brute-force minimum
 * of the real SGP4 separation instead of that closed form.)
 */
function crossingPair(delaySec: number) {
  const mk = (id: number, incl: number, maDeg: number): CompactGp => [id, `SAT ${id}`, EPOCH, MEAN_MOTION, 1e-6, incl, 0, 0, maDeg, 0, 0, 0];
  const a = satrecFromCompact(mk(1, 0.01, 0))!;
  const delayDeg = ((-N_RAD_S * delaySec) * 180) / Math.PI;
  const b = satrecFromCompact(mk(2, 90, (360 + delayDeg) % 360))!;
  return { a, b };
}

describe("pairDistance / refineApproach", () => {
  it("matches a brute-force 1 ms minimum of the SGP4 separation", () => {
    const { a, b } = crossingPair(2);
    const truth = bruteForceMinimum(a, b, EPOCH - 6_000, EPOCH + 8_000);
    const r = refineApproach(a, b, EPOCH - 20_000, EPOCH + 20_000);
    expect(r.distanceKm).toBeCloseTo(truth.d, 2);
    expect(Math.abs(r.tcaMs - truth.t)).toBeLessThan(25);
  });

  it("reports a plausible crossing geometry: a few to tens of km, ~10 km/s relative", () => {
    const { a, b } = crossingPair(2);
    const r = refineApproach(a, b, EPOCH - 20_000, EPOCH + 20_000);
    expect(r.distanceKm).toBeGreaterThan(3);
    expect(r.distanceKm).toBeLessThan(40);
    // Perpendicular tracks at ~7.6 km/s each: |Δv| ≈ 10.7 km/s.
    expect(r.relSpeedKmS).toBeGreaterThan(10);
    expect(r.relSpeedKmS).toBeLessThan(11.5);
  });

  it("is symmetric in its arguments", () => {
    const { a, b } = crossingPair(2);
    expect(pairDistance(a, b, EPOCH + 500)!.distanceKm).toBeCloseTo(pairDistance(b, a, EPOCH + 500)!.distanceKm, 9);
  });

  it("returns a larger separation away from the crossing", () => {
    const { a, b } = crossingPair(2);
    const near = pairDistance(a, b, EPOCH + 1000)!.distanceKm;
    const away = pairDistance(a, b, EPOCH + 60_000)!.distanceKm;
    expect(away).toBeGreaterThan(near * 10);
  });
});

describe("scanConjunctions", () => {
  it("detects the crossing pair among bystanders, using only coarse sampling", async () => {
    const { a, b } = crossingPair(2);
    // A distant third satellite: same altitude, polar, but a quarter orbit away.
    const far = satrecFromCompact([3, "FAR", EPOCH, MEAN_MOTION, 1e-6, 90, 0, 0, 90, 0, 0, 0])!;
    const sats = [a, b, far];
    const events = await scanConjunctions(sats, [0, 1, 2], {
      startMs: EPOCH - 5 * 60_000,
      durationMs: 10 * 60_000,
      stepMs: 30_000,
      thresholdKm: 50,
    });
    const hit = events.find((e) => e.indexA === 0 && e.indexB === 1);
    expect(hit).toBeDefined();
    const truth = bruteForceMinimum(a, b, EPOCH - 6_000, EPOCH + 8_000);
    expect(hit!.rangeKm).toBeCloseTo(truth.d, 2);
    expect(Math.abs(hit!.tcaMs - truth.t)).toBeLessThan(25);
    // sorted ascending by range
    for (let i = 1; i < events.length; i++) expect(events[i].rangeKm).toBeGreaterThanOrEqual(events[i - 1].rangeKm);
  });

  it("ignores co-moving pairs (docked objects): relative speed below the floor", async () => {
    const mk = (id: number): CompactGp => [id, `SAT ${id}`, EPOCH, MEAN_MOTION, 1e-6, 51.6, 10, 0, 0, 0, 0, 0];
    const sats = [satrecFromCompact(mk(1))!, satrecFromCompact(mk(2))!];
    const events = await scanConjunctions(sats, [0, 1], { startMs: EPOCH, durationMs: 10 * 60_000, stepMs: 30_000, thresholdKm: 50 });
    expect(events).toEqual([]);
  });

  it("returns nothing for fewer than two valid objects", async () => {
    const { a } = crossingPair(1);
    expect(await scanConjunctions([a, null], [0, 1], { startMs: EPOCH, durationMs: 60_000, stepMs: 30_000, thresholdKm: 50 })).toEqual([]);
  });

  it("calls the yield hook between batches", async () => {
    const { a, b } = crossingPair(2);
    let yields = 0;
    await scanConjunctions([a, b], [0, 1], {
      startMs: EPOCH,
      durationMs: 60 * 60_000,
      stepMs: 30_000,
      thresholdKm: 50,
      yieldEvery: async () => {
        yields++;
      },
    });
    expect(yields).toBeGreaterThan(0);
  });
});

describe("pairState", () => {
  it("returns both positions in scene units and their separation", () => {
    const { a, b } = crossingPair(2);
    const s = pairState(a, b, EPOCH + 1000)!;
    expect(Math.hypot(...s.a)).toBeGreaterThan(1.05);
    expect(Math.hypot(...s.b)).toBeGreaterThan(1.05);
    expect(s.distanceKm).toBeCloseTo(pairDistance(a, b, EPOCH + 1000)!.distanceKm, 6);
    expect(s.distanceKm).toBeGreaterThan(1);
    expect(s.distanceKm).toBeLessThan(100);
  });
});

describe("pickScanSubset", () => {
  const gp = (mm: number): CompactGp => [1, "X", 0, mm, 0, 0, 0, 0, 0, 0, 0, 0];

  it("always includes every station, skips Starlink and high orbits, and respects the cap", () => {
    const kinds = new Uint8Array([ObjectKind.Station, ObjectKind.Starlink, ObjectKind.Other, ObjectKind.Debris, ObjectKind.Other, ObjectKind.Debris]);
    const gps = [gp(15.5), gp(15.1), gp(14.0), gp(13.0), gp(1.0), gp(14.5)];
    const subset = pickScanSubset(kinds, gps, 100);
    expect(subset).toContain(0); // station
    expect(subset).not.toContain(1); // starlink
    expect(subset).not.toContain(4); // GEO-ish (1 rev/day)
    expect(subset).toEqual([0, 2, 3, 5]);
    expect(pickScanSubset(kinds, gps, 2).length).toBeLessThanOrEqual(2);
  });
});
