/**
 * Regenerates public/data/sample-gp.json, the offline fallback dataset.
 *
 *   node scripts/fetch-sample-data.ts
 *
 * Runs on Node >= 22.6 (native TypeScript type stripping), no extra deps.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseGpJson } from "../src/lib/data/parse.ts";
import { parseSocratesCsv, SOCRATES_URL } from "../src/lib/data/socrates.ts";
import type { CompactGp } from "../src/types/index.ts";

const BASE = "https://celestrak.org/NORAD/elements/gp.php";
const UA = "overhead-app sample generator (+https://github.com/aluinn/overhead)";

// How many objects of each group to keep. Small enough to keep the repo light,
// big enough that the fallback globe still looks alive.
const PLAN: Record<string, number> = {
  stations: Infinity,
  starlink: 420,
  active: 600,
  "cosmos-2251-debris": 80,
  "iridium-33-debris": 60,
  "fengyun-1c-debris": 140,
  "cosmos-1408-debris": 60,
};

async function getGroup(group: string): Promise<CompactGp[]> {
  const res = await fetch(`${BASE}?GROUP=${group}&FORMAT=json`, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${group}: HTTP ${res.status}`);
  return parseGpJson(await res.json());
}

/** Keep a contiguous slab of Starlink (sorted by RAAN) so the sample includes real trains. */
function pickStarlink(all: CompactGp[], n: number): CompactGp[] {
  const byRaan = [...all].sort((a, b) => a[6] - b[6]);
  const start = Math.floor(byRaan.length / 3);
  return byRaan.slice(start, start + n);
}

function evenlySpaced<T>(all: T[], n: number): T[] {
  if (all.length <= n) return all;
  const step = all.length / n;
  return Array.from({ length: n }, (_, i) => all[Math.floor(i * step)]);
}

const groups: Record<string, CompactGp[]> = {};
for (const [group, keep] of Object.entries(PLAN)) {
  const all = await getGroup(group);
  groups[group] =
    group === "starlink" ? pickStarlink(all, keep) : group === "stations" ? all : evenlySpaced(all, keep);
  console.log(`${group}: kept ${groups[group].length} of ${all.length}`);
}

console.log("fetching SOCRATES (~20 MB)…");
const csv = await (await fetch(SOCRATES_URL, { headers: { "user-agent": UA } })).text();
const conjunctions = parseSocratesCsv(csv, { limit: 40, notBeforeMs: Date.now(), minRelSpeedKmS: 0.5 });
console.log(`conjunctions: kept ${conjunctions.length}`);

const out = path.join(import.meta.dirname, "..", "public", "data", "sample-gp.json");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), groups, conjunctions }));
console.log(`wrote ${out}`);
