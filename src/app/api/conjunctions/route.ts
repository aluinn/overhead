import { NextResponse } from "next/server";
import { loadSample } from "@/lib/data/sample";
import { parseSocratesCsv, SOCRATES_URL } from "@/lib/data/socrates";
import type { Conjunction, ConjunctionResponse } from "@/types";

export const runtime = "nodejs";
// The CSV is ~20 MB; parsing it takes a moment on a cold instance.
export const maxDuration = 30;

const REVALIDATE_MS = 3 * 60 * 60 * 1000;
const WINDOW_MS = 72 * 60 * 60 * 1000;
const LIMIT = 120;

let cache: { at: number; conjunctions: Conjunction[] } | null = null;
let inflight: Promise<Conjunction[]> | null = null;

async function fetchSocrates(): Promise<Conjunction[]> {
  const now = Date.now();
  const res = await fetch(SOCRATES_URL, {
    // Over Next's 2 MB data-cache limit, so cache the *parsed* result ourselves.
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
    headers: { "user-agent": "overhead-app (+https://github.com/aluinn/overhead)" },
  });
  if (!res.ok) throw new Error(`SOCRATES: HTTP ${res.status}`);
  const all = parseSocratesCsv(await res.text(), {
    // Docked/co-orbiting pairs (ISS + visiting vehicles) show 0 km range at ~0 km/s: not interesting.
    minRelSpeedKmS: 0.5,
    notBeforeMs: now,
    limit: Number.MAX_SAFE_INTEGER,
  });
  const upcoming = all.filter((c) => c.tcaMs <= now + WINDOW_MS);
  if (upcoming.length === 0) throw new Error("SOCRATES: no upcoming conjunctions parsed");
  return upcoming.slice(0, LIMIT);
}

function respond(body: ConjunctionResponse, ttl: number) {
  return NextResponse.json(body, {
    headers: {
      "cache-control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
      "x-overhead-source": body.source,
    },
  });
}

/** GET /api/conjunctions — closest predicted approaches from CelesTrak SOCRATES Plus. */
export async function GET() {
  if (cache && Date.now() - cache.at < REVALIDATE_MS) {
    return respond({ source: "socrates", fetchedAt: new Date(cache.at).toISOString(), conjunctions: cache.conjunctions }, REVALIDATE_MS / 1000);
  }

  inflight ??= fetchSocrates().finally(() => {
    inflight = null;
  });

  try {
    const conjunctions = await inflight;
    cache = { at: Date.now(), conjunctions };
    return respond({ source: "socrates", fetchedAt: new Date(cache.at).toISOString(), conjunctions }, REVALIDATE_MS / 1000);
  } catch (err) {
    console.warn("[conjunctions] upstream failed:", err instanceof Error ? err.message : err);
    const now = Date.now();
    if (cache) {
      const live = cache.conjunctions.filter((c) => c.tcaMs > now);
      if (live.length > 0) {
        return respond({ source: "stale-cache", fetchedAt: new Date(cache.at).toISOString(), conjunctions: live }, 300);
      }
    }
    // Last resort: bundled sample, shifted so its events lie in the future.
    const sample = await loadSample();
    const shift = now - Date.parse(sample.generatedAt);
    const conjunctions = sample.conjunctions.map((c) => ({ ...c, tcaMs: c.tcaMs + shift }));
    return respond({ source: "sample", fetchedAt: sample.generatedAt, conjunctions }, 300);
  }
}
