// T2 [F5] — pure RPS resolution (R5.1). No side effects, the only gameplay authority.
import type { Shape, RoundResult } from './types';

/** Map of what each shape beats. */
const BEATS: Record<Shape, Shape> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

/**
 * Resolve a round from player A vs player B.
 * Returns 'a' (A wins), 'b' (B wins), or 'draw'. Covers all 9 combos.
 */
export function resolve(a: Shape, b: Shape): RoundResult {
  if (a === b) return 'draw';
  return BEATS[a] === b ? 'a' : 'b';
}
