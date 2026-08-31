# Tasks — card-rps3d

**Card:** 3D Rock-Paper-Scissors with Wii-style mouse-gesture throws
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo (issue #4)
**Step:** tasks (agent: `impl-agent`, role: break design into atomic tasks) · **no crew assigned**
**Depth:** standard · **Trust:** assisted
**Run:** escalated subagent, executed **INLINE**. This runtime (KiroCrew subagent) has
read/write/shell only — no `select_crew`/`spawn_run` — same tool-inheritance handling as the
investigate/requirements/design steps of this card. The tasks step has **no crew** in the
pipeline anyway, so nothing is flattened here. Grounded in `design.md` + `requirements.md`.

Every task is atomic (one focused change), independently verifiable, ordered so each builds only
on completed predecessors, and traces to a requirement (Rx / NFRx) and a design module.

---

## T0 — Project scaffold (zero-install static bundle)
- [ ] Init a Vite + TypeScript static project (no server, no framework runtime): `index.html`,
  `src/main.ts`, `tsconfig.json`, `package.json`, `vite.config.ts` (static output).
- [ ] Add Three.js as a pinned dependency; add Vitest as the test runner (pinned).
- [ ] Confirm `npm run build` emits a static bundle and `npm run dev` serves it locally
  (bind 127.0.0.1).
- **Traces:** R4.1, NFR1 · **Module:** `index.html`, `main.ts`
- **Verify:** `npm run build` succeeds; opening the built `index.html` loads a blank play area.

## T1 — Pure RPS rules (`game/rules.ts`)
- [ ] Implement `resolve(player, cpu): 'win'|'lose'|'draw'` for all 9 combinations.
- [ ] Implement `cpuPick(): Shape` — uniform random, independent, drawn from a source the player
  never observes.
- **Traces:** R3.1, R3.2 · **Module:** `game/rules.ts`
- **Verify (unit):** all 9 outcome combos asserted; `cpuPick` distribution sanity over N draws.

## T2 — Gesture feature extraction (`gesture/features.ts`)
- [ ] From a `{t,x,y}[]` sample buffer derive: peak velocity, velocity profile (spike vs.
  sustained), dominant axis (vertical/horizontal), direction-reversal count, straightness
  (net displacement / total path length).
- [ ] Expose a `Features` type consumed by the classifier.
- **Traces:** R1.1 · **Module:** `gesture/features.ts`
- **Verify (unit):** feature math on canned buffers (a straight down-flick, a flat sweep, a
  two-reversal snip) yields the expected feature signs/values.

## T3 — Rule-based classifier (`gesture/classify.ts`)
- [ ] Implement `classify(features): {shape, confidence}` with the v1 rules:
  rock = short/sharp/straight vertical flick; paper = sustained horizontal sweep, low reversals;
  scissors = ≥2 direction reversals in the window.
- [ ] Confidence = margin between top and runner-up rule scores; emit `low` below the motion
  threshold (do not silently guess).
- **Traces:** R1.1, R1.2 · **Module:** `gesture/classify.ts`
- **Verify (unit):** labeled synthetic buffers per shape assert correct shape + confidence sign;
  a sub-threshold buffer returns low confidence.

## T4 — Pointer capture sampler (`gesture/capture.ts`)
- [ ] On `pointerdown` in the play area, start sampling `{t,x,y}` per `pointermove` throttled to
  animation frames; on `pointerup` close the window and emit the buffer.
- [ ] Apply the minimum-motion gate (path length + peak velocity) → `confidence=low` below it.
- **Traces:** R1.1, R1.2 (press-and-hold-then-flick capture window per design decision 1)
- **Module:** `gesture/capture.ts` · **Depends on:** T2, T3
- **Verify:** manual — pressing and flicking produces a buffer that classifies; a tiny jiggle
  yields low confidence.

## T5 — Round state machine (`game/round.ts`)
- [ ] Implement `IDLE → CAPTURING → CLASSIFIED → RESOLVED → REPLAY`.
- [ ] Draw the CPU pick at RESOLVED entry (unobserved); wire `resolve()` for the outcome.
- [ ] REPLAY re-enters IDLE in place (no reload).
- **Traces:** R3.1, R3.2, R3.3 · **Module:** `game/round.ts` · **Depends on:** T1, T3, T4
- **Verify (unit):** driving events through the machine reaches RESOLVED with a correct outcome
  and returns to IDLE on replay.

## T6 — Three.js scene (`render/scene.ts`)
- [ ] One scene, perspective camera, soft lighting; two low-poly hand rigs (player near, CPU far);
  poses for fist / flat / two-fingers.
- **Traces:** R2.1, R2.2, R2.3 · **Module:** `render/scene.ts` · **Depends on:** T0
- **Verify:** scene renders both rigs at ≥30 fps on an integrated-GPU laptop browser (frame-time
  spot check).

## T7 — Throw animation (`render/throwAnim.ts`)
- [ ] On CLASSIFIED, play a short 3-2-1-shoot cock-and-throw tween for both hands, snapping to the
  resolved pose. Keep it cosmetic and decoupled from classification latency (result ready ≤150 ms;
  animation runs after).
- **Traces:** R1.4, R2.1, R2.2 · **Module:** `render/throwAnim.ts` · **Depends on:** T5, T6
- **Verify:** classification-to-result state transition measured ≤150 ms independent of the
  animation duration.

## T8 — Accessibility fallback + confidence UI (`ui/fallback.ts`)
- [ ] Three always-visible buttons (rock/paper/scissors) that inject a CLASSIFIED event into the
  same downstream path as a gesture.
- [ ] Low-confidence badge on the top-guess shape + a one-click "re-throw" affordance.
- **Traces:** NFR3, R1.2 · **Module:** `ui/fallback.ts` · **Depends on:** T5
- **Verify:** a full round resolves via a button with the gesture path disabled; a low-confidence
  gesture shows the badge and re-throw works.

## T9 — App bootstrap wiring (`main.ts`)
- [ ] Bootstrap the scene, mount capture + fallback, run the round loop, show win/lose/draw and
  play-again in place.
- **Traces:** R1–R4 integration, R3.3, R4.1 · **Module:** `main.ts` · **Depends on:** T5–T8
- **Verify:** end-to-end — flick throws, sees a 3D throw, gets an outcome, replays without reload.

## T10 — Dev accuracy overlay + manual accuracy harness (verification for R1.3)
- [ ] Dev-only overlay drawing the sample buffer + chosen features.
- [ ] A small recorded/labeled gesture set to spot-check ≥80% first-try accuracy (R1.3 is scoped as
  a manual spot-check, not a formal study).
- **Traces:** R1.3 · **Module:** dev overlay (behind a dev flag) · **Depends on:** T4
- **Verify:** overlay renders; accuracy spot-check ≥80% on the labeled set (tune classifier
  thresholds in T3 if below — do not expand to a learned classifier; that is a backlog item).

---

## Task → Requirement coverage

| Req | Tasks |
|-----|-------|
| R1.1 | T2, T3, T4 |
| R1.2 | T3, T4, T8 |
| R1.3 | T10 |
| R1.4 | T7 |
| R2.1/R2.2/R2.3 | T6, T7 |
| R3.1/R3.2/R3.3 | T1, T5 |
| R4.1 | T0, T9 |
| NFR1 | T0 (lean scaffold) |
| NFR2 | (nothing built — no monetization surfaces) |
| NFR3 | T8 |

Every functional requirement maps to at least one task; NFR2 is honored by omission (no ads/IAP/
accounts/analytics tasks exist).

## Effort Attribution (scope-growth back-step check)

| id | feature | tasks | size | points |
|----|---------|-------|------|--------|
| f1 | Gesture capture + classifier | T2, T3, T4, T10 | L | 5 |
| f2 | 3D throw render | T6, T7 | M | 3 |
| f3 | Round resolution + replay | T1, T5 | S | 1 |
| f4 | Zero-install shell + a11y fallback | T0, T8, T9 | S | 1 |

- **effort.scope[tasks] = 10.** Held **flat** vs. `effort.scope[design] = 10` — the tasks step
  decomposed the existing design 1:1 into atomic units and introduced **no new features or scope**.
  T10 (accuracy harness) and T0 (scaffold) are verification/enablement of already-specced work, not
  new product scope.
- **Back-step heuristic:** GROWTH_FACTOR at depth=standard = 2.0 → back-step to `design` trips if
  `scope[tasks] > 2.0 × scope[design]` i.e. > 20. **scope[tasks] = 10 ≤ 20 → NO back-step.**

## Self-review (Step Review Contract)

- **Serves INTENT:** yes — tasks front-load the gesture pipeline (T2–T4, T10, the stated hard part)
  and keep the 3D render (T6–T7) and shell (T0, T9) proportionate; no monetization tasks exist.
- **Unseen scope introduced?** No. 1:1 decomposition of the approved design; the two harder
  variants (free-flick, learned classifier) stay parked as backlog, not tasked.
- **Consequential implicit technical fork?** None new — the gesture-model fork was resolved at
  design; tasks only sequence it. Test framework choice (Vitest) is a conventional, reversible
  scaffold decision, not a product fork.
- **Capability gap?** None warranting a new crew/tool at this step.
- **Decision Gate: NOT raised** — the step cleanly serves intent, scope is flat, and the next stop
  is the human **gate-impl** gate (assisted trust → the advance cron parks there and notifies; it
  does not auto-approve).

## Repo-root `.dlc-yolo` mirror

`results_in_repo=true`, but the owned repo is **not cloned in this sandbox**, so the repo-root
`.dlc-yolo/` mirror + commit remains **DEFERRED** to the orchestrator/pr step (same as the prior
three steps). This tasks artifact lives in the spec dir and the app-data results area.
