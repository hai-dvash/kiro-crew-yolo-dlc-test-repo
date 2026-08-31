import type { Shape, Outcome } from '../types';

const BEATS: Record<Shape, Shape> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

/** Resolve a round from the player's perspective (R3.1). */
export function resolve(player: Shape, cpu: Shape): Outcome {
  if (player === cpu) return 'draw';
  return BEATS[player] === cpu ? 'win' : 'lose';
}

const SHAPES: readonly Shape[] = ['rock', 'paper', 'scissors'];

/**
 * Draw the CPU's shape uniformly and independently (R3.2).
 * `rng` defaults to Math.random so the source is never observable to the player;
 * it is injectable purely so tests can assert distribution.
 */
export function cpuPick(rng: () => number = Math.random): Shape {
  const i = Math.min(SHAPES.length - 1, Math.floor(rng() * SHAPES.length));
  return SHAPES[i];
}
