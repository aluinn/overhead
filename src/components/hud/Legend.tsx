"use client";

import { KIND_COLORS } from "@/components/globe/SatellitePoints";
import { formatInt } from "@/lib/utils/format";
import { useAppState } from "@/store/runtime";
import { ObjectKind } from "@/types";

const ROWS: Array<{ kind: ObjectKind; label: string }> = [
  { kind: ObjectKind.Starlink, label: "STARLINK" },
  { kind: ObjectKind.Other, label: "SATELLITES" },
  { kind: ObjectKind.Debris, label: "DEBRIS" },
  { kind: ObjectKind.Station, label: "STATIONS" },
];

export function Legend() {
  const perKind = useAppState((s) => s.catalog?.perKind ?? null);
  const source = useAppState((s) => s.dataSource);

  return (
    <aside className="pointer-events-none hidden select-none sm:block" aria-label="Legend">
      <ul className="space-y-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)]">
        {ROWS.map(({ kind, label }) => (
          <li key={kind} className="flex items-center gap-2.5">
            <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS[kind], boxShadow: `0 0 8px ${KIND_COLORS[kind]}` }} />
            <span className="w-24">{label}</span>
            <span className="tabular-nums text-[var(--fg)]">{perKind ? formatInt(perKind[kind]) : "—"}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[9px] tracking-[0.16em] text-[var(--muted)]">
        {source === "sample" ? "OFFLINE SAMPLE DATA" : source === "stale-cache" ? "DATA: CELESTRAK (CACHED)" : source ? "DATA: CELESTRAK" : "LOADING…"}
      </p>
    </aside>
  );
}
