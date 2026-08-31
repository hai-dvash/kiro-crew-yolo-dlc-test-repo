# Review — card-rps3d

**Card:** 3D Rock-Paper-Scissors with Wii-style mouse-gesture throws
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo (issue #4) · **PR #5** (branch `feat/rps3d-implement`)
**Step:** review (agent: `review-agent`, no crew) · **Depth:** standard → severity-ranked
**Run:** escalated runtime, executed **INLINE**. `spawn_run`/`select_crew` are NOT present in this
runtime (read/write/shell only — the documented tool-inheritance gap); review-agent has no crew
assigned anyway, so nothing was flattened. Per the terminal-status contract the step ends on a
terminal `step_status`, never a dangling `pending`.

## Method

Reviewed the actual merged code at the branch head (`c3b8621`) against the **approved**
`requirements.md` + `design.md` (the acceptance criteria), then **independently re-verified** the
build and tests rather than trusting the recorded claim.

**Independent verification (this run, in the owned repo clone):**
- `npm test` → **23/23 passing** (round 3, rules 11, features 4, classify 5). ✓
- `npm run build` → `tsc --noEmit` clean + `vite build` clean (14 modules, static bundle). ✓

## Requirement coverage

| Req | Status | Evidence |
|-----|--------|----------|
| R1.1 capture + classify into {r,p,s} | ✓ | `capture.ts` press-and-hold window → `features.ts` → `classify.ts` returns exactly one shape |
| R1.2 no silent guess on ambiguous/low-motion | ✓ | `classify` gate: `pathLength<40 \|\| peakVelocity<0.15 \|\| margin<0.5 → 'low'`; `main.ts` `showBadge` + re-throw affordance; test `sub-threshold jiggle → low` |
| R1.3 ≥80% first-try accuracy | ◑ | T10 harness asserts ≥80% on a **5-fixture synthetic** set only (passes). Real-user accuracy is unmeasured — honestly scoped that way in requirements/design |
| R1.4 ≤150 ms gesture-end→result | ✓ | `Round.classified` resolves synchronously on pointerup; `playThrow` is cosmetic, decoupled via `.then()` |
| R2.1/2.2 3D player + CPU throw | ✓ | `scene.ts` two rigs, `throwAnim.ts` plays both, poses snap at t≥0.85 |
| R2.3 ≥30 fps no dGPU | ◑ | Design-justified (low-poly boxes, no shadows/PBR, pixelRatio≤2); not runtime-measured (no browser in sandbox) |
| R3.1 correct resolution | ✓ | `rules.resolve` + all-9-combos test green |
| R3.2 CPU pick independent/unseen | ✓ | `cpuPick` drawn at RESOLVED entry from `Math.random`; uniform-distribution test |
| R3.3 replay no reload | ✓ | `Round.replay()` re-enters IDLE in place; `main` re-throw path |
| R4.1 zero-install browser | ✓ | Vite static bundle, no server, no login |
| NFR2 no monetization | ✓ | Confirmed by omission — no ads/accounts/analytics/tracking anywhere |
| NFR3 a11y fallback | ✓ | `fallback.ts` 3 buttons inject via the **same** `resolveShape` round path; test "fallback classifies directly from IDLE" |

## What's good

- Clean separation (gesture / render / game / ui); pure, testable domain logic.
- The low-confidence gate genuinely honors R1.2 — it never blocks flow yet never silently commits a
  wrong guess; wired end-to-end to the badge + re-throw.
- Result/animation decoupling is correct — the outcome is resolved before the cosmetic tween, so
  R1.4 holds regardless of animation duration.
- Defensive feature math: divide-by-zero guard, degenerate-buffer test, jitter EPS on reversal
  counting.
- Fallback truly shares the round path (not a parallel implementation) — the right way to satisfy
  NFR3.

## Findings (severity-ranked)

**Critical:** none.
**High:** none.

**Medium**
- **M1 — R1.3 accuracy is validated only against 5 synthetic fixtures.** The classifier fixtures were
  authored to pass the very thresholds they exercise, so the ≥80% test is close to tautological. This
  is *acceptable for a showcase* and was explicitly scoped (requirements R1.3 "measured on a small
  manual test set, not a formal study"), but the true first-user accuracy is unknown until real
  gestures are tried. Recommend a manual pass in-browser via the `?dev` overlay before any public
  demo. Not gate-blocking.

**Low**
- **L1 — `main.ts` fallback path transitions IDLE→CAPTURING→CLASSIFIED via `beginCapture()`+`classified()`.**
  Works (and is tested from IDLE), but the fallback briefly enters CAPTURING it never needed. Cosmetic;
  no behavioral bug.
- **L2 — `throwAnim.playThrow` reads live `group.position.y` as its base each call.** Guarded by the
  state machine (never called concurrently), so not reachable today; would drift if ever invoked
  mid-tween. Leave a note if animation gets richer.
- **L3 — Gesture capture handles `pointercancel` but not pointer-leaves-canvas mid-drag or multi-pointer.**
  Fine for a single-pointer showcase; note for polish.

## Verdict

**Clean to proceed to `gate-review`.** No Critical/High findings. All functional requirements are met
and independently verified (23/23 tests, clean build). The two ◑ items (R1.3 real-user accuracy, R2.3
measured fps) are inherent to a sandbox review with no browser and were honestly scoped as
best-effort/manual in the approved spec — they are **manual pre-demo checks**, not code defects. M1/L1–L3
are polish, not blockers.

Recommended next: human `gate-review` approval, then the `pr` step (PR #5 is already open — in fact
already MERGED; the orchestrator should reconcile the PR/label state at the pr step).

## Self-review (Step Review Contract)
- **Serves INTENT:** yes — reviewed against the gesture-feel-primary framing; the one substantive caveat
  (M1) is precisely about the primary acceptance metric and is surfaced honestly rather than rubber-stamped.
- **Unseen scope introduced?** No — review only, no code changed, no new entities.
- **Consequential implicit fork?** No — the trainless-vs-learned classifier fork was settled at design;
  M1 flags a *verification* limit within that decision, not a re-opened fork.
- **Capability gap?** A real-browser accuracy harness would strengthen R1.3/R2.3 verification, but it is a
  known, honestly-scoped manual step — not worth raising the Decision Gate for a showcase.
- **Decision Gate: NOT raised** — no Critical/High, no scope/intent violation, no fork. The step cleanly
  produces its artifact and hands to the human gate.
- **Terminal status:** `step_status['review']='done'` (artifact produced + build/tests independently
  verified; no dangling pending).
