# Requirements — [f2] Poppy reveal animation on the thrown object

**Card:** `card-kiro-crew-yolo-dlc-test-repo-24`
**Issue:** [#24](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/24) (child of parent #22, feature **f2**)
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Step:** requirements · trust=assisted · depth=deep · capability=dlcyolo-coordinator
**Crew:** dlcyolo-rps3d-spec (dlcyolo-authoring) — performed inline (see §8 dispatch grounding)
**Depends on:** f1 (#23) — the throwable-object + opponent render path f2 animates

---

## 1. Summary

f2 is the *juice/feel* slice of the "throw the actual RPS objects, not a hand" redesign (#22): a
**smooth, poppy animation that pops whichever object is thrown at reveal time** — the theatrical
"pop" beat when the player's thrown object and the CPU's pick are revealed. It is a **read-only
cosmetic consumer of the already-committed round result**, layered over the render path introduced
by f1 (#23). Art direction, easing curve, technique, and exact staging are **design-step work**
(STOP-RULE: requirements captures WHAT + the invariants, not HOW).

## 2. Functional requirements

- **R1 — Pop on reveal.** When a round resolves (a confident throw commits `playerShape`,
  `opponentShape`, `result`, `phase='resolved'`), the thrown object(s) play a short "poppy" reveal
  animation (a scale/overshoot pop) that reads as the object *arriving/landing* into view.
- **R2 — Driven off the committed result, once per round.** The pop is triggered from the existing
  `resolved`-phase hook (`machine.onChange` → `phase==='resolved' && result` → the cosmetic layer),
  exactly like `juice.onResult` today. It fires **once per resolved round** and is re-armed on the
  next `begin()` (the machine resets to `capturing` on the next `submit()` after a resolved round).
- **R3 — Animates the objects f1 introduces.** The pop targets the throwable player object and the
  revealed opponent object from f1's object-rig / opponent render path (#23). It consumes f1's
  object handle(s); it introduces no object of its own.
- **R4 — Reuse the existing animation channel, zero new dependency.** The pop is expressed via the
  existing RAF tween channel (`poseT` 0→1 over the existing window) and/or the `Juice` cosmetic
  layer (`onResult` / per-frame `update`). No new render loop, no new library — Three.js transforms
  + the existing Rapier-backed juice layer cover "poppy."
- **R5 — Reads instantly as a "pop."** The default (full-motion) animation is a perceptible,
  snappy scale-overshoot-settle on the thrown object; it must land as a deliberate reveal beat, not
  a jitter or a slow fade. (Exact curve/duration/overshoot magnitude = design.)

## 3. Non-functional requirements

- **NFR1 — F1-FIRST / render-as-consumer (LOAD-BEARING).** The pop is choreography over an
  already-decided round. Implementation MUST NOT:
  - relocate `pickOpponent()` out of `RoundMachine.submit()`;
  - couple the committed `result` / `opponentShape` to when (or whether) the animation fires or
    completes;
  - add any gate before commit.
  The result is decided synchronously at throw time; the pop only *reveals* it. This is locked by
  `round.test.ts` + `render-physics.test.ts` + the `main.ts` layering comment.
- **NFR2 — Additive-to-core.** No edits to `src/round/**`, `src/rules.ts`, `src/gesture/**`, or
  `src/types.ts` (import-only if referenced). Changes confined to the render/cosmetic surface
  (`src/physics/juice.ts` and/or a sibling cosmetic module, `src/main.ts` wiring, and f1's
  object-rig module as its contract exposes).
- **NFR3 — a11y / reduced-motion downgrade (MUST honor the existing FORK-2 path).** When
  `shouldTweenOnly` is true (reduced-motion preference OR LOW tier), the pop degrades to a minimal
  tween-only / instant-settle presentation with no violent shake or particle burst — but the object
  still *arrives* so the reveal is not lost. The functional outcome (`#status` verdict/score line)
  is announced regardless of the animation, and the cosmetic layer never writes the `aria-live`
  region.
- **NFR4 — Reversible / graceful.** The pop is fire-and-forget and cosmetic; if the object handle
  is absent (e.g. f1 not yet integrated / a load failure) the reveal safely no-ops without throwing
  or blocking the round.
- **NFR5 — Headless regression seam (closes the card-rps3d-fix broken-green gap class).** The pop's
  **trigger wiring** — fires exactly once per resolved result, only on `phase==='resolved'`, never
  before commit, and honors the tween-only downgrade — MUST be assertable in a **node-env,
  DOM/WebGL-free** test, mirroring the `wireGame` DI discipline (inject a fake object handle / juice
  spy; assert the pop is invoked with the committed result and NOT before). No WebGL, no real DOM.

## 4. Acceptance criteria

1. On a confident throw, the thrown object plays a perceptible pop at `phase==='resolved'`; no pop
   fires on `idle`/`capturing`/`lowConfidence`.
2. The pop fires **once** per resolved round and re-arms for the next round.
3. `git diff origin/main..HEAD` over the protected surface (`src/round/**`, `src/rules.ts`,
   `src/gesture/**`, `src/types.ts` non-import) is **empty** (NFR2 diff-confirmed).
4. Under reduced-motion / LOW tier the pop collapses to the tween-only / instant path with no
   shake/particles; the object still arrives (NFR3).
5. A node-env DOM-free test asserts the pop trigger fires once, only on a committed `resolved`
   result, never before commit, and takes the tween-only branch when downgraded (NFR5); it goes RED
   if the trigger is moved before commit or fires on a non-resolved phase.
6. `tsc --noEmit && vite build` clean and the full vitest suite green (baseline + the new f2 test).
7. `pickOpponent()` remains inside `submit()` and no result field is read/derived from animation
   state (NFR1, verifiable by inspection + the existing layering tests staying green).

## 5. Dependency & sequencing

**f2 depends on f1 (#23).** Today the player visual is a per-frame-posed `HandRig` and the opponent
is **text-only** — there is no discrete throwable object to pop. f2 animates the object(s) f1
introduces. f1 (#23) is the foundation and **must land first**.

- f2 **requirements + design** can proceed now, specified against f1's object-rig contract (the
  object handle the tween scales/pops).
- f2 **implement** sequences **after** f1's object-rig interface exists (merged, or against f1's
  committed interface on the shared work). The headless NFR5 test can be authored against a fake
  object handle before f1 lands.

This is a sequencing constraint handed to design/implement, **not** a requirements blocker.

## 6. Effort & decomposition

- `effort.features = [ f2: S / 1 pt ]`, `effort.total = 1`, `effort.scope[requirements] = 1`.
- Back-step check (depth=deep, GROWTH_FACTOR=3.0): `requirements(1) > 3 × investigate(3) = 9`? **NO.**
- **Decomposition: KEEP ONE CARD** — no further child tickets. depth=deep + unlimited budget
  *permits* fanning but does not require it; f2 is a single cohesive S/1 cosmetic tween on one
  render surface. Fanning a 1-pt animation would produce trivial split PRs (waste, violates
  no-extra-abstraction). f2 proceeds down its own ladder as ONE unit. (f2 is a *sibling* of
  f1/#23 and f3/#25 under parent #22 — not a parent of further children.)

## 7. Decision-gate self-review (ASK-BEFORE-DONE, run against inputs)

- **intent-fidelity:** the artifact serves both the literal ask (pop the thrown object) and the
  underlying intent (a theatrical reveal beat for the redesign). ✓
- **scope-drift:** the single-card-vs-fan-out fork was already answered by the human interjection
  at the parent (#22) — f2 exists because of it; f2's own scope is unambiguous. No new unseen scope.
  ✓
- **technical-fork:** the mesh-vs-parametric object contract, easing curve/technique, and how the
  pop hooks the object are **design work** (STOP-RULE), not requirements blockers. The animation
  *home* (juice layer + RAF `poseT`) and the *trigger hook* (resolved-beat) are established fact
  from live source, not a fork. ✓
- **capability-gap:** the missing `select_crew`/`spawn_run` is only the dispatch **mechanism**, not
  a tool the requirements work needs (read/analyze/write held). Not a hard gap. ✓

No un-asked, human-only fork changes WHAT this step builds → **no blocking `ask_question`**; no new
decision-gate entry required. Proceed to `done`.

## 8. Dispatch grounding (no faked crew run)

This runtime's tool surface is **read/write/shell only** — it does **not** hold
`select_crew`/`spawn_run` (same empirically-confirmed finding as every prior step on this pipeline).
Per PRODUCE-OR-BLOCK, a run lacking the crew-routing **mechanism** performs the step **inline**
rather than faking a crew or silently downgrading. Requirements authoring is a read→analyze→write
pass = exactly dlcyolo-rps3d-spec's `dlcyolo-authoring` scope (a subset of coordinator scope), done
inline honestly. This is **NOT** a hard capability-gap.

## 9. Handoff

- **NEXT:** gate-spec — card trust=assisted (inherited: `card.trust=null` → pipeline `pl-rps3d`
  assisted), so the advance cron does **not** auto-approve; it PARKS the human gate before design.
- **To design/implement:** honor §3 NFR1 F1-first + §5 f1 dependency; consume f1's object-rig
  contract; zero new dep; reuse the `juice` / `resolved`-beat hook + RAF `poseT` channel; respect
  the reduced-motion/LOW tween-only downgrade; author the NFR5 headless trigger-wiring regression
  test (DOM/WebGL-free, `wireGame`-style DI).
- **f1-first:** f2 implement lands **after** f1 (#23) provides the throwable object + opponent
  render path.
