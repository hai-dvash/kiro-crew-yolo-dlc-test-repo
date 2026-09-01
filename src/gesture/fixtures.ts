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

/** The committed fixture suite (varied scales for robustness). */
export const FIXTURES: Fixture[] = [
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'rock' as Shape, window: rock(s) })),
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'paper' as Shape, window: paper(s) })),
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'scissors' as Shape, window: scissors(s) })),
];
