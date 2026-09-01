// card-rps3d-headline [issue #19, design §2] — the pure, DOM-free HUD copy module.
// Maximal-comedy headline + a truthful gesture→shape legend, kept as plain data/consts so a
// node-env test (test/hud.test.ts) can assert the copy + the truthful mapping directly, and both
// index.html/main.ts consume this ONE source (R1.1 / NFR4). No DOM / three / window imports.
import type { Shape } from '../types';

/** One legend row: the maximal-comedy gesture→shape mapping, truthful to the classifier + keys. */
export interface LegendRow {
  /** The mouse-flick verb the engine recognizes (chop/sweep/snip). */
  gesture: string;
  /** The keyboard fallback key (R/P/S), matching src/a11y/fallback KEY_MAP. */
  key: string;
  /** MUST be a real Shape ('rock'|'paper'|'scissors') — `shape: Shape` type-checks truthfulness. */
  shape: Shape;
  /** Decorative emoji (rendered aria-hidden). */
  icon: string;
  /** The human shape label ('Rock'/'Paper'/'Scissors'). */
  label: string;
}

/**
 * Truthful mapping — MUST match src/gesture (chop=rock, sweep=paper, snip=scissors) and
 * src/a11y/fallback KEY_MAP (r=rock, p=paper, s=scissors). The `shape: Shape` field makes an
 * untruthful value a COMPILE error; test/hud.test.ts additionally asserts row-by-row consistency
 * and that the key/shape sets are exactly {R,P,S} / the full Shape union (R2.1).
 */
export const RPS_LEGEND: readonly LegendRow[] = [
  { gesture: 'chop', key: 'R', shape: 'rock', icon: '🪨', label: 'Rock' },
  { gesture: 'sweep', key: 'P', shape: 'paper', icon: '📄', label: 'Paper' },
  { gesture: 'snip', key: 'S', shape: 'scissors', icon: '✂️', label: 'Scissors' },
] as const;

/**
 * Maximal-comedy headline copy (R1). Deliberately over-the-top + redundant — the joke IS the
 * over-engineering. `h1` fills the EXISTING single <h1> (keeps one semantic h1); the rest are
 * <p> sub-lines, NEVER a 2nd <h1> (R1.2 / NFR1). One editable source (NFR4).
 */
export const HEADLINE = {
  /** Fills the EXISTING single <h1>. */
  h1: 'ROCK · PAPER · SCISSORS',
  /** Comedic over-confidence sub-line (a <p>, not an <h1>). */
  certainty:
    'You are — with 10,000% mathematically-certified, notarized, ISO-9001-audited, ' +
    'triple-underwritten confidence — playing ROCK · PAPER · SCISSORS.',
  /** A second absurd reassurance line. */
  reassurance:
    'In case of any doubt whatsoever: yes. Still Rock. Still Paper. Still Scissors. ' +
    'Definitely, unmistakably, irrevocably Rock-Paper-Scissors.™',
  /** Short absurd title repeated near the legend. */
  legendTitle: 'The Three (3) Sacred, Officially Certified Throws™:',
} as const;
