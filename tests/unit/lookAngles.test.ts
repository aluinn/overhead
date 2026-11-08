import { describe, expect, it } from "vitest";
import { compass, computeVisible, footprintAngleDeg, lookAngle, observerBasis } from "@/lib/orbital/lookAngles";
import { R_EARTH_KM } from "@/lib/orbital/propagate";

/** Scene (Y-up) position for an ECEF point in km. */
const toScene = (x: number, y: number, z: number): [number, number, number] => [x / R_EARTH_KM, z / R_EARTH_KM, -y / R_EARTH_KM];

describe("observerBasis", () => {
  it("puts an equatorial, prime-meridian observer on the +X axis at the WGS-84 radius", () => {
    const o = observerBasis(0, 0, 0);
    expect(o.x).toBeCloseTo(6378.137, 3);
    expect(o.y).toBeCloseTo(0, 6);
    expect(o.z).toBeCloseTo(0, 6);
    expect(o.up).toEqual([1, 0, 0]);
    expect(o.east).toEqual([-0, 1, 0]);
    expect(o.north).toEqual([-0, -0, 1]);
  });

  it("is flattened at the poles (b ≈ 6356.752 km)", () => {
    const o = observerBasis(90, 0, 0);
    expect(o.z).toBeCloseTo(6356.752, 2);
  });
});

describe("lookAngle", () => {
  const obs = observerBasis(0, 0, 0);

  it("sees a satellite straight up at 90° elevation", () => {
    const la = lookAngle(obs, 6378.137 + 500, 0, 0);
    expect(la.elevationDeg).toBeCloseTo(90, 6);
    expect(la.rangeKm).toBeCloseTo(500, 6);
  });

  it("reports azimuth 0° for north, 90° for east, 180° for south, 270° for west", () => {
    const base = 6378.137;
    // Slightly above the horizon in each direction (tilted up by raising x).
    expect(lookAngle(obs, base + 300, 0, 800).azimuthDeg).toBeCloseTo(0, 5);
    expect(lookAngle(obs, base + 300, 800, 0).azimuthDeg).toBeCloseTo(90, 5);
    expect(lookAngle(obs, base + 300, 0, -800).azimuthDeg).toBeCloseTo(180, 5);
    expect(lookAngle(obs, base + 300, -800, 0).azimuthDeg).toBeCloseTo(270, 5);
  });

  it("gives negative elevation for something below the local horizon", () => {
    expect(lookAngle(obs, -7000, 0, 0).elevationDeg).toBeLessThan(0);
  });

  it("matches a hand-computed elevation (500 km up, 1000 km north)", () => {
    // Flat-earth-ish check using the local frame: up = 500, north ≈ 1000 along the surface
    // but the earth curves away, so elevation is below atan(500/1000)=26.6°.
    const la = lookAngle(obs, 6378.137 + 500, 0, 1000);
    expect(la.elevationDeg).toBeGreaterThan(20);
    expect(la.elevationDeg).toBeLessThan(26.6);
  });
});

describe("footprintAngleDeg", () => {
  it("is ~15° of arc for a 550 km Starlink seen above 10°", () => {
    expect(footprintAngleDeg(550, 10)).toBeCloseTo(15.0, 0);
  });
  it("grows with altitude and shrinks with a higher mask", () => {
    expect(footprintAngleDeg(1200, 10)).toBeGreaterThan(footprintAngleDeg(550, 10));
    expect(footprintAngleDeg(550, 30)).toBeLessThan(footprintAngleDeg(550, 10));
  });
});

describe("compass", () => {
  it.each([
    [0, "N"],
    [359, "N"],
    [45, "NE"],
    [90, "E"],
    [200, "SSW"],
    [270, "W"],
  ])("%i° → %s", (az, label) => {
    expect(compass(az)).toBe(label);
  });
});

describe("computeVisible", () => {
  const obs = observerBasis(0, 0, 0);
  // Observer at (0N, 0E). Objects as ECEF km:
  const overhead = [6378.137 + 550, 0, 0];
  const lowElevation = (() => {
    // ~5° elevation: far along the surface east.
    const lon = (20 * Math.PI) / 180;
    const r = 6378.137 + 550;
    return [r * Math.cos(lon), r * Math.sin(lon), 0];
  })();
  const farSide = [-(6378.137 + 550), 0, 0];
  const highish = (() => {
    const lon = (6 * Math.PI) / 180; // closer: should be well above 10°
    const r = 6378.137 + 550;
    return [r * Math.cos(lon), r * Math.sin(lon), 0];
  })();
  const decayed = [0, 0, 0];

  const pts = [overhead, lowElevation, farSide, highish, decayed];
  const scene = new Float32Array(pts.flatMap(([x, y, z]) => (x === 0 && y === 0 && z === 0 ? [0, 0, 0] : toScene(x, y, z))));

  it("keeps only objects above the mask, highest first, and ignores parked/decayed ones", () => {
    const v = computeVisible(scene, scene, 0, pts.length, obs, 10);
    expect(Array.from(v.indices.subarray(0, v.count))).toEqual([0, 3]);
    expect(v.elevationDeg[0]).toBeGreaterThan(v.elevationDeg[1]);
    expect(v.elevationDeg[0]).toBeCloseTo(90, 1);
    expect(v.elevationDeg[1]).toBeGreaterThan(10);
  });

  it("lowers the cut when the mask is lowered", () => {
    const v = computeVisible(scene, scene, 0, pts.length, obs, 0);
    // the 20°-east object is above the true horizon, but its elevation is positive but small
    expect(v.count).toBe(3);
    expect(Array.from(v.indices)).toEqual([0, 3, 1]);
  });

  it("interpolates between snapshots by alpha", () => {
    const a = new Float32Array(toScene(...(overhead as [number, number, number])));
    const b = new Float32Array(toScene(...(farSide as [number, number, number])));
    expect(computeVisible(a, b, 0, 1, obs, 10).count).toBe(1);
    expect(computeVisible(a, b, 1, 1, obs, 10).count).toBe(0);
  });
});
