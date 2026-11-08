import { describe, expect, it } from "vitest";
import { sunDirectionEcef } from "@/lib/orbital/sun";

describe("sunDirectionEcef", () => {
  it("is a unit vector", () => {
    const [x, y, z] = sunDirectionEcef(new Date("2026-05-05T10:00:00Z"));
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  });

  it("has ~0° declination at the March equinox and ~+23.4° at the June solstice", () => {
    const eq = sunDirectionEcef(new Date("2026-03-20T12:00:00Z"));
    expect(Math.asin(eq[2]) * (180 / Math.PI)).toBeCloseTo(0, 0);
    const sol = sunDirectionEcef(new Date("2026-06-21T12:00:00Z"));
    expect(Math.asin(sol[2]) * (180 / Math.PI)).toBeCloseTo(23.4, 0);
  });

  it("is near the prime meridian (lon ≈ 0°) at solar noon UTC", () => {
    // 12:00 UTC: within the equation of time (±16 min = ±4°) of Greenwich noon.
    const [x, y] = sunDirectionEcef(new Date("2026-04-15T12:00:00Z"));
    const lon = Math.atan2(y, x) * (180 / Math.PI);
    expect(Math.abs(lon)).toBeLessThan(5);
  });

  it("moves west by ~15° per hour in the Earth-fixed frame", () => {
    const lonAt = (iso: string) => {
      const [x, y] = sunDirectionEcef(new Date(iso));
      return Math.atan2(y, x) * (180 / Math.PI);
    };
    const d = lonAt("2026-04-15T13:00:00Z") - lonAt("2026-04-15T12:00:00Z");
    expect(d).toBeCloseTo(-15, 0);
  });
});
