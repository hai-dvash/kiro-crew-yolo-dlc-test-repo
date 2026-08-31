import { describe, it, expect } from 'vitest';
import { resolve, cpuPick } from '../src/game/rules';
import type { Shape } from '../src/types';

describe('resolve — all 9 combinations (R3.1)', () => {
  const cases: Array<[Shape, Shape, string]> = [
    ['rock', 'rock', 'draw'],
    ['rock', 'paper', 'lose'],
    ['rock', 'scissors', 'win'],
    ['paper', 'rock', 'win'],
    ['paper', 'paper', 'draw'],
    ['paper', 'scissors', 'lose'],
    ['scissors', 'rock', 'lose'],
    ['scissors', 'paper', 'win'],
    ['scissors', 'scissors', 'draw'],
  ];
  it.each(cases)('resolve(%s, %s) === %s', (p, c, expected) => {
    expect(resolve(p, c)).toBe(expected);
  });
});

describe('cpuPick — independent & roughly uniform (R3.2)', () => {
  it('returns only valid shapes', () => {
    const seq = [0, 0.34, 0.67, 0.999];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    for (let n = 0; n < 8; n++) {
      expect(['rock', 'paper', 'scissors']).toContain(cpuPick(rng));
    }
  });

  it('distribution is roughly uniform over many draws', () => {
    const counts: Record<Shape, number> = { rock: 0, paper: 0, scissors: 0 };
    for (let n = 0; n < 3000; n++) counts[cpuPick()]++;
    for (const k of Object.keys(counts) as Shape[]) {
      expect(counts[k]).toBeGreaterThan(3000 / 3 - 250);
      expect(counts[k]).toBeLessThan(3000 / 3 + 250);
    }
  });
});
