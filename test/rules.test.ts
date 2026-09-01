import { describe, it, expect } from 'vitest';
import { resolve } from '../src/rules';
import type { Shape } from '../src/types';

describe('rules.resolve — all 9 combos (R5.1)', () => {
  const cases: Array<[Shape, Shape, 'a' | 'b' | 'draw']> = [
    ['rock', 'rock', 'draw'],
    ['rock', 'scissors', 'a'],
    ['rock', 'paper', 'b'],
    ['paper', 'paper', 'draw'],
    ['paper', 'rock', 'a'],
    ['paper', 'scissors', 'b'],
    ['scissors', 'scissors', 'draw'],
    ['scissors', 'paper', 'a'],
    ['scissors', 'rock', 'b'],
  ];
  it.each(cases)('%s vs %s -> %s', (a, b, expected) => {
    expect(resolve(a, b)).toBe(expected);
  });
});
