import { describe, expect, it } from "vitest";
import { R_EARTH_KM } from "@/lib/orbital/propagate";
import { detectTrains, type PlaneElements } from "@/lib/orbital/trainDetection";

const RADIUS_KM = R_EARTH_KM + 350;

interface Sat {
  /** Along-track angle (deg). */
  anomaly: number;
  incl?: number;
  raan?: number;
  meanMotion?: number;
}

/** Circular-orbit scene positions (Y-up, Earth radii) + plane descriptors for synthetic satellites. */
function build(sats: Sat[]): { positions: Float32Array; planes: PlaneElements; all: number[] } {
  const positions = new Float32Array(sats.length * 3);
  const planes: PlaneElements = {
    inclinationDeg: new Float32Array(sats.length),
    raanDeg: new Float32Array(sats.length),
    meanMotion: new Float32Array(sats.length),
  };
  sats.forEach((s, i) => {
    const incl = ((s.incl ?? 53) * Math.PI) / 180;
    const raan = ((s.raan ?? 100) * Math.PI) / 180;
    const u = (s.anomaly * Math.PI) / 180;
    // Perifocal → ECEF-ish (the frame doesn't matter for distance tests).
    const x = RADIUS_KM * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(incl));
    const y = RADIUS_KM * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(incl));
    const z = RADIUS_KM * Math.sin(u) * Math.sin(incl);
    positions.set([x / R_EARTH_KM, z / R_EARTH_KM, -y / R_EARTH_KM], i * 3);
    planes.inclinationDeg[i] = s.incl ?? 53;
    planes.raanDeg[i] = s.raan ?? 100;
    planes.meanMotion[i] = s.meanMotion ?? 15.8;
  });
  return { positions, planes, all: sats.map((_, i) => i) };
}

/** Along-track spacing in degrees for a given distance in km at orbit radius. */
const deg = (km: number) => (km / RADIUS_KM) * (180 / Math.PI);

describe("detectTrains", () => {
  it("finds a tight string of satellites as one train, ordered along the track", () => {
    const sats = Array.from({ length: 12 }, (_, i) => ({ anomaly: 40 + i * deg(30) }));
    const { positions, planes, all } = build(sats);
    const trains = detectTrains(all, positions, planes);
    expect(trains).toHaveLength(1);
    expect(trains[0].members).toHaveLength(12);
    expect(trains[0].id).toBe(0);
    // 11 gaps of 30 km ≈ 330 km end to end (chord ≈ arc at this scale).
    expect(trains[0].lengthKm).toBeGreaterThan(320);
    expect(trains[0].lengthKm).toBeLessThan(335);
    // sorted along the line: member indices run monotonically (either direction)
    const m = trains[0].members;
    const ascending = m[0] < m[m.length - 1];
    for (let i = 1; i < m.length; i++) expect(m[i] > m[i - 1]).toBe(ascending);
  });

  it("does not call a settled, widely spaced constellation a train", () => {
    const sats = Array.from({ length: 22 }, (_, i) => ({ anomaly: i * (360 / 22) }));
    const { positions, planes, all } = build(sats);
    expect(detectTrains(all, positions, planes)).toEqual([]);
  });

  it("requires a minimum cluster size", () => {
    const { positions, planes, all } = build([{ anomaly: 10 }, { anomaly: 10 + deg(20) }, { anomaly: 10 + deg(40) }]);
    expect(detectTrains(all, positions, planes)).toEqual([]);
    expect(detectTrains(all, positions, planes, { minSize: 3 })).toHaveLength(1);
  });

  it("separates close satellites that are in different planes", () => {
    // Same place, 3° of RAAN apart: physically near each other but not co-planar.
    const a = Array.from({ length: 6 }, (_, i) => ({ anomaly: 40 + i * deg(25), raan: 100 }));
    const b = Array.from({ length: 6 }, (_, i) => ({ anomaly: 40 + i * deg(25), raan: 103 }));
    const { positions, planes, all } = build([...a, ...b]);
    // Planes are ~3° RAAN apart => hundreds of km apart at the equator crossing, but force the issue:
    // widen the link distance so only the plane check can keep them apart.
    const trains = detectTrains(all, positions, planes, { linkKm: 400, maxRaanDeg: 1.5 });
    expect(trains).toHaveLength(2);
    expect(trains.map((t) => t.members.length)).toEqual([6, 6]);
  });

  it("reports two separate trains largest first with sequential ids", () => {
    const big = Array.from({ length: 9 }, (_, i) => ({ anomaly: 20 + i * deg(25) }));
    const small = Array.from({ length: 6 }, (_, i) => ({ anomaly: 200 + i * deg(25) }));
    const { positions, planes, all } = build([...small, ...big]);
    const trains = detectTrains(all, positions, planes);
    expect(trains.map((t) => t.members.length)).toEqual([9, 6]);
    expect(trains.map((t) => t.id)).toEqual([0, 1]);
  });

  it("ignores objects parked at the origin (decayed)", () => {
    const sats = Array.from({ length: 6 }, (_, i) => ({ anomaly: 40 + i * deg(25) }));
    const { positions, planes, all } = build(sats);
    positions.fill(0); // all parked
    expect(detectTrains(all, positions, planes)).toEqual([]);
  });
});
