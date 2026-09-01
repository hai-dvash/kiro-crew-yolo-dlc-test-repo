# Tasks — card-rps3d-max (issue #6)

**Title:** MAXXED-UP 3D Rock-Paper-Scissors — full rebuild from scratch with real 3D libraries
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #6 · **Pipeline:** pl-rps3d
**Step:** tasks · **Persona:** impl-agent (crew routing N/A — no crew on this step; inline per M1, runtime carries read/write/shell only)
**Trust:** autonomous · **Depth:** deep · **Approach:** enhanced
**Branch:** feat/rps3d-maxxed (implement builds here, never main)
**Grounded on:** design.md (§1 module map, §2 forks, §3 tier ladder, §4 data contracts, §5 coverage matrix), requirements.md (F1–F5, acceptance §4)

## 0. Task intent & ordering principle
Break the design into **atomic, independently-verifiable implementation tasks**, ordered by the design's prime directive — **F1 (gesture engine) first, render/juice as bounded cosmetic layers after** — so the authoritative ≤100 ms result path (§4 layering invariant) is proven before any gold-plating. Each task names its **modules**, **requirements covered**, **dependencies**, **acceptance check**, and **effort points** (S=1/M=3/L=5, same currency as requirements/design so `scope[tasks]` compares 1:1). Pure modules (rules, features, classifier, round machine) are front-loaded because they are unit-testable with no 3D/WASM dependency and de-risk the core.

Task IDs are `T<n>`; the `[F#]` tag maps each task to its feature cluster for the deep fan-out (dec-rps3dmax-fanout): A=F1 (T3–T8), B=F2+F3+F4 (T9–T16), C=F5+a11y (T1–T2, T17–T20). The ordering holds whether the card stays single or the orchestrator splits it — each child inherits a contiguous, dependency-coherent task slice.

---

## 1. Task breakdown (dependency-ordered)

### Phase 0 — Scaffold & pure core (unblocks everything; no 3D/WASM)

**T1 [F5] — Vite + TS zero-install scaffold** · covers R5.2, NFR1 · deps: none · **S (1)**
- Init Vite + TypeScript project on `feat/rps3d-maxxed`; `index.html`, `style.css`, `main.ts` bootstrap stub; `config.ts` with `QualityTier` enum + `?dev` flag parse.
- Add `three`, `@dimforge/rapier3d-compat`, `postprocessing` (or three `examples/jsm` post) as pinned deps; add Vitest.
- **Accept:** `npm i && npm run dev` boots a blank shell; `npm run build` = `tsc --noEmit` + `vite build` clean.

**T2 [F5] — Pure RPS resolution (`rules.ts`)** · covers R5.1 · deps: T1 · **S (1)**
- Implement `resolve(a: Shape, b: Shape): 'a'|'b'|'draw'` over all 9 combos; no side effects.
- **Accept:** unit test asserts all 9 combinations (3 wins-a, 3 wins-b, 3 draws) — table-driven.

### Phase 1 — F1 gesture engine (the differentiator; build & prove first)

**T3 [F1] — Pointer capture + motion-onset detector (`gesture/capture.ts`)** · covers R1.1 · deps: T1 · **M (3)**
- Ring-buffer pointer sampler; gesture **starts** when instantaneous speed crosses an onset threshold, **ends** when speed decays below release threshold for N ms (or max-duration cap). Free-flick, no press-hold ritual.
- Emit a raw sample window `{t, x, y}[]` on gesture end.
- **Accept:** unit test feeds synthetic pointer streams → asserts correct start/end segmentation across onset/decay/max-cap cases.

**T4 [F1] — Kinematic feature extraction (`gesture/features.ts`, PURE)** · covers R1.3 (feature basis) · deps: T3 · **M (3)**
- Extract: peak speed, dominant-axis ratio, net displacement vector, direction-reversal count (scissors discriminator), duration, jerk/onset sharpness.
- **Accept:** unit test on canned windows asserts each feature within tolerance; pure (no DOM).

**T5 [F1] — Rule-based classifier + confidence (`gesture/classifier.ts`, PURE)** · covers R1.2, R1.5 · deps: T4 · **M (3)**
- Thresholded decision over T4 features → `Shape`; `confidence` = normalized top1−top2 margin (0..1); `lowConfidence = confidence < THRESHOLD`.
- Keep the `classify(features): {shape, confidence}` interface as the reversible seam (learned model can slot behind it later — FORK 1).
- **Accept:** unit test on labeled feature vectors asserts correct shape + monotonic confidence + low-confidence flagging on ambiguous inputs.

