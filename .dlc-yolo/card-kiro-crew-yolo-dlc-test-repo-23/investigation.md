# Investigation — card-kiro-crew-yolo-dlc-test-repo-23 (f1)

**Issue:** [#23](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/23) —
`[card-rps3d-objects · f1] Throwable RPS object-rig + opponent-object render path`
**Parent:** #22 (card-rps3d-objects), the DEEP-decomposed RPS-object visual redesign.
**Step:** investigate · **trust:** assisted · **depth:** deep · **capability:** dlcyolo-coordinator
**Crew assigned:** `dlcyolo-rps3d-market` (dlcyolo-readonly) + its viability/monetization go/no-go addendum.

## Dispatch grounding (no faked crew run)
Spawned as `dlcyolo-coordinator`, which the task states holds `select_crew`/`spawn_run`. Empirically —
consistent with every prior step on this pipeline (card-backlog-14 intake→pr, card-rps3d-headline
investigate→pr, card-rps3d-objects investigate/requirements) — this runtime's tool surface is
**read/write/shell only**; the crew-routing tools are not wired here. Per the pipeline-workflow
PRODUCE-OR-BLOCK contract, a run lacking the crew-routing MECHANISM **performs the step inline** rather
than faking a crew or silently downgrading. `investigate` is a read-only research/classification +
viability go/no-go pass — exactly the assigned readonly market crew's scope (+ its viability addendum) —
needing only read+shell+write, all held by the coordinator (a superset of readonly). This is **NOT a
hard capability-gap**: the missing tool is only the dispatch mechanism, not one the research itself needs.

## Classification
- **Type:** feature (visual/render redesign — the foundation slice of the parent redesign).
- **Size:** M (3 pts) — introduces a NEW throwable-object render entity (rock/paper/scissors) that
  REPLACES the `HandRig` player visual, AND a NEW opponent-object render path (opponent is text-only
  today). Two genuinely new render entities + their load/scale/frame wiring.
- **Risk:** LOW to core / MEDIUM to render. The only real hazard is violating the F1-first invariant
  during the render swap (see guardrail below). Core gameplay is untouched.
- **Labels:** `enhancement` + `ui` already applied by the parent decomposition; `dlc:investigate`
  retained for the advance cron.

## Live-source grounding (read on branch dlc/card-kiro-crew-yolo-dlc-test-repo-23 @ origin/main dcdb2e4)
- **`src/round/machine.ts` — the SINGLE gameplay authority.** `RoundMachine.submit(r)`: on a confident
  throw it SYNCHRONOUSLY calls the injectable `pickOpponent()`, `resolve()`s, sets
  `playerShape`/`opponentShape`/`result`/`score`, `phase → 'resolved'`, then `emit()`. **Both shapes
  and the result already exist in committed state at resolve time.** Low-confidence returns early (no
  silent guess). `pickOpponent` is constructor-injected → deterministic in tests.
- **`src/render/hands.ts` — today's PLAYER visual.** `HandRig` interface (`object`, `setShape`,
  `dispose`) with `PrimitiveHandRig` (always ships) + `GltfHandRig` (upgrade behind the same iface),
  chosen by `loadHands(tier)`. ONE persistent rig, posed per-frame. **No opponent object is rendered
  today** — the opponent is text-only.
- **`src/main.ts` — wiring + render path.**
  - `wireGame(deps)` is the DOM/WebGL-free testable seam: `loadHands() → scene.add(rig.object) →
    measureRig → computeRigScale → applyScale → frameObject → onRigLoaded`. Both the gesture engine
    and the a11y fallback feed the SAME `machine.submit` sink.
  - `machine.onChange(render)` fires AFTER commit; `render(s)` is a TEXT HUD (`You: … · CPU: … → verdict`).
  - `juice.onResult(...)` is the cosmetic "fire-and-forget — cannot alter the committed result" layer.
  - The RAF loop poses only the PLAYER shape: `if (hands && st.playerShape) hands.setShape(st.playerShape, …)`.
- **`src/types.ts`** — `Shape='rock'|'paper'|'scissors'`, `GestureResult`, `RoundResult`; the seams that
  "keep F1 authoritative." Untouched by f1.
- **Tests present:** `round.test.ts`, `render-physics.test.ts`, `main.test.ts`, `hands.test.ts`,
  `framing.test.ts`, etc. `main.test.ts` locks the `wireGame` wiring headlessly (the seam that caught the
  card-rps3d-fix boot defects) — f1's object-rig should slot into the same seam and extend that test.

## LOAD-BEARING guardrail handed to design (do NOT break)
The "throw the actual object" + eventual "hidden-CPU board" is a **pure render-layer** concern. The
opponent is ALREADY chosen and committed in `submit()`. Design MUST NOT:
1. relocate `pickOpponent()` out of `submit()`, or
2. couple the committed result to render/animation timing.
Doing either breaks the layering invariant locked by `round.test.ts` + `render-physics.test.ts` +
`main.ts`. The object-rig + opponent-object render path are **committed-result CONSUMERS** subscribing
after the machine commits — exactly like `HandRig`/`juice` today.

## Integration seams f1 should reuse (design's job to specify, not decided here)
- Replace `HandRig`/`loadHands` with an object-rig that satisfies the same `WireRig`/`loadHands` contract
  so `wireGame`'s load→scale→frame→pose path is unchanged and remains headless-testable.
- Add an opponent-object render entity driven off `state.opponentShape` (already committed).
- Keep `#status`/`#badge` truthful + first (a11y; NFR from parent requirements).
- Regression coverage on the render surface via the DOM-free `wireGame` seam (the class of gap that let
  card-rps3d-fix ship broken-green).
- **Deferred to DESIGN (STOP-RULE):** whether to model literal rock/paper/scissors meshes vs a
  parametric object rig; opponent-object placement/staging; how f2 (pop) and f3 (board/reveal) hook the
  object it introduces. f1 must LAND FIRST (it is the foundation both f2 and f3 depend on).

## Viability / monetization go/no-go (the market crew's real job)
**GO — unconditional.** Showcase piece, **no revenue dimension** (no ad slot / retention / funnel; the
parent card self-declares no revenue). The work is additive-to-core, render-confined, **zero new
dependency** (Three.js meshes already in the stack; the pop reuses the existing Rapier `Juice` layer),
and cannot regress gameplay (F1-first floor). Showcase value is HIGH: throwing the actual object + a
distinct opponent object reads instantly as RPS and is the foundation for the theatrical reveal — it
directly serves the parent intent ("current design is terrible → make it good"). The market crew's
substantive call here is the **licensing/dependency viability** (clean: no new asset licensing needed for
a parametric/primitive object rig; if a design later opts for sourced meshes, that inherits the parent's
CC0/CC-BY provenance discipline) and to **keep f1 scoped to the foundation** (M/3), not absorb f2/f3.

## Decision gate
RAISED (intent-fidelity / viability go/no-go), recorded in `card.decisions[]` as `dec-obj23-viability`
with recommendation **GO / keep f1 scoped to the foundation**, `action=continue`, confidence high. NOT
blocking at investigate: under trust=assisted the HUMAN weighs the actual go at **gate-research** (the
next step, a human gate on this card). Art direction / mesh-vs-parametric / opponent staging are
DESIGN-step work per the STOP-RULE. No un-asked blocking question remains.

## Effort
`effort.features = [f1 M/3]`; `effort.scope[investigate] = 3`. Entry step (no back-step compare).

**Verdict:** GO. Proceed to gate-research (human gate, assisted). f1 is the foundation — must land
before f2/f3.
