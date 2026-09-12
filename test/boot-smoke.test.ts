// card-rps3d-visual (#29) · T10 / VER-1 — boot-smoke over the DOM/WebGL-free seams. Two guarantees:
//   (A) the four wireGame wiring props still hold after the #29 T7 swap (rig added, engine->submit,
//       fallback->submit, frameObject called with the measured center/radius);
//   (B) a full RevealController beat runs end-to-end with the REAL BoardOccluder + an opponent
//       adapter: cover() on capturing, setShape(committed) + reveal() on resolved, update() drives
//       isRevealed()===true, and the opponent adapter's setShape saw the committed shape.
// MUST fail if the T7 reveal wiring or occluder path throws — the exact broken-green class this
// pipeline exists to prevent.
import { describe, it, expect } from 'vitest';
import { wireGame, type WireDeps } from '../src/main';
import { BoardOccluder, type OpponentObject } from '../src/render/occluder';
import { RevealController } from '../src/render/reveal';
import { RoundMachine } from '../src/round/machine';
import type { GestureResult, Shape } from '../src/types';

const R: GestureResult = { shape: 'scissors', confidence: 0.9, lowConfidence: false, latencyMs: 5 };

// (A) wireGame smoke — fakes recording what wireGame is responsible for (mirrors main.test harness).
function makeHarness() {
  const added: unknown[] = [];
  const framed: Array<{ center: [number, number, number]; radius: number }> = [];
  const submitted: GestureResult[] = [];
  let engineCb: ((r: GestureResult) => void) | null = null;
  let fallbackSubmit: ((r: GestureResult) => void) | null = null;
  const rigObject = { id: 'rig-object' };

  const deps: WireDeps = {
    scene: { scene: { add: (o) => added.push(o) }, frameObject: (c, r) => framed.push({ center: c, radius: r }) },
    loadHands: async () => ({ object: rigObject }),
    engine: { onResult: (cb) => (engineCb = cb) },
    fallbackOnResult: (submit) => (fallbackSubmit = submit),
    machine: { submit: (r) => submitted.push(r) },
    measureRig: () => ({ center: [1, 2, 3], radius: 4 }),
    applyScale: () => {},
  };
  return {
    deps,
    added,
    framed,
    submitted,
    rigObject,
    fire: { engine: (r: GestureResult) => engineCb?.(r), fallback: (r: GestureResult) => fallbackSubmit?.(r) },
  };
}

describe('#29 boot-smoke (T10 / VER-1) — wireGame wiring survives the T7 swap', () => {
  it('(a) adds the loaded rig to the scene and frames it on load', async () => {
    const h = makeHarness();
    await wireGame(h.deps).loaded;
    expect(h.added).toContain(h.rigObject);
    expect(h.framed).toEqual([{ center: [1, 2, 3], radius: 4 }]);
  });

  it('(b)(c) both input paths (engine + a11y fallback) feed the same machine.submit', () => {
    const h = makeHarness();
    wireGame(h.deps);
    h.fire.engine(R);
    h.fire.fallback(R);
    expect(h.submitted).toEqual([R, R]);
  });
});

// (B) reveal-beat smoke — the REAL BoardOccluder + an opponent adapter (as main.ts wires them),
// driven by a real RoundMachine so "committed before reveal" is genuine. THREE-backed but headless
// (no renderer/canvas): BoardOccluder only touches material.opacity + object.visible.
describe('#29 boot-smoke (T10 / VER-1) — full reveal beat with the real occluder', () => {
  it('cover on capturing, reveal on resolved, update reaches isRevealed; opponent shown committed shape', () => {
    const occluder = new BoardOccluder();
    let shown: Shape | null = null;
    let visible = true;
    const opponent: OpponentObject = {
      setVisible: (v) => (visible = v),
      setShape: (s) => (shown = s),
    };
    let punchCalls = 0;
    const ctrl = new RevealController({
      occluder,
      opponent,
      instant: () => false, // full-motion path
      onReveal: () => punchCalls++,
    });

    const m = new RoundMachine(() => 'rock'); // deterministic opponent
    m.onChange((s) => ctrl.onState(s));

    expect(() => {
      m.begin(); // capturing -> cover()
      m.submit(R); // scissors vs rock -> rock wins -> resolved, opponentShape committed = rock
    }).not.toThrow();

    // covered then revealing: opponent got the committed shape, punch-in fired (non-instant).
    expect(shown).toBe('rock');
    expect(punchCalls).toBe(1);
    expect(occluder.isRevealed()).toBe(false); // transition armed, not yet advanced

    // advance the transition to completion (REVEAL_MS = 320ms; feed 0.4s).
    ctrl.update(0.4);
    expect(occluder.isRevealed()).toBe(true);
    // keep the adapter's setVisible surface exercised (no throw / referenced).
    opponent.setVisible(visible);
  });

  it('instant path (reduced-motion / LOW) skips the camera punch-in', () => {
    const occluder = new BoardOccluder();
    const opponent: OpponentObject = { setVisible: () => {}, setShape: () => {} };
    let punchCalls = 0;
    const ctrl = new RevealController({ occluder, opponent, instant: () => true, onReveal: () => punchCalls++ });
    const m = new RoundMachine(() => 'rock');
    m.onChange((s) => ctrl.onState(s));
    m.begin();
    m.submit(R);
    expect(punchCalls).toBe(0); // instant path -> no punch-in
    expect(occluder.isRevealed()).toBe(true); // instant reveal is immediate
  });
});