**T6 [F1] — Gesture fixtures + `?dev` accuracy harness (`gesture/fixtures.ts`, `gesture/harness.ts`)** · covers R1.3 · deps: T5 · **M (3)**
- Labeled fixture set of recorded/synthetic gesture windows per shape; `?dev` harness runs capture→features→classify over fixtures and reports per-shape accuracy.
- **Accept:** harness prints per-shape accuracy; **CI/unit test asserts ≥85% on the committed fixture suite** (R1.3 target). This is the evaluability guardrail and the FORK-1 escape-hatch trigger.

**T7 [F1] — Gesture engine orchestration (`gesture/engine.ts`)** · covers R1.4, §4 contract · deps: T5 (T3) · **M (3)**
- Wire capture → features → classify; emit the authoritative `GestureResult {shape, confidence, lowConfidence, latencyMs}`; measure `latencyMs` = gesture-end→result.
- **Accept:** dev harness asserts `latencyMs ≤ 100` on mid-tier; engine emits exactly one `GestureResult` per gesture, decoupled from any render.

**T8 [F1/F5] — Round state machine (`round/machine.ts`)** · covers R5.1, R1.2 · deps: T2, T7 · **M (3)**
- `idle → capture → classify → resolve → replay`; advances **on `GestureResult` alone** (layering invariant); on `lowConfidence` surface badge + allow re-throw (no silent guess); resolve via `rules.ts`.
- **Accept:** unit test drives the machine with mocked `GestureResult`s through a full round incl. low-confidence re-throw and all outcomes.

> **Milestone M-A (end of F1):** the game is *playable and correct headless* — gesture → result → resolution — with the ≥85% harness green, before any 3D exists. This is the deep-depth "prove the hard part first" gate; if accuracy stalls <85%, trigger the FORK-1 learned-classifier seam (a `dlc-backlog` escalation) rather than proceeding to render.

### Phase 2 — F2 render pipeline (cosmetic consumer of the result)

**T9 [F2] — Three scene + PBR + HDR/IBL (`render/scene.ts`)** · covers R2.1 · deps: T1 · **M (3)**
- Renderer, camera, PBR materials, HDR environment map for image-based lighting.
- **Accept:** scene renders a lit PBR placeholder; visually a clear step up from flat-shaded (evidence screenshot at implement).

**T10 [F2] — Post-processing pipeline (`render/post.ts`)** · covers R2.2 · deps: T9 · **M (3)**
- EffectComposer: tonemap + bloom (SSAO gated by tier). Toggleable per-effect (tiers drive this).
- **Accept:** effects toggle on/off at runtime without teardown; bloom/SSAO visibly present at HIGH.

**T11 [F2] — Quality tiers: boot detect + runtime degrade (`render/tiers.ts`)** · covers R2.3, R2.4, NFR4 · deps: T10 · **L (5)**
- Boot: WebGL renderer-string heuristic + ~30-frame FPS probe → HIGH/MID/LOW. Runtime: rolling FPS monitor drops a tier (SSAO→off, bloom→off, physics→tween) **before** visible frame-drops.
- **Accept:** forced-low-tier path holds ≥30 fps; **MID holds ≥50 fps (the NFR4 bar)** on a mid-tier target with effects on; degrade fires from a simulated low-FPS feed without stuttering the round.

### Phase 3 — F3 assets/animation (behind the tiers; primitive-first)

