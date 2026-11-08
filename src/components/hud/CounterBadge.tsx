"use client";

import { useObserverActions } from "@/hooks/useObserver";
import { formatInt } from "@/lib/utils/format";
import { useAppState } from "@/store/runtime";

/** Headline stat: total in orbit, or "above you right now" once a location is set. */
export function CounterBadge() {
  const total = useAppState((s) => s.catalog?.count ?? 0);
  const status = useAppState((s) => s.status);
  const observer = useAppState((s) => s.observer);
  const above = useAppState((s) => s.sky.visible.count);
  const { locate, setObserver, status: locating } = useObserverActions();

  const sky = observer !== null;
  const value = sky ? above : total;

  return (
    <div className="absolute right-5 top-5 z-10 text-right sm:right-8 sm:top-7" data-testid="counter">
      <div className="pointer-events-none font-mono text-3xl font-light tabular-nums tracking-tight text-[var(--fg)] sm:text-5xl" aria-live="off">
        {status === "loading" ? <span className="text-[var(--muted)]">——</span> : formatInt(value)}
      </div>
      <div className="pointer-events-none mt-1 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)]">
        {status === "error" ? "NO DATA AVAILABLE" : sky ? `OBJECTS OVER ${observer.label.toUpperCase()} RIGHT NOW` : "OBJECTS IN ORBIT"}
      </div>
      {status === "ready" && (
        <button
          type="button"
          onClick={() => (sky ? setObserver(null) : void locate())}
          disabled={locating === "locating"}
          className="pointer-events-auto mt-3 rounded-sm border border-[var(--accent)]/50 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 disabled:opacity-60"
        >
          {sky ? "← WORLD VIEW" : locating === "locating" ? "LOCATING…" : "◎ OVER MY HEAD"}
        </button>
      )}
    </div>
  );
}
