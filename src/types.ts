// Shared domain types.

export type Shape = 'rock' | 'paper' | 'scissors';

export type Outcome = 'win' | 'lose' | 'draw';

export type Confidence = 'high' | 'low';

/** A single sampled pointer position with a timestamp (ms). */
export interface Sample {
  t: number;
  x: number;
  y: number;
}

/** Interpretable features derived from a gesture sample buffer. */
export interface Features {
  /** Peak instantaneous speed (px/ms). */
  peakVelocity: number;
  /** true = one sharp spike, false = sustained motion. */
  spikeProfile: boolean;
  /** 'vertical' | 'horizontal' by net travel. */
  dominantAxis: 'vertical' | 'horizontal';
  /** Count of direction reversals along the dominant axis. */
  reversals: number;
  /** net displacement / total path length, in [0,1]. 1 = perfectly straight. */
  straightness: number;
  /** Total path length in px (motion-gate input). */
  pathLength: number;
}

export interface Classification {
  shape: Shape;
  confidence: Confidence;
  /** Margin between the top and runner-up rule scores (debug/tuning). */
  margin: number;
}
