import type { Features, Classification, Shape } from '../types';

/** Minimum motion to count as an intentional throw (R1.2 — no silent guessing). */
export const MIN_PATH_LENGTH = 40; // px
export const MIN_PEAK_VELOCITY = 0.15; // px/ms

/**
 * Rule-based v1 classifier (R1.1, R1.2). Trainless and debuggable:
 *  - rock     = short, sharp, straight vertical flick (a "pound")
 *  - paper    = sustained horizontal sweep, low reversals
 *  - scissors = >=2 direction reversals (a "snip")
 * Confidence is the margin between the top and runner-up scores; below the
 * motion gate we return `low` on the best guess rather than guessing silently.
 */
export function classify(f: Features): Classification {
  const scores: Record<Shape, number> = { rock: 0, paper: 0, scissors: 0 };

  // Scissors: the defining feature is >=2 reversals.
  scores.scissors += clamp01(f.reversals / 2) * 3;

  // Rock: sharp vertical spike, straight, low reversals.
  if (f.dominantAxis === 'vertical') scores.rock += 1.8;
  if (f.spikeProfile) scores.rock += 1.0;
  scores.rock += f.straightness * 1.0;
  scores.rock -= f.reversals * 0.8;

  // Paper: horizontal, sustained (not a spike), straight, low reversals.
  if (f.dominantAxis === 'horizontal') scores.paper += 1.8;
  if (!f.spikeProfile) scores.paper += 0.8;
  scores.paper += f.straightness * 1.0;
  scores.paper -= f.reversals * 0.8;

  const ranked = (Object.keys(scores) as Shape[])
    .map((s) => ({ shape: s, score: scores[s] }))
    .sort((a, b) => b.score - a.score);

  const margin = ranked[0].score - ranked[1].score;

  const belowGate = f.pathLength < MIN_PATH_LENGTH || f.peakVelocity < MIN_PEAK_VELOCITY;
  const confidence = belowGate || margin < 0.5 ? 'low' : 'high';

  return { shape: ranked[0].shape, confidence, margin };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
