# Investigation — card-rps3d-objects (issue #22)

**Title:** Redesign: throw the actual rock/paper/scissors objects (not a hand), with a poppy reveal animation and a board that hides the CPU pick

**Step:** investigate · **Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Modes:** trust=assisted · depth=standard · capability=dlcyolo-coordinator
**Crew:** dlcyolo-rps3d-market (dlcyolo-readonly) + 1 matching addendum (same crew, viability/monetization go/no-go)
**Grounded in live source @ main dcdb2e4** (post PR#15 merge) + live GitHub (issue #22 OPEN, author hai-dvash == gh-auth, ownership guard PASS).

---

## 1. Classification

| Field | Value |
|---|---|
| **Type** | `feature` (visual redesign / presentation rework — the user calls the current design "terrible" and wants it rethought) |
| **Size** | **M–L** (~5 pts). This is materially bigger than the prior hand-swap cards (card-rps3d-fix S/M, card-backlog-8 M). It introduces a NEW render entity (throwable RPS objects), a NEW opponent-object render path (today the opponent is text-only), a reveal-sequencing/animation layer, and an occluder ("board") — none of which exist yet. |
| **Risk** | **LOW to the core, MEDIUM to render.** The gameplay authority (RoundMachine + rules) is untouched; risk is confined to the render/animation layer. The only real hazard is violating the F1-first invariant during the "hidden reveal" (see §3). |
| **Labels** | `enhancement` (present), plus recommend `ui` on triage. Stage label `dlc:investigate` retained for the advance cron. |

## 2. What the redesign actually touches (live-source grounded)

The current visual model (read from source, not assumed):

- **`src/round/machine.ts`** — `RoundMachine.submit()` is the single gameplay authority. On a
  confident throw it **synchronously** picks the opponent (`pickOpponent()`), calls `resolve()`,
  sets `playerShape`/`opponentShape`/`result`/`score`, phase→`resolved`, and `emit()`s. **The CPU
  pick already exists in committed state the instant the round resolves.** (Load-bearing for §3.)
- **`src/render/hands.ts`** — `PrimitiveHandRig` / `GltfHandRig` behind a `HandRig` interface. ONE
  persistent hand object, scaled + camera-framed once at load, posed per-frame via
  `hands.setShape(playerShape, t)`. **There is NO opponent object rendered at all** — the opponent
  is text-only in `statusEl`.
- **`src/main.ts`** — `wireGame()` loads the rig, adds it to the scene, frames the camera, and wires
  `engine.onResult` + a11y fallback → `machine.submit`. `machine.onChange` drives `render(s)` (text
  HUD) + `juice.onResult` (cosmetic, fire-and-forget, explicitly "cannot alter the committed
  result"). The RAF loop poses only the PLAYER shape.
- **`src/render/scene.ts`** — PBR scene + `frameObject()` camera-fit (added by card-rps3d-fix).
- **`index.html`** — text HUD (`#status` role=status/aria-live, `#badge` role=alert). No object DOM.

**Net:** the redesign replaces "one persistent hand that morphs between poses" with:
1. **Throwable RPS objects** — a new render entity set (rock / paper / scissors meshes or a
   parametric object rig) that replaces `HandRig` as the player-visual, and a NEW opponent-object
   render path (the opponent must now be shown as an object, not just text).
2. **Poppy reveal animation** — a "pop" on whichever object is thrown (scale/overshoot/spring feel;
   Rapier `juice` is already the cosmetic-only layer this belongs in — no new dep needed).
3. **Occluder / "board"** — something that HIDES the CPU's chosen object until a reveal beat, then
   clears/opens to reveal it.

## 3. Load-bearing invariant (must survive the redesign — flag to design)

**F1-first / render-as-consumer.** `RoundMachine.submit()` commits BOTH shapes + result the moment
a confident gesture arrives — the opponent is NOT chosen lazily at reveal time. Therefore the
"board that hides the CPU pick" is a **pure render-layer sequencing/occlusion concern**, NOT a rules
change: the CPU pick is already known and committed; the render simply must not DISPLAY the opponent
object until the reveal beat. **Design MUST NOT** move `pickOpponent()` out of `submit()` or make the
result depend on animation timing — that would break the layering invariant that main.ts, round.test.ts,
and render-physics.test.ts all lock. The reveal is choreography over an already-committed result.

This is the single most important guardrail handed to the design step.

## 4. Viability / Monetization go/no-go (the market crew's real job)

**Verdict: GO (unconditional).**

- **Revenue dimension: NONE.** This is a showcase/portfolio piece (README + all prior cards
  self-declare no revenue: no ad slot, no retention loop, no funnel). The market crew's job here is
  therefore NOT a money call — it is a **viability + scope-sanity** call.
- **Viability: HIGH.** The rework is entirely additive-to-core / confined to the render layer, uses
  the libraries already in the stack (Three.js meshes + the existing Rapier `juice` layer for the
  "pop"), needs **zero new dependencies**, and cannot regress gameplay (core is untouched; render is
  a committed-result consumer).
- **Showcase value: HIGH.** "Throw the actual object + poppy reveal + hidden-CPU board" is a much
  stronger visual demo than a morphing hand — it reads instantly as RPS and adds the theatrical
  reveal beat that makes a showcase memorable. This directly serves the underlying intent ("current
  design is terrible → make it good").

## 5. Guardrails handed downstream (to requirements/design)

- **Keep F1 authoritative** (§3): reveal = choreography over a committed result; do not relocate
  `pickOpponent()` or couple result to animation timing.
- **Zero new dependency** — use existing Three.js + the Rapier `juice` cosmetic layer for the pop.
- **Preserve a11y** — keep `#status`/`#badge` truthful and first in reading order; the reveal must
  not spam the aria-live region, and the outcome must remain announced (a SR user who can't see the
  "pop" still hears "You: rock · CPU: scissors → You win").
- **Regression coverage on the untested render/reveal surface** — the same class of gap that let
  card-rps3d-fix ship broken-green. Design should specify a headless/DOM-free test seam for the
  reveal sequencing (assert: opponent object hidden until reveal beat, then shown; result committed
  before the animation starts).
- **Replaces the hand rig** — the `HandRig` interface + `loadHands()` become the object-rig's
  concern; the RiggedSimple `.glb` + its CC-BY credit path likely become dead once the hand is gone
  (design decides whether to remove or leave dormant).

## 6. Decision surface (raised → recorded in card.decisions[]; NOT blocking at investigate)

The one consequential fork visible at investigate is the **scope/approach of the visual rework** —
specifically whether to keep this as ONE card or fan out, and the additive-layer-vs-replace posture.
Under depth=standard this is a scope-sanity recommendation, and under trust=assisted the *human*
weighs the actual go decision at **gate-research** (the next step, which is a human gate on this
assisted card). Art direction / animation technique / reveal mechanism are explicitly DESIGN-step
work per the console STOP-RULE (captures WHAT, not HOW) — not decided here.

**Recommendation to gate-research:** GO, single card, depth=standard, treat as an M–L render-layer
redesign that REPLACES the hand-visual while preserving the F1-first core. Fan-out to child cards is
NOT recommended at standard depth (the three asks — objects, pop, board — are one cohesive visual
surface that must ship together to read as a coherent redesign; splitting would produce
partial/incoherent PRs). If requirements/design find the object-modeling + reveal + occluder
genuinely exceeds an L, that is the point to reconsider a split (back-step/fan-out is orchestrator
work raised from the affected step, not pre-committed here).

## 7. Effort attribution

`effort.features` = [f1: object-rig + opponent object render path (M/3), f2: poppy reveal animation
via juice layer (S/1), f3: hidden-CPU board/occluder + reveal sequencing + regression seam (S/1)].
`effort.total` = 5. `effort.scope[investigate]` = 3 (research/classification pass).
standard GROWTH_FACTOR=2.0; back-step N/A (entry step).

## 8. Outcome

- Artifact produced (this file) + mirrored to the durable results area.
- Ownership guard PASS (issue #22 author hai-dvash == gh-auth hai-dvash, is_bot=false, OPEN).
- Decision gate RAISED (intent-fidelity / scope-sanity viability go/no-go), recorded in
  `card.decisions[]` with recommendation GO/single-card/standard.
- **step_status['investigate'] = done** (real triage + go/no-go artifact genuinely produced;
  nothing faked; no crew-routing tool was required for a read-only research pass).
- NEXT = **gate-research**. Card trust=ASSISTED → the advance cron does NOT auto-approve; it PARKS
  the human gate for a human decision (assisted/manual gates wait for a human, not forced).
