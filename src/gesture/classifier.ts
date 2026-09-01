// T5 [F1] — rule-based classifier + confidence (R1.2, R1.5). PURE.
// FORK 1 (design §2): tuned rule-based, NOT learned. The `classify(features)`
// interface is the reversible seam — a learned model can slot behind it later
// without touching capture/engine/shell.
import type { Shape, Features } from './../types';

export interface Scored {
  shape: Shape;
  /** Normalized top1-top2 margin, 0..1. */
  confidence: number;
  lowConfidence: boolean;
  /** Raw per-shape scores (debug/tuning). */
  scores: Record<Shape, number>;
}

/**
 * Gesture semantics (free-flick vocabulary, design §2):
 *  - rock     = a sharp downward chop: vertical dominant, few reversals, high onset sharpness.
 *  - paper    = a flat horizontal sweep: horizontal dominant, few reversals, sustained.
 *  - scissors = a back-and-forth snip: multiple direction reversals (the discriminator).
 */
function score(f: Features): Record<Shape, number> {
  const vertical = f.dominantAxis === 'vertical' ? 1 : 0;
  const horizontal = f.dominantAxis === 'horizontal' ? 1 : 0;
  const axisConfidence = Math.min(f.dominantAxisRatio / 3, 1); // 0..1
  const reversalStrength = Math.min(f.reversals / 3, 1); // 0..1
  const sharp = Math.min(f.onsetSharpness / 0.02, 1); // 0..1

  // Scissors: reversals dominate regardless of axis.
  const scissors = reversalStrength * 1.5;

  // Rock: vertical, sharp, low reversals.
  const rock = vertical * axisConfidence + sharp * 0.6 + (1 - reversalStrength) * 0.4;

  // Paper: horizontal, sustained (low sharpness), low reversals.
  const paper = horizontal * axisConfidence + (1 - sharp) * 0.5 + (1 - reversalStrength) * 0.4;

  return { rock, paper, scissors };
}

export const LOW_CONFIDENCE_THRESHOLD = 0.2;

/** Classify a feature vector into a shape with a margin-based confidence. */
export function classify(f: Features, threshold = LOW_CONFIDENCE_THRESHOLD): Scored {
  const scores = score(f);
  const entries = (Object.entries(scores) as [Shape, number][]).sort((a, b) => b[1] - a[1]);
  const [topShape, topScore] = entries[0];
  const runnerUp = entries[1][1];

  const total = topScore + runnerUp + EPS;
  const confidence = Math.max(0, Math.min(1, (topScore - runnerUp) / total));

  return {
    shape: topShape,
    confidence,
    lowConfidence: confidence < threshold,
    scores,
  };
}

const EPS = 1e-6;
