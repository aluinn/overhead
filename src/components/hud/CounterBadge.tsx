"use client";

import { formatInt } from "@/lib/utils/format";
import { useAppState } from "@/store/runtime";

/** Headline stat. Stage 3 swaps this to "objects above you" once an observer is set. */
export function CounterBadge() {
  const count = useAppState((s) => s.catalog?.count ?? 0);
  const status = useAppState((s) => s.status);

  return (
    <div className="pointer-events-none absolute right-5 top-5 z-10 text-right sm:right-8 sm:top-7" data-testid="counter">
      <div className="font-mono text-3xl font-light tabular-nums tracking-tight text-[var(--fg)] sm:text-5xl">
        {status === "loading" ? <span className="text-[var(--muted)]">——</span> : formatInt(count)}
      </div>
      <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)]">
        {status === "error" ? "NO DATA AVAILABLE" : "OBJECTS IN ORBIT"}
      </div>
    </div>
  );
}
