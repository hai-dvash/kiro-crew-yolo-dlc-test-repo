// Shared domain types (design §4 — the seams that keep F1 authoritative).

export type Shape = 'rock' | 'paper' | 'scissors';

/** Round outcome from player A's perspective. */
export type RoundResult = 'a' | 'b' | 'draw';

/** A single sampled pointer position with a timestamp (ms). */
export interface Sample {
  t: number;
  x: number;
  y: number;
}

/**
 * Kinematic features derived from a gesture window (gesture/features.ts).
 * Pure, DOM-free — the classifier's only input.
 */
export interface Features {
  /** Peak instantaneous speed (px/ms). */
  peakSpeed: number;
  /** |dominant-axis travel| / (|other-axis travel| + eps), >=1. */
  dominantAxisRatio: number;
  /** 'vertical' | 'horizontal' by net travel. */
  dominantAxis: 'vertical' | 'horizontal';
  /** Net displacement vector magnitude (px). */
  netDisplacement: number;
  /** Direction reversals along the dominant axis (scissors discriminator). */
  reversals: number;
  /** Gesture duration (ms). */
  durationMs: number;
  /** Onset sharpness / peak jerk proxy (px/ms^2). */
  onsetSharpness: number;
  /** Total path length (px) — motion-gate + straightness input. */
  pathLength: number;
}

/**
 * The ONE authoritative event the shell consumes (design §4).
 * Render + physics subscribe to this AFTER the round-machine commits it.
 */
export interface GestureResult {
  shape: Shape;
  /** 0..1, margin-based (R1.2). */
  confidence: number;
  /** confidence < THRESHOLD -> badge + allow re-throw, no silent guess (R1.2). */
  lowConfidence: boolean;
  /** gesture-end -> result; asserted <=100ms in dev harness (R1.4). */
  latencyMs: number;
}
