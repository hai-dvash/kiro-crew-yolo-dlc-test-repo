// card-rps3d-fix [R6.4, design §6] — boot/wiring smoke test (the META fix). RED on 719c6eb:
// `wireGame` and this file did not exist; boot() was one untestable closure touching document +
// WebGL, which is why the green build shipped a broken screen (wrong asset, no framing, dead input
// path all went unasserted). GREEN after T9: wireGame is a DOM/WebGL-free seam whose collaborators
// are injected, so we can assert the four wiring properties that each map to one shipped defect:
//   (a) the loaded rig is added to the scene           — render surface wired
//   (b) engine.onResult -> machine.submit              — gesture input path live
//   (c) the a11y fallback feeds the SAME submit         — keyboard/button path live
//   (d) frameObject is invoked with the rig's measured center/radius on load — camera framing wired
import { describe, it, expect } from 'vitest';
import { wireGame, type WireDeps } from '../src/main';
import type { GestureResult } from '../src/types';

const R: GestureResult = { shape: 'scissors', confidence: 0.9, lowConfidence: false, latencyMs: 5 };

// A minimal test harness: fakes that record the interactions wireGame is responsible for.
function makeHarness(overrides: Partial<WireDeps> = {}) {
  const added: unknown[] = [];
  const framed: Array<{ center: [number, number, number]; radius: number }> = [];
  const submitted: GestureResult[] = [];
  let engineCb: ((r: GestureResult) => void) | null = null;
  let fallbackSubmit: ((r: GestureResult) => void) | null = null;

  const rigObject = { id: 'rig-object' };
  const scaleApplied: number[] = [];

  const deps: WireDeps = {
    scene: {
      scene: { add: (o) => added.push(o) },
      frameObject: (center, radius) => framed.push({ center, radius }),
    },
    loadHands: async () => ({ object: rigObject }),
    engine: { onResult: (cb) => (engineCb = cb) },
    fallbackOnResult: (submit) => (fallbackSubmit = submit),
    machine: { submit: (r) => submitted.push(r) },
    // Measure returns a fixed AABB so we can assert frameObject gets the measured values.
    measureRig: () => ({ center: [1, 2, 3], radius: 4 }),
    applyScale: (_o, s) => scaleApplied.push(s),
    ...overrides,
  };

  return {
    deps,
    added,
    framed,
    submitted,
    scaleApplied,
    rigObject,
    fire: {
      engine: (r: GestureResult) => engineCb?.(r),
      fallback: (r: GestureResult) => fallbackSubmit?.(r),
    },
  };
}

describe('wireGame boot/wiring smoke (card-rps3d-fix, R6.4)', () => {
  it('(a) adds the loaded rig object to the scene on load', async () => {
    const h = makeHarness();
    await wireGame(h.deps).loaded;
    expect(h.added).toContain(h.rigObject);
  });

  it('(b) wires engine.onResult -> machine.submit', () => {
    const h = makeHarness();
    wireGame(h.deps);
    h.fire.engine(R);
    expect(h.submitted).toContain(R);
  });

  it('(c) wires the a11y fallback to the SAME machine.submit', () => {
    const h = makeHarness();
    wireGame(h.deps);
    h.fire.fallback(R);
    expect(h.submitted).toContain(R);
  });

  it('(d) invokes frameObject with the rig\'s measured center/radius after load', async () => {
    const h = makeHarness();
    await wireGame(h.deps).loaded;
    expect(h.framed).toHaveLength(1);
    expect(h.framed[0]).toEqual({ center: [1, 2, 3], radius: 4 });
  });

  it('normalizes the rig scale before framing (computeRigScale applied)', async () => {
    const h = makeHarness();
    await wireGame(h.deps).loaded;
    // radius 4 -> diagonal 8 -> computeRigScale(8, 2) = 0.25
    expect(h.scaleApplied).toEqual([0.25]);
  });
});
