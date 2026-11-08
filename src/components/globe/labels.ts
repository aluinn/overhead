/**
 * Lightweight DOM label layer drawn over the canvas. Each label is a
 * persistent element that is repositioned (transform only) every frame, so
 * there is no layout thrash and no React re-render per frame.
 */
export interface LabelHandle {
  /** Move the label to CSS pixel coords, or hide it with `null`. */
  place(pos: { x: number; y: number } | null, text?: string): void;
}

export class LabelLayer {
  private readonly root: HTMLDivElement;
  private readonly labels = new Map<string, HTMLDivElement>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "pointer-events-none absolute inset-0 overflow-hidden";
    this.root.setAttribute("aria-hidden", "true");
    parent.appendChild(this.root);
  }

  /** `variant` "tag" is a small pill; "hover" is a slightly brighter tooltip. */
  create(key: string, variant: "tag" | "hover" = "tag"): LabelHandle {
    const el = document.createElement("div");
    el.className =
      variant === "tag"
        ? "absolute left-0 top-0 hidden whitespace-nowrap font-mono text-[10px] tracking-[0.14em] text-[#ffc83d]"
        : "absolute left-0 top-0 hidden whitespace-nowrap rounded-sm border border-[var(--line)] bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-[var(--fg)] backdrop-blur-sm";
    this.root.appendChild(el);
    this.labels.set(key, el);

    let lastText = "";
    let visible = false;
    return {
      place: (pos, text) => {
        if (!pos) {
          if (visible) {
            el.style.display = "none";
            visible = false;
          }
          return;
        }
        if (text !== undefined && text !== lastText) {
          el.textContent = text;
          lastText = text;
        }
        if (!visible) {
          el.style.display = "block";
          visible = true;
        }
        // Offset so the label sits to the upper-right of the point.
        el.style.transform = `translate(${Math.round(pos.x + 10)}px, ${Math.round(pos.y - 18)}px)`;
      },
    };
  }

  dispose(): void {
    this.root.remove();
    this.labels.clear();
  }
}