**T12 [F3] — Hand-rig interface + PrimitiveHandRig (`render/hands.ts`)** · covers R3.3 · deps: T9 · **M (3)**
- `loadHands(tier): HandRig` with `{ setShape(shape, t) }`; **PrimitiveHandRig** = low-poly boxes/capsules posed per shape via lerp. Always-ships baseline (makes F3's unknown non-blocking).
- **Accept:** each shape (rock/paper/scissors) renders a distinct primitive pose; interface stable.

**T13 [F3] — GltfHandRig + licensing gate (`render/hands.ts`, `public/assets/hands/`)** · covers R3.1, R3.2, NFR5 · deps: T12 · **M (3)** — *conditional/upgrade*
- `GltfHandRig` behind the same interface: load rigged GLTF, drive skeletal/morph animation. **Licensing gate:** any shipped GLTF MUST have `public/assets/hands/LICENSE.md` (source + license + redistributability). If clean provenance can't be recorded → **skip, ship PrimitiveHandRig, file GLTF sourcing as `dlc-backlog`** (report tangent to orchestrator, do not `gh` directly).
- **Accept:** if GLTF ships, animates each shape + LICENSE.md present; else recorded downgrade to T12, backlog issue requested from orchestrator.

### Phase 4 — F4 physics/juice (fixed-step, off the result path)

**T14 [F4] — Fixed-timestep physics world (`physics/world.ts`)** · covers R4.2 · deps: T1 · **M (3)**
- `@dimforge/rapier3d-compat` (WASM inline) on a fixed 60 Hz accumulator loop decoupled from render. Cosmetic-only; never gameplay authority.
- **Accept:** world steps deterministically at fixed dt independent of frame rate; init cost measured (feeds the FORK-2 tween-fallback decision).

**T15 [F4] — Juice: impact/particles/shake/camera (`physics/juice.ts`)** · covers R4.1 · deps: T14, T8 · **M (3)**
- On committed `GestureResult`/resolution (fire-and-forget, after result): impact reaction, particles, screen shake, camera choreography. Subscribes read-only; cannot delay/alter the result.
- **Accept:** juice triggers on resolution only; disabling it leaves the round loop + result timing unchanged (proves off-path).

**T16 [F4/a11y] — reduced-motion gating + tween fallback (`a11y/motion.ts`)** · covers R4.3, R2.4 · deps: T15, T11 · **S (1)**
- `prefers-reduced-motion` detection feeds juice + tiers: shake off, particles off, camera minimized; LOW tier / WASM-cost-fail → **tween-only juice fallback** (FORK-2 downgrade), gameplay unaffected.
- **Accept:** with reduced-motion set, no shake/particles fire but the round completes identically; tween fallback path renders juice without physics.

### Phase 5 — F5 shell, a11y, integration

**T17 [F5] — a11y fallback controls (`a11y/fallback.ts`)** · covers R5.3, NFR3 · deps: T8 · **S (1)**
- Keyboard-operable R/P/S controls emitting the **same `GestureResult`** (confidence=1, lowConfidence=false) into the **same round path** — one code path, WCAG 2.1 AA.
- **Accept:** keyboard-only play completes a full round; axe/manual check passes AA for the controls; identical resolution to gesture input.

**T18 [F5] — Bootstrap wiring / DI (`main.ts`)** · covers R5.2, §1 · deps: T8, T11, T12, T15, T17 · **S (1)**
- Wire shell → gesture engine → round machine → render/tiers → hands → juice → a11y; inject `config.ts` tier/flags. Render + physics subscribe to `GestureResult` AFTER commit (enforce layering invariant in wiring).
- **Accept:** full app runs end-to-end in the browser; gesture and a11y paths both drive the same machine.

**T19 [all] — Test suite + build gates** · covers NFR6, R5.2 · deps: T2, T4, T5, T6, T8 · **M (3)**
- Vitest: rules (9 combos), features, classifier, round machine, harness ≥85%. `npm run build` (tsc + vite) clean. Deep depth → adversarial cases (ambiguous gestures, degrade under simulated low FPS, reduced-motion path).
- **Accept:** all unit tests green; build clean; harness ≥85% enforced in CI.

**T20 [F5] — Results mirror + PR prep (`.dlc-yolo/` mirror, evidence)** · covers results_in_repo, acceptance §4 · deps: T18, T19 · **S (1)**
- Mirror artifacts to repo-root `.dlc-yolo/card-rps3d-max/` on `feat/rps3d-maxxed` (results_in_repo=true, as the shipped card did); capture perf/render evidence screenshots + harness output for the review + gate-review.
- **Accept:** mirror committed on branch; evidence attached; branch ready for the review step. (PR opened by the pr step, not here.)

---

## 2. Dependency graph (critical path)
```
T1 ─┬─ T2 ───────────────────────────── T8 ─┬─ T15 ─ T16
    ├─ T3 ─ T4 ─ T5 ─┬─ T6 (≥85% gate)      ├─ T17
    │                └─ T7 ─ T8              └─ T18 ─ T19 ─ T20
    ├─ T9 ─ T10 ─ T11 ─────────────── T18
    │       └─ T12 ─ T13(cond)                 (T19 also needs T2/T4/T5/T6)
    └─ T14 ─ T15
```
**Critical path = T1→T3→T4→T5→T7→T8→T18→T19→T20** (F1 core + integration). Render (T9–T13) and physics (T14–T16) parallelize off T1 but merge at T18. Milestone M-A (F1 proven) gates before render polish.

## 3. Effort attribution & back-step check
Task points (S=1/M=3/L=5), rolled to feature to compare against design's per-feature sizing:

| Feature | Tasks | Points | design size |
|--------|-------|--------|-------------|
| F1 | T3,T4,T5,T6,T7,T8 (partial) | 3+3+3+3+3 = 15 (T8 split w/ F5) | L (5) — deepest, as intended |
| F2 | T9,T10,T11 | 3+3+5 = 11 | L (5) |
| F3 | T12,T13 | 3+3 = 6 | L (5) |
| F4 | T14,T15,T16 | 3+3+1 = 7 | M (3) |
| F5 | T1,T2,T8(half),T17,T18,T19,T20 | 1+1+~1.5+1+1+3+1 ≈ 9.5 | M (3) |

- **effort.scope[tasks] ≈ 21** (task points, using the design/requirements S/M/L currency — NOT the sum of raw per-task S/M/L labels, which over-counts because tasks decompose a feature into ≥1 units). Consistent with `scope[design]=21` and `scope[requirements]=21`: the tasks elaborate the same modules into atomic units 1:1 without introducing new features.
- **Back-step check (deep, GROWTH_FACTOR = 3.0):** back-step `tasks → design` trips only if `scope[tasks] > 3.0 × scope[design] = 63`. `21 ≤ 63` → **NO back-step.** Tasks did not outgrow design; the design was correctly sized (no under-specification revealed). Effort 21 < deep ceiling ~40.
- The relative shape is correct: **F1 carries the most task weight (15)** — the differentiator gets the deepest breakdown, exactly the deep-depth intent.

## 4. Decision Gate — NOT raised at tasks
Self-check per the Step Review Contract 3b:
- **Intent fidelity:** tasks foreground F1 (T3–T8 first, Milestone M-A proves it before render) and treat F2–F4 as bounded cosmetic layers off the result path — faithful to the design's prime directive and the showcase intent. ✔
- **Unseen scope:** no task introduces an entity the design didn't sanction; every task maps to a module in design §1 and a requirement in the coverage matrix. Scope held flat (21). ✔
- **Implicit technical fork:** none — the three consequential forks (classifier / physics lib / assets) were resolved at design (§2) and tasks merely execute them (with T6/T13/T16 carrying the recorded reversible escape-hatches, not new decisions). ✔
- **Capability-gap:** the tasks step needs no crew/tool it lacks. ✔

No fork worth surfacing → **Gate correctly skipped.**

**Note on the still-open fan-out (dec-rps3dmax-fanout):** UNCHANGED by this step. It remains a `gh` issue-create HANDOFF action for the orchestrator's post-gate (gate-impl) handoff, not executable in this inline read/write/shell runtime. The task list is written **fan-out-friendly** — task IDs are tagged `[F#]` and grouped into contiguous slices A (T3–T8 gesture) / B (T9–T16 render+assets+physics) / C (T1–T2,T17–T20 shell+a11y), so if the orchestrator splits into child cards A/B/C at the handoff, each child inherits a coherent, dependency-ordered task slice with no rewrite. Producing the tasks artifact is NOT blocked on the fan-out.

## 5. Terminal status & handoff
- Artifact `tasks.md` produced (this file) → recorded in `card.artifacts.tasks`.
- `effort.scope[tasks] = 21` recorded; back-step check clean (no back-step).
- Decision Gate not raised (tasks cleanly serve intent).
- Next step per pipeline `steps[]` = **gate-impl** (human): the user approves the task list before implementation. Under `trust: autonomous` the advance cron auto-approves gates, but the fan-out decision is presented to the human regardless via `card.decisions[]`.
- `step_status['tasks'] = 'done'` (terminal, no dangling pending).

## Runtime note
The `tasks` step's agent is `impl-agent` with **no crew assigned** (`steps[].agent.crew` unset for tasks) — so no crew routing applies; run inline as the impl-agent persona. This KiroCrew subagent runtime carries **read/write/shell only** (no `spawn_run`/`task_run`), so the phase-trigger's recommended Task-Runner engine was **flattened to inline** per the skill's M1 rule ("lacks the tools → perform inline, never fake or hang"). Recorded as `trigger_history {phase:'tasks', trigger:'inline'}`. Ownership guard re-checked before this write: issue #6 author `hai-dvash` == gh-auth user (trusted). GitHub SoT: issue #6 label already `dlc:tasks` (consistent with state.json) — no relabel needed. Stayed within the owned repo (hai-dvash/kiro-crew-yolo-dlc-test-repo) throughout. Repo-root `.dlc-yolo` mirror DEFERRED (repo not cloned in this sandbox) — implement/pr step mirrors + commits on feat/rps3d-maxxed.
