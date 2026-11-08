import type { Clock } from "@/lib/utils/clock";
import type { PropagatorClient } from "@/lib/utils/rpc";

/** Real-time spacing between worker ticks. Faster sim speeds need denser ticks to keep arcs smooth. */
function tickMs(speed: number): number {
  return speed <= 60 ? 1000 : 250;
}

/**
 * Pulls positions from the worker once per tick and exposes two snapshots
 * (`prev`, `next`) plus the sim times they belong to. The GPU lerps between
 * them using `alpha()`, so motion is smooth at 60fps while SGP4 only runs ~1Hz.
 *
 * The Float32Arrays are owned here and reused every tick; the buffer the
 * worker returns becomes the next request's scratch space (zero allocation
 * in steady state).
 */
export class PositionStream {
  count = 0;
  prev = new Float32Array(0);
  next = new Float32Array(0);
  prevT = 0;
  nextT = 1;
  /** Bumped whenever prev/next contents change. */
  version = 0;
  /** Bumped whenever the arrays are reallocated (catalog changed). */
  generation = 0;

  private scratch: ArrayBuffer | null = null;
  private timer: number | undefined;
  private running = false;
  private inflight = false;
  private primed = false;
  private lastEpoch = -1;
  private lastSpeed = 1;

  constructor(
    private readonly clock: Clock,
    private readonly client: PropagatorClient,
  ) {}

  /** Resize for a new catalog and re-prime. */
  setCount(count: number): void {
    this.count = count;
    this.prev = new Float32Array(count * 3);
    this.next = new Float32Array(count * 3);
    this.scratch = null;
    this.primed = false;
    this.generation++;
    this.version++;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.pump();
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.timer);
  }

  /** Interpolation factor for the current sim time, clamped to [0, 1]. */
  alpha(): number {
    const span = this.nextT - this.prevT;
    if (span <= 0) return 1;
    const a = (this.clock.now() - this.prevT) / span;
    return a < 0 ? 0 : a > 1 ? 1 : a;
  }

  /** Interpolated position of object `i` in scene space, written into `out`. */
  positionAt(i: number, a: number, out: { x: number; y: number; z: number }): void {
    const o = i * 3;
    out.x = this.prev[o] + (this.next[o] - this.prev[o]) * a;
    out.y = this.prev[o + 1] + (this.next[o + 1] - this.prev[o + 1]) * a;
    out.z = this.prev[o + 2] + (this.next[o + 2] - this.prev[o + 2]) * a;
  }

  private schedule(delay: number): void {
    if (!this.running) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.pump(), delay);
  }

  private async pump(): Promise<void> {
    if (!this.running || this.inflight) return;
    if (this.count === 0) {
      this.schedule(200);
      return;
    }

    const epoch = this.clock.epoch;
    const generation = this.generation;
    const speed = this.clock.speed;
    const step = tickMs(speed);

    // A time jump or speed change invalidates the lerp window: re-prime.
    if (epoch !== this.lastEpoch || speed !== this.lastSpeed) {
      this.primed = false;
      this.lastEpoch = epoch;
      this.lastSpeed = speed;
    }

    const started = performance.now();
    // First request after a (re)prime is for "now"; later ones lead by one tick.
    const target = this.clock.now() + (this.primed ? step * speed : 0);
    this.inflight = true;
    try {
      const buffer = this.scratch ?? new ArrayBuffer(this.count * 12);
      this.scratch = null;
      const res = await this.client.call("propagate", { timeMs: target, buffer }, [buffer]);
      const fresh = new Float32Array(res.buffer);

      // Drop results that raced a seek or a catalog change.
      if (epoch === this.clock.epoch && generation === this.generation && fresh.length === this.next.length) {
        if (!this.primed) {
          this.next.set(fresh);
          this.prev.set(fresh);
          this.nextT = target;
          this.prevT = target - 1;
          // Immediately fetch the leading snapshot so lerping can begin.
          this.primed = true;
          this.version++;
          this.scratch = res.buffer;
          this.inflight = false;
          void this.pump();
          return;
        }
        this.prev.set(this.next);
        this.prevT = this.nextT;
        this.next.set(fresh);
        this.nextT = target;
        this.version++;
      }
      this.scratch = res.buffer;
    } catch (err) {
      console.error("[positions] propagate failed", err);
    } finally {
      this.inflight = false;
    }

    this.schedule(Math.max(0, step - (performance.now() - started)));
  }
}
