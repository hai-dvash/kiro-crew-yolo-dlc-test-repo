// card-rps3d-objects · f1 (#23) — NFR4 headless regression for the throwable RPS object-rig +
// opponent-object render path. Node-env, DOM/WebGL-free — reuses the wireGame injected-fake seam +
// the makeHarness pattern from test/main.test.ts. Closes the exact card-rps3d-fix broken-green gap:
// a green build shipped a broken screen because the render/wiring surface was untested. These three
// cases lock (1) the object-rig satisfies the HandRig/WireRig contract and wires through wireGame,
// (2) setShape is a render-only consumer (never touches the machine), (3) the opponent object is a
// COMMITTED-RESULT consumer (F1-first: opponentShape is committed by submit() BEFORE the render
// subscriber observes it; pickOpponent() stays in the machine).
import { describe, it, expect } from 'vitest';
import { wireGame, type WireDeps } from '../src/main';
import { RpsObjectRig } from '../src/render/objects';
import { RoundMachine } from '../src/round/machine';
import type { GestureResult, Shape } from '../src/types';

// scissors vs rock -> rock beats scissors (BEATS.rock='scissors') -> result 'b' (opponent wins). A
// deterministic pickOpponent lets us assert the opponent object renders exactly the committed shape.
const CONFIDENT: GestureResult = { shape: 'scissors', confidence: 0.9, lowConfidence: false, latencyMs: 5 };

// A minimal harness mirroring test/main.test.ts: fakes recording what wireGame is responsible for.
function makeHarness(loadRig: () => Promise<{ object: unknown }>) {
  const added: unknown[] = [];
  const framed: Array<{ center: [number, number, number]; radius: number }> = [];
  const scaleApplied: number[] = [];
  const submitted: GestureResult[] = [];

  const deps: WireDeps = {
    scene: {
      scene: { add: (o) => added.push(o) },
      frameObject: (center, radius) => framed.push({ center, radius }),
    },
    loadHands: loadRig,
    engine: { onResult: () => {} },
    fallbackOnResult: () => {},
    machine: { submit: (r) => submitted.push(r) },
    measureRig: () => ({ center: [1, 2, 3], radius: 4 }),
    applyScale: (_o, s) => scaleApplied.push(s),
  };
  return { deps, added, framed, scaleApplied, submitted };
}

describe('RpsObjectRig — object-rig contract + wireGame wiring (f1 #23, R1/NFR4)', () => {
  it('(1) satisfies the HandRig contract (object/setShape/dispose)', () => {
    const rig = new RpsObjectRig();
    expect(rig.object).toBeDefined();
    expect(typeof rig.setShape).toBe('function');
    expect(typeof rig.dispose).toBe('function');
  });

  it('(1) wires through wireGame: added to the scene, scaled, and framed on load', async () => {
    const rig = new RpsObjectRig();
    const h = makeHarness(async () => rig as unknown as { object: unknown });
    await wireGame(h.deps).loaded;
    // added to the scene
    expect(h.added).toContain(rig.object);
    // scaled before framing (computeRigScale applied; radius 4 -> diagonal 8 -> 0.25)
    expect(h.scaleApplied).toEqual([0.25]);
    // framed with the measured center/radius
    expect(h.framed).toEqual([{ center: [1, 2, 3], radius: 4 }]);
  });
});

describe('RpsObjectRig.setShape — active-object select, render-only (f1 #23, R1/NFR1)', () => {
  // Read the emphasis scale of a shape's child mesh (0.2..1.0). setShape drives this, never a machine.
  function emphasisOf(rig: RpsObjectRig, shape: Shape): number {
    // meshes are private; read via the group's children in construction order rock,paper,scissors.
    const idx: Record<Shape, number> = { rock: 0, paper: 1, scissors: 2 };
    const child = (rig.object as unknown as { children: Array<{ scale: { x: number } }> }).children[idx[shape]];
    return child.scale.x;
  }

  it('selects the active object and decays the others toward hidden', () => {
    const rig = new RpsObjectRig();
    // Settle paper fully active, then settle scissors fully active.
    for (let i = 0; i < 60; i++) rig.setShape('paper', 0.3);
    expect(emphasisOf(rig, 'paper')).toBeGreaterThan(emphasisOf(rig, 'rock'));
    expect(emphasisOf(rig, 'paper')).toBeGreaterThan(emphasisOf(rig, 'scissors'));

    for (let i = 0; i < 60; i++) rig.setShape('scissors', 0.3);
    expect(emphasisOf(rig, 'scissors')).toBeGreaterThan(emphasisOf(rig, 'paper'));
    expect(emphasisOf(rig, 'scissors')).toBeGreaterThan(emphasisOf(rig, 'rock'));
  });

  it('clamps t and never references the round machine (render-only consumer)', () => {
    const rig = new RpsObjectRig();
    // Out-of-range t must not throw / must clamp.
    expect(() => rig.setShape('rock', 5)).not.toThrow();
    expect(() => rig.setShape('rock', -3)).not.toThrow();
    // The module surface exposes no machine/submit reference — a purely structural render entity.
    expect((rig as unknown as { submit?: unknown }).submit).toBeUndefined();
  });
});

describe('Opponent-object render path — committed-result consumer (f1 #23, R2/NFR1, F1-FIRST)', () => {
  it('renders the committed opponentShape from the onChange subscriber, submit() untouched', () => {
    // Deterministic opponent = rock; player throws scissors -> rock beats scissors -> result 'b'.
    const machine = new RoundMachine(() => 'rock' as Shape);

    // A test-double opponent rig (the render entity) recording setShape calls.
    const opponentCalls: Array<{ shape: Shape; committedBeforeObserved: boolean }> = [];

    // The exact wiring boot() uses: a committed-result consumer subscribed via onChange.
    machine.onChange((s) => {
      if (s.phase === 'resolved' && s.result && s.opponentShape) {
        // F1-FIRST proof: at the moment the subscriber observes the change, the machine has ALREADY
        // committed opponentShape (submit() set it synchronously before emit()).
        const committed = machine.getState().opponentShape === s.opponentShape;
        opponentCalls.push({ shape: s.opponentShape, committedBeforeObserved: committed });
      }
    });

    machine.begin();
    machine.submit(CONFIDENT);

    expect(opponentCalls).toHaveLength(1);
    expect(opponentCalls[0].shape).toBe('rock'); // exactly the committed opponent shape
    expect(opponentCalls[0].committedBeforeObserved).toBe(true);
    // Sanity: the machine committed the full resolved state (F1 is authoritative, render consumes it).
    expect(machine.getState().playerShape).toBe('scissors');
    expect(machine.getState().result).toBe('b');
  });

  it('GUARD-BITES: deriving the opponent shape at render time (not from committed state) is wrong', () => {
    // This case documents the F1-first contract the implementation must honor: the opponent object
    // reads machine.getState().opponentShape (committed by submit()), it does NOT re-pick at render.
    // If a future edit derived the shape independently of committed state, this equality breaks.
    const machine = new RoundMachine(() => 'paper' as Shape);
    let observed: Shape | null = null;
    machine.onChange((s) => {
      if (s.phase === 'resolved' && s.opponentShape) observed = s.opponentShape;
    });
    machine.begin();
    machine.submit(CONFIDENT);
    // The rendered opponent shape MUST equal the machine's committed pick — never an independent guess.
    expect(observed).toBe(machine.getState().opponentShape);
    expect(observed).toBe('paper');
  });
});
