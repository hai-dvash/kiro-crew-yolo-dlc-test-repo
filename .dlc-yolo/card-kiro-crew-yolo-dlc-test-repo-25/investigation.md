# Investigation — card-kiro-crew-yolo-dlc-test-repo-25 (f3)

**Card:** `card-kiro-crew-yolo-dlc-test-repo-25`
**Issue:** [#25](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/25) — "[card-rps3d-objects · f3] Hidden-CPU board/occluder + reveal sequencing + regression seam"
**Parent:** #22 (card `card-rps3d-objects`), feature **f3 (S/1)**. **Depends on f1 (#23).**
**Step:** investigate · **trust:** assisted (inherited) · **depth:** deep · **capability:** dlcyolo-coordinator
**Crew assigned:** `dlcyolo-rps3d-market` (dlcyolo-readonly) + 1 addendum (same crew, viability/monetization go/no-go)

---

## 1. Dispatch grounding (no faked crew run)
The investigate step is crew-assigned to `dlcyolo-rps3d-market`. This coordinator runtime's tool
surface is **read / write / shell only** — it does **not** hold `select_crew`/`spawn_run` (the same
empirically-confirmed finding as every prior step on this pipeline: card-backlog-14, card-rps3d-headline,
and this card's parent card-rps3d-objects). Per **PRODUCE-OR-BLOCK**, a run lacking the crew-routing
*mechanism* PERFORMS the step inline rather than faking a crew or silently downgrading. `investigate`
is a **read-only research + classification + viability go/no-go** pass — exactly the assigned readonly
market crew's scope (+ its viability addendum) — needing only read+shell+write, all held by the
coordinator (a superset of readonly). This is **NOT a hard capability-gap**: the absent tool is only the
dispatch mechanism, not one the research itself needs.

## 2. Live source grounding
Synced owned repo to `origin/main` @ `dcdb2e4` (post PR#15 merge) and read the load-bearing files:

- **`src/round/machine.ts`** — `RoundMachine.submit()` is the SINGLE gameplay authority. On a confident
  throw it SYNCHRONOUSLY calls `pickOpponent()`, `resolve()`, sets `playerShape`/`opponentShape`/`result`,
  flips `phase='resolved'`, updates score, then `emit()`. **The opponent is chosen + committed at throw
  time, before any render/animation.** `pickOpponent` is injectable (deterministic in tests).
- **`src/main.ts`** — `machine.onChange((s) => { render(s); if (resolved) juice.onResult(...) })`. Render
  + juice are DOWNSTREAM subscribers; the comment states juice is "Cosmetic, fire-and-forget — cannot
  alter the committed result." Opponent is **text-only today** (`statusEl` renders `CPU: ${opponentShape}`);
  there is **no opponent object mesh** yet — f1 (#23) introduces it. The RAF loop poses only the *player*
  shape.
- **`test/round.test.ts`** — locks: resolves on confident result, no silent guess on low-confidence, all
  three outcomes deterministic, auto-fresh-round. (F1-first at the state level.)
- **`test/main.test.ts`** — the DOM/WebGL-free `wireGame` seam: asserts rig-added, engine→submit,
  fallback→submit, frameObject-on-load. **This is the headless-seam pattern f3's regression test must reuse.**
- **`test/render-physics.test.ts`** — tier/physics/motion gating is pure + headless (`environment: 'node'`).

## 3. Classification
- **Type:** feature (visual/render-layer redesign slice)
- **Size:** **S (~1 pt)** — a render-layer occluder + a reveal-timing sequencer + one headless
  regression test. No core/rules change.
- **Risk:** LOW to core / MEDIUM to render. The single hazard is **violating F1-first** if someone is
  tempted to gate the *result* on the reveal animation. It must remain pure occlusion/choreography over
  an already-committed result.
- Labels on #25: `enhancement`, `dlc:investigate`, `ui` (already applied at fan-out).

## 4. F1-FIRST guardrails handed to design (LOAD-BEARING — do not violate)
1. **Do NOT relocate `pickOpponent()`** out of `submit()`, and **do NOT couple `result`/`opponentShape`
   to when the reveal fires.** The board/occluder hides the *already-committed* opponent object; the
   reveal is choreography, not a rules gate. `round.test.ts` + the `wireGame` seam lock this — breaking
   it turns those tests red.
2. **Subscribe after commit.** The occluder/reveal controller consumes `machine.onChange` state
   (`phase==='resolved'`, `opponentShape`), exactly like `render`/`juice` do today — it must never sit
   *upstream* of `submit()`.
3. **Depends on f1 (#23).** f3 hides/reveals the *opponent object* that f1 introduces. Until f1 lands,
   f3 can build the occluder + sequencing controller against the render seam with a stub opponent object,
   but the visible integration lands after f1.
4. **a11y (NFR):** the outcome (status text / aria-live) must remain announced **even if the reveal is
   never seen** — the occluder is visual-only; it must not suppress the committed `statusEl`/badge update.
   Reduced-motion path: reveal collapses to an instant show (reuse `shouldTweenOnly`).
5. **Zero new dependency; additive-to-core.** Three.js meshes/materials + existing timing already suffice
   for an occluder + a reveal tween. No new package.
6. **Regression seam (NFR5) — the acceptance-defining artifact:** a headless / DOM-free test (reuse the
   `wireGame`/injected-seam discipline, `environment: 'node'`) that asserts (a) the opponent object is
   **HIDDEN** until the reveal beat, then **SHOWN**; and (b) the **result is committed BEFORE** the reveal
   animation starts. This closes the exact gap class that let card-rps3d-fix ship broken-green (untested
   render/sequencing surface). Design should express the reveal controller as an injectable, DOM-free
   unit so this assertion needs no WebGL.

## 5. Viability / monetization go/no-go (the market crew's real job)
**GO (unconditional).** Showcase piece, **no revenue dimension** (no ad slot / retention / funnel; the
parent intent self-declares no revenue). The work is additive-to-core, render-confined, zero-new-dep,
reversible, and cannot regress gameplay (F1-first preserved). Showcase value is high: a board that hides
the CPU pick + a reveal beat adds the theatrical tension that makes RPS *read* as a game rather than an
instant text result — directly serving the parent "current design is terrible → make it good" intent.
Time-box is irrelevant (no external sourcing; pure in-repo render work).

## 6. Decision gate
Raised `dec-25-viability` (intent-fidelity / viability go/no-go), auto-resolved under the recorded
context to **GO, action=continue, confidence high**. The one consequential *structural* fork on this
redesign (single card vs deep fan-out) was already answered by the human interjection at the parent
(card-rps3d-objects) — f3 exists *because* of that decision. f3's own scope is unambiguous from the
issue body; there is **no new human-only fork** that changes WHAT is built, so no `ask_question` is
raised. Art direction / occluder form / reveal technique are **design-step** work (STOP-RULE: investigate
captures WHAT + viability, not HOW).

## 7. Next
`gate-research` — card trust=**assisted**, so the advance cron does NOT auto-approve; it parks the human
gate for a decision (assisted gates wait for a human, never forced).
