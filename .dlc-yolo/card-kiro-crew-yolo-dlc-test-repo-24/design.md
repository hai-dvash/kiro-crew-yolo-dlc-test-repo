# Design — [f2] Poppy reveal animation on the thrown object

**Card:** `card-kiro-crew-yolo-dlc-test-repo-24`
**Issue:** [#24](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/24) (child of parent #22, feature **f2**)
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Step:** design · trust=assisted · depth=deep · capability=dlcyolo-coordinator
**Crew:** dlcyolo-rps3d-design (dlcyolo-authoring) — performed inline (see §10 dispatch grounding)
**Depends on:** f1 (#23) — the throwable-object + opponent render path f2 animates (must land first)

---

## 1. Summary

f2 adds a **poppy reveal animation** — a snappy scale-overshoot-settle "pop" — on the object(s)
that f1 (#23) throws/reveals, fired at the moment the round resolves. This design specifies f2 as a
**purely additive cosmetic consumer of the already-committed round result**: it introduces no state,
never touches the round machine, reuses the existing RAF tween channel and the `resolved`-beat hook,
and adds **zero new dependency**.

The key design decision is a small **`PopTarget` seam** — an abstract "thing that can be scaled"
handle — so f2 is designed and its regression test authored **against f1's object contract before
f1 lands**, then wired to f1's real objects at integration. This preserves the deep-decomposition
one-PR-per-child invariant while honoring the hard f1→f2 sequencing dependency (§7).

## 2. Live-source grounding (branch `dlc/card-kiro-crew-yolo-dlc-test-repo-24` @ bf93da8)

Confirmed against real code (not the notes):

- **`src/round/machine.ts`** — `RoundMachine.submit()` on a confident throw calls `pickOpponent()`,
  `resolve()`, sets `playerShape`/`opponentShape`/`result`/`phase='resolved'`, updates score, then
  `emit()` — **all synchronous, before any listener runs**. `begin()` clears the result and moves to
  `capturing`; `submit()` auto-calls `begin()` if already `resolved`. → the reveal is choreography
  over an already-decided round; **re-arm point = the `resolved`→(next `begin`) transition.**
- **`src/physics/juice.ts`** — `Juice.onResult(result, {tweenOnly, physics})` fires the reaction
  **only on a committed result** (header: *"Never called before commit"*); `tweenOnly` short-circuits
  to no-shake; `update(dt)` decays per frame. This is the established cosmetic-layer pattern f2 mirrors.
- **`src/main.ts`** — the ONE resolved-beat hook:
  ```ts
  machine.onChange((s) => {
    render(s);
    if (s.phase === 'resolved' && s.result) {
      poseT = 0;
      const tweenOnly = shouldTweenOnly({ reducedMotion: reduced, tier: monitor.getTier(), physicsReady: !!physics });
      juice.onResult(s.result, { tweenOnly, physics }); // fire-and-forget — cannot alter the committed result
    }
  });
  ```
  and the RAF loop already advances a normalized tween: `poseT = min(1, poseT + dt/250)` and calls
  `juice.update(dt/1000)`. **f2 hooks the identical `resolved` branch + reuses this per-frame tween
  clock — no new loop.**
- **`src/a11y/motion.ts`** — `shouldTweenOnly({reducedMotion, tier, physicsReady})` is the FORK-2
  gate (reduced-motion OR LOW tier OR physics missing). f2 **must** consume the same signal.
- **`test/main.test.ts`** — `makeHarness()` builds injected fakes and asserts `wireGame`'s wiring
  headlessly (node-env, no DOM/WebGL). **f2's NFR5 test mirrors this DI discipline exactly.**

## 3. Design decision — cosmetic module + `PopTarget` seam (the one real fork)

**Fork:** how does f2 animate an object that does not exist yet (f1 unbuilt), without either (a)
blocking on f1 or (b) coupling to f1's not-yet-designed internals?

**Chosen:** introduce a tiny **`PopTarget`** contract — the minimal structural view f2 needs of a
poppable object — and a **`RevealPop`** cosmetic controller that drives it. f1's throwable object /
opponent object satisfy `PopTarget` at integration (or a one-line adapter does). f2's logic + test
depend only on `PopTarget`, never on f1's mesh internals.

```ts
// src/render/reveal-pop.ts (NEW, cosmetic; DOM/WebGL-free logic)
/** The minimal view RevealPop needs of a poppable object: a settable uniform scale.
 *  f1's player throwable-object and opponent object satisfy this (or via a 1-line adapter). */
export interface PopTarget {
  /** Set the object's uniform display scale (1 = rest). Cosmetic only. */
  setPopScale(scale: number): void;
}
```

**Rejected alternatives:**
- *Bake the pop into f1's object-rig directly* — couples f2's feel logic into f1's PR, breaks
  one-PR-per-child and makes the reveal beat untestable in isolation.
- *A new dependency (tween lib / GSAP)* — violates R4/NFR2 zero-new-dep; the codebase already has a
  normalized RAF clock (`poseT`) and a proven cosmetic-layer pattern (`Juice`).
- *Extend `Juice` itself* — `Juice` owns camera-shake/physics-burst; a pop is per-object scale, a
  distinct concern. A sibling `RevealPop` module keeps single-responsibility and a clean test seam,
  while being wired from the **same** `resolved` hook and `update(dt)` cadence as `Juice`.

## 4. Component design — `RevealPop`

A pure, deterministic controller. No THREE import in its logic (it only calls `PopTarget.setPopScale`),
so it is fully node-testable.

```ts
// src/render/reveal-pop.ts (NEW)
export interface RevealPopOptions {
  /** reduced-motion OR LOW tier OR physics-missing => instant settle, no overshoot (FORK-2). */
  tweenOnly: boolean;
}

const POP_MS = 260;          // reveal beat window (design-tuned; distinct from the 250ms pose ease)
const OVERSHOOT = 1.18;      // peak scale on the pop (full-motion only)

export class RevealPop {
  private t = -1;            // -1 = idle/armed; 0..POP_MS = animating
  private tweenOnly = false;
  private target: PopTarget | null;

  constructor(target: PopTarget | null) { this.target = target; }

  /** Point RevealPop at f1's object once it exists (or swap targets per round). */
  setTarget(target: PopTarget | null): void { this.target = target; }

  /** Fire the reveal pop for a COMMITTED result. Never called before commit (caller-enforced). */
  onResult(opts: RevealPopOptions): void {
    this.tweenOnly = opts.tweenOnly;
    if (this.tweenOnly) {
      // Reduced-motion / LOW: no overshoot bounce — object simply arrives at rest scale.
      this.target?.setPopScale(1);
      this.t = -1;
      return;
    }
    this.t = 0;              // arm the overshoot animation
    this.target?.setPopScale(0.0001); // start collapsed so it "pops" in
  }

  /** Per-frame advance (ms). Cosmetic; safe to no-op when idle or target absent. */
  update(dtMs: number): void {
    if (this.t < 0 || !this.target) return;
    this.t = Math.min(POP_MS, this.t + dtMs);
    const k = this.t / POP_MS;                 // 0..1
    // Overshoot-settle: ease past 1.0 to OVERSHOOT then relax back to 1.0 (back-ease-out feel).
    const s = k < 0.6
      ? (k / 0.6) * OVERSHOOT                   // rise to peak
      : OVERSHOOT + (1 - OVERSHOOT) * ((k - 0.6) / 0.4); // settle to 1
    this.target.setPopScale(s);
    if (this.t >= POP_MS) { this.target.setPopScale(1); this.t = -1; } // land exactly at rest
  }

  /** Re-arm for a fresh round (mirrors machine.begin()). */
  reset(): void { this.t = -1; this.target?.setPopScale(1); }
}
```

Notes:
- **Deterministic + DOM-free** → the whole controller is unit-testable in node by asserting the
  `setPopScale` value stream. No `Math.random`, no `performance.now`, no WebGL.
- **`tweenOnly` path** collapses to instant rest-scale (object still *arrives*, NFR3) — no overshoot,
  no bounce.
- **Absent target** → every method no-ops safely (NFR4), so f2 merges/tests green **before f1 lands**.

## 5. Wiring into `main.ts` (additive, ~6 lines; render(s) untouched)

```ts
import { RevealPop } from './render/reveal-pop';
// ... in boot(), after `const juice = new Juice(...)`:
const revealPop = new RevealPop(null); // target set when f1's object rig loads (onRigLoaded)

// inside the EXISTING machine.onChange resolved branch, alongside juice.onResult — NOT a new hook:
if (s.phase === 'resolved' && s.result) {
  poseT = 0;
  const tweenOnly = shouldTweenOnly({ reducedMotion: reduced, tier: monitor.getTier(), physicsReady: !!physics });
  juice.onResult(s.result, { tweenOnly, physics });
  revealPop.onResult({ tweenOnly });          // f2: pop the thrown object (fire-and-forget)
}

// re-arm on a fresh round: when phase leaves resolved (capturing):
if (s.phase === 'capturing') revealPop.reset();

// inside the EXISTING frame() RAF loop, next to `juice.update(dt/1000)`:
revealPop.update(dt);                          // dt is ms here (frame() uses ms deltas)
```

- **No new listener, no new RAF loop** — f2 rides the existing `onChange` resolved branch and the
  existing `frame()` cadence.
- **`render(s)` is byte-for-byte unchanged** → `#status`/`#badge` aria-live semantics preserved
  (NFR3); the cosmetic layer never writes the live region.
- **`pickOpponent()` stays inside `submit()`** and no result field is read from animation state (NFR1).
- **f1 integration point:** when f1's `onRigLoaded` fires with the throwable object, call
  `revealPop.setTarget(<f1 object adapted to PopTarget>)`. Until f1 lands, target stays `null` and
  `revealPop` safely no-ops — f2's PR is green standalone.

## 6. NFR5 — headless regression test contract (closes the broken-green gap class)

`test/reveal-pop.test.ts` (NEW, node-env, DOM/WebGL-free), mirroring `test/main.test.ts`'s
`makeHarness` DI discipline. It injects a **fake `PopTarget`** that records the `setPopScale` stream
and asserts the *trigger wiring + feel invariants*:

1. **Fires once per resolved result, only on `phase==='resolved'`.** Drive a `RoundMachine`
   (deterministic `pickOpponent`) via `submit()`, subscribe a harness that calls `revealPop.onResult`
   on the resolved branch, and assert `onResult` ran exactly once per resolved round and **not** on
   `idle`/`capturing`/`lowConfidence`. (A low-confidence submit records no pop.)
2. **Never before commit.** Assert that at the instant `onResult` fires, the machine state already
   has a non-null `result`/`opponentShape` (result committed *before* the pop) — RED if the trigger
   is moved before `emit()`/commit.
3. **Overshoot then settle (full motion).** With `tweenOnly:false`, step `update()` across `POP_MS`
   and assert the scale stream **rises above 1.0** (a real "pop"), then **lands exactly at 1.0** at
   the end (no drift, no stuck scale).
4. **Tween-only downgrade.** With `tweenOnly:true`, assert **no scale ever exceeds 1.0** (no bounce)
   and the target ends at rest scale 1.0 — object arrives, no violent motion (NFR3).
5. **Re-arm.** After a resolved round, `reset()` returns the target to 1.0 and a subsequent
   `onResult` pops again (once per round, R2).
6. **Absent target no-op.** `new RevealPop(null)` — `onResult`/`update`/`reset` never throw (NFR4).

Guard-bite check to run at implement: flipping the trigger to fire on a non-resolved phase, or
moving it before commit, must turn tests (1)/(2) RED.

## 7. Dependency & sequencing (f1 → f2)

- **f2 requirements + design (this step): DONE now**, against the `PopTarget` seam — no f1 code needed.
- **f2 implement:** the `RevealPop` module + `reveal-pop.test.ts` can be **built and shipped green
  before f1**, because the target is `null`-safe. The **visible integration** (pointing `RevealPop`
  at f1's real thrown object via `setTarget` in `onRigLoaded`) sequences **after f1 (#23) lands** the
  object-rig + opponent render path. Recommend implement author the module+test now and gate only the
  1-line `setTarget` wiring on f1's merged object handle.
- This is the same sequencing constraint carried from investigate/requirements — **not** a blocker
  for producing this design.

## 8. Effort & decomposition

- `effort.features = [ f2: S / 1 pt ]`, `effort.scope[design] = 1` (foundation slice detailed, not
  grown — same as investigate=3 read-scope / requirements=1).
- Back-step check (depth=deep, GROWTH_FACTOR=3.0): `design(1) > 3 × requirements(1) = 3`? **NO.**
- **Decomposition: KEEP ONE CARD** — no further child tickets. f2 is a single cohesive S/1 cosmetic
  controller on one render surface; the `PopTarget` seam is one module + one test, not fan-out
  material. f2 remains a *sibling* of f1(#23)/f3(#25) under parent #22.

## 9. Decision-gate self-review (ASK-BEFORE-DONE, run against inputs at step start)

- **intent-fidelity:** serves the literal ask (a poppy pop on the thrown object) and the underlying
  intent (a theatrical reveal beat). ✓
- **scope-drift:** single-card-vs-fan-out was answered by the human interjection at parent #22; f2's
  own scope is unambiguous. No new unseen scope. ✓
- **technical-fork:** the one real design fork — *how to animate an object that doesn't exist yet* —
  is resolved **internally** by the `PopTarget` seam (dependency-free, standard DI already used by
  `wireGame`/`Juice`); it is a design decision, **not** a human-only pipeline fork that changes WHAT
  is built. Easing curve/overshoot magnitude/duration are tuning knobs realized at implement, guarded
  by the NFR5 "rises above 1.0 then settles to 1.0" test — not blocking forks. ✓
- **capability-gap:** the missing `select_crew`/`spawn_run` is only the dispatch **mechanism**, not a
  tool the design work needs (read/analyze/write held). Not a hard gap. ✓

**No un-asked, human-only fork changes WHAT this step builds → no blocking `ask_question`; no new
decision-gate entry required.** Proceed to `done`. (Under trust=assisted, the downstream human gates
still park for a human; this step produces its artifact and does not force any gate.)

## 10. Dispatch grounding (no faked crew run)

This runtime's tool surface is **read/write/shell only** — it does **not** hold
`select_crew`/`spawn_run` (same empirically-confirmed finding as every prior step on this pipeline:
card-backlog-14, card-rps3d-headline, card-rps3d-objects, and this card's investigate→requirements).
Per PRODUCE-OR-BLOCK, a run lacking the crew-routing **mechanism** performs the step **inline**
rather than faking a crew or silently downgrading. Design authoring is a read→analyze→write pass =
exactly dlcyolo-rps3d-design's `dlcyolo-authoring` scope (a subset of coordinator scope), done inline
honestly. This is **NOT** a hard capability-gap.

## 11. Handoff (to tasks / implement)

- Honor **NFR1 F1-first**: `pickOpponent()` stays in `submit()`; the pop reads nothing from
  animation state; drive from the existing `resolved` hook only.
- **Zero new dependency**: `RevealPop` + the RAF `poseT`/`frame()` cadence + `PopTarget`; no lib.
- **NFR2 additive**: touch set = `src/render/reveal-pop.ts` (new), `src/main.ts` (~6 additive lines
  in the existing hook + RAF loop), `test/reveal-pop.test.ts` (new). **Zero edits** to
  `src/round/**`, `src/rules.ts`, `src/gesture/**`, `src/types.ts` (import-only if referenced).
- **NFR3 a11y**: consume `shouldTweenOnly`; tween-only path = instant rest, no overshoot; never
  write `aria-live`; `render(s)` unchanged.
- **NFR5**: author `test/reveal-pop.test.ts` per §6 (node-env, DI, guard-bites).
- **f1-first**: ship the module+test now (null-safe); gate the 1-line `setTarget(f1Object)` wiring on
  f1 (#23) merging.
