import { describe, it, expect } from 'vitest';
import { Round } from '../src/game/round';
import type { RoundResult } from '../src/game/round';

describe('Round state machine (R3.1, R3.2, R3.3)', () => {
  it('drives IDLE→CAPTURING→CLASSIFIED→RESOLVED and returns to IDLE on replay', () => {
    const states: string[] = [];
    let result: RoundResult | null = null;
    // rng=0 → cpuPick = 'rock'
    const round = new Round(
      { onState: (s) => states.push(s), onResolved: (r) => (result = r) },
      () => 0,
    );

    expect(round.getState()).toBe('IDLE');
    round.beginCapture();
    round.classified('paper'); // paper beats rock → win
    expect(round.getState()).toBe('RESOLVED');
    expect(result).toEqual({ player: 'paper', cpu: 'rock', outcome: 'win' });
    expect(states).toEqual(['CAPTURING', 'CLASSIFIED', 'RESOLVED']);

    round.replay();
    expect(round.getState()).toBe('IDLE');
    expect(round.getResult()).not.toBeNull(); // last result retained until next round
  });

  it('fallback path classifies directly from IDLE (NFR3 shares the round path)', () => {
    const round = new Round({}, () => 0.5); // cpuPick index 1 → 'paper'
    round.classified('scissors'); // scissors beats paper → win
    expect(round.getState()).toBe('RESOLVED');
    expect(round.getResult()?.outcome).toBe('win');
  });

  it('ignores classification while already RESOLVED until replay', () => {
    const round = new Round({}, () => 0);
    round.classified('rock');
    const first = round.getResult();
    round.classified('paper'); // ignored — must replay first
    expect(round.getResult()).toBe(first);
  });
});
