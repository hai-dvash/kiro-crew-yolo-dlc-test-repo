import { describe, it, expect } from 'vitest';
import { RoundMachine } from '../src/round/machine';
import type { GestureResult, Shape } from '../src/types';

function gr(shape: Shape, confidence = 0.9, lowConfidence = false): GestureResult {
  return { shape, confidence, lowConfidence, latencyMs: 12 };
}

describe('RoundMachine (T8, R5.1/R1.2)', () => {
  it('advances on a confident GestureResult and resolves', () => {
    const m = new RoundMachine(() => 'scissors'); // player rock beats scissors
    m.begin();
    m.submit(gr('rock'));
    const s = m.getState();
    expect(s.phase).toBe('resolved');
    expect(s.result).toBe('a');
    expect(s.score.player).toBe(1);
  });

  it('does NOT resolve on low confidence — flags a re-throw (no silent guess)', () => {
    const m = new RoundMachine(() => 'rock');
    m.begin();
    m.submit(gr('scissors', 0.05, true));
    const s = m.getState();
    expect(s.phase).toBe('lowConfidence');
    expect(s.result).toBeNull();
    expect(s.score.player + s.score.opponent + s.score.draws).toBe(0);
  });

  it('produces all three outcomes deterministically', () => {
    const win = new RoundMachine(() => 'scissors');
    win.begin();
    win.submit(gr('rock'));
    expect(win.getState().result).toBe('a');

    const lose = new RoundMachine(() => 'paper');
    lose.begin();
    lose.submit(gr('rock'));
    expect(lose.getState().result).toBe('b');

    const draw = new RoundMachine(() => 'rock');
    draw.begin();
    draw.submit(gr('rock'));
    expect(draw.getState().result).toBe('draw');
  });

  it('auto-starts a fresh round when submitting after a resolved state', () => {
    const m = new RoundMachine(() => 'scissors');
    m.begin();
    m.submit(gr('rock'));
    m.submit(gr('rock'));
    expect(m.getState().score.player).toBe(2);
  });
});
