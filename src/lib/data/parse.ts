import type { CompactGp } from "@/types";

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Convert one CelesTrak OMM/GP JSON object into the compact tuple.
 * Returns null when any required field is missing or non-numeric, so a
 * single malformed record never poisons a whole group.
 */
export function compactFromOmm(raw: unknown): CompactGp | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const noradId = num(r.NORAD_CAT_ID);
  const name = typeof r.OBJECT_NAME === "string" ? r.OBJECT_NAME.trim() : null;
  const epochMs = typeof r.EPOCH === "string" ? Date.parse(r.EPOCH.endsWith("Z") ? r.EPOCH : `${r.EPOCH}Z`) : NaN;
  const meanMotion = num(r.MEAN_MOTION);
  const ecc = num(r.ECCENTRICITY);
  const incl = num(r.INCLINATION);
  const raan = num(r.RA_OF_ASC_NODE);
  const argp = num(r.ARG_OF_PERICENTER);
  const ma = num(r.MEAN_ANOMALY);
  const bstar = num(r.BSTAR);
  const ndot = num(r.MEAN_MOTION_DOT);
  const nddot = num(r.MEAN_MOTION_DDOT);

  if (
    noradId === null || name === null || Number.isNaN(epochMs) ||
    meanMotion === null || ecc === null || incl === null || raan === null ||
    argp === null || ma === null || bstar === null || ndot === null || nddot === null
  ) {
    return null;
  }
  // Reject physically meaningless element sets (would crash or NaN SGP4).
  if (meanMotion <= 0 || ecc < 0 || ecc >= 1) return null;

  return [noradId, name, epochMs, meanMotion, ecc, incl, raan, argp, ma, bstar, ndot, nddot];
}

/** Parse a CelesTrak GP JSON array into compact records, dropping invalid entries. */
export function parseGpJson(json: unknown): CompactGp[] {
  if (!Array.isArray(json)) return [];
  const out: CompactGp[] = [];
  for (const item of json) {
    const rec = compactFromOmm(item);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * Minimal RFC 4180 CSV line splitter (handles quoted fields and escaped
 * quotes). SOCRATES names can contain commas inside quotes.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}
