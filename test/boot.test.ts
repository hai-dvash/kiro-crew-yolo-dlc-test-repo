// card-rps3d-fixgame FR-5 + FR-2 + FR-3 — boot-wiring integration tests (implement step).
//
// These tests close the gap that let "green-but-broken-on-screen" defects ship: they assert the
// shipped boot wiring end-to-end via the DOM/WebGL-free wireGame(WireDeps) seam (INV-4).
//
// Four assertions:
//   1. Both input paths (gesture engine + a11y fallback) are wired to the SAME machine.submit sink.
//   2. The rig is added to the scene, scaled, and frameObject is called with the post-scale
//      measured center/radius (FR-3 framing chain).
//   3. onRigLoaded is invoked after load+frame; no GltfHandRig dead branch compiles
//      (importing main.ts below would fail at module-load if GltfHandRig were still referenced).
//   4. Suite remains green after the FR-2 dead-code removal (implicit: all 12 test files pass).
import { describe, it, expect } from 'vitest';
import { wireGame, type WireScene, type WireRig, type WireEngine } from '../src/main';
import type { GestureResult } from '../src/types';

// ---- test helpers ----

function makeWireScene(): WireScene & {
  adds: unknown[];
  framed: Array<{ center: [number, number, number]; radius: number }>;
  frameObject: (center: [number, number, number], radius: number) => void;
} {
  const adds: unknown[] = [];
  const framed: Array<{ center: [number, number, number]; radius: number }> = [];
  return {
    scene: { add: (o) => { adds.push(o); } },
    frameObject: (center, radius) => { framed.push({ center, radius }); },
    adds,
    framed,
  };
}

function makeWireRig(): WireRig {
  return { object: { id: 'stub-rig-object' } };
}

// ---- Test 1: both input paths wire to the same submit sink (FR-5 / INV-1) ----

describe('FR-5: boot wires both input paths to the same machine.submit sink', () => {
  it('gesture engine and a11y fallback both call machine.submit (single source of truth)', () => {
    const submitted: GestureResult[] = [];
    let engineCb: ((r: GestureResult) => void) | null = null;
    let fallbackCb: ((r: GestureResult) => void) | null = null;

    const engine: WireEngine = {
      onResult: (cb) => { engineCb = cb; },
    };
    const machine = { submit: (r: GestureResult) => { submitted.push(r); } };

    wireGame({
      scene: makeWireScene(),
      loadHands: async () => makeWireRig(),
      engine,
      fallbackOnResult: (submit) => { fallbackCb = submit; },
      machine,
      measureRig: () => ({ center: [0, 0, 0], radius: 1 }),
    });

    const r1: GestureResult = { shape: 'rock', confidence: 0.9, lowConfidence: false, latencyMs: 5 };
    const r2: GestureResult = { shape: 'paper', confidence: 0.8, lowConfidence: false, latencyMs: 6 };

    engineCb!(r1);
    fallbackCb!(r2);

    // Both paths reached machine.submit
    expect(submitted).toHaveLength(2);
    expect(submitted[0]).toBe(r1);
    expect(submitted[1]).toBe(r2);
  });

  it('engine and fallback route through the IDENTICAL submit function (not two independent ones)', () => {
    const callOrder: string[] = [];
    let engineCb: ((r: GestureResult) => void) | null = null;
    let fallbackCb: ((r: GestureResult) => void) | null = null;

    wireGame({
      scene: makeWireScene(),
      loadHands: async () => makeWireRig(),
      engine: { onResult: (cb) => { engineCb = cb; } },
      fallbackOnResult: (submit) => { fallbackCb = submit; },
      machine: {
        submit: () => { callOrder.push('submit'); },
      },
      measureRig: () => ({ center: [0, 0, 0], radius: 1 }),
    });

    const r: GestureResult = { shape: 'scissors', confidence: 0.95, lowConfidence: false, latencyMs: 4 };
    engineCb!(r);
    fallbackCb!(r);

    // machine.submit was invoked by both paths (2 calls = same sink, not 0 or 1)
    expect(callOrder).toEqual(['submit', 'submit']);
  });
});

