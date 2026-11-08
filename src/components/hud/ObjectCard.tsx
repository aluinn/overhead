"use client";

import { KIND_COLORS } from "@/components/globe/SatellitePoints";
import { formatKm, formatLat, formatLon } from "@/lib/utils/format";
import { useAppState, useRuntime } from "@/store/runtime";
import { ObjectKind } from "@/types";

const KIND_LABEL: Record<ObjectKind, string> = {
  [ObjectKind.Other]: "SATELLITE",
  [ObjectKind.Debris]: "DEBRIS",
  [ObjectKind.Starlink]: "STARLINK",
  [ObjectKind.Station]: "STATION",
};

export function ObjectCard() {
  const { store } = useRuntime();
  const selected = useAppState((s) => s.selected);
  const catalog = useAppState((s) => s.catalog);
  const info = useAppState((s) => s.info);
  const showTrail = useAppState((s) => s.showTrail);

  if (selected === null || !catalog) return null;
  const kind = catalog.kinds[selected] as ObjectKind;
  const color = KIND_COLORS[kind];

  return (
    <section
      className="pointer-events-auto w-[min(92vw,300px)] sm:fixed sm:left-8 sm:top-28 rounded-sm border border-[var(--line)] bg-black/50 p-4 backdrop-blur-md"
      aria-label="Selected object"
      data-testid="object-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.2em]" style={{ color }}>
            <span className="size-1.5 rounded-full" style={{ background: color }} />
            {KIND_LABEL[kind]}
          </div>
          <h2 className="mt-1.5 truncate font-mono text-sm tracking-wide text-[var(--fg)]">{catalog.names[selected]}</h2>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)]">NORAD {catalog.ids[selected]}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => store.set({ selected: null, info: null })}
          className="-m-1 p-1 font-mono text-xs text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        >
          ✕
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 font-mono">
        <Stat label="ALTITUDE" value={info ? formatKm(info.altKm, 0) : "—"} />
        <Stat label="SPEED" value={info ? `${info.speedKmS.toFixed(2)} km/s` : "—"} />
        <Stat label="LAT / LON" value={info ? `${formatLat(info.latDeg)} ${formatLon(info.lonDeg)}` : "—"} small />
        <Stat label="PERIOD" value={info ? `${info.periodMin.toFixed(1)} min` : "—"} />
      </dl>

      <button
        type="button"
        role="switch"
        aria-checked={showTrail}
        onClick={() => store.set({ showTrail: !showTrail })}
        className="mt-4 flex w-full items-center justify-between rounded-sm border border-[var(--line)] px-2.5 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"
      >
        ORBIT TRAIL
        <span className={showTrail ? "text-[var(--accent)]" : ""}>{showTrail ? "ON" : "OFF"}</span>
      </button>
    </section>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <dt className="text-[9px] tracking-[0.2em] text-[var(--muted)]">{label}</dt>
      <dd className={`mt-0.5 tabular-nums text-[var(--fg)] ${small ? "text-[11px]" : "text-[13px]"}`}>{value}</dd>
    </div>
  );
}
