"use client";

import { useClockView } from "@/hooks/useClock";
import { formatUtc } from "@/lib/utils/format";
import { SPEEDS } from "@/lib/utils/clock";
import { useRuntime } from "@/store/runtime";

const RANGE_HOURS = 24;

export function TimeControls() {
  const { clock } = useRuntime();
  const view = useClockView();
  const simMs = view?.simMs ?? null;
  const speed = view?.speed ?? 1;
  const isLive = view?.isLive ?? true;
  // Quarter-hour resolution matches the slider step and avoids "-0.00H".
  const offsetH = view ? Math.max(-RANGE_HOURS, Math.min(RANGE_HOURS, Math.round(view.offsetMs / 900_000) / 4)) : 0;

  return (
    <div
      className="pointer-events-auto w-[min(92vw,520px)] rounded-sm border border-[var(--line)] bg-black/45 px-4 py-3 backdrop-blur-md"
      role="group"
      aria-label="Time controls"
    >
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.16em]">
        <span className="tabular-nums text-[var(--fg)]" data-testid="sim-time">
          {simMs === null ? "—" : formatUtc(simMs)}
        </span>
        <button
          type="button"
          onClick={() => clock.goLive()}
          className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 transition-colors ${
            isLive
              ? "border-[var(--accent)]/50 text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
          }`}
        >
          <span className={`size-1.5 rounded-full ${isLive ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`} />
          {isLive ? "LIVE" : "NOW"}
        </button>
      </div>

      <input
        type="range"
        min={-RANGE_HOURS}
        max={RANGE_HOURS}
        step={0.25}
        value={offsetH}
        onChange={(e) => clock.seek(Date.now() + Number(e.target.value) * 3_600_000)}
        aria-label="Scrub time (hours from now)"
        className="scrubber mt-3 w-full"
      />

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-[var(--muted)]">
        <span>{offsetH === 0 ? "±0H" : `${offsetH > 0 ? "+" : "−"}${Math.abs(offsetH).toFixed(offsetH % 1 === 0 ? 0 : 2)}H`}</span>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => clock.setSpeed(s)}
              aria-pressed={speed === s}
              className={`rounded-sm px-2 py-0.5 transition-colors ${
                speed === s ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "hover:text-[var(--fg)]"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
