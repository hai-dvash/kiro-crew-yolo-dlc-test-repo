# Requirements — card-kiro-crew-yolo-dlc-test-repo-25 (f3)

**Card:** `card-kiro-crew-yolo-dlc-test-repo-25`
**Issue:** [#25](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/25) — "[card-rps3d-objects · f3] Hidden-CPU board/occluder + reveal sequencing + regression seam"
**Parent:** #22 (card `card-rps3d-objects`), feature **f3 (S/1)**. **Depends on f1 (#23).**
**Step:** requirements · **trust:** assisted (inherited) · **depth:** deep · **capability:** dlcyolo-coordinator
**Crew assigned:** `dlcyolo-rps3d-spec` (dlcyolo-authoring)
**Upstream:** investigation.md (this dir), `dec-25-viability` = GO/continue.

---

## 0. Dispatch grounding (no faked crew run)
This step is crew-assigned to `dlcyolo-rps3d-spec`. This coordinator runtime's tool surface is
**read / write / shell only** — it does **not** hold `select_crew`/`spawn_run` (the same
empirically-confirmed finding as every prior step on `pl-rps3d`: card-backlog-14,
card-rps3d-headline, parent card-rps3d-objects, and this card's own investigate run). Per
**PRODUCE-OR-BLOCK**, a run lacking the crew-routing *mechanism* PERFORMS the step inline rather
than faking a crew or silently downgrading. Requirements authoring is a read → analyze → write
pass = exactly `dlcyolo-rps3d-spec`'s dlcyolo-authoring scope (a subset of coordinator scope),
done inline honestly. **NOT a hard capability-gap:** the absent tool is only dispatch, not one the
requirements work needs.

## 1. Scope (f3 leaf)
f3 is the **theatrical reveal** slice of the parent RPS-object redesign: a visual **occluder**
("board / barrier / screen") that HIDES the CPU's pick until a **reveal beat**, plus the
**sequencing controller** that orchestrates hide → (player throw resolves) → reveal, plus the
**headless regression seam** that locks the F1-first invariant on the render/sequencing surface.

f3 does **not** introduce the objects themselves — that is f1 (#23, the foundation). f3 hides and
then reveals the *opponent object f1 introduces*. Until f1 lands, f3 builds the occluder + reveal
controller against the render seam with a **stub opponent object**, and the visible integration
completes after f1.

## 2. Functional requirements

- **R1 — Occluder.** An additive render-layer element (board/barrier/screen) that visually hides
  the opponent's rendered object from the moment a round begins until the reveal beat. Occlusion is
  **visual only** — it never touches game state.
- **R2 — Reveal sequencing.** A controller that subscribes to the round machine's committed state
  and drives the beat order: **round begins → opponent object hidden → player throw resolves
  (result already committed) → reveal beat → opponent object shown.** The reveal is *choreography*
  over an already-resolved result.
- **R3 — Reveal reads as a beat.** The reveal is a discrete, perceivable moment (a short reveal
  animation/transition on the occluder), giving the round the "big reveal" tension the parent intent
  asks for. Exact art direction / occluder form / reveal technique is **design-step** work
  (STOP-RULE — requirements captures WHAT, not HOW).
- **R4 — Injectable, DOM/WebGL-free controller.** The reveal/sequencing controller is expressed as
  an injectable unit consuming an abstract "opponent object" handle (`show()`/`hide()` or a
  visibility flag) and the machine's `onChange` state — **not** a closure bound to `document`/WebGL.
  This is what makes R-NFR5's headless assertion possible (mirrors the `wireGame` seam discipline).
- **R5 — Fresh-round re-hide.** On a new round (`RoundMachine.begin()` / the next `submit` after a
  resolved round), the occluder re-hides the opponent so each round replays the reveal — never a
  stuck-open board.

## 3. Non-functional requirements

- **NFR1 — F1-FIRST / render-as-consumer (LOAD-BEARING).** The occluder + reveal controller are
  **downstream consumers** of committed state, exactly like `render`/`juice` today. **Do NOT relocate
  `pickOpponent()` out of `RoundMachine.submit()`; do NOT couple `result`/`opponentShape` to when the
  reveal fires.** `submit()` picks the opponent, resolves, sets `playerShape`/`opponentShape`/`result`
  and flips `phase='resolved'` **synchronously at throw time**, before any render/animation; the
  reveal is pure choreography. `round.test.ts` + the `wireGame`/`main.test.ts` seam lock this —
  breaking it turns those tests red.
- **NFR2 — Additive-to-core.** No edits to `src/round/**`, `src/rules.ts`, or `src/types.ts` (import
  only). Occluder + controller are new render-layer units + a thin wire-in at the boot/`onChange`
  seam. The gesture, physics-authority, and rules paths are untouched.
- **NFR3 — a11y preserved.** The committed outcome MUST remain announced even if the reveal is never
  seen — the occluder is visual-only and must NOT suppress the committed `statusEl`/badge update in
  `render(s)`. **Reduced-motion / LOW tier:** the reveal collapses to an **instant show** (reuse the
  existing `shouldTweenOnly({reducedMotion, tier, physicsReady})` signal that `juice` already uses —
  same downgrade contract, no new mechanism).
- **NFR4 — Zero new dependency; reversible.** Three.js meshes/materials + the existing RAF/timing
  channel (the same `poseT`/`juice.update(dt)` frame loop) suffice for an occluder + reveal
  transition. No new package. The whole feature is behind the render layer and removable without
  touching gameplay.
- **NFR5 — Headless regression seam (ACCEPTANCE-DEFINING).** A DOM/WebGL-free test
  (`environment: 'node'`, reusing the `wireGame`-style injected-seam / fake-collaborator discipline
  from `test/main.test.ts`) that asserts:
  1. the opponent object is **HIDDEN** from round-begin until the reveal beat, then **SHOWN**; and
  2. the **result is committed BEFORE** the reveal animation starts (drive `machine.submit(R)` with a
     deterministic `pickOpponent`, assert `phase==='resolved'` + `result`/`opponentShape` set at the
     moment the reveal controller is first invoked).
  This closes the exact gap class that let card-rps3d-fix ship broken-green (untested render/sequencing
  surface). Under **reduced-motion**, additionally assert the reveal path resolves to an immediate show
  with no timing dependency.

## 4. Acceptance criteria
1. Opponent object is not visible from round-begin until the reveal beat; visible after it (R1/R2).
2. The reveal is a discrete, perceivable beat (R3).
3. `pickOpponent()` stays inside `submit()`; result/opponentShape are committed before the reveal
   fires — verified by the headless test (NFR1/NFR5).
4. No edits to `src/round/**` / `rules.ts` / `types.ts` (import only) — additive diff confirmed
   (NFR2).
5. Committed outcome still announced (status/badge) with the board present; reduced-motion collapses
   the reveal to an instant show (NFR3).
6. Zero new dependency (NFR4).
7. A node-env DOM-free regression test exists and BITES: breaking the hide-until-reveal ordering or
   moving `pickOpponent` out of `submit()` turns it red (NFR5).
8. Fresh round re-hides the opponent so each round replays the reveal (R5).

## 5. Dependency & sequencing
- **Depends on f1 (#23):** f3 hides/reveals the *opponent object* f1 introduces (opponent is
  text-only today — no opponent mesh exists). f3 may spec + build the occluder + controller against a
  **stub opponent object** now; visible end-to-end integration lands after f1's opponent-object
  render path is merged.
- **Sibling, not child:** f2 (#24, pop animation) and f3 are siblings under parent #22; f3 creates no
  children of its own.

## 6. Decomposition (ASK-BEFORE-DONE, run against inputs)
The one consequential structural fork (single-card vs deeper fan-out) was already answered by the
**human interjection at the parent** (`card-rps3d-objects`) — f3 exists *because* of that decision.
f3 is a cohesive S/1 render-layer slice (occluder + controller + one regression test must ship
together to read as a coherent reveal); depth=deep + unlimited budget PERMITS but does not REQUIRE
further fanning, and splitting a 1-pt slice yields incoherent partial PRs. So **KEEP ONE CARD**,
created **NO** further child tickets. The remaining forks (occluder form, reveal technique, opponent
staging) are **design-step** work (STOP-RULE), not requirements blockers. No un-asked human-only fork
remains → no `ask_question`; proceed to done.

## 7. Effort
`effort.features=[f3 S/1]`; `effort.total=1`; `effort.scope[requirements]=1` (leaf slice detailed,
not grown vs investigate=1). deep GROWTH_FACTOR=3.0 back-step `1 > 3×1(investigate)=3`? **NO.** No
feature parked.

## 8. Next
`gate-spec` — card trust=**assisted**, so the advance cron does NOT auto-approve; it PARKS the human
gate-spec for a decision before design runs (assisted/manual gates wait for a human, never forced).
f3's implement must **sequence after f1 (#23)** lands the opponent object it hides/reveals.
