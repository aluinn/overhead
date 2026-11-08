"use client";

import { useClockView } from "@/hooks/useClock";
import { formatInt } from "@/lib/utils/format";
import { useAppState, useRuntime, type ConjunctionView } from "@/store/runtime";
import { NearMissItem } from "./NearMissItem";

const SOURCE_LABEL = {
  socrates: "CELESTRAK SOCRATES · NEXT 72H",
  "stale-cache": "CELESTRAK SOCRATES (CACHED)",
  sample: "OFFLINE SAMPLE EVENTS",
  computed: "COMPUTED IN YOUR BROWSER",
} as const;

/** Upcoming close approaches between tracked objects; click one to time-travel to it. */
export function NearMissFeed() {
  const { store } = useRuntime();
  const { status, source, scanned, items } = useAppState((s) => s.conjunctions);
  const active = useAppState((s) => s.activeConjunction);
  const trackedOnly = useAppState((s) => s.trackedOnly);
  const view = useClockView(1000);
  const nowMs = view?.simMs ?? 0;

  const shown = trackedOnly ? items.filter((c) => c.indexA >= 0 && c.indexB >= 0) : items;
  // Hide events that already happened (relative to the simulated clock), keep the active one.
  const upcoming = shown.filter((c) => c.tcaMs > nowMs - 60_000 || c.id === active?.id);

  const select = (item: ConjunctionView) => store.set({ activeConjunction: item, selected: null, info: null });

  return (
    <div className="p-3">
      <div className="flex items-center justify-between px-1 font-mono text-[9px] tracking-[0.16em] text-[var(--muted)]">
        <span>{source ? SOURCE_LABEL[source] : "LOADING…"}</span>
        <button
          type="button"
          role="switch"
          aria-checked={trackedOnly}
          onClick={() => store.set({ trackedOnly: !trackedOnly })}
          className="transition-colors hover:text-[var(--fg)]"
        >
          TRACKED ONLY <span className={trackedOnly ? "text-[var(--accent)]" : ""}>{trackedOnly ? "ON" : "OFF"}</span>
        </button>
      </div>

      {source === "computed" && (
        <p className="mt-2 px-1 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
          SOCRATES is unreachable, so these come from a {formatInt(scanned)}-object subset. Fewer events than the full catalog.
        </p>
      )}

      <ul className="mt-2 space-y-0.5" data-testid="near-miss-list">
        {upcoming.map((c) => (
          <NearMissItem key={c.id} item={c} nowMs={nowMs} active={active?.id === c.id} onSelect={select} />
        ))}
      </ul>

      {status !== "idle" && upcoming.length === 0 && (
        <p className="px-1 py-6 text-center font-mono text-[11px] text-[var(--muted)]">
          {status === "loading" || !source ? "Fetching conjunction data…" : trackedOnly && items.length > 0 ? "No events between tracked objects. Turn off TRACKED ONLY." : "No upcoming close approaches."}
        </p>
      )}
    </div>
  );
}
