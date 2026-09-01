// f3 [#25] — NFR5 headless regression for the reveal controller (design §5, T4). The acceptance-
// defining artifact: node-env, DOM/WebGL/fs-free, mirroring test/main.test.ts's fake-collaborator
// discipline. Drives a REAL RoundMachine (deterministic pickOpponent) so the "result is committed
// before the reveal fires" assertion is genuine, not mocked. GUARD-BITES: relocating pickOpponent
// out of submit() (or gating the result on the reveal) makes test #2 red; dropping the fresh-round
// cover() makes test #5 red — the exact broken-green gap class card-rps3d-fix taught us to lock.
import { describe, it, expect } from 'vitest';
import { RevealController } from '../src/render/reveal';
import type { Occluder, OpponentObject } from '../src/render/occluder';
import { RoundMachine } from '../src/round/machine';
import type { GestureResult } from '../src/types';

function fakes(instant = false) {
  const calls: string[] = [];
  let shownShape: string | null = null;
  const occluder: Occluder = {
    cover: () => calls.push('cover'),
    reveal: (i) => calls.push(i ? 'reveal:instant' : 'reveal'),
    update: () => {},
    isRevealed: () => calls.includes('reveal') || calls.includes('reveal:instant'),
  };
  const opponent: OpponentObject = {
    setVisible: () => {},
    setShape: (s) => (shownShape = s),
  };
  const ctrl = new RevealController({ occluder, opponent, instant: () => instant });
  return {
    ctrl,
    calls,
    get shownShape() {
      return shownShape;
    },
  };
}

const R = (): GestureResult => ({ shape: 'scissors', confidence: 0.9, lowConfidence: false, latencyMs: 5 });

describe('reveal controller (f3, NFR5)', () => {
  it('opponent is HIDDEN from round-begin, then SHOWN on the reveal beat (AC1)', () => {
    const f = fakes();
    const m = new RoundMachine(() => 'rock');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin(); // capturing -> cover
    expect(f.calls).toContain('cover');
    expect(f.calls).not.toContain('reveal');
    m.submit(R()); // resolved -> reveal
    expect(f.calls).toContain('reveal');
  });

  it('result is COMMITTED before the reveal fires — F1-first (AC3)', () => {
    const f = fakes();
    let stateAtReveal: { phase: string; result: unknown; opponentShape: unknown } | null = null;
    const m = new RoundMachine(() => 'rock');
    // Wrap so we snapshot machine state at the exact moment the controller reveals.
    m.onChange((s) => {
      const before = f.calls.length;
      f.ctrl.onState(s);
      if (f.calls.length > before && f.calls[f.calls.length - 1].startsWith('reveal')) {
        stateAtReveal = { phase: s.phase, result: s.result, opponentShape: s.opponentShape };
      }
    });
    m.submit(R());
    // player=scissors vs opponent=rock: rock beats scissors => opponent wins => result 'b'.
    // The controller displays the ALREADY-committed opponent pick (rock) at the reveal beat.
    expect(stateAtReveal).toEqual({ phase: 'resolved', result: 'b', opponentShape: 'rock' });
    expect(f.shownShape).toBe('rock');
  });

  it('reduced-motion / LOW collapses the reveal to an instant show (AC5)', () => {
    const f = fakes(true);
    const m = new RoundMachine(() => 'paper');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin();
    m.submit(R());
    expect(f.calls).toContain('reveal:instant');
    expect(f.calls).not.toContain('reveal');
  });

  it('low-confidence stays covered (no reveal)', () => {
    const f = fakes();
    const m = new RoundMachine(() => 'rock');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin();
    m.submit({ shape: 'rock', confidence: 0.2, lowConfidence: true, latencyMs: 5 });
    expect(f.calls.some((c) => c.startsWith('reveal'))).toBe(false);
  });

  it('fresh round RE-HIDES (R5/AC8): cover fires again on the next round', () => {
    const f = fakes();
    const m = new RoundMachine(() => 'rock');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin();
    m.submit(R()); // reveal
    m.submit(R()); // resolved -> submit() re-enters via begin(): capturing -> cover
    expect(f.calls.filter((c) => c === 'cover').length).toBeGreaterThanOrEqual(2);
  });
});
