export interface ShareContent {
  /** e.g. "3,402 objects over London right now". The leading number is highlighted. */
  headline: string;
  /** Smaller line under the headline, e.g. a UTC timestamp. */
  subline: string;
  /** Host shown as the watermark, e.g. "overhead.vercel.app". */
  watermark: string;
}

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 675; // 16:9, shows in full in X's timeline

const MONO = '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const ACCENT = "#38e1ff";

/**
 * Compose the shareable PNG: the globe frame, cover-cropped to 16:9, with the
 * headline stat and a URL watermark. Pure canvas, no network, no libraries.
 */
export function composeShareImage(frame: CanvasImageSource & { width: number; height: number }, content: ShareContent): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable");

  ctx.fillStyle = "#03050a";
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // Cover-fit crop of the WebGL frame (centred).
  const scale = Math.max(SHARE_WIDTH / frame.width, SHARE_HEIGHT / frame.height);
  const dw = frame.width * scale;
  const dh = frame.height * scale;
  ctx.drawImage(frame, (SHARE_WIDTH - dw) / 2, (SHARE_HEIGHT - dh) / 2, dw, dh);

  // Legibility gradient from the bottom, and a soft vignette.
  const grad = ctx.createLinearGradient(0, SHARE_HEIGHT * 0.45, 0, SHARE_HEIGHT);
  grad.addColorStop(0, "rgba(3,5,10,0)");
  grad.addColorStop(1, "rgba(3,5,10,0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, SHARE_HEIGHT * 0.45, SHARE_WIDTH, SHARE_HEIGHT * 0.55);

  const pad = 56;

  // Wordmark, top-left.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(pad + 5, pad + 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6edf5";
  ctx.font = `500 22px ${MONO}`;
  setSpacing(ctx, "7px");
  ctx.fillText("OVERHEAD", pad + 24, pad + 11);

  // Headline: first token (the number) in accent, the rest in white. Shrinks to fit.
  const [num, ...rest] = content.headline.split(" ");
  const tail = rest.length ? ` ${rest.join(" ")}` : "";
  let size = 76;
  setSpacing(ctx, "-1px");
  const maxWidth = SHARE_WIDTH - pad * 2;
  const measure = (px: number) => {
    ctx.font = `300 ${px}px ${MONO}`;
    return ctx.measureText(num).width + ctx.measureText(tail).width;
  };
  while (size > 30 && measure(size) > maxWidth) size -= 2;
  const baseline = SHARE_HEIGHT - pad - 62;
  ctx.font = `300 ${size}px ${MONO}`;
  ctx.fillStyle = ACCENT;
  ctx.fillText(num, pad, baseline);
  const numWidth = ctx.measureText(num).width;
  ctx.fillStyle = "#e6edf5";
  ctx.fillText(tail, pad + numWidth, baseline);

  // Subline + watermark.
  setSpacing(ctx, "3px");
  ctx.font = `400 20px ${MONO}`;
  ctx.fillStyle = "#8696a8";
  ctx.fillText(content.subline.toUpperCase(), pad, SHARE_HEIGHT - pad - 14);

  ctx.textAlign = "right";
  ctx.fillStyle = "#e6edf5";
  ctx.font = `500 22px ${MONO}`;
  setSpacing(ctx, "2px");
  ctx.fillText(content.watermark, SHARE_WIDTH - pad, SHARE_HEIGHT - pad - 14);
  ctx.textAlign = "left";
  setSpacing(ctx, "0px");

  return canvas;
}

/** `letterSpacing` is widely supported but not yet in every TS lib typing. */
function setSpacing(ctx: CanvasRenderingContext2D, value: string): void {
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = value;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG"))), "image/png");
  });
}

/** Copy a PNG to the clipboard. Resolves false when the browser doesn't allow it. */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** X (Twitter) web intent. Intents can't attach images, so the UI tells people to paste the copied one. */
export function xIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({ text, url });
  return `https://x.com/intent/post?${params.toString()}`;
}
