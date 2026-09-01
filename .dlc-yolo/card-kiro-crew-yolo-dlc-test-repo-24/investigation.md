# Investigation — [f2] Poppy reveal animation on the thrown object

**Card:** `card-kiro-crew-yolo-dlc-test-repo-24`
**Issue:** [#24](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/24) (child of parent #22, feature **f2**)
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Step:** investigate · trust=assisted · depth=deep · capability=dlcyolo-coordinator
**Crew:** dlcyolo-rps3d-market (readonly) + viability/monetization addendum — performed inline (see Dispatch grounding)

---

## 1. Intent (WHAT, per the parent decomposition)

f2 is one of three children of the "throw the actual RPS objects, not a hand" redesign (#22):
a **smooth, poppy animation that pops whichever object is thrown** at reveal time. It is the
*juice/feel* slice of the redesign — the theatrical "pop" beat when the player's thrown object and
the CPU's pick are revealed. Art/technique/curve choice is **design-step work** (STOP-RULE:
investigate captures WHAT + viability, not HOW).

## 2. Classification

- **Type:** feature (cosmetic/animation layer — presentation only)
- **Size:** **S (~1 pt)** — a single scale/pop tween on an existing render entity, driven off the
  already-committed result; no core, gesture, physics-authority, or rules change.
- **Risk to core:** LOW (additive, read-only consumer of committed state). **Risk to feel:** the
  only real hazard is coupling the animation to result timing (see §4 F1-first).

## 3. Live-source grounding (parent branch `dlc/card-rps3d-objects` @ 4a9060e)

Read the load-bearing surfaces:

- **`src/round/machine.ts`** — `RoundMachine.submit()` on a confident throw picks the opponent and
  resolves **synchronously**: sets `playerShape`, `opponentShape`, `result`, `phase='resolved'`,
  then `emit()`. **Both shapes + the result exist in committed state before any render/animation
  runs.** The reveal is pure choreography over an already-decided round.
- **`src/physics/juice.ts`** — the existing cosmetic layer. Header states it verbatim: *"Triggered
  on a COMMITTED result only (fire-and-forget, AFTER the round resolves). Subscribes read-only;
  cannot delay or alter the result (layering invariant)."* `onResult(result, opts)` already fires a
  debris burst + screen shake; `update(dt)` decays per-frame. **This is the exact home for the f2
  pop** — either extend `Juice` or add a sibling cosmetic tween driven from the same hook.
- **`src/main.ts`** — `machine.onChange` → on `phase==='resolved' && result` resets `poseT=0` and
  calls `juice.onResult(...)` (guarded by `shouldTweenOnly` for reduced-motion/LOW-tier). The RAF
  `frame()` loop already advances `poseT` (0→1 over 250ms) and calls `juice.update()`. **f2's pop
  reuses this existing resolved-beat hook + RAF tween channel — no new render loop, no new dep.**
- **FORK-2 downgrade already present:** `shouldTweenOnly` / `opts.tweenOnly` → reduced-motion and
  LOW tier get a tween-only / no-shake path. f2 **must** honor this (a11y): pop still reads, but no
  violent shake/particles when reduced-motion is set.

## 4. Load-bearing guardrail handed to design/implement (F1-first / NFR1)

The pop animation is a **read-only consumer of the committed result**. Design/implement MUST:
- **NOT** relocate `pickOpponent()` out of `submit()`, and **NOT** couple the result to animation
  timing/completion. The result is decided at throw; the pop only *reveals* it. (This is locked by
  `round.test.ts` + `render-physics.test.ts` + the `main.ts` layering comment.)
- Drive the pop from the **existing `resolved`-phase hook** (`machine.onChange` / `juice.onResult`),
  never by adding a gate before commit.
- Respect the **tween-only downgrade** for reduced-motion/LOW tier.

## 5. Dependency (BLOCKING for design/implement, NOT for investigate)

**f2 depends on f1 (#23).** Today the player visual is a per-frame-posed `HandRig` and the opponent
is **text-only** — there is **no discrete throwable object** to "pop." The thing f2 animates (the
thrown rock/paper/scissors object + the opponent object) is **introduced by f1**. f1 (#23) is
currently OPEN at `dlc:investigate` — unbuilt.

Implication: f2 can be fully investigated and its animation-contract seam specified now, but its
**design/implement cannot land against a real object until f1 defines the object-rig interface**
(the mesh(es) + a stable handle the tween scales/pops). Recommended: f2 design consumes f1's
object-rig contract; f2 implement sequences **after** f1 merges (or against f1's committed
interface on the shared parent branch).

## 6. Viability / monetization go/no-go (the market crew's job)

**GO — conditional on f1.**
- **Showcase piece, NO revenue dimension** (no ad slot, retention loop, or funnel; the parent card
  self-declares no revenue). The market question here is feasibility + coherence, not money.
- **Feasibility: high.** The animation home (`juice` cosmetic layer + RAF `poseT` tween) already
  exists; the resolved-beat hook already fires. f2 is a small additive tween.
- **Zero new dependency:** Three.js scale/tween + the existing Rapier juice layer cover "poppy."
- **Cannot regress gameplay** (read-only consumer of committed state; a11y downgrade already wired).
- **Condition:** f2 has no object to animate until **f1 (#23)** lands the throwable-object +
  opponent render path. So: GO, but **sequenced after f1** (dependency, not a viability blocker).

**Verdict: CONDITIONAL-GO** — proceed down f2's ladder; gate the *implement* beat on f1's
object-rig interface being available. Non-regression is guaranteed by the F1-first layering floor.

## 7. Dispatch grounding (no faked crew run)

This runtime's tool surface is **read/write/shell only** — it does **not** hold
`select_crew`/`spawn_run` (same empirically-confirmed finding as every prior step on this pipeline:
card-backlog-14, card-rps3d-headline, card-rps3d-objects investigate→requirements). Per
PRODUCE-OR-BLOCK, a run lacking the crew-routing **mechanism** performs the step **inline** rather
than faking a crew or silently downgrading. investigate is a read-only research + viability go/no-go
pass = exactly the assigned readonly market crew's scope (+ its viability addendum), needing only
read+shell+write — all held by the coordinator (a superset of readonly). This is **NOT** a hard
capability-gap: the missing tool is only the dispatch mechanism, not one the research needs.

## 8. Handoff

- **NEXT:** gate-research (human gate — card is assisted, so the gate PARKS for a human; not forced).
- **To requirements/design:** honor §4 F1-first guardrail + §5 f1 dependency; zero new dep; reuse
  the `juice`/`resolved`-beat hook; respect the reduced-motion/LOW tween-only downgrade; bake a
  headless regression seam so the pop's *trigger wiring* (fires once per resolved result, never
  before commit) is testable without WebGL (mirror the `wireGame` DOM-free discipline).
