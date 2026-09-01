# Implement report — Game visually broken: green-cylinder hand, no camera framing, dead gesture input

- **Card:** card-rps3d-fix · **Pipeline:** pl-rps3d (enhanced, self-enabling)
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Issue:** [#13](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/13)
- **Type:** bug (runtime/render + input) · **Depth:** deep · **Trust:** autonomous
- **Capability:** `dlcyolo-builder` (write + shell) — this run genuinely produced code + green tests.
- **Baseline:** owned-repo `main` HEAD `719c6eb`. **Branch:** `feat/card-rps3d-fix-implement`.

## What shipped (tasks T1–T11)

| Task | Change | File(s) |
|------|--------|---------|
| T1 | Hand-plausibility gate: `isHandSkeleton` + `MIN_FINGER_BONES=3`; ladder `clips → morph → (bones AND isHandSkeleton) → null`. RiggedSimple's 2 generic `Bone` joints are rejected → `PrimitiveHandRig` ships. | `src/render/hands.ts` |
| T2 | R6.1 asset-strategy guard test (2 generic bones → `null`; primitive floor; 5-finger-named → `bones` rig, no false negative). | `test/hands.test.ts` |
| T3 | Provenance reconciliation: RiggedSimple row Status → "present but NOT the active rig (rejected by the hand-plausibility gate; retained for a future upgrade)". CC-BY credit correctly inert (primitive ships). NFR5 G1 gate still satisfied (non-placeholder `hand.glb` row). | `public/assets/hands/LICENSE.md` |
| T4 | New pure framing module: `computeFraming` (dual-FOV — frames against the tighter of vertical/horizontal so portrait AND landscape fit) + `computeRigScale`. No WebGL, no per-asset constants. | `src/render/framing.ts` |
| T5 | R6.2 framing math test (AABB within frustum at landscape + portrait; portrait pushes camera farther; scale maps large/small diagonals to target; degenerate-safe). | `test/framing.test.ts` |
| T6 | `Scene3D.frameObject(center, radius)` (additive); stores last-framed target and re-frames inside `resize()`; `main.ts` measures the loaded rig's AABB, applies `computeRigScale`, calls `frameObject`. `Box3` runs on load + resize only, NOT in the RAF loop (NFR4). | `src/render/scene.ts`, `src/main.ts` |
| T7 | R4 confidence repair, levers in the design order: **(1)** capture onset `0.35→0.28` / release `90→120ms` (one coherent flick window; no scoring change); **(2)** confidence denominator `(top+runnerUp)→(top+EPS)` — a monotonic rescale (strictly ≥ old, never reorders shapes). **Lever 3 (common-mass trim) NOT applied** — empirically it *lowered* paper confidence (paper's runner-up is scissors, which carries no common mass) and helped nothing, so per the design hard-gate it does not ship. | `src/gesture/capture.ts`, `src/gesture/classifier.ts` |
| T8 | R6.3 confidence regression: the 4 `scissorsVertical` fixtures were LOW (~0.14) under the old formula and clear the threshold (~0.25) under the fix (RED-on-old crossover); monotonic-rescale invariance (new ≥ old on all 20 fixtures); argmax-per-fixture invariance (scoring intent preserved). | `test/gesture.test.ts` |
| T9 | R6.4 boot seam: extracted `wireGame(deps)` (DI'd collaborators) from `boot()`; `boot()` is the thin real-DOM adapter. Auto-boot guarded on a real `document` so the module is import-safe under test. New smoke test asserts (a) rig added to scene, (b) engine→machine.submit, (c) fallback→same submit, (d) `frameObject` invoked with the measured center/radius, (e) `computeRigScale` applied. **The meta test that would have caught all three defects.** | `src/main.ts`, `test/main.test.ts` |
| T10 | Full gate green (below). | — |
| T11 | Mirror docs + this report; commit + push `feat/card-rps3d-fix-implement`. | `.dlc-yolo/card-rps3d-fix/` |

## Gate evidence

- `npx tsc --noEmit` → exit 0 (clean).
- `npx vite build` → clean (primitive-path build; asset retained but not driving the rig).
- `npx vitest run` → **57 passed** (41 baseline + 16 new/extended across `hands`, `framing`,
  `gesture`, `main`), incl. `test/harness.test.ts` ≥85% overall + ≥75% per-shape accuracy gate
  (F1 no-regression holds — the confidence change is denominator-only, argmax untouched).

## RED-on-`719c6eb` proof (each guarding test genuinely locks a regression)

Overlaid the four new/extended test files onto a clean `719c6eb` checkout (baseline source, no
fixes) and ran them — **8 targeted assertions FAILED**, proving they are not no-ops:

- **R6.1** — the two hand-plausibility rejection assertions FAIL (baseline accepts RiggedSimple's
  bones → not `null`). The 5-finger no-false-negative assertion passes on both (correct: it's the
  *rejection* that's new).
- **R6.2** — whole file fails on baseline (`src/render/framing.ts` does not exist → import error).
- **R6.3** — the scissors-crossover assertion FAILS on baseline (old denominator flags those genuine
  flicks low). Monotonicity + argmax-invariance pass on both (they are invariants — correct).
- **R6.4** — all five fail on baseline (`wireGame` does not exist → import error).

## Behavior-preserving guarantees

- `src/rules.ts` and the classifier's `score()` (which shape wins) are **untouched**; the confidence
  change is a monotonic denominator rescale, proven winner-preserving on the whole corpus.
- `HandRig` interface, `PrimitiveHandRig`, `loadHands(tier)` signature, and the `clips`/`morph`
  ladder branches are unchanged — T1 only tightens the `bones` branch's acceptance test.
- `wireGame` extraction is a behavior-preserving refactor: `boot()`'s observable runtime behavior in
  the browser is identical (it now delegates its wiring to `wireGame(realDeps)`).

## Backlog parked (per design §1 Q1 / §8)

- **Real rigged-hand `.glb` upgrade** — a genuine feature (a hand mesh with true RPS clips/morphs),
  deliberately deferred from this bug-fix to avoid re-opening the asset-vetting gate. Filed as a
  `dlc-backlog` issue on the owned repo (mirrors how card-rps3d-max parked #8/#9).

## Effort attribution

Implemented the plan 1:1 (no new features). `effort.scope[implement] = 8` (= `scope[tasks] = 8`).
Back-step check (deep `GROWTH_FACTOR = 3.0`): `8 > 3 × 8 = 24`? No → no back-step.
