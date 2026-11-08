import { eciToEcf, gstime, propagate, twoline2satrec } from "satellite.js";
import { describe, expect, it } from "vitest";
import { compactFromOmm } from "@/lib/data/parse";
import { ecefAt, fillScenePositions, inspectObject, julianDate, R_EARTH_KM, sampleTrail, satrecFromCompact } from "@/lib/orbital/propagate";
import type { CompactGp } from "@/types";
import fixture from "../fixtures/gp-iss.json";

// Spacetrack Report #3 / Vallado SGP4-VER reference case "88888".
const L1 = "1 88888U          80275.98708465  .00073094  13844-3  66816-4 0    8";
const L2 = "2 88888  72.8435 115.9689 0086731  52.6988 110.5714 16.05824518  105";
const ref = twoline2satrec(L1, L2);
const REF_EPOCH_MS = Math.round((ref.jdsatepoch - 2_440_587.5) * 86_400_000);

/** The same elements expressed as our compact GP tuple. */
const GP_88888: CompactGp = [88888, "SGP4-VER 88888", REF_EPOCH_MS, 16.05824518, 0.0086731, 72.8435, 115.9689, 52.6988, 110.5714, 0.66816e-4, 0.00073094, 0.13844e-3];

describe("satrecFromCompact", () => {
  it("reproduces the SGP4 reference vector (TEME, t = epoch) within metres", () => {
    const sat = satrecFromCompact(GP_88888)!;
    expect(sat).not.toBeNull();
    const pv = propagate(sat, new Date(REF_EPOCH_MS));
    expect(pv).not.toBeNull();
    const p = pv!.position as { x: number; y: number; z: number };
    // Published values for tsince = 0.
    expect(p.x).toBeCloseTo(2328.97048951, 1);
    expect(p.y).toBeCloseTo(-5995.22076416, 1);
    expect(p.z).toBeCloseTo(1719.97067261, 1);
  });

  it("builds a usable satrec from a real CelesTrak ISS record", () => {
    const gp = compactFromOmm(fixture.valid[0])!;
    const sat = satrecFromCompact(gp);
    expect(sat).not.toBeNull();
  });

  it("returns null instead of throwing on garbage elements", () => {
    const bad: CompactGp = [1, "BAD", Date.now(), Number.NaN, 2, 0, 0, 0, 0, 0, 0, 0];
    expect(satrecFromCompact(bad)).toBeNull();
  });
});

describe("ecefAt / fillScenePositions", () => {
  const sat = satrecFromCompact(GP_88888)!;
  const t = REF_EPOCH_MS + 90 * 60_000; // 90 min after epoch
  const date = new Date(t);

  it("agrees with satellite.js's own TEME→ECEF conversion", () => {
    const pv = propagate(sat, date)!;
    const want = eciToEcf(pv.position as { x: number; y: number; z: number }, gstime(date));
    const got = ecefAt(sat, julianDate(t), gstime(julianDate(t)))!;
    expect(got.x).toBeCloseTo(want.x, 3);
    expect(got.y).toBeCloseTo(want.y, 3);
    expect(got.z).toBeCloseTo(want.z, 3);
  });

  it("maps ECEF (X, Y, Z) to scene (X, Z, −Y) in Earth radii", () => {
    const e = ecefAt(sat, julianDate(t), gstime(julianDate(t)))!;
    const out = new Float32Array(3);
    fillScenePositions([sat], t, out);
    expect(out[0]).toBeCloseTo(e.x / R_EARTH_KM, 4);
    expect(out[1]).toBeCloseTo(e.z / R_EARTH_KM, 4);
    expect(out[2]).toBeCloseTo(-e.y / R_EARTH_KM, 4);
  });

  it("parks missing satellites at the origin and only writes the requested range", () => {
    const out = new Float32Array([9, 9, 9, 9, 9, 9, 9, 9, 9]);
    fillScenePositions([sat, null, sat], t, out, 1, 2);
    expect(Array.from(out.subarray(0, 3))).toEqual([9, 9, 9]);
    expect(Array.from(out.subarray(3, 6))).toEqual([0, 0, 0]);
    expect(Array.from(out.subarray(6, 9))).toEqual([9, 9, 9]);
  });
});

describe("inspectObject", () => {
  it("returns a physically sensible ISS state", () => {
    const gp = compactFromOmm(fixture.valid[0])!;
    const sat = satrecFromCompact(gp)!;
    const info = inspectObject(sat, gp, gp[2] + 30 * 60_000)!;
    expect(info.altKm).toBeGreaterThan(380);
    expect(info.altKm).toBeLessThan(450);
    expect(info.speedKmS).toBeGreaterThan(7.5);
    expect(info.speedKmS).toBeLessThan(7.8);
    expect(Math.abs(info.latDeg)).toBeLessThanOrEqual(51.7); // can't exceed the inclination
    expect(info.periodMin).toBeCloseTo(92.95, 1);
    expect(info.inclinationDeg).toBeCloseTo(51.632, 3);
  });
});

describe("sampleTrail", () => {
  it("samples steps+1 points, all at orbital radius", () => {
    const gp = compactFromOmm(fixture.valid[0])!;
    const sat = satrecFromCompact(gp)!;
    const trail = sampleTrail(sat, gp[2], 93 * 60_000, 60);
    expect(trail.length).toBe(61 * 3);
    for (let i = 0; i < 61; i++) {
      const r = Math.hypot(trail[i * 3], trail[i * 3 + 1], trail[i * 3 + 2]);
      expect(r).toBeGreaterThan(1.05);
      expect(r).toBeLessThan(1.09);
    }
  });
});
