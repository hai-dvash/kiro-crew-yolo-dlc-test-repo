# Requirements — card-rps3d-max (issue #6)

**Title:** MAXXED-UP 3D Rock-Paper-Scissors — full rebuild from scratch with real 3D libraries
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #6 · **Pipeline:** pl-rps3d
**Step:** requirements · **Persona:** dlcyolo-rps3d-spec (spec-agent; crew routing flattened inline — see runtime note)
**Trust:** autonomous · **Depth:** deep · **Approach:** enhanced
**Branch:** feat/rps3d-maxxed (implement builds here, never main)
**Grounded on:** investigation.md (F1–F5 clusters, STRONG-GO-as-showcase verdict)

## 0. Product intent (the goal behind the ticket)
A **from-scratch, high-fidelity 3D Rock-Paper-Scissors** built as a **portfolio/tech-demo showcase**, NOT a revenue play (viability verdict reaffirmed: NO-GO as revenue, STRONG-GO as showcase). The value concentrates in **F1 — the real-time gesture engine** (the differentiator and the legitimate small-ML / signal-processing artifact); the maxxed 3D (PBR/HDR/post-processing, GLTF rigs, physics juice) is impressive but comparatively commodity integration. The literal ask is "put it on a new branch with real 3D libraries"; the intent is *make the hard parts feel great without gold-plating render before the gesture feels right.*

## 1. In scope / out of scope
**In scope (v1 showcase):** F1 gesture engine, F2 3D render pipeline, F3 assets+animation, F4 physics/juice, F5 game shell + a11y — decomposed below.
**Out of scope (non-goals, from the issue + viability):**
- **NO monetization** — no ads, no accounts, no telemetry-for-revenue, no paywalls. (Reaffirmed non-goal; any monetization tangent is parked to `dlc-backlog`, never built.)
- No multiplayer / netcode.
- No mobile-native app (browser only; touch may be a stretch goal, not required).
- Library *selection* (Rapier vs cannon-es; learned vs rule-based classifier) is a **design fork**, NOT decided here.

## 2. Functional requirements

### F1 — Gesture engine (motion classifier) — PRIMARY acceptance driver [Size L]
- **R1.1** The game SHALL recognize three throws (rock / paper / scissors) from a mouse/pointer motion gesture, with a **richer capture model than the shipped trainless classifier** (shipped = press-and-hold-then-flick; maxxed target = **free-flick capture** with a motion-onset detector so the player does not need a rigid hold-then-release ritual).
- **R1.2** Each recognition SHALL produce a **confidence score**; low-confidence throws MUST NOT be silently guessed — surface a low-confidence badge and allow a re-throw (carry the shipped no-silent-guess invariant forward).
- **R1.3** The classifier SHALL be **evaluable**: a dev-mode accuracy harness (`?dev`) MUST report per-shape recognition accuracy against a fixture set, with a target **≥ 85%** on the fixture suite (raised from the shipped ≥80% given the higher-spec bar; deep depth).
- **R1.4** Recognition latency (gesture end → classified result) SHALL be **≤ 100 ms** on a mid-tier laptop, and MUST be decoupled from the cosmetic 3D throw animation (the result is authoritative; the animation is juice).
- **R1.5** The classifier architecture (well-tuned **rule-based** vs a **small learned** model) is an **explicit design fork** — requirements do not force it. If learned is chosen at design, the training-data/tooling burden MUST be justified against a tuned rule-based baseline (do not assume learned).

### F2 — 3D render pipeline [Size L]
- **R2.1** The scene SHALL use **PBR materials + an HDR/IBL environment** (image-based lighting) for realistic shading — a clear visual step up from the shipped low-poly flat-shaded look.
- **R2.2** The scene SHALL apply **post-processing** (at minimum tone mapping + bloom; SSAO desirable) via an EffectComposer/`postprocessing` pipeline.
- **R2.3** The render loop SHALL hold a **perf budget of ≥ 50 fps** on a mid-tier laptop with post-processing + physics + skeletal animation active; a **perf gate at design** MUST size this before implement (carried risk from investigation).
- **R2.4** The render MUST **degrade gracefully**: if the device cannot hold the budget, post-processing effects downgrade (bloom/SSAO off) before frame-drops become visible — a quality tier fallback.

