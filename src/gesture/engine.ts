// T7 [F1] — gesture engine orchestration (R1.4, design §4 contract).
// Wires capture -> features -> classify; emits the authoritative GestureResult,
// measuring latency = gesture-end -> result. Decoupled from any render.
import type { Sample, GestureResult } from './../types';
import { PointerCapture, DEFAULT_CAPTURE, type CaptureTuning } from './capture';
import { extract } from './features';
import { classify, LOW_CONFIDENCE_THRESHOLD } from './classifier';

/** Pure path: a raw window -> GestureResult. Deterministic, unit/harness-testable. */
export function classifyWindow(
  window: Sample[],
  now: number,
  threshold = LOW_CONFIDENCE_THRESHOLD,
): GestureResult {
  const t0 = performance.now?.() ?? now;
  const features = extract(window);
  const scored = classify(features, threshold);
  const t1 = performance.now?.() ?? now;
  return {
    shape: scored.shape,
    confidence: scored.confidence,
    lowConfidence: scored.lowConfidence,
    latencyMs: Math.max(0, t1 - t0),
  };
}

/**
 * Live engine bound to a DOM element. Emits exactly one GestureResult per
 * free-flick, independent of render (the layering invariant).
 */
export class GestureEngine {
  private readonly capture: PointerCapture;
  private readonly listeners = new Set<(r: GestureResult) => void>();

  constructor(threshold = LOW_CONFIDENCE_THRESHOLD, tuning: CaptureTuning = DEFAULT_CAPTURE) {
    this.capture = new PointerCapture((window) => {
      const end = performance.now();
      const result = classifyWindow(window, end, threshold);
      this.listeners.forEach((l) => l(result));
    }, tuning);
  }

  attach(el: HTMLElement): void {
    this.capture.attach(el);
  }

  detach(): void {
    this.capture.detach();
  }

  onResult(fn: (r: GestureResult) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
