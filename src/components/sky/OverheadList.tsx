"use client";

import { KIND_COLORS } from "@/components/globe/SatellitePoints";
import { compass, type VisibleSet } from "@/lib/orbital/lookAngles";
import { formatInt } from "@/lib/utils/format";
import type { Catalog } from "@/store/runtime";
import type { ObjectKind } from "@/types";

const MAX_ROWS = 60;

interface Props {
  visible: VisibleSet;
  catalog: Catalog;
  selected: number | null;
  trainOf: Int16Array | null;
  onSelect: (index: number) => void;
}

/** Live list of objects above the horizon, highest first. */
export function OverheadList({ visible, catalog, selected, trainOf, onSelect }: Props) {
  const rows = Math.min(visible.count, MAX_ROWS);
  return (
    <div>
      <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-3 px-1 font-mono text-[9px] tracking-[0.2em] text-[var(--muted)]">
        <span>OBJECT</span>
        <span className="w-10 text-right">ELEV</span>
        <span className="w-8 text-right">AZ</span>
      </div>
      <ul data-testid="overhead-list">
        {Array.from({ length: rows }, (_, k) => {
          const idx = visible.indices[k];
          const kind = catalog.kinds[idx] as ObjectKind;
          const isTrain = trainOf !== null && trainOf[idx] >= 0;
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => onSelect(idx)}
                aria-pressed={selected === idx}
                className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-sm px-1 py-[5px] text-left font-mono text-[11px] transition-colors hover:bg-white/5 ${
                  selected === idx ? "bg-[var(--accent)]/10" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: KIND_COLORS[kind] }} />
                  <span className="truncate text-[var(--fg)]">{catalog.names[idx]}</span>
                  {isTrain && (
                    <span className="shrink-0 rounded-sm border border-[var(--accent)]/50 px-1 text-[8px] tracking-[0.14em] text-[var(--accent)]">TRAIN</span>
                  )}
                </span>
                <span className="w-10 text-right tabular-nums text-[var(--fg)]">{visible.elevationDeg[k].toFixed(0)}°</span>
                <span className="w-8 text-right tabular-nums text-[var(--muted)]">{compass(visible.azimuthDeg[k])}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {visible.count > rows && (
        <p className="mt-2 px-1 font-mono text-[9px] tracking-[0.16em] text-[var(--muted)]">
          + {formatInt(visible.count - rows)} MORE BELOW {Math.round(visible.elevationDeg[rows - 1])}°
        </p>
      )}
    </div>
  );
}