### F3 — Assets + animation [Size M–L, biggest asset unknown]
- **R3.1** Rock / paper / scissors SHALL be represented by **real GLTF hand rigs** with **skeletal or morph-target animation** (vs low-poly placeholders) — a hand that forms each shape.
- **R3.2** Asset sourcing SHALL be resolved as a **design decision**: source appropriately-licensed rigged GLTF hands OR author minimal rigs; **license provenance MUST be recorded** (no unlicensed assets in the repo). This is the largest schedule unknown — flagged for the design perf/asset gate.
- **R3.3** If rigged GLTF hands cannot be sourced/authored within budget, a **fallback to stylized primitive-based hand poses** is acceptable for v1 (keeps the card shippable; records the downgrade).

### F4 — Physics / juice [Size M]
- **R4.1** Throws SHALL have **physical juice**: impact reaction, particles, screen shake, and camera choreography on resolution.
- **R4.2** A **physics library** (Rapier WASM or cannon-es) MAY back the juice; the **choice is a design fork**. Physics MUST run on a **fixed timestep** decoupled from render, and MUST NOT block the ≤100 ms result path (R1.4) or the perf budget (R2.3).
- **R4.3** Juice is **cosmetic and skippable** — a reduced-motion / a11y setting (NFR-A11Y) disables screen shake and heavy particles without breaking gameplay.

### F5 — Game shell + a11y [Size S–M]
- **R5.1** A **round state machine** SHALL drive: idle → capture → classify → resolve → replay, with correct RPS resolution over all 9 combinations.
- **R5.2** A **zero-install dev shell** (Vite + TS) SHALL run the app with `npm i && npm run dev`; `npm run build` MUST produce a clean static bundle (tsc typecheck + vite build).
- **R5.3** An **accessible fallback** SHALL let a player who cannot perform the gesture (or uses assistive tech) pick rock/paper/scissors via keyboard-operable controls that share the same round path (carry the shipped a11y-button pattern; MUST meet WCAG 2.1 AA for the controls).

## 3. Non-functional requirements
- **NFR1 (Zero-install):** `npm i && npm run dev` boots; no global tooling beyond Node.
- **NFR2 (No monetization):** enforced by omission — no monetization code paths exist. (Coverage-by-absence, as in the shipped card.)
- **NFR3 (Accessibility):** the game is playable end-to-end via the R5.3 fallback; reduced-motion honored (R4.3); controls meet WCAG 2.1 AA.
- **NFR4 (Perf):** ≥50 fps mid-tier with full effects (R2.3), graceful degrade (R2.4), ≤100 ms recognition (R1.4).
- **NFR5 (Asset licensing):** every bundled 3D asset has recorded, redistributable licensing (R3.2).
- **NFR6 (Testability):** rules, classifier, and round machine covered by unit tests; the ?dev accuracy harness (R1.3) is a first-class evaluability surface. Deep depth → adversarial review + extra test-coverage expectation at review.

## 4. Acceptance criteria (v1 done)
1. Free-flick gesture recognizes R/P/S with **≥85%** fixture accuracy (R1.3), confidence surfaced, no silent guess (R1.2), ≤100 ms (R1.4).
2. Scene renders with PBR + HDR/IBL + post-processing (R2.1/R2.2), holds ≥50 fps mid-tier with graceful degrade (R2.3/R2.4).
3. Hands are GLTF-rigged animated shapes with recorded licensing (R3.1/R3.2) — or the recorded primitive fallback (R3.3).
4. Resolution has physics-backed juice, reduced-motion-safe (R4.1/R4.3), physics off the result path (R4.2).
5. Full round loop over all 9 combos (R5.1); zero-install build clean (R5.2/NFR1); a11y fallback path works to WCAG 2.1 AA (R5.3/NFR3).
6. No monetization anywhere (NFR2). Unit tests + ?dev accuracy harness green (NFR6).

## 5. Effort attribution & scope
Per-feature effort (S=1 / M=3 / L=5 / XL=8):

| Feature | Note | Size | Points |
|--------|------|------|--------|
| F1 | Gesture engine — free-flick capture + confidence + accuracy harness (the differentiator) | L | 5 |
| F2 | 3D render — PBR + HDR/IBL + post-processing + perf tiers | L | 5 |
| F3 | Assets + rigged GLTF hands + animation (biggest unknown) | L | 5 |
| F4 | Physics / juice — fixed-timestep, reduced-motion-safe | M | 3 |
| F5 | Game shell + round machine + zero-install + a11y | M | 3 |

