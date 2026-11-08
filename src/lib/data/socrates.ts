import type { Conjunction } from "@/types";
import { splitCsvLine } from "./parse.ts";

export const SOCRATES_URL = "https://celestrak.org/SOCRATES/sort-minRange.csv";

export interface ParseOptions {
  /** Drop events with a relative speed below this (km/s). Filters docked / co-orbiting pairs. */
  minRelSpeedKmS?: number;
  /** Drop events that happened before this instant (epoch ms). */
  notBeforeMs?: number;
  /** Keep at most this many (closest first). */
  limit?: number;
}

/** Strip the operational-status suffix SOCRATES appends, e.g. "POISK [+]" -> "POISK". */
export function cleanName(raw: string): string {
  return raw.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
}

/** SOCRATES timestamps are UTC, formatted `YYYY-MM-DD HH:MM:SS.sss`. */
export function parseTca(raw: string): number {
  const iso = raw.trim().replace(" ", "T");
  return Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
}

/**
 * Parse the SOCRATES Plus CSV (header + one row per conjunction).
 * The file is ~20 MB, so rows are scanned line by line and only the ones that
 * survive the filters are materialised.
 */
export function parseSocratesCsv(csv: string, opts: ParseOptions = {}): Conjunction[] {
  const { minRelSpeedKmS = 0.5, notBeforeMs = 0, limit = 150 } = opts;
  const out: Conjunction[] = [];

  let header: string[] | null = null;
  let idx: Record<string, number> = {};
  let pos = 0;

  while (pos < csv.length) {
    let end = csv.indexOf("\n", pos);
    if (end === -1) end = csv.length;
    const line = csv.slice(pos, end).replace(/\r$/, "");
    pos = end + 1;
    if (line.length === 0) continue;

    if (header === null) {
      header = splitCsvLine(line);
      idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
      for (const required of ["NORAD_CAT_ID_1", "OBJECT_NAME_1", "NORAD_CAT_ID_2", "OBJECT_NAME_2", "TCA", "TCA_RANGE", "TCA_RELATIVE_SPEED"]) {
        if (!(required in idx)) throw new Error(`SOCRATES CSV missing column ${required}`);
      }
      continue;
    }

    const f = splitCsvLine(line);
    const relSpeed = Number(f[idx.TCA_RELATIVE_SPEED]);
    const range = Number(f[idx.TCA_RANGE]);
    const tca = parseTca(f[idx.TCA] ?? "");
    if (!Number.isFinite(relSpeed) || !Number.isFinite(range) || Number.isNaN(tca)) continue;
    if (relSpeed < minRelSpeedKmS || tca < notBeforeMs) continue;

    const id1 = Number(f[idx.NORAD_CAT_ID_1]);
    const id2 = Number(f[idx.NORAD_CAT_ID_2]);
    if (!Number.isInteger(id1) || !Number.isInteger(id2)) continue;

    const probRaw = idx.MAX_PROB !== undefined ? Number(f[idx.MAX_PROB]) : NaN;

    out.push({
      id: `${id1}-${id2}-${tca}`,
      noradId1: id1,
      name1: cleanName(f[idx.OBJECT_NAME_1]),
      noradId2: id2,
      name2: cleanName(f[idx.OBJECT_NAME_2]),
      tcaMs: tca,
      rangeKm: range,
      relSpeedKmS: relSpeed,
      maxProbability: Number.isFinite(probRaw) ? probRaw : null,
    });
  }

  out.sort((a, b) => a.rangeKm - b.rangeKm);
  return out.slice(0, limit);
}
