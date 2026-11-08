export const SPEEDS = [1, 60, 600] as const;
export type Speed = (typeof SPEEDS)[number];

/**
 * Simulation clock: wall-clock-driven, with a speed multiplier and seeking.
 * `epoch` increments whenever time *jumps* (seek / go live), so consumers can
 * discard in-flight work that belongs to the old timeline.
 */
export class Clock {
  private realBase = performance.now();
  private simBase = Date.now();
  private _speed: Speed = 1;
  private _epoch = 0;

  /** Current simulation time, epoch ms. */
  now(): number {
    return this.simBase + (performance.now() - this.realBase) * this._speed;
  }

  get speed(): Speed {
    return this._speed;
  }

  get epoch(): number {
    return this._epoch;
  }

  /** True when running at 1x within a couple of seconds of the real time. */
  get isLive(): boolean {
    return this._speed === 1 && Math.abs(this.now() - Date.now()) < 2000;
  }

  setSpeed(speed: Speed): void {
    this.rebase(this.now());
    this._speed = speed;
  }

  seek(ms: number): void {
    this.rebase(ms);
    this._epoch++;
  }

  goLive(): void {
    this._speed = 1;
    this.rebase(Date.now());
    this._epoch++;
  }

  private rebase(simMs: number): void {
    this.realBase = performance.now();
    this.simBase = simMs;
  }
}