- **effort.total = 21** (vs the shipped card's 10 — this is the from-scratch maxxed bar).
- **effort.scope[requirements] = 21** — the design back-step baseline (deep GROWTH_FACTOR = 3.0 → design trips a back-step only if scope[design] > 63).
- **Back-step check:** scope[requirements]=21 vs scope[investigate]=3. Requirements is not gated against investigate by the growth heuristic (requirements sets the baseline). No back-step at this step.

## 6. DEEP-DEPTH FAN-OUT (decision raised — orchestrator resolves)
depth=deep → the pipeline MAY fan out to child cards (deep budget: max_child_cards ≤ 8, effort_ceiling ~40, addenda proactive). The investigation explicitly recommends **fanning F1 (gesture engine) out as its own child card** so the hard part flows the ladder deeply, with F2–F5 as sibling(s). effort.total=21 is UNDER the deep ceiling (~40), and this is **genuine new scope, not creep** → the sanctioned positive path is to FAN OUT, not back-step. Recommended split:
- **Child A — F1 gesture engine** (the differentiator; deep, its own design/impl/review).
- **Child B — F2+F3+F4 3D/assets/physics render stack** (bounded library integration + perf/asset gate).
- **Child C — F5 shell + a11y** (thin; could fold into B if the orchestrator prefers ≤2 children).

**This is a Decision Gate entry** (see §8). Because filing child issues requires `gh` write authority on the owned repo (an orchestrator/handoff action) and this inline run carries read/write/shell only, the fan-out is **RECOMMENDED and RECORDED for the orchestrator's post-gate handoff**, not executed here — the requirements doc stays coherent as a single spec that the orchestrator can split into child tickets at the gate-spec handoff.

## 7. Open questions carried to gate-spec (human)
1. **Fan-out shape:** approve the 3-child split (A/B/C), a 2-child split (A + BCF5), or keep it one card? (deep budget allows up to 8 children.)
2. **Classifier fork (R1.5):** any steer toward learned vs rule-based, or leave it fully to design?
3. **Asset strategy (R3.2):** is authoring minimal rigs acceptable, or must we source pre-rigged licensed GLTF hands? (biggest schedule unknown.)
4. **Perf floor (R2.3/NFR4):** is ≥50 fps mid-tier the right bar, or should we set a concrete target device?

## 8. Decision Gate — RAISED (fan-out under deep budget)
- **kind:** scope-drift (positive / sanctioned growth) + capability-gap (child-ticket handoff)
- **raised_by:** requirements (spec-agent)
- **question:** "card-rps3d-max requirements decompose into F1–F5 (effort 21, under the deep ceiling ~40). Fan out into child cards (recommended: A=gesture, B=render+assets+physics, C=shell+a11y) or keep as one card?"
- **options:** [ {id:a, note:"3-child fan-out A/B/C", risk:"3 issues to manage, but each hard part flows deeply"}, {id:b, note:"2-child (gesture | rest)", risk:"render stack stays chunky"}, {id:c, note:"single card", risk:"the differentiator (F1) doesn't get its own deep ladder — lower-res build"} ]
- **recommendation:** (a) — the deep budget exists precisely to make the differentiator flow its own ladder; F1 as a child is the high-res path.
- **action:** split (fan-out) — **deferred to the orchestrator's post-gate handoff** (requires `gh` issue-create authority not present in this inline runtime). Requirements step does not itself open child issues.
- **confidence:** high (that fan-out is right); the exact child count is the human's call at gate-spec.
- **resolution status:** the fan-out is a HANDOFF action, not a blocker on producing the requirements artifact. The requirements artifact is complete and coherent; step_status may be set `done` and the card advances to gate-spec (human), where this decision is presented. The step is NOT left blocked on it.

## Runtime note (crew routing)
The task requested `select_crew('dlcyolo-rps3d-spec')` → run THROUGH the crew. This KiroCrew subagent runtime carries **read/write/shell only — no `select_crew`/`spawn_run` MCP tools**. Per the pipeline-workflow skill's M1 rule ("if it lacks crew-routing tools, PERFORM the step inline with the step agent — never fake a crew run or hang"), crew routing to `dlcyolo-rps3d-spec` was **flattened to inline reasoning in that crew's spec-agent persona**. The crew is confirmed present in the registry (`kirocrew agent list`). Stayed within the owned repo. Ended on a terminal `step_status='done'` — no dangling pending.
