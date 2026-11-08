import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GP_GROUPS, type CompactGp, type DataSource, type GpGroup, type GpResponse } from "@/types";
import { parseGpJson } from "./parse";
import { sampleGpFor } from "./sample";

const BASE = "https://celestrak.org/NORAD/elements/gp.php";
/** CelesTrak refreshes roughly every 2h and blocks clients that re-download sooner. */
const REVALIDATE_MS = 3 * 60 * 60 * 1000;
/** After a failure (403/timeout/…), don't touch upstream again for this long. */
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 20_000;

/** Seconds a CDN may serve a good upstream response. */
export const CDN_TTL_S = REVALIDATE_MS / 1000;
/** Fallback responses are cached briefly so we retry upstream soon. */
export const FALLBACK_TTL_S = 300;

interface CacheEntry {
  at: number;
  records: CompactGp[];
}

// Three layers, cheapest first: instance memory → /tmp on disk (survives
// restarts and shared by warm serverless instances) → CelesTrak. On top of
// that, the CDN `s-maxage` header absorbs most traffic on Vercel.
const memory = new Map<GpGroup, CacheEntry>();
const inflight = new Map<GpGroup, Promise<CompactGp[]>>();
const failedAt = new Map<GpGroup, number>();

const diskDir = path.join(os.tmpdir(), "overhead-cache");
const diskFile = (group: GpGroup) => path.join(diskDir, `gp-${group}.json`);

async function readDisk(group: GpGroup): Promise<CacheEntry | null> {
  try {
    const entry = JSON.parse(await readFile(diskFile(group), "utf8")) as CacheEntry;
    return Array.isArray(entry.records) && typeof entry.at === "number" ? entry : null;
  } catch {
    return null;
  }
}

async function writeDisk(group: GpGroup, entry: CacheEntry): Promise<void> {
  try {
    await mkdir(diskDir, { recursive: true });
    await writeFile(diskFile(group), JSON.stringify(entry));
  } catch {
    // Read-only filesystem: the memory cache still works.
  }
}

async function fetchUpstream(group: GpGroup): Promise<CompactGp[]> {
  const url = `${BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "overhead-app (+https://github.com/aluinn/overhead)", accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CelesTrak ${group}: HTTP ${res.status}`);
  const records = parseGpJson(await res.json());
  if (records.length === 0) throw new Error(`CelesTrak ${group}: no valid records`);
  return records;
}

type GroupResult = GpResponse & { ttlSeconds: number };

const isFresh = (e: CacheEntry | undefined | null): boolean => !!e && Date.now() - e.at < REVALIDATE_MS;

function ok(group: GpGroup, entry: CacheEntry): GroupResult {
  return { group, source: "celestrak", fetchedAt: new Date(entry.at).toISOString(), records: entry.records, ttlSeconds: CDN_TTL_S };
}

export async function getGroup(group: GpGroup): Promise<GroupResult> {
  let entry = memory.get(group);
  if (entry && isFresh(entry)) return ok(group, entry);

  const disk = await readDisk(group);
  if (disk && (!entry || disk.at > entry.at)) {
    entry = disk;
    memory.set(group, disk);
  }
  if (entry && isFresh(entry)) return ok(group, entry);

  const lastFail = failedAt.get(group);
  const backingOff = lastFail !== undefined && Date.now() - lastFail < FAILURE_BACKOFF_MS;

  if (!backingOff) {
    let pending = inflight.get(group);
    if (!pending) {
      pending = fetchUpstream(group).finally(() => inflight.delete(group));
      inflight.set(group, pending);
    }
    try {
      const records = await pending;
      const next = { at: Date.now(), records };
      memory.set(group, next);
      failedAt.delete(group);
      void writeDisk(group, next);
      return ok(group, next);
    } catch (err) {
      failedAt.set(group, Date.now());
      console.warn(`[gp] upstream failed for ${group}:`, err instanceof Error ? err.message : err);
    }
  }

  // Degrade: stale cache first, bundled sample last.
  let source: DataSource;
  let records: CompactGp[];
  let at: number;
  if (entry) {
    source = "stale-cache";
    records = entry.records;
    at = entry.at;
  } else {
    source = "sample";
    records = await sampleGpFor(group);
    at = Date.now();
  }
  return { group, source, fetchedAt: new Date(at).toISOString(), records, ttlSeconds: FALLBACK_TTL_S };
}

export const ALL_GROUPS = Object.keys(GP_GROUPS) as GpGroup[];
