"use client";

import { useEffect, useRef, useState } from "react";
import { formatInt, formatUtc } from "@/lib/utils/format";
import { useAppState, useRuntime } from "@/store/runtime";
import { canvasToBlob, composeShareImage, copyImageToClipboard, downloadBlob, xIntentUrl, type ShareContent } from "./captureImage";

interface Prepared {
  blob: Blob;
  url: string;
  content: ShareContent;
}

/** Share: snapshot the current view with the headline stat, then copy / download / post to X. */
export function ShareButton() {
  const runtime = useRuntime();
  const total = useAppState((s) => s.catalog?.count ?? 0);
  const above = useAppState((s) => s.sky.visible.count);
  const observer = useAppState((s) => s.observer);
  const ready = useAppState((s) => s.status === "ready");

  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  const close = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPrepared(null);
    setNote(null);
  };

  useEffect(() => {
    if (!prepared) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prepared]);

  const open = async () => {
    const frame = runtime.capture?.();
    if (!frame) return;
    setBusy(true);
    try {
      const headline = observer
        ? `${formatInt(above)} objects over ${observer.label} right now`
        : `${formatInt(total)} objects in orbit right now`;
      const content: ShareContent = {
        headline,
        subline: `${formatUtc(runtime.clock.now())}${runtime.clock.isLive ? "" : " · replay"}`,
        watermark: new URL(siteUrl()).host,
      };
      const canvas = composeShareImage(frame, content);
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      previewUrl.current = url;
      setPrepared({ blob, url, content });
      setNote(null);
    } catch (err) {
      console.error("[share] failed to render image", err);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!prepared) return;
    const ok = await copyImageToClipboard(prepared.blob);
    setNote(ok ? "Image copied. Paste it into your post." : "Your browser blocked copying. Use Download instead.");
  };

  const nativeShare = async () => {
    if (!prepared) return;
    const file = new File([prepared.blob], "overhead.png", { type: "image/png" });
    try {
      await navigator.share({ files: [file], text: prepared.content.headline, url: siteUrl() });
    } catch {
      // user cancelled
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    prepared !== null &&
    navigator.canShare({ files: [new File([prepared.blob], "overhead.png", { type: "image/png" })] });

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={!ready || busy}
        className="pointer-events-auto mt-2 rounded-sm border border-[var(--line)] px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--fg)] disabled:opacity-50"
      >
        {busy ? "RENDERING…" : "↗ SHARE"}
      </button>

      {prepared && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share"
            className="w-[min(94vw,640px)] rounded-sm border border-[var(--line)] bg-[#070b12]/95 p-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-[var(--muted)]">
              <span>SHARE THIS VIEW</span>
              <button type="button" aria-label="Close" onClick={close} className="hover:text-[var(--fg)]">
                ✕
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL preview, not optimisable */}
            <img src={prepared.url} alt={prepared.content.headline} className="w-full rounded-sm border border-[var(--line)]" data-testid="share-preview" />

            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] tracking-[0.16em] sm:grid-cols-3">
              <button type="button" onClick={() => void copy()} className="rounded-sm border border-[var(--accent)]/50 px-3 py-2 text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10">
                COPY IMAGE
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(prepared.blob, "overhead.png")}
                className="rounded-sm border border-[var(--line)] px-3 py-2 text-[var(--fg)] transition-colors hover:border-[var(--accent)]/50"
              >
                DOWNLOAD
              </button>
              <a
                href={xIntentUrl(`${prepared.content.headline}.`, siteUrl())}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 rounded-sm border border-[var(--line)] px-3 py-2 text-center text-[var(--fg)] transition-colors hover:border-[var(--accent)]/50 sm:col-span-1"
              >
                POST TO X ↗
              </a>
            </div>

            {canNativeShare && (
              <button type="button" onClick={() => void nativeShare()} className="mt-2 w-full rounded-sm border border-[var(--line)] px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] hover:text-[var(--fg)]">
                SHARE VIA…
              </button>
            )}

            <p className="mt-3 min-h-4 font-mono text-[10px] leading-relaxed text-[var(--muted)]" role="status">
              {note ?? "X can't attach images from a link: copy the image, then paste it into your post."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Public origin for links and the watermark. */
function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}
