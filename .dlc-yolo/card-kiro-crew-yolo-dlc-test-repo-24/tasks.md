# Tasks — [f2] Poppy reveal animation on the thrown object

**Card:** `card-kiro-crew-yolo-dlc-test-repo-24`
**Issue:** [#24](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/24) (child of parent #22, feature **f2**)
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Step:** tasks · trust=assisted (inherited) · depth=deep · capability=dlcyolo-authoring
**Crew:** dlcyolo-rps3d-spec / impl-agent role — performed inline (see §6 dispatch grounding)
**Depends on:** f1 (#23) — the throwable-object + opponent render path (must land first for the *visible* integration only)

---

## 0. Posture (read before starting)

f2 is a **single cohesive S/1 cosmetic slice**: a `RevealPop` controller behind a dependency-free
`PopTarget` seam, wired into the *existing* resolved-beat hook + RAF loop in `main.ts`, plus a
node-env DOM/WebGL-free regression test. **No further decomposition** (design §8): the module + test
are one unit, not fan-out material. f2 is a *sibling* of f1/#23 and f3/#25 under parent #22.

**Sequencing (design §7):** the module (`src/render/reveal-pop.ts`) + its test
(`test/reveal-pop.test.ts`) can be **built and shipped GREEN before f1** because `PopTarget` is
`null`-safe. Only the **1-line `setTarget(<f1 object>)` wiring** in `onRigLoaded` is gated on f1
(#23) merging — hence **T7** is the sole f1-gated task. Everything T1–T6 ships now.

**Load-bearing invariants (design §5, requirements §3):**
- **NFR1 F1-first:** `pickOpponent()` stays in `RoundMachine.submit()`; the pop reads nothing from
  animation state; drive only from the *existing* `phase==='resolved' && result` branch.
- **NFR2 additive:** touch set = `src/render/reveal-pop.ts` (new) + `src/main.ts` (~6 additive lines)
  + `test/reveal-pop.test.ts` (new). **Zero** edits to `src/round/**`, `src/rules.ts`,
  `src/gesture/**`, `src/types.ts` (import-only), `src/physics/juice.ts`, `src/a11y/**`.
- **NFR3 a11y:** consume `shouldTweenOnly`; tween-only path = instant rest scale, no overshoot;
  `render(s)` byte-for-byte unchanged; never touch the `aria-live` region.
- **NFR4 reversible:** absent `PopTarget` → every method no-ops safely.
- **NFR5 headless seam:** node-env DI test mirroring `test/main.test.ts`'s `makeHarness`.
- **R4 zero new dep:** no new package; reuse the RAF `poseT`/`frame()` cadence + `PopTarget`.

---

## 1. Atomic tasks

### T1 — Create `PopTarget` + `RevealPop` module (NEW file, DOM/WebGL-free) `[F2 core]`
- **Do:** Add `src/render/reveal-pop.ts` exporting:
  - `export interface PopTarget { setPopScale(scale: number): void }`
  - `export interface RevealPopOptions { tweenOnly: boolean }`
  - `export class RevealPop` per design §4: constructor `(target: PopTarget | null)`;
    `setTarget(target: PopTarget | null): void`; `onResult(opts: RevealPopOptions): void`;
    `update(dtMs: number): void`; `reset(): void`. Constants `POP_MS=260`, `OVERSHOOT=1.18`.
  - Behavior: `onResult` with `tweenOnly` → `target?.setPopScale(1)` + idle; else arm (`t=0`,
    `setPopScale(0.0001)`). `update(dtMs)` advances `t` toward `POP_MS`, computes the
    overshoot-settle scale (rise to `OVERSHOOT` by k=0.6, relax to exactly `1.0` at k=1), lands at
    `setPopScale(1)` + idle when `t>=POP_MS`. `reset` → idle + `setPopScale(1)`.
  - **No `three` import in the logic** — it only calls `PopTarget.setPopScale` (pure, deterministic,
    no `Math.random`/`performance.now`).
- **Verify:** `npx tsc --noEmit` clean (module compiles standalone).
- **Traces:** R1, R4, R5, NFR2, NFR4.
- **Accept:** file exists, exports `PopTarget`/`RevealPopOptions`/`RevealPop`; deterministic; no
  `three`/DOM/WebGL/`Math.random` reference.

### T2 — Author the node-env NFR5 regression test (NEW file) `[F2 test]`
- **Do:** Add `test/reveal-pop.test.ts` (vitest, node-env, DOM/WebGL-free), mirroring
  `test/main.test.ts`'s `makeHarness` DI discipline. Inject a **fake `PopTarget`** recording the
  `setPopScale(scale)` stream. Cover design §6:
  1. **Fires once per resolved result, only on `phase==='resolved'`.** Drive a real `RoundMachine`
     with a **deterministic `pickOpponent`**; subscribe a harness that calls `revealPop.onResult`
     on the resolved branch; assert it ran exactly once per resolved round and **not** on
     `idle`/`capturing`/`lowConfidence` (a `lowConfidence:true` submit records no pop).
  2. **Never before commit.** At the instant `onResult` fires, assert `machine.getState().result`
     and `.opponentShape` are already non-null (result committed *before* the pop).
  3. **Overshoot then settle (full motion).** `tweenOnly:false`; step `update()` across `POP_MS`;
     assert the recorded scale stream **rises above 1.0** and **lands exactly at 1.0** at the end.
  4. **Tween-only downgrade.** `tweenOnly:true`; assert **no recorded scale exceeds 1.0** and the
     target ends at rest `1.0`.
  5. **Re-arm.** After a resolved round, `reset()` → target at `1.0`; a subsequent `onResult` pops
     again.
  6. **Absent target no-op.** `new RevealPop(null)` — `onResult`/`update`/`reset` never throw.
- **Verify:** `npm test` — the new suite is discovered and all its cases pass.
- **Traces:** R2, NFR3, NFR5, AC1, AC2, AC4, AC5.
- **Accept:** `test/reveal-pop.test.ts` exists; the 6 cases above pass in node-env with no DOM/WebGL.

### T3 — Wire `RevealPop` construction into `main.ts` boot (ADDITIVE) `[F2 wiring]`
- **Do:** In `src/main.ts` `boot()`, after `const juice = new Juice(scene3d.camera);`, add
  `import { RevealPop } from './render/reveal-pop';` (top) and `const revealPop = new RevealPop(null);`
  (target set by T7 when f1's rig loads). No other change here.
- **Verify:** `npx tsc --noEmit` clean; `render(s)` untouched.
- **Traces:** R2, NFR2.
- **Accept:** `revealPop` constructed once with a `null` target; diff shows only the import + the one
  `const` line (plus T4/T5/T7 additions).

### T4 — Fire the pop from the EXISTING resolved-beat hook (ADDITIVE) `[F2 wiring]`
- **Do:** Inside the **existing** `machine.onChange` `if (s.phase === 'resolved' && s.result)` branch,
  **alongside** `juice.onResult(...)` (NOT a new listener), add:
  `revealPop.onResult({ tweenOnly });` (reuse the `tweenOnly` already computed for `juice`).
  Add re-arm: when `s.phase === 'capturing'`, call `revealPop.reset();` (a small additive guard in
  the same `onChange` callback).
- **Verify:** `pickOpponent()` still only in `submit()`; no result field read from animation state;
  `render(s)` byte-for-byte unchanged.
- **Traces:** R1, R2, NFR1, NFR3, AC1, AC2, AC7.
- **Accept:** pop fires once on `resolved`, re-arms on `capturing`; layering tests
  (`round.test.ts`, `render-physics.test.ts`) stay green.

### T5 — Advance the pop on the EXISTING RAF cadence (ADDITIVE) `[F2 wiring]`
- **Do:** Inside the **existing** `frame(now)` RAF loop, next to `juice.update(dt / 1000);`, add
  `revealPop.update(dt);` (`frame()` uses **ms** deltas, and `RevealPop.update` expects ms — pass
  `dt` directly, not `dt/1000`). No new loop.
- **Verify:** `npx tsc --noEmit` clean; the pop decays/settles per frame; no new `requestAnimationFrame`.
- **Traces:** R4, R5, NFR2.
- **Accept:** `revealPop.update(dt)` called once per frame in the existing loop; diff is one line.

### T6 — Global gate: build + full suite + additive-only diff `[F2 gate]`
- **Do:** Run `npm run build` (`tsc --noEmit && vite build`) and `npm test`. Confirm the additive
  touch set via `git diff --name-only origin/main..HEAD` (code/test excluding `.dlc-yolo/`) =
  EXACTLY `src/render/reveal-pop.ts` + `src/main.ts` + `test/reveal-pop.test.ts`. Run the
  protected-surface guard: `git diff --name-only origin/main..HEAD` filtered to
  `src/round/** src/rules.ts src/gesture/** src/types.ts src/physics/juice.ts src/a11y/**` must be
  **empty** (NFR2 diff-confirmed; `src/types.ts` import-only if referenced).
  **Guard-bite check:** temporarily move the trigger to a non-resolved phase or before `emit()` →
  T2 cases (1)/(2) go RED; revert.
- **Verify:** build clean (pre-existing rapier chunk-size warning is acceptable); full vitest suite
  green (baseline + the new f2 suite); protected-surface diff empty; guard bites then restored green.
- **Traces:** AC3, AC6, NFR2, NFR5.
- **Accept:** all green; additive-only diff confirmed; guard-bite verified.

### T7 — f1 integration wiring — the ONE f1-gated line (SEQUENCED after #23) `[F2↔F1]`
- **Do:** In `main.ts` `onRigLoaded` (where f1's throwable/opponent object becomes available), call
  `revealPop.setTarget(<f1 object adapted to PopTarget>)` — f1's object satisfies
  `setPopScale(scale)` directly or via a 1-line adapter (e.g. `{ setPopScale: (s) => obj.scale.setScalar(s) }`).
- **Sequencing:** this is the **only** task gated on f1 (#23) merging (or on f1's committed object
  contract). T1–T6 ship GREEN before f1 (null-safe target). Do NOT block f2's PR on f1 for T1–T6;
  land T7 (or a follow-up) once f1's object handle exists.
- **Verify (after f1):** the visible pop plays on the real thrown object; still no core edit; suite
  green.
- **Traces:** R3, dependency §5/§7.
- **Accept:** `setTarget` points `RevealPop` at f1's real object once f1 lands; until then f2's PR is
  green standalone with the target `null`.

---

## 2. Dependency graph

```
T1 (RevealPop + PopTarget)  ──┐
                              ├─> T3 (construct in boot) ──> T4 (fire on resolved) ──> T5 (update in RAF) ──> T6 (gate)
T2 (NFR5 test)  ──────────────┘                                                                                  │
                                                                                                                 └─> T7 (f1 setTarget — SEQUENCED after #23)
```

- T1 and T2 are parallel (T2 tests T1's contract; author together). T3→T4→T5 are the additive
  `main.ts` wiring in order. T6 is the global gate over T1–T5. **T7 is the only f1-gated task** and
  may land after f1 (#23); T1–T6 ship green independently.

## 3. Global acceptance (parent exit criteria — maps 1:1 to requirements §4)

1. **AC1** — pop plays on `phase==='resolved'`; none on `idle`/`capturing`/`lowConfidence` (T2.1, T4).
2. **AC2** — fires **once** per resolved round and re-arms (T2.1, T2.5, T4).
3. **AC3** — protected-surface diff empty; additive-only (T6).
4. **AC4** — reduced-motion / LOW → tween-only instant path, no overshoot, object still arrives (T2.4, T4).
5. **AC5** — node-env DOM-free test asserts trigger once / only on committed `resolved` / never
   before commit / tween-only branch; RED if trigger moved before commit or to a non-resolved phase (T2, T6 guard-bite).
6. **AC6** — `tsc --noEmit && vite build` clean + full vitest suite green (T6).
7. **AC7** — `pickOpponent()` remains in `submit()`; no result field read from animation state
   (T4, layering tests stay green).

## 4. Effort & back-step

- `effort.features = [ f2: S / 1 pt ]`, `effort.total = 1`, `effort.scope[tasks] = 1` (leaf slice
  broken into atomic tasks; scope NOT grown — same as investigate=3 read-scope / requirements=1 /
  design=1).
- Back-step (depth=deep, GROWTH_FACTOR=3.0): `tasks(1) > 3 × design(1) = 3`? **NO.**
- **Decomposition: KEEP ONE CARD** — tasks created NO child tickets (re-fanning would duplicate;
  f2 is a sibling of f1/#23, f3/#25).
- No feature parked.

## 5. Decision-gate self-review (ASK-BEFORE-DONE, run against inputs at step start)

- **intent-fidelity:** the task set serves the literal ask (pop the thrown object) and the underlying
  intent (a theatrical reveal beat); every task maps 1:1 onto design §4–§6. ✓
- **scope-drift:** single-card-vs-fan-out was answered by the human interjection at parent #22; f2's
  scope is unambiguous; tasks introduce no unseen entity. ✓
- **technical-fork:** the one real fork (animate a not-yet-existing object) was resolved at design
  via the dependency-free `PopTarget` seam; tasks merely sequence it. Easing/overshoot/duration are
  implement tuning knobs guarded by the NFR5 "rises above 1.0 then settles to 1.0" test — not
  blocking forks. The f1 dependency is a **sequencing** constraint (isolated to T7), not a human-only
  fork changing WHAT is built. ✓
- **capability-gap:** the missing `select_crew`/`spawn_run` is only the dispatch **mechanism**, not a
  tool the task-breakdown needs (read/analyze/write held). Not a hard gap. ✓

**No un-asked, human-only fork changes WHAT this step builds → no blocking `ask_question`; no new
decision-gate entry required.** Proceed to `done`. (Under trust=assisted, the downstream human
gate-impl still PARKS for a human before implement runs; this step produces its artifact and forces
no gate.)

## 6. Dispatch grounding (no faked crew run)

This runtime's tool surface is **read/write/shell only** — it does **not** hold
`select_crew`/`spawn_run` (same empirically-confirmed finding as every prior step on this pipeline:
card-backlog-14, card-rps3d-headline, card-rps3d-objects, and this card's investigate→requirements→
design). Per PRODUCE-OR-BLOCK, a run lacking the crew-routing **mechanism** performs the step
**inline** rather than faking a crew or silently downgrading. The tasks step is a read-design →
analyze → write-task-list pass = exactly `dlcyolo-authoring` scope, done inline honestly. This is
**NOT** a hard capability-gap.

## 7. Handoff (to gate-impl / implement)

- **NEXT:** gate-impl — card trust=assisted (inherited: `card.trust=null` → pipeline `pl-rps3d`
  assisted), so the advance cron does **not** auto-approve; it PARKS the human gate before implement.
- **To implement:** build T1–T6 now (they ship GREEN standalone via the null-safe `PopTarget`);
  land T7's `setTarget` wiring after f1 (#23) provides the throwable/opponent object. Honor NFR1
  F1-first, NFR2 additive touch set, NFR3 reduced-motion tween-only, R4 zero-new-dep. Author
  `test/reveal-pop.test.ts` per T2 (the NFR5 headless seam that closes the card-rps3d-fix
  broken-green gap class).
- **f1-first:** f2's *visible* reveal integration sequences after f1 (#23) lands; parent #22 retires
  only when f1/f2/f3 are all consumed.
