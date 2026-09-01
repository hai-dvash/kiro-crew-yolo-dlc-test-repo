# Design — card-kiro-crew-yolo-dlc-test-repo-23 (f1, child of #22)

**Issue:** [#23](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/23) —
`[card-rps3d-objects · f1] Throwable RPS object-rig + opponent-object render path`
**Parent:** #22 (card-rps3d-objects), the DEEP-decomposed RPS-object visual redesign (Order-4 proof).
**Step:** design · **Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Effective modes:** trust=assisted (inherited: card.trust=null → pipeline assisted) · depth=**deep** · capability=dlcyolo-coordinator
**Crew (assigned):** dlcyolo-rps3d-design (dlcyolo-authoring, verified present in roster via `kirocrew agent list`)
**Grounded in live source @ branch `dlc/card-kiro-crew-yolo-dlc-test-repo-23` @ 5930727** (based off origin/main dcdb2e4) + live GitHub (issue #23 OPEN, author hai-dvash == gh-auth, ownership guard PASS).

---

## 0. Dispatch grounding (no faked crew run)

Spawned as `dlcyolo-coordinator`, which the task states holds `select_crew`/`spawn_run`. Empirically —
consistent with every prior step on this pipeline (card-backlog-14 intake→pr, card-rps3d-headline
investigate→pr, parent card-rps3d-objects investigate/requirements, this card's own investigate +
requirements) — this runtime's tool surface is **read/write/shell only**; the crew-routing tools are not
wired here (verified this run: attempting to dispatch has no effect; only read/write/shell are available).
Per the pipeline-workflow **PRODUCE-OR-BLOCK** contract, a run lacking the crew-routing MECHANISM
**performs the step inline** rather than faking a crew or silently downgrading. Design authoring is a
read→analyze→write pass = exactly the assigned `dlcyolo-rps3d-design` (dlcyolo-authoring) scope, a subset
of the coordinator's scope — done inline, honestly. This is **NOT a hard capability-gap**: the missing
tool is only the dispatch mechanism, not one the design work needs, so per the contract I do not raise a
capability-gap block for it.

## 1. Design goal & invariant

Turn f1's requirements (R1 object-rig replaces the hand as the player visual; R2 new opponent-object
render path) into a concrete, buildable, **behavior-preserving** render-layer design that plugs into the
existing `wireGame` seam with **zero structural change** and holds the **F1-FIRST** invariant.

**LOAD-BEARING invariant (NFR1), carried verbatim to implement:** `RoundMachine.submit()` synchronously
calls the injected `pickOpponent()`, `resolve()`s, sets `playerShape`/`opponentShape`/`result`/`score`,
flips `phase='resolved'`, then `emit()`s (verified live `src/round/machine.ts:67-90`). Therefore f1's
player object-rig **and** the new opponent object are **committed-result CONSUMERS** — they subscribe
AFTER the machine commits, exactly like `HandRig`/`juice` today. Implement MUST NOT (1) relocate
`pickOpponent()` out of `submit()`, or (2) couple the committed result / `opponentShape` to render or
animation timing. `round.test.ts` + `render-physics.test.ts` + `main.ts`'s layering comment lock this.

## 2. Design-step forks resolved (the STOP-RULE "HOW")

Requirements §3 deferred four choices to design. Resolved here (these are design content, not human-only
pipeline forks — the single-card-vs-fan-out fork was already settled at the parent's human interjection):

**FORK D1 — Literal mesh vs primitive/parametric geometry → PARAMETRIC (primitive Three.js geometry).**
Chosen because it (a) satisfies R5 zero-new-dep **outright** with no asset sourcing/licensing at all,
(b) mirrors the proven `PrimitiveHandRig` always-ships pattern (NFR5 baseline), and (c) reads instantly
as RPS (R3) with recognizable silhouettes:
- **rock** — an icosahedron (`THREE.IcosahedronGeometry`, detail 0) with high roughness → a chunky faceted stone.
- **paper** — a thin flat box/plane (`THREE.BoxGeometry(w, h, ~0.02)`) → a flat sheet.
- **scissors** — two thin crossed blades (two elongated boxes rotated into an X) grouped → the scissors "V".
A future sourced-mesh upgrade can slot behind the SAME rig interface (like `GltfHandRig` did for hands)
and would then inherit the parent's CC0/CC-BY provenance discipline — but f1 ships parametric, no new dep.

**FORK D2 — `setShape(shape, t)` object semantics → ACTIVE-OBJECT SELECT with a scale/emphasis tween.**
Unlike the hand (one mesh morphing between poses), the object-rig holds **three pre-built child meshes**
(rock, paper, scissors) parented under `object`. `setShape(shape, t)` shows the `shape` mesh and hides the
other two, and interpolates the active mesh's emphasis (scale toward its shown size) by `t∈[0,1]` so the
existing RAF `poseT` drive (`hands.setShape(st.playerShape, poseT*0.2)` in `main.ts`) still animates a
gentle settle — **behavior-preserving of the call site**. No per-frame real-time coupling to the result;
`t` is the same normalized pose parameter the hand used. (f2's "pop" later drives a bigger overshoot on
this same handle; f1 only exposes it.)

**FORK D3 — Opponent-object staging & two-entity framing → SYMMETRIC OPPONENT via a shared rig factory,
framed as a group.** Today `wireGame` frames ONE rig. Design keeps `wireGame` framing ONE root object by
introducing a **player object-rig** loaded through the existing `loadHands`-shaped seam, and rendering the
**opponent object** as a **sibling driven from `machine.onChange`** (off committed `state.opponentShape`),
positioned offset from the player (e.g. opponent set back/across the table on +Z or +X). To keep
`wireGame`'s single-object framing intact and headless-testable, the **player rig object** stays the framed
root; the opponent object is added to the scene separately in `boot()`'s `onChange` wiring (a committed-
result consumer) and positioned by a fixed transform — it does not participate in `computeRigScale`/
`frameObject` (avoiding a `wireGame` structural change, honoring R4/NFR2). Both player and opponent objects
are built by the SAME `makeRpsObjectRig()` factory so they read as the same visual language (R3).

**FORK D4 — Where the opponent object is driven → in the existing `machine.onChange` subscriber (boot),
NOT in `submit()`.** The opponent rig gets a `setShape(opponentShape, 1)` call inside the same
`machine.onChange((s) => …)` block that already calls `render(s)` and `juice.onResult(...)` on
`phase==='resolved'`. This is the committed-result consumer path (F1-first preserved) — the opponent
object simply reflects already-committed state.

## 3. Concrete design

### 3.1 New module `src/render/objects.ts` (the object-rig)
Exposes an object-rig satisfying the **exact live `HandRig` contract** so nothing structural changes:

```ts
// src/render/objects.ts  (NEW — additive; no edits to hands.ts)
import * as THREE from 'three';
import type { Shape } from '../types';
import { QualityTier } from '../config';
import type { HandRig } from './hands';   // reuse the SAME interface (object/setShape/dispose)

// Parametric RPS object-rig. Holds three child meshes; setShape selects+emphasizes the active one.
// Always-ships baseline (NFR5) — mirrors PrimitiveHandRig; no asset, no new dep (R5).
export class RpsObjectRig implements HandRig {
  object = new THREE.Group();
  private meshes: Record<Shape, THREE.Object3D>;
  private current: Record<Shape, number> = { rock: 0, paper: 0, scissors: 0 };
  constructor() {
    this.meshes = {
      rock: makeRock(),
      paper: makePaper(),
      scissors: makeScissors(),
    };
    for (const s of ['rock', 'paper', 'scissors'] as Shape[]) {
      this.meshes[s].visible = false;
      this.object.add(this.meshes[s]);
    }
    this.setShape('rock', 1);
  }
  setShape(shape: Shape, t: number): void {
    const k = Math.max(0, Math.min(1, t));
    for (const s of ['rock', 'paper', 'scissors'] as Shape[]) {
      const active = s === shape;
      this.meshes[s].visible = active || this.current[s] > 0.01;
      const target = active ? 1 : 0;
      this.current[s] += (target - this.current[s]) * k;
      this.meshes[s].scale.setScalar(0.2 + this.current[s]);
      this.meshes[s].visible = this.current[s] > 0.01;
    }
  }
  dispose(): void {
    this.object.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  }
}

// factory used by BOTH the player rig and the opponent object (same visual language, R3)
export function makeRpsObjectRig(): RpsObjectRig { return new RpsObjectRig(); }

// loadHands-shaped async seam so wireGame({ loadHands }) consumes it with NO structural change (R1).
export async function loadObjects(_tier: QualityTier): Promise<HandRig> {
  return new RpsObjectRig();   // parametric always ships; a sourced-mesh upgrade slots here later
}
```
`makeRock()/makePaper()/makeScissors()` build the FORK-D1 geometries (icosahedron / thin box / two crossed
boxes) with `MeshStandardMaterial` (matches the existing PBR scene). Kept in the same module.

### 3.2 `src/main.ts` wiring (additive, NO structural `wireGame` change)
- **Player rig:** change the `loadHands` dep passed to `wireGame` from `loadHands(bootTier)` to
  `loadObjects(bootTier)` (both return `Promise<HandRig>` — signature identical, `wireGame` untouched).
  The RAF loop's `hands.setShape(st.playerShape, poseT*0.2)` now poses the OBJECT rig — behavior-preserving.
- **Opponent object:** in `boot()`, build one `const opponent = makeRpsObjectRig();`, add
  `opponent.object` to the scene at a fixed offset transform (e.g. `opponent.object.position.set(0,0,-3)`),
  and inside the existing `machine.onChange((s) => …)` block, on `s.phase === 'resolved' && s.opponentShape`
  call `opponent.setShape(s.opponentShape, 1)`. This is a committed-result consumer (F1-first, FORK-D4).
  The opponent object is hidden/idle until resolved (its meshes start invisible), which is also the seam
  **f3's board** later hides.
- `#status`/`#badge` text HUD is UNCHANGED (NFR3): the SR user still hears "You: rock · CPU: scissors → …".

### 3.3 a11y (NFR3)
The object render path writes NO aria-live region. `render(s)`'s `#status`/`#badge` text stays first in
reading order and truthful; objects are pure visual. Opponent object presence does not change the announced
outcome. No regression to `src/a11y/*`.

### 3.4 Fallback / reversibility (NFR5)
`RpsObjectRig` is parametric and always constructs (no async asset, no failure mode) — it is itself the
always-ships baseline, analogous to `PrimitiveHandRig`. `loadObjects` never returns null. If a future
sourced-mesh upgrade is added behind the interface, it must keep this parametric floor as the fallback
(the `loadHands` → `PrimitiveHandRig` pattern is the reference).

## 4. Test design (NFR4 — closes the card-rps3d-fix broken-green gap)

All tests are **node-env, DOM/WebGL-free**, reusing the `wireGame` injected-fake seam + the `makeHarness`
pattern from `main.test.ts`. Two test targets (implement will land these in one `test/objects.test.ts`
plus one added case in the boot smoke coverage):

1. **Object-rig satisfies the `HandRig`/`WireRig` contract & wires through `wireGame` (R1, NFR4).**
   Construct `new RpsObjectRig()`; assert it exposes `object`, `setShape`, `dispose`. Feed
   `loadHands: async () => rig` into the `makeHarness` `WireDeps`; `await wireGame(deps).loaded`; assert
   the rig object is **added to the scene**, **scaled** (`scaleApplied` non-empty), and **framed**
   (`framed` gets the measured center/radius) — mirroring `main.test.ts` (a)/(d)/scale. No THREE/WebGL.
2. **`setShape` selects the active object without touching the machine (R1, NFR1).**
   Call `rig.setShape('paper', 1)` then `rig.setShape('scissors', 1)`; assert the active shape's child is
   the emphasized/visible one and the others decay toward hidden (pure geometry-state assertion on the
   rig, no submit/machine call). Guards that posing is a render-only consumer.
3. **Opponent path renders off committed `opponentShape` without touching `submit()` (R2, NFR1).**
   Drive a `RoundMachine` with an injected `pickOpponent` (deterministic), `submit` a confident result,
   and assert that a test double opponent rig's `setShape` is called with the machine's committed
   `state.opponentShape` **from the `onChange` subscriber** — proving the opponent object is a committed-
   result consumer and `submit()`/`pickOpponent()` are unchanged (assert `machine.getState().opponentShape`
   is set BEFORE the render subscriber observes it).

**Guard-bites expectation (implement acceptance):** breaking F1-first (e.g. deriving the opponent shape at
render time instead of reading committed state) or breaking the `HandRig` contract must turn a test RED.

## 5. NFR2 additive-only touch set (diff contract handed to implement)

- **NEW** `src/render/objects.ts` (the object-rig + factory + `loadObjects`).
- **NEW** `test/objects.test.ts` (the three NFR4 assertions above).
- **EDIT** `src/main.ts` — swap the `loadHands` dep → `loadObjects`, add the opponent object build +
  `onChange` `setShape` call. Additive within the render/wiring layer.
- **ZERO edits** under `src/round/**`, `src/rules.ts`, `src/types.ts` (import-only), `src/a11y/**`.
  `src/render/hands.ts` is left intact (the interface is imported, not modified) — f1 adds an object-rig
  alongside, it does not delete the hand rig code.

## 6. Deferred to the children (NOT f1's work)

- **f2 (#24) pop:** drives a bigger scale overshoot on the player object handle via the existing Juice/RAF
  channel. f1 only exposes `setShape`'s emphasis tween seam; f2 designs/implements the pop.
- **f3 (#25) board/reveal:** hides the opponent object (built here, starts invisible until resolved) behind
  an occluder and sequences the reveal. f1 only provides the opponent object entity + its committed-result
  `setShape` hook; f3 designs the occluder + reveal timing.

## 7. Acceptance criteria (design exit)

1. design.md produced + committed on `dlc/card-kiro-crew-yolo-dlc-test-repo-23` (this file). ✔ this step.
2. FORK D1-D4 resolved with concrete geometry, `setShape` semantics, opponent staging, and driving-site — done.
3. Design plugs into the live `wireGame` seam with NO structural change (`loadObjects` matches
   `loadHands` signature; opponent object driven from the existing `onChange` consumer) — specified §3.2.
4. NFR1 F1-first preserved: `pickOpponent()` stays in `submit()`; opponent object is a committed-result
   consumer; no result↔render/animation timing coupling — specified §1/§2 FORK-D4/§4.
5. NFR2 additive-only touch set enumerated (§5): zero `src/round/**`/`rules.ts`/`types.ts` edits.
6. NFR4 headless `wireGame`-seam regression test design specified (§4), reusing the node-env DOM-free
   `makeHarness` pattern, with a guard-bites expectation.
7. `step_status['design'] = done`.

## 8. Effort & back-step

`effort.features = [f1 M/3]`; `effort.total = 3`; `effort.scope[design] = 3` (the foundation slice
detailed, NOT grown vs requirements' 3). depth=deep GROWTH_FACTOR=3.0; back-step check:
scope[design]=3 > 3.0 × scope[requirements](=3) = 9? **NO.** No feature parked. No new child fan-out
(f1 is a cohesive foundation slice; the single-card decision is inherited from the parent).

## 9. Handoff

NEXT = **tasks** — no explicit gate between design and tasks in this ladder. Under trust=assisted the
advance cron consumes `design=done`, relabels `dlc:design → dlc:tasks`, and escalates the tasks step;
the downstream human gate-impl still PARKS for a human before implement runs. f1 must LAND FIRST — it is
the foundation f2 (#24) and f3 (#25) both depend on; parent #22 retires only when f1/f2/f3 are all consumed.
