import { gstime } from "satellite.js";

const DEG = Math.PI / 180;

/**
 * Low-precision solar position (Astronomical Almanac, accurate to ~0.01°),
 * returned as a unit vector in the Earth-fixed (ECEF) frame.
 *
 * Axes follow the ECEF convention: +X through (0°N, 0°E), +Y through
 * (0°N, 90°E), +Z through the north pole.
 */
export function sunDirectionEcef(date: Date): [number, number, number] {
  const jd = date.getTime() / 86_400_000 + 2_440_587.5;
  const n = jd - 2_451_545.0;

  const meanLon = (280.46 + 0.9856474 * n) * DEG;
  const meanAnomaly = (357.528 + 0.9856003 * n) * DEG;
  const eclipticLon =
    meanLon + (1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * DEG;
  const obliquity = (23.439 - 0.0000004 * n) * DEG;

  // Sun direction in the inertial (ECI / J2000-ish) frame.
  const xi = Math.cos(eclipticLon);
  const yi = Math.cos(obliquity) * Math.sin(eclipticLon);
  const zi = Math.sin(obliquity) * Math.sin(eclipticLon);

  // Rotate into ECEF by the Greenwich sidereal angle.
  const theta = gstime(date);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c * xi + s * yi, -s * xi + c * yi, zi];
}
