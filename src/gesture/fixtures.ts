// T6 [F1] — labeled gesture fixtures for the accuracy harness (R1.3).
// Synthetic but kinematically faithful free-flick windows per shape.
import type { Sample, Shape } from './../types';

export interface Fixture {
  label: Shape;
  window: Sample[];
}

/** Build a window from (dx,dy) steps at a fixed sample interval. */
function build(steps: Array<[number, number]>, dtMs = 8): Sample[] {
  const out: Sample[] = [];
  let x = 400;
  let y = 300;
  let t = 0;
  out.push({ t, x, y });
  for (const [dx, dy] of steps) {
    x += dx;
    y += dy;
    t += dtMs;
    out.push({ t, x, y });
  }
  return out;
}

// rock = sharp downward chop (vertical, few reversals, sharp onset)
function rock(scale = 1): Sample[] {
  const s = scale;
  return build([
    [2, 30 * s], [3, 55 * s], [2, 60 * s], [1, 40 * s], [0, 18 * s], [0, 4],
  ]);
}

// paper = flat horizontal sweep (horizontal, sustained, few reversals)
function paper(scale = 1): Sample[] {
  const s = scale;
  return build([
    [22 * s, 2], [30 * s, 1], [34 * s, 0], [30 * s, -1], [24 * s, 0], [16 * s, 1], [8 * s, 0],
  ]);
}

// scissors = back-and-forth snip (multiple reversals — the discriminator)
function scissors(scale = 1): Sample[] {
  const s = scale;
  return build([
    [26 * s, 4], [-24 * s, -3], [25 * s, 2], [-23 * s, -2], [22 * s, 3], [-20 * s, -1],
  ]);
}

// scissors (vertical-leaning): net motion leans vertical (dy monotone-down, so the
// old dominant-axis-only logic read reversalsY = 0 and under-counted), while the
// snip alternation lives on X (dx sign flips every step -> high reversalsX). Net
// vertical dominance is kept MODERATE (a real snip, not a pure chop) so the
// classifier's axis-gated rock term does not swamp scissors; the both-axes sum
// then reads the X alternation and classifies scissors. (issue #9)
function scissorsVertical(scale = 1): Sample[] {
  const s = scale;
  return build([
    [28 * s, 9 * s], [-16 * s, 10 * s], [27 * s, 9 * s], [-15 * s, 10 * s], [26 * s, 9 * s], [-14 * s, 10 * s],
  ]);
}

// scissors (diagonal): comparable dx/dy magnitude, BOTH axes alternate sign —
// exercises the summed count across a non-horizontal path. (issue #9)
function scissorsDiagonal(scale = 1): Sample[] {
  const s = scale;
  return build([
    [20 * s, 18 * s], [-18 * s, -16 * s], [19 * s, 17 * s], [-17 * s, -15 * s], [18 * s, 16 * s], [-16 * s, -14 * s],
  ]);
}

/** The committed fixture suite (varied scales for robustness). */
export const FIXTURES: Fixture[] = [
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'rock' as Shape, window: rock(s) })),
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'paper' as Shape, window: paper(s) })),
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'scissors' as Shape, window: scissors(s) })),
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'scissors' as Shape, window: scissorsVertical(s) })),
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'scissors' as Shape, window: scissorsDiagonal(s) })),
];
