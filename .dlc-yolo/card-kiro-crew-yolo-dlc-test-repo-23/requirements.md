# Requirements — card-kiro-crew-yolo-dlc-test-repo-23 (f1, child of #22)

**Issue:** [#23](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/23) —
`[card-rps3d-objects · f1] Throwable RPS object-rig + opponent-object render path`
**Parent:** #22 (card-rps3d-objects), the DEEP-decomposed RPS-object visual redesign (Order-4 proof).
**Step:** requirements · **Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Effective modes:** trust=assisted (inherited: card.trust=null → pipeline assisted) · depth=**deep** · capability=dlcyolo-coordinator
**Crew (assigned):** dlcyolo-rps3d-spec (dlcyolo-authoring, verified present in roster)
**Grounded in live source @ branch dlc/card-kiro-crew-yolo-dlc-test-repo-23 @ 6666420** (based off origin/main dcdb2e4) + live GitHub (issue #23 OPEN, author hai-dvash == gh-auth, ownership guard PASS).

---

## 0. Dispatch grounding (no faked crew run)

Spawned as `dlcyolo-coordinator`. Empirically — consistent with every prior step on this pipeline
(card-backlog-14 intake→pr, card-rps3d-headline investigate→pr, parent card-rps3d-objects
investigate/requirements, this card's own investigate) — the runtime tool surface is **read/write/shell
only**; `select_crew`/`spawn_run` are not wired here. Per the pipeline-workflow PRODUCE-OR-BLOCK
contract, a run lacking the crew-routing MECHANISM **performs the step inline** rather than faking a crew
or silently downgrading. Requirements authoring is a read→analyze→write pass = exactly the assigned
dlcyolo-rps3d-spec (dlcyolo-authoring) scope, a subset of the coordinator's scope — done inline, honestly.
This is **NOT a hard capability-gap**: the missing tool is only the dispatch mechanism, not one the
requirements work needs.

## 1. Scope — f1 is the FOUNDATION slice (KEEP ONE CARD)

f1 is the foundation child both f2 (pop) and f3 (board/reveal) depend on. It delivers **two new render
entities and their wiring**, nothing more:

1. A **throwable RPS object-rig** (rock / paper / scissors) that REPLACES the `HandRig` morphing hand as
   the **player** visual.
2. A **NEW opponent-object render path** — the opponent's committed shape rendered as an object (today
   the opponent is TEXT-ONLY in `render()`).

**Decomposition decision (ASK-BEFORE-DONE, run against inputs):** the one consequential fork is
single-card-vs-further-fan-out. depth=deep + budget unlimited PERMITS fanning, but does not require it.
f1's two entities are ONE cohesive render-swap unit — the object-rig and its opponent counterpart share
the same `loadHands`/`WireRig` contract, the same scale/frame path, and must land together to read as a
coherent "throw the actual object" foundation; splitting them yields two incoherent partial PRs for one
render swap. This matches the investigate recommendation (`dec-obj23-viability`, chosen=a: GO / keep f1
scoped to the foundation). So **KEEP ONE CARD, no further child fan-out**. This fork was already surfaced
+ recorded at investigate and is not a human-only blocker at requirements → no `ask_question`, proceed to done.

## 2. Requirements

**R1 — Throwable RPS object-rig replaces the hand as the PLAYER visual.** Provide a rig that renders the
player's committed `state.playerShape` as the ACTUAL object (a rock, a sheet of paper, scissors), not a
morphing hand. It MUST satisfy the SAME `HandRig` contract that `wireGame` consumes today so the
load→scale→frame→pose path is unchanged and stays headless-testable:
- `object: THREE.Object3D` (added to the scene by `wireGame`),
- `setShape(shape: Shape, t: number): void` (posed per-frame from the RAF loop — for objects this is the
  swap/emphasis of the active object toward `shape`, interpolated by `t∈[0,1]`),
- `dispose(): void`.
`loadHands(tier)` (or its object-rig successor behind the same signature) MUST still return this
interface so `wireGame({ loadHands, … })` needs NO structural change. (Verified live: `src/render/hands.ts`
`HandRig` iface; `src/main.ts` `wireGame` load→`scene.add(rig.object)`→`measureRig`→`computeRigScale`→
`applyScale`→`frameObject`→`onRigLoaded`; RAF `if (hands && st.playerShape) hands.setShape(st.playerShape, …)`.)

**R2 — NEW opponent-object render path.** Render `state.opponentShape` (already committed by
`RoundMachine.submit()`) as its own object entity in the scene, distinct from the player object. Today
`render(s)` only writes text (`CPU: ${s.opponentShape}`). f1 introduces the opponent OBJECT; it is driven
off the committed `opponentShape`, NOT chosen at render time. (This is the entity f3's board later hides.)

**R3 — Reads instantly as RPS.** The player object + opponent object must make "you threw X, CPU threw Y"
legible at a glance — the whole point of the parent redesign ("current design is terrible → make it good").
Object identity (which of rock/paper/scissors) must be unambiguous.

**R4 — Same input/DI seams; no gameplay coupling.** The object-rig plugs into the existing `wireGame`
`WireRig`/`WireScene`/`MeasureRig` seams. The gesture engine + a11y fallback continue to feed the SAME
`machine.submit` sink. f1 changes only what is RENDERED, never how a shape is decided.

**R5 — Zero new dependency.** Three.js meshes (already in the stack) build the objects. No new npm
dependency. (Whether the objects are primitive/parametric Three.js geometry or sourced meshes is a
DESIGN choice per the STOP-RULE; if design opts for sourced meshes it inherits the parent's CC0/CC-BY
provenance discipline — but the requirement is zero-new-dep, and a primitive/parametric rig satisfies it
outright.)

### Non-functional

**NFR1 — F1-FIRST / render-as-consumer (LOAD-BEARING invariant).** `RoundMachine.submit()` picks the
opponent (`pickOpponent()`), resolves, and commits BOTH `playerShape` and `opponentShape` + `result`
SYNCHRONOUSLY the instant a confident gesture arrives, then `phase='resolved'` → `emit()` (verified live in
`src/round/machine.ts`). Therefore f1's object-rig AND opponent-object are **committed-result CONSUMERS**
that subscribe AFTER the machine commits — exactly like `HandRig`/`juice` today. f1 MUST NOT:
1. relocate `pickOpponent()` out of `submit()`, or
2. couple the committed result / `opponentShape` to render or animation timing.
`round.test.ts`, `render-physics.test.ts`, and `main.ts`'s layering comment lock this.

**NFR2 — Additive-to-core.** `RoundMachine` + `rules.ts` + `types.ts` are UNTOUCHED. All f1 work is
confined to the render layer (`src/render/*`, the `wireGame` wiring in `src/main.ts`, and the object-rig
module). `types.ts` may be import-only.

**NFR3 — a11y preserved.** `#status`/`#badge` stay truthful + first in reading order; the object render
path must NOT spam the aria-live region and must not remove the announced textual outcome. A screen-reader
user who cannot see the objects still hears "You: rock · CPU: scissors → You win".

**NFR4 — Regression coverage on the untested render surface (closes the card-rps3d-fix broken-green gap).**
f1 MUST extend the DOM/WebGL-free `wireGame` seam coverage (node-env vitest, injected `WireRig`/`WireScene`/
`MeasureRig` stubs, `import.meta.glob '?raw'` for markup): assert the object-rig satisfies the `WireRig`
contract and is added + scaled + framed via `wireGame` (mirroring `main.test.ts` (a)/(d)/scale), and assert
the opponent-object path renders off the committed `opponentShape` without touching `submit()`. The same
class of gap that let card-rps3d-fix ship a broken screen on a green build.

**NFR5 — Reversible / behavior-preserving of gameplay.** Swapping the visual cannot regress the game: if
the object-rig fails to build, fall back gracefully (the existing `loadHands` → `PrimitiveHandRig` floor
pattern is the reference; f1's object-rig should keep an equivalent always-ships baseline).

## 3. Deferred to DESIGN (STOP-RULE — this step captures WHAT, not HOW)

- Literal-mesh vs primitive/parametric object rig; exact geometry/material for each of rock/paper/scissors.
- Opponent-object placement/staging (where it sits relative to the player object; camera framing of two
  entities vs one — note `wireGame` currently frames ONE rig, so design must decide framing for two).
- How f2 (pop) and f3 (board/reveal) hook the object f1 introduces (f1 only exposes the seams; the hooks
  are the children's design/implement work).
- Whether `setShape`'s object semantics animate a swap or just select the active object.

## 4. Acceptance criteria (f1 exit)

1. requirements.md produced + committed on `dlc/card-kiro-crew-yolo-dlc-test-repo-23` (this file). 
2. R1: an object-rig satisfying the live `HandRig` contract (`object`/`setShape`/`dispose`) renders the
   player's committed shape as the actual object; `wireGame` consumes it with NO structural change.
3. R2: the opponent's committed `opponentShape` is rendered as a distinct object entity.
4. NFR1: `pickOpponent()` stays in `submit()`; no result↔render/animation timing coupling (diff-verified +
   `round.test.ts`/`render-physics.test.ts` still green).
5. NFR2: additive-only diff — zero edits under `src/round/**`, `rules.ts`, `types.ts` (import-only).
6. NFR4: a headless `wireGame`-seam regression test asserts the object-rig contract + opponent path,
   added to the suite (all green).
7. `step_status['requirements'] = done`.

## 5. Effort & back-step

`effort.features = [f1 M/3]`; `effort.total = 3`; `effort.scope[requirements] = 3` (the foundation slice,
detailed not grown vs investigate's 3). depth=deep GROWTH_FACTOR=3.0; back-step check:
scope[requirements]=3 > 3.0 × scope[investigate](=3) = 9? **NO.** No feature parked.

## 6. Handoff

NEXT = **gate-spec** — a human gate on this assisted card. The advance cron does NOT auto-approve under
trust=assisted; it PARKS the gate for a human. On approval, DESIGN owns art direction / geometry /
opponent staging / animation-swap semantics per the STOP-RULE. f1 must LAND FIRST — it is the foundation
f2 (#24) and f3 (#25) both depend on. Single card, no children (no further fan-out); parent #22 retires
only when f1/f2/f3 are all consumed.
