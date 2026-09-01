# Code Review — f2 poppy reveal animation (card-24, child of #22)

- **Card:** `card-kiro-crew-yolo-dlc-test-repo-24` (f2, child of #22 `card-rps3d-objects`)
- **Issue:** hai-dvash/kiro-crew-yolo-dlc-test-repo#24
- **Branch:** `dlc/card-kiro-crew-yolo-dlc-test-repo-24` @ `6f41e0c` (code `5c5f315`)
- **Base:** `origin/main` @ `dcdb2e4`
- **Trust/Depth/Capability:** assisted / deep / dlcyolo-authoring
- **Verdict:** **PASS** — no Critical / High / Medium. One non-blocking Low (informational, sequencing/deferral, already tracked).

## What was reviewed (grounded live, not trusting the implement note)

Re-verified every load-bearing claim against live GitHub + a fresh isolated clone + a real build/test run:

1. **Ownership guard — PASS (fail-closed).** `gh api user` → `hai-dvash`; issue #24 author `hai-dvash` == gh-auth, `is_bot=false`, state OPEN, carries `dlc:review` (+ enhancement, ui). Config `trusted_authors` unset → default `[hai-dvash]`.
2. **Clean single-card branch — CONFIRMED.** `origin/main..HEAD` = exactly the 6 card-24 commits (investigate `a14a583` → implement.md `6f41e0c`), based off `origin/main`. **ZERO cross-card bleed** (reviewed in an isolated fresh clone to avoid the recurring shared-clone hazard).
3. **Additive-only diff (NFR2) — DIFF-CONFIRMED.** Code/test diff = EXACTLY `src/render/reveal-pop.ts` (new, +87) + `test/reveal-pop.test.ts` (new, +142) + `src/main.ts` (+10) = **239 insertions**. Protected-surface guard over `src/round/**`, `rules.ts`, `gesture/**`, `types.ts`, `physics/juice.ts`, `a11y/**` returned **EMPTY**.
4. **F1-first / render-as-consumer (NFR1) — CONFIRMED by diff + code.** `pickOpponent()` stays solely in `RoundMachine.submit()`; `render(s)` is byte-for-byte unchanged. The 3 main.ts additions are: the import, `const revealPop = new RevealPop(null)`, `revealPop.onResult({tweenOnly})` fired **inside the existing** `phase==='resolved' && result` branch (alongside `juice.onResult`), `revealPop.reset()` in the existing `capturing` branch, and `revealPop.update(dt)` in the existing RAF loop. The controller reads **nothing** from animation state.
5. **Build — CLEAN.** `tsc --noEmit && vite build` passes (only the pre-existing rapier chunk-size warning).
6. **Tests — 63/63 GREEN.** Baseline 57 → +6 f2 cases (`npm test`, 9 files). The implement note's 57→63 claim is ACCURATE.
7. **Guard-bites — VERIFIED RED.** Forcing the pop's trigger to fire on every change (before commit) turns case (2) "never fires before commit" RED (`reveal-pop.test.ts:83`); restoring returns to 63/63. The NFR5 net genuinely bites — a future change that couples the reveal to pre-commit state fails CI. Closes the exact card-rps3d-fix broken-green gap class on the pop's trigger wiring.

## Conformance matrix

| Req/NFR | Status | Evidence |
|---|---|---|
| R1 pop-on-reveal (scale overshoot at resolved) | PASS | `RevealPop.update()` rises to `OVERSHOOT=1.18` then settles to exactly 1.0 over `POP_MS=260`; test (3) |
| R2 driven off committed result, once-per-round + re-arm | PASS | fired from the existing resolved-beat hook; `reset()` on capturing; tests (1)/(5) |
| R3 animates the object f1 introduces | PASS (deferred integration) | consumes an abstract `PopTarget` handle; introduces no object — see Low |
| R4 reuse RAF/tween channel, ZERO new dep | PASS | no `three` import, no new package; `update(dt)` on the existing frame() cadence |
| R5 reads as a discrete pop | PASS | overshoot-settle curve, distinct from the 250ms pose ease |
| NFR1 F1-first / render-as-consumer | PASS | pickOpponent stays in submit(); render(s) untouched; guard-bite verified |
| NFR2 additive-to-core | PASS | protected-surface guard EMPTY (diff-confirmed) |
| NFR3 a11y reduced-motion / LOW tween-only | PASS | `tweenOnly` → instant rest scale, no overshoot; render(s)/aria-live untouched; test (4) |
| NFR4 reversible / graceful | PASS | null target no-ops every method; test (6) |
| NFR5 headless DOM/WebGL-free regression | PASS | node-env suite drives a real RoundMachine + fake PopTarget; guard-bite bites |

All 7 acceptance criteria met for the shipped slice (T1–T6). Correctly deferred: **T7** (`revealPop.setTarget(<f1 object>)` in `onRigLoaded`).

## Findings

**LOW-1 (non-blocking, informational, already tracked — NOT a decision gate).**
The visible pop is inert until f1 (#23) lands the throwable/opponent object; T7 (the 1-line `setTarget` wiring) is deferred because #23 is OPEN/unmerged. This is a legitimate PRODUCE-OR-BLOCK deferral, the null-safe target no-ops safely (NFR4), and f2 ships green standalone. **Sequencing dependency, not a code defect.** Merge-order: f1 (#23) must land, then f2's T7 line activates the pop.

## Decision-gate self-review (ASK-BEFORE-DONE, run against inputs)

- **intent-fidelity** — OK: a poppy pop is both the literal ask and the theatrical reveal-beat underlying intent.
- **scope-drift** — OK: single-card-vs-fan-out was answered by the human interjection at parent #22; f2 is a cohesive S/1 slice.
- **technical-fork** — resolved at design via the dependency-free `PopTarget` seam; easing/overshoot/duration are tuning knobs guarded by the NFR5 test. Not a human-only pipeline fork.
- **capability-gap** — the missing `select_crew`/`spawn_run` is only the dispatch mechanism; review is a read-source → run-build+tests → analyze → write pass = exactly dlcyolo-authoring scope.

No un-asked human-only blocking question → no `ask_question` raised, no new decision-gate entry.

## Effort / back-step

`effort.scope[review]=2` (reviewed 3 files + conformance matrix + live build/tests + guard-bite probe; scope not grown). deep GF=3.0: back-step `2 > 3×1(implement)=3`? **NO**.

## Recommendation

Approve → proceed to `pr` (open ONE PR `dlc/card-kiro-crew-yolo-dlc-test-repo-24` → main closing #24). Note the merge-order dependency on f1 (#23) for the visible pop to activate. Card trust=**assisted** → `gate-review` PARKS for a human (not auto-approved).
