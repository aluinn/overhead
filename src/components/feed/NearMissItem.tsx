import { formatRelative, formatUtcTime } from "@/lib/utils/format";
import type { ConjunctionView } from "@/store/runtime";

interface Props {
  item: ConjunctionView;
  /** Sim time, used for the countdown. */
  nowMs: number;
  active: boolean;
  onSelect: (item: ConjunctionView) => void;
}

const fmtRange = (km: number): string => (km < 10 ? km.toFixed(3) : km < 100 ? km.toFixed(2) : km.toFixed(1));

/** One predicted close approach. Untracked objects can't be flown to, so those rows are inert. */
export function NearMissItem({ item, nowMs, active, onSelect }: Props) {
  const tracked = item.indexA >= 0 && item.indexB >= 0;
  const tight = item.rangeKm < 1;

  return (
    <li>
      <button
        type="button"
        disabled={!tracked}
        onClick={() => onSelect(item)}
        aria-pressed={active}
        title={tracked ? "Fly to this close approach" : "One of these objects isn't in the tracked set"}
        className={`w-full rounded-sm border px-3 py-2.5 text-left transition-colors ${
          active ? "border-[var(--accent)]/60 bg-[var(--accent)]/10" : "border-transparent hover:bg-white/5"
        } ${tracked ? "" : "cursor-not-allowed opacity-45"}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-mono text-[11px] text-[var(--fg)]">
            {item.name1} <span className="text-[var(--muted)]">×</span> {item.name2}
          </span>
          <span
            className={`shrink-0 font-mono text-[13px] tabular-nums ${tight ? "text-[#ff6a3d]" : "text-[var(--fg)]"}`}
            aria-label={`${fmtRange(item.rangeKm)} kilometres`}
          >
            {fmtRange(item.rangeKm)}
            <span className="ml-0.5 text-[9px] text-[var(--muted)]">km</span>
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between font-mono text-[9px] tracking-[0.14em] text-[var(--muted)]">
          <span>
            {formatRelative(item.tcaMs, nowMs).toUpperCase()} · {formatUtcTime(item.tcaMs)}Z
          </span>
          <span className="tabular-nums">{item.relSpeedKmS.toFixed(1)} KM/S</span>
        </div>
      </button>
    </li>
  );
}
