// T3 [F1] — pointer capture + motion-onset detector (R1.1).
// Free-flick: a gesture STARTS when speed crosses an onset threshold and ENDS
// when speed decays below a release threshold for `releaseMs` (or a max-duration cap).
// No press-hold ritual. Pure segmentation logic is exported for unit testing.
import type { Sample } from '../types';

export interface CaptureTuning {
  /** px/ms — instantaneous speed to START a gesture. */
  onsetSpeed: number;
  /** px/ms — speed below which the gesture is considered decaying. */
  releaseSpeed: number;
  /** ms of continuous sub-release speed before the gesture ENDS. */
  releaseMs: number;
  /** ms hard cap on a single gesture. */
  maxDurationMs: number;
  /** ring-buffer capacity (samples). */
  bufferSize: number;
}

export const DEFAULT_CAPTURE: CaptureTuning = {
  onsetSpeed: 0.35,
  releaseSpeed: 0.12,
  releaseMs: 90,
  maxDurationMs: 1200,
  bufferSize: 256,
};

function speed(a: Sample, b: Sample): number {
  const dt = b.t - a.t;
  if (dt <= 0) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y) / dt;
}

/**
 * Pure segmentation: given a full stream of samples, return the windows
 * (sub-arrays) that constitute distinct free-flick gestures. Deterministic,
 * DOM-free, unit-testable (T3 acceptance).
 */
export function segment(stream: Sample[], tuning: CaptureTuning = DEFAULT_CAPTURE): Sample[][] {
  const windows: Sample[][] = [];
  let active: Sample[] | null = null;
  let belowSince: number | null = null;

  for (let i = 1; i < stream.length; i++) {
    const prev = stream[i - 1];
    const cur = stream[i];
    const s = speed(prev, cur);

    if (active === null) {
      if (s >= tuning.onsetSpeed) {
        active = [prev, cur];
        belowSince = null;
      }
      continue;
    }

    active.push(cur);
    const elapsed = cur.t - active[0].t;

    if (s < tuning.releaseSpeed) {
      const sinceT: number = belowSince ?? cur.t;
      belowSince = sinceT;
      if (cur.t - sinceT >= tuning.releaseMs) {
        windows.push(active);
        active = null;
        belowSince = null;
        continue;
      }
    } else {
      belowSince = null;
    }

    if (elapsed >= tuning.maxDurationMs) {
      windows.push(active);
      active = null;
      belowSince = null;
    }
  }

  if (active && active.length >= 2) windows.push(active);
  return windows;
}

/**
 * Live capture wired to a DOM element. Calls `onGesture` with the raw sample
 * window each time a free-flick completes. Uses the same pure `segment` logic
 * incrementally via a lightweight streaming state machine.
 */
export class PointerCapture {
  private buf: Sample[] = [];
  private active: Sample[] | null = null;
  private belowSince: number | null = null;
  private readonly tuning: CaptureTuning;
  private readonly onGesture: (window: Sample[]) => void;
  private bound: ((e: PointerEvent) => void) | null = null;
  private el: HTMLElement | null = null;

  constructor(onGesture: (window: Sample[]) => void, tuning: CaptureTuning = DEFAULT_CAPTURE) {
    this.onGesture = onGesture;
    this.tuning = tuning;
  }

  attach(el: HTMLElement): void {
    this.el = el;
    this.bound = (e: PointerEvent) => this.onMove(e);
    el.addEventListener('pointermove', this.bound);
  }

  detach(): void {
    if (this.el && this.bound) this.el.removeEventListener('pointermove', this.bound);
    this.el = null;
    this.bound = null;
  }

  private onMove(e: PointerEvent): void {
    const sample: Sample = { t: performance.now(), x: e.clientX, y: e.clientY };
    this.buf.push(sample);
    if (this.buf.length > this.tuning.bufferSize) this.buf.shift();
    if (this.buf.length < 2) return;

    const prev = this.buf[this.buf.length - 2];
    const s = speed(prev, sample);

    if (this.active === null) {
      if (s >= this.tuning.onsetSpeed) {
        this.active = [prev, sample];
        this.belowSince = null;
      }
      return;
    }

    this.active.push(sample);
    const elapsed = sample.t - this.active[0].t;

    if (s < this.tuning.releaseSpeed) {
      const sinceT: number = this.belowSince ?? sample.t;
      this.belowSince = sinceT;
      if (sample.t - sinceT >= this.tuning.releaseMs) return this.commit();
    } else {
      this.belowSince = null;
    }
    if (elapsed >= this.tuning.maxDurationMs) this.commit();
  }

  private commit(): void {
    if (this.active && this.active.length >= 2) this.onGesture(this.active);
    this.active = null;
    this.belowSince = null;
  }
}
