import type { Observer } from "@/types";
import { observerFromCoords } from "./cityLookup";

export type GeoFailure = "denied" | "unavailable" | "timeout" | "unsupported";

export type GeoResult = { ok: true; observer: Observer } | { ok: false; reason: GeoFailure };

/** Promise wrapper over the Geolocation API. Never throws; failures carry a reason for the UI. */
export function requestLocation(timeoutMs = 10_000): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          observer: {
            ...observerFromCoords(pos.coords.latitude, pos.coords.longitude),
            altKm: Math.max(0, (pos.coords.altitude ?? 0) / 1000),
          },
        }),
      (err) =>
        resolve({
          ok: false,
          reason: err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable",
        }),
      // Coarse is plenty: a satellite at 500 km doesn't care about 5 km of error.
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60_000 },
    );
  });
}

const STORAGE_KEY = "overhead:observer";

/** Remembered observer (per-browser convenience only; storage may be unavailable). */
export function loadSavedObserver(): Observer | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Observer>;
    if (typeof o.latDeg === "number" && typeof o.lonDeg === "number" && typeof o.label === "string") {
      return { latDeg: o.latDeg, lonDeg: o.lonDeg, altKm: typeof o.altKm === "number" ? o.altKm : 0, label: o.label };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveObserver(observer: Observer | null): void {
  try {
    if (observer) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(observer));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
