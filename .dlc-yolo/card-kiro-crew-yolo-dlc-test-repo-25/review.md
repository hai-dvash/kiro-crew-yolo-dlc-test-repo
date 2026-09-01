# Review — f3 (#25): hidden-CPU board/occluder + reveal sequencing + headless regression seam

**Card:** `card-kiro-crew-yolo-dlc-test-repo-25` (leaf child of #22, the Order-4 deep-decomposition proof — sibling of f1/#23, f2/#24)
**Branch:** `dlc/card-kiro-crew-yolo-dlc-test-repo-25` @ `96aecdf`
**Reviewed:** 2026-09-01, capability=dlcyolo-authoring, trust=assisted (inherited), depth=deep
**Verdict:** **PASS** — no Critical / High / Medium. One non-blocking Low (informational).

## Grounding (verified LIVE, implement note NOT trusted)

- **Ownership guard PASS (fail-closed):** `gh api user` → `hai-dvash`; issue #25 author `hai-dvash`, `is_bot=false`, state OPEN, carries `dlc:review`. f1 dep #23 confirmed OPEN/unmerged (T7 correctly deferred).
- **Branch chain / one-PR-per-card:** reviewed in an isolated fresh clone. `origin/main(dcdb2e4)..HEAD` = exactly the 5 card-25 commits (`3a5e327` investigate → `96aecdf` implement), based off origin/main, **ZERO cross-card bleed** (no card-23/f1 or card-24/f2 files).
- **Additive-only diff (NFR2) — DIFF-CONFIRMED:** code/test changed set = EXACTLY `src/render/occluder.ts` (A) + `src/render/reveal.ts` (A) + `test/reveal.test.ts` (A) + `src/main.ts` (M). Protected-surface guard over `src/round/**`, `rules.ts`, `types.ts`, `gesture/**`, `physics/**`, `a11y/**`, `render/{scene,hands,framing}.ts`, `package.json` returned **EMPTY**.
- **Build:** `npm run build` (tsc --noEmit && vite build) clean (pre-existing rapier chunk >500kB warning only).
- **Tests:** `npm test` → 9 files, **62 passed** (baseline 57 + 5 new f3 cases — implement's 57→62 claim ACCURATE).
- **GUARD-BITE verified RED:** neutralizing the `capturing|idle → cover()` re-hide branch turns 2 tests RED (hidden-then-shown AC1 + fresh-round re-hide AC8), reverted → 62 green, tree clean. The F1-first / re-hide net genuinely bites — closing the exact card-rps3d-fix broken-green gap class.

## Conformance matrix

| Req / NFR | Status | Evidence |
|---|---|---|
| R1 additive occluder hides opponent begin→reveal | PASS | `Occluder.cover()` fired on `capturing`/`idle`; `NullOccluder` always-ships fallback |
| R2 reveal-sequencing controller off committed state | PASS | `RevealController.onState` reveals only on `phase==='resolved' && result && opponentShape` |
| R3 reveal reads as a discrete beat | PASS | `BoardOccluder` opacity 1→0 over `REVEAL_MS=320`; `reveal()`/`update(dt)` |
| R4 injectable DOM/WebGL-free controller | PASS | `RevealController` depends on `Occluder`/`OpponentObject` ifaces + `instant()`, not THREE |
| R5 fresh-round re-hide | PASS | `revealedThisRound` re-arm on `capturing`/`idle`; test #5 asserts cover ≥ 2 via `begin()` re-entry |
| **NFR1 F1-first / render-as-consumer (LOAD-BEARING)** | **PASS** | `pickOpponent()` stays solely in `machine.ts:79` submit(); `render(s)` byte-for-byte unchanged; `reveal.onState(s)` APPENDED after `render(s)`; controller reads already-committed `opponentShape`/`result`, never gates. Guard-bite verified. |
| NFR2 additive-to-core | PASS | protected-surface guard EMPTY (diff-confirmed) |
| NFR3 a11y preserved | PASS | `render(s)` status/badge unchanged (outcome announced with board present); `instant()` via `shouldTweenOnly` = reduced-motion/LOW instant show |
| NFR4 zero-new-dep / reversible | PASS | Three.js meshes + existing RAF channel; `NullOccluder` no-op fallback; `package.json` unchanged |
| NFR5 headless DOM/WebGL/fs-free regression | PASS | node-env `test/reveal.test.ts` drives a REAL `RoundMachine` + fake `Occluder`/`OpponentObject`; guard verified to bite |

**8 acceptance criteria met** for the shipped slice (T1–T5). T7 (swap `NullOccluder`+stub for `BoardOccluder` + f1's real `OpponentObject` in `onRigLoaded`) correctly DEFERRED.

## Substance notes

- `RevealController.onState` beat order is grounded in the real `RoundPhase` union; the `revealedThisRound` guard makes it idempotent against re-emits.
- The AC3 committed-before-reveal test snapshots machine state at the exact reveal call and asserts `{phase:'resolved', result:'b', opponentShape:'rock'}` — driving a real machine (deterministic `pickOpponent`), not a mock, so the F1-first assertion is genuine.
- **Deviation accepted (test corrected to ground truth):** the design/tasks sketch asserted `resolve('scissors','rock')==='a'`, but live `src/rules.ts` has `BEATS.rock='scissors'` (rock beats scissors) → `resolve` returns `'b'`. The implement fixed the *test assertion* to match the real game authority; the controller reads whatever `submit()` committed and is unaffected. Correct call — a spec sketch error corrected against source, not a code hack.

## Findings

- **Low (non-blocking, informational — NOT a decision gate):** the visible board/reveal is inert until f1 (#23) lands the throwable/opponent object render path. T7 (the boot-time handle swap in `onRigLoaded`) is deferred because #23 is OPEN/unmerged — a legitimate PRODUCE-OR-BLOCK deferral (`NullOccluder` + stub keep f3 non-regressive; f3 ships green standalone). Merge-order: f1 (#23) lands, then f3's T7 activates the visible board/reveal. This is a sequencing dependency, not a code defect.

## Decision-gate self-review (ASK-BEFORE-DONE §3a)

Run against inputs at step start: intent-fidelity OK (hidden-CPU board = literal + theatrical-reveal underlying intent); scope-drift OK (single-card-vs-fan-out answered by the human interjection at parent #22 — f3 exists because of it); technical-fork resolved at design via the injectable `Occluder`/`OpponentObject` seam (occluder mesh form / easing are implement tuning knobs guarded by the NFR5 test; the f1 dependency is a sequencing constraint isolated to T7, not a human-only fork changing WHAT is built); capability-gap — authoring read/build/git sufficed. Verdict is PASS (no Critical/High → no back-step/reject fork). **No un-asked human-only blocking question** → no `ask_question`, no new decision-gate entry, proceed to done.

## Recommendation

Approve → proceed to `pr` (open ONE PR `dlc/card-kiro-crew-yolo-dlc-test-repo-25` → main closing #25). Note the merge-order dependency on f1 (#23) for the visible board/reveal. Parent #22 retires only when f1/f2/f3 are all consumed.
