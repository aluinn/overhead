"use client";

import { useObserverActions } from "@/hooks/useObserver";
import { formatInt } from "@/lib/utils/format";
import { MIN_ELEVATION_DEG, useAppState, useRuntime } from "@/store/runtime";
import { OverheadList } from "./OverheadList";
import { RadarPlot } from "./RadarPlot";

/** "Over my head" content: call-to-action until a location is set, then radar + live list. */
export function SkyTab() {
  const { store } = useRuntime();
  const { locate, setObserver, openPicker, status } = useObserverActions();
  const observer = useAppState((s) => s.observer);
  const catalog = useAppState((s) => s.catalog);
  const sky = useAppState((s) => s.sky);
  const selected = useAppState((s) => s.selected);
  const trainOf = useAppState((s) => s.trainOf);
  const trains = useAppState((s) => s.trains);

  if (!observer || !catalog) {
    return (
      <div className="p-5">
        <p className="font-mono text-[12px] leading-relaxed text-[var(--fg)]">See exactly what&apos;s passing above you, live.</p>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
          Your location stays in your browser. Nothing is sent anywhere.
        </p>
        <button
          type="button"
          onClick={() => void locate()}
          disabled={status === "locating"}
          className="mt-4 w-full rounded-sm border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-3 py-2.5 font-mono text-[11px] tracking-[0.18em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 disabled:opacity-60"
        >
          {status === "locating" ? "LOCATING…" : "◎ OVER MY HEAD"}
        </button>
        <button
          type="button"
          onClick={openPicker}
          className="mt-2 w-full px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        >
          CHOOSE A CITY INSTEAD
        </button>
      </div>
    );
  }

  const select = (index: number) => store.set({ selected: index });
  const total = sky.visible.count;

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.18em]">
        <span className="truncate text-[var(--fg)]">OVER {observer.label.toUpperCase()}</span>
        <span className="flex gap-3 text-[var(--muted)]">
          <button type="button" onClick={openPicker} className="transition-colors hover:text-[var(--fg)]">
            CHANGE
          </button>
          <button type="button" onClick={() => setObserver(null)} className="transition-colors hover:text-[var(--fg)]">
            EXIT
          </button>
        </span>
      </div>

      <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)]">
        ABOVE {MIN_ELEVATION_DEG}° ELEVATION · {formatInt(total)} OBJECTS
        {trains.length > 0 && ` · ${trains.length} STARLINK TRAIN${trains.length === 1 ? "" : "S"} ON THE GLOBE`}
      </p>

      <div className="mt-3">
        <RadarPlot visible={sky.visible} catalog={catalog} selected={selected} trainOf={trainOf} onSelect={select} />
      </div>
      <p className="mt-1 text-center font-mono text-[9px] tracking-[0.18em] text-[var(--muted)]">LOOKING UP · N AT TOP · E AT LEFT</p>

      <div className="mt-4">
        <OverheadList visible={sky.visible} catalog={catalog} selected={selected} trainOf={trainOf} onSelect={select} />
      </div>
    </div>
  );
}
