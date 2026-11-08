"use client";

import { useCallback, useEffect, useRef } from "react";
import { KIND_COLORS } from "@/components/globe/SatellitePoints";
import { type VisibleSet } from "@/lib/orbital/lookAngles";
import { ObjectKind } from "@/types";
import { MIN_ELEVATION_DEG, type Catalog, useRuntime } from "@/store/runtime";

interface Props {
  visible: VisibleSet;
  catalog: Catalog;
  selected: number | null;
  trainOf: Int16Array | null;
  onSelect: (index: number) => void;
}

const SIZE = 264;
const PAD = 22;

/**
 * Polar sky plot. Zenith at the centre, the horizon mask at the rim, North up,
 * East to the *left* (the view you get lying on your back looking up).
 */
export function RadarPlot({ visible, catalog, selected, trainOf, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { store } = useRuntime();
  const radius = SIZE / 2 - PAD;

  const toXY = useCallback(
    (azDeg: number, elDeg: number): [number, number] => {
      const r = ((90 - elDeg) / (90 - MIN_ELEVATION_DEG)) * radius;
      const az = (azDeg * Math.PI) / 180;
      return [SIZE / 2 - r * Math.sin(az), SIZE / 2 - r * Math.cos(az)];
    },
    [radius],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const css = getComputedStyle(canvas);
    const line = css.getPropertyValue("--line").trim() || "rgba(160,190,220,0.14)";
    const muted = css.getPropertyValue("--muted").trim() || "#6b7b8f";
    const accent = css.getPropertyValue("--accent").trim() || "#38e1ff";

    // Rings: horizon mask, 30°, 60°, zenith cross.
    ctx.lineWidth = 1;
    ctx.strokeStyle = line;
    for (const el of [MIN_ELEVATION_DEG, 30, 60]) {
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, ((90 - el) / (90 - MIN_ELEVATION_DEG)) * radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(SIZE / 2, SIZE / 2 - radius);
    ctx.lineTo(SIZE / 2, SIZE / 2 + radius);
    ctx.moveTo(SIZE / 2 - radius, SIZE / 2);
    ctx.lineTo(SIZE / 2 + radius, SIZE / 2);
    ctx.stroke();

    ctx.fillStyle = muted;
    ctx.font = "10px var(--font-geist-mono), ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", SIZE / 2, 9);
    ctx.fillText("S", SIZE / 2, SIZE - 9);
    ctx.fillText("E", 9, SIZE / 2);
    ctx.fillText("W", SIZE - 9, SIZE / 2);

    // Dots: draw debris first, stations last so the interesting ones sit on top.
    const order: ObjectKind[] = [ObjectKind.Debris, ObjectKind.Other, ObjectKind.Starlink, ObjectKind.Station];
    for (const kind of order) {
      ctx.fillStyle = KIND_COLORS[kind];
      for (let k = 0; k < visible.count; k++) {
        const idx = visible.indices[k];
        if (catalog.kinds[idx] !== kind) continue;
        const [x, y] = toXY(visible.azimuthDeg[k], visible.elevationDeg[k]);
        const inTrain = trainOf !== null && trainOf[idx] >= 0;
        ctx.globalAlpha = kind === ObjectKind.Debris ? 0.6 : 0.95;
        ctx.beginPath();
        ctx.arc(x, y, kind === ObjectKind.Station ? 3.6 : inTrain ? 2.4 : 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (selected !== null) {
      const k = visible.indices.indexOf(selected);
      if (k >= 0 && k < visible.count) {
        const [x, y] = toXY(visible.azimuthDeg[k], visible.elevationDeg[k]);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [visible, catalog, selected, trainOf, radius, toXY]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const my = (e.clientY - rect.top) * scale;
    let best = -1;
    let bestD2 = 14 * 14;
    for (let k = 0; k < visible.count; k++) {
      const [x, y] = toXY(visible.azimuthDeg[k], visible.elevationDeg[k]);
      const d2 = (x - mx) ** 2 + (y - my) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = k;
      }
    }
    if (best >= 0) {
      onSelect(visible.indices[best]);
    } else {
      store.set({ selected: null, info: null });
    }
  };

  return (
    <canvas
      ref={ref}
      onClick={onClick}
      role="img"
      aria-label={`Sky plot showing ${visible.count} objects above ${MIN_ELEVATION_DEG} degrees elevation`}
      data-testid="radar"
      className="mx-auto block cursor-crosshair"
      style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}
    />
  );
}