// ---- Test 2: rig is scene.add-ed, scaled, and frameObject is called with post-scale AABB (FR-3 + FR-5) ----

describe('FR-3 + FR-5: rig added to scene + measured + scaled + framed on load', () => {
  it('adds the rig object to the scene on load', async () => {
    const ws = makeWireScene();
    const rig = makeWireRig();
    await wireGame({
      scene: ws,
      loadHands: async () => rig,
      engine: { onResult: () => {} },
      fallbackOnResult: () => {},
      machine: { submit: () => {} },
      measureRig: () => ({ center: [0, 0, 0], radius: 1 }),
    }).loaded;

    expect(ws.adds).toContain(rig.object);
  });

  it('calls applyScale with a positive scale derived from the rig AABB diagonal', async () => {
    const scalesApplied: number[] = [];
    await wireGame({
      scene: makeWireScene(),
      loadHands: async () => makeWireRig(),
      engine: { onResult: () => {} },
      fallbackOnResult: () => {},
      machine: { submit: () => {} },
      measureRig: () => ({ center: [0, 0, 0], radius: 3 }),  // diagonal = 6
      applyScale: (_o, s) => { scalesApplied.push(s); },
    }).loaded;

    // computeRigScale(6, 2) = 2/6 ≈ 0.333
    expect(scalesApplied).toHaveLength(1);
    expect(scalesApplied[0]).toBeCloseTo(2 / 6, 5);
  });

  it('calls frameObject with the remeasured (post-scale) center and radius', async () => {
    const ws = makeWireScene();
    let callCount = 0;

    await wireGame({
      scene: ws,
      loadHands: async () => makeWireRig(),
      engine: { onResult: () => {} },
      fallbackOnResult: () => {},
      machine: { submit: () => {} },
      // Two calls to measureRig: first before scale, second after. Return different values to
      // assert wireGame uses the SECOND (post-scale) measurement for frameObject.
      measureRig: () => {
        callCount++;
        return callCount === 1
          ? { center: [0, 0, 0], radius: 3 }   // pre-scale measurement (used for scale only)
          : { center: [1, 2, 3], radius: 0.5 }; // post-scale measurement (should feed frameObject)
      },
    }).loaded;

    expect(ws.framed).toHaveLength(1);
    expect(ws.framed[0]).toEqual({ center: [1, 2, 3], radius: 0.5 });
  });
});

// ---- Test 3: onRigLoaded is called post-load; no GltfHandRig dead branch remains (FR-2 + FR-5) ----

describe('FR-2 + FR-5: onRigLoaded called after load; no GltfHandRig dead branch', () => {
  it('invokes the optional onRigLoaded callback exactly once after the rig is loaded and framed', async () => {
    let onRigLoadedCalls = 0;
    let onRigLoadedArg: unknown = undefined;
    const rig = makeWireRig();

    await wireGame({
      scene: makeWireScene(),
      loadHands: async () => rig,
      engine: { onResult: () => {} },
      fallbackOnResult: () => {},
      machine: { submit: () => {} },
      measureRig: () => ({ center: [0, 0, 0], radius: 1 }),
      onRigLoaded: (r) => {
        onRigLoadedCalls++;
        onRigLoadedArg = r;
      },
    }).loaded;

    expect(onRigLoadedCalls).toBe(1);
    expect(onRigLoadedArg).toBe(rig);
  });

  it('importing src/main.ts succeeds with no GltfHandRig reference (FR-2 compile guard)', async () => {
    // This test is an IMPLICIT assertion: if the FR-2 dead-code removal was incomplete and
    // GltfHandRig were still imported from the deleted src/render/hands.ts, the import of
    // wireGame above would have thrown a "Cannot find module" error at module load time — this
    // whole test file would fail to run. The fact that we reach this line proves the removal
    // is complete and src/main.ts no longer references the deleted module.
    const { wireGame: wg } = await import('../src/main');
    expect(typeof wg).toBe('function');
  });
});
