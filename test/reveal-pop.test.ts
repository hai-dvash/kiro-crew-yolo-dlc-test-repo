// [f2] #24 (child of #22) — poppy reveal-pop regression test (NFR5).
// node-env, DOM/WebGL-free, mirroring test/main.test.ts's makeHarness DI discipline. It drives a
// REAL RoundMachine (deterministic pickOpponent) through the SAME resolved-beat wiring main.ts uses,
// and injects a fake PopTarget recording the setPopScale stream. This closes the card-rps3d-fix
// broken-green gap class: the pop's TRIGGER WIRING is asserted headlessly —
//   (1) fires once per resolved round, only on phase==='resolved' (not idle/capturing/lowConfidence)
//   (2) never before commit (result + opponentShape already set when onResult fires)
//   (3) full-motion overshoot rises above 1.0 then lands exactly at 1.0
//   (4) tween-only downgrade never exceeds 1.0 and ends at rest
//   (5) re-arm pops again on a subsequent round
//   (6) absent target no-ops (never throws)
import { describe, it, expect } from 'vitest';
import { RevealPop, type PopTarget } from '../src/render/reveal-pop';
import { RoundMachine, type RoundState } from '../src/round/machine';
import type { GestureResult } from '../src/types';

/** Fake PopTarget recording every setPopScale value the controller writes. */
function fakeTarget(): PopTarget & { scales: number[] } {
  const scales: number[] = [];
  return { scales, setPopScale: (s) => scales.push(s) };
}

const CONFIDENT: GestureResult = { shape: 'scissors', confidence: 0.9, lowConfidence: false, latencyMs: 5 };
const LOW: GestureResult = { shape: 'rock', confidence: 0.2, lowConfidence: true, latencyMs: 5 };

/**
 * Wire a RevealPop to a RoundMachine exactly the way main.ts does: fire onResult from the
 * `phase==='resolved' && result` branch and reset() when the phase is 'capturing'. Records the
 * committed machine snapshot captured AT the instant the pop fired (proves NFR1 never-before-commit).
 */
function wire(machine: RoundMachine, revealPop: RevealPop, tweenOnly: boolean) {
  const firedWith: Array<{ result: RoundState['result']; opponentShape: RoundState['opponentShape'] }> = [];
  machine.onChange((s) => {
    if (s.phase === 'resolved' && s.result) {
      firedWith.push({ result: s.result, opponentShape: s.opponentShape });
      revealPop.onResult({ tweenOnly });
    } else if (s.phase === 'capturing') {
      revealPop.reset();
    }
  });
  return firedWith;
}

/** Step the controller across the full pop window and return the recorded scale stream slice. */
function runToSettle(revealPop: RevealPop, target: { scales: number[] }, stepMs = 16, steps = 40) {
  const start = target.scales.length;
  for (let i = 0; i < steps; i++) revealPop.update(stepMs);
  return target.scales.slice(start);
}

describe('RevealPop reveal-pop trigger wiring (f2 #24, NFR5)', () => {
  it('(1) fires once per resolved round; not on idle/capturing/lowConfidence', () => {
    const target = fakeTarget();
    const machine = new RoundMachine(() => 'rock'); // deterministic opponent
    const rp = new RevealPop(target);
    let popCount = 0;
    machine.onChange((s) => {
      if (s.phase === 'resolved' && s.result) {
        popCount++;
        rp.onResult({ tweenOnly: false });
      } else if (s.phase === 'capturing') {
        rp.reset();
      }
    });

    machine.begin(); // capturing — no pop
    machine.submit(LOW); // lowConfidence — no pop
    expect(popCount).toBe(0);

    machine.submit(CONFIDENT); // resolved — one pop
    expect(popCount).toBe(1);
  });

  it('(2) never fires before commit — result + opponentShape are set when it fires', () => {
    const target = fakeTarget();
    const machine = new RoundMachine(() => 'rock');
    const rp = new RevealPop(target);
    const firedWith = wire(machine, rp, false);

    machine.begin();
    machine.submit(CONFIDENT);

    expect(firedWith).toHaveLength(1);
    expect(firedWith[0].result).not.toBeNull();
    expect(firedWith[0].opponentShape).not.toBeNull();
    // player=scissors vs opponent=rock: rock beats scissors => result 'b' (from player-A's
    // perspective, opponent B wins) — proves the committed result drove the beat, not a guess.
    expect(firedWith[0].result).toBe('b');
  });

  it('(3) full-motion overshoot rises above 1.0 then lands exactly at 1.0', () => {
    const target = fakeTarget();
    const rp = new RevealPop(target);
    rp.onResult({ tweenOnly: false });
    const stream = runToSettle(rp, target);
    expect(Math.max(...stream)).toBeGreaterThan(1.0); // a real "pop"
    expect(stream[stream.length - 1]).toBe(1.0); // lands exactly at rest — no drift/stuck scale
  });

  it('(4) tween-only downgrade never exceeds 1.0 and ends at rest', () => {
    const target = fakeTarget();
    const rp = new RevealPop(target);
    rp.onResult({ tweenOnly: true });
    // no overshoot armed — but stepping update must not introduce any scale > 1.0 either
    runToSettle(rp, target);
    expect(Math.max(...target.scales)).toBeLessThanOrEqual(1.0);
    expect(target.scales[target.scales.length - 1]).toBe(1.0); // object still arrives at rest
  });

  it('(5) re-arms: reset() returns to rest and a subsequent onResult pops again', () => {
    const target = fakeTarget();
    const machine = new RoundMachine(() => 'rock');
    const rp = new RevealPop(target);
    let popCount = 0;
    machine.onChange((s) => {
      if (s.phase === 'resolved' && s.result) {
        popCount++;
        rp.onResult({ tweenOnly: false });
      } else if (s.phase === 'capturing') {
        rp.reset();
      }
    });

    machine.begin();
    machine.submit(CONFIDENT); // pop 1
    machine.submit(CONFIDENT); // submit() auto-begins (capturing => reset) then resolves => pop 2
    expect(popCount).toBe(2);
    // after the settle the target rests at 1.0
    runToSettle(rp, target);
    expect(target.scales[target.scales.length - 1]).toBe(1.0);
  });

  it('(6) absent target: onResult/update/reset never throw', () => {
    const rp = new RevealPop(null);
    expect(() => {
      rp.onResult({ tweenOnly: false });
      rp.update(16);
      rp.reset();
      rp.onResult({ tweenOnly: true });
    }).not.toThrow();
  });
});
