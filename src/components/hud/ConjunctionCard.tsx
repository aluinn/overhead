"use client";

import { useClockView } from "@/hooks/useClock";
import { formatKm, formatUtc } from "@/lib/utils/format";
import { useAppState, useRuntime } from "@/store/runtime";

/** Shown while a close approach is on screen: who, when, how close, how fast. */
export function ConjunctionCard() {
  const { store, clock } = useRuntime();
  const c = useAppState((s) => s.activeConjunction);
  const view = useClockView(250);
  if (!c) return null;

  const dt = view ? (view.simMs - c.tcaMs) / 1000 : 0;
  const countdown = `T${dt <= 0 ? "−" : "+"}${Math.abs(dt).toFixed(0).padStart(2, "0")}s`;

  return (
    <section
      className="pointer-events-auto w-[min(92vw,300px)] rounded-sm border border-[var(--accent)]/40 bg-black/55 p-4 backdrop-blur-md sm:fixed sm:left-8 sm:top-28"
      aria-label="Close approach"
      data-testid="conjunction-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)]">CLOSE APPROACH</div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => store.set({ activeConjunction: null })}
          className="-m-1 p-1 font-mono text-xs text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        >
          ✕
        </button>
      </div>

      <h2 className="mt-2 font-mono text-[12px] leading-snug text-[var(--fg)]">
        <span className="text-[var(--accent)]">●</span> {c.name1}
        <br />
        <span className="text-[#ff8a4c]">●</span> {c.name2}
      </h2>

      <div className="mt-3 font-mono text-3xl font-light tabular-nums tracking-tight text-[var(--fg)]">{countdown}</div>
      <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)]">TCA {formatUtc(c.tcaMs)}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 font-mono">
        <div>
          <dt className="text-[9px] tracking-[0.2em] text-[var(--muted)]">MISS DISTANCE</dt>
          <dd className="mt-0.5 text-[13px] tabular-nums text-[var(--fg)]">{formatKm(c.rangeKm, c.rangeKm < 10 ? 3 : 1)}</dd>
        </div>
        <div>
          <dt className="text-[9px] tracking-[0.2em] text-[var(--muted)]">RELATIVE SPEED</dt>
          <dd className="mt-0.5 text-[13px] tabular-nums text-[var(--fg)]">{c.relSpeedKmS.toFixed(2)} km/s</dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => store.set({ activeConjunction: { ...c } })}
          className="flex-1 rounded-sm border border-[var(--line)] px-2.5 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"
        >
          ↺ REPLAY
        </button>
        <button
          type="button"
          onClick={() => {
            store.set({ activeConjunction: null });
            clock.goLive();
          }}
          className="flex-1 rounded-sm border border-[var(--line)] px-2.5 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"
        >
          BACK TO NOW
        </button>
      </div>
    </section>
  );
}
