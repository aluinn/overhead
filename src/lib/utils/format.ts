const intFmt = new Intl.NumberFormat("en-US");

export const formatInt = (n: number): string => intFmt.format(Math.round(n));

export function formatKm(km: number, digits = 0): string {
  return `${km.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })} km`;
}

/** `2026-11-08 22:57:03Z` */
export function formatUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ") + "Z";
}

/** `22:57:03` UTC */
export function formatUtcTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

export function formatLat(deg: number): string {
  return `${Math.abs(deg).toFixed(2)}°${deg >= 0 ? "N" : "S"}`;
}

export function formatLon(deg: number): string {
  return `${Math.abs(deg).toFixed(2)}°${deg >= 0 ? "E" : "W"}`;
}

/** Relative time like `in 3h 12m` / `2m ago`. */
export function formatRelative(ms: number, nowMs: number): string {
  const diff = ms - nowMs;
  const abs = Math.abs(diff);
  const m = Math.floor(abs / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const body = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m ${Math.floor((abs % 60_000) / 1000)}s` : `${Math.floor(abs / 1000)}s`;
  return diff >= 0 ? `in ${body}` : `${body} ago`;
}
