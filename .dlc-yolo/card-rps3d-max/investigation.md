# Investigation — card-rps3d-max (issue #6)

**Title:** MAXXED-UP 3D Rock-Paper-Scissors — full rebuild from scratch with real 3D libraries
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #6 · **Pipeline:** pl-rps3d
**Step:** investigate · **Persona:** dlcyolo-rps3d-market (crew routing flattened inline — see runtime note)
**Trust:** autonomous · **Depth:** standard · **Approach:** enhanced

## 1. Classification (triage)
- **Type:** feature (from-scratch rebuild, not a bug/chore).
- **Relation to prior work:** DISTINCT card from the shipped `card-rps3d` (issue #4 / PR #5 merged — minimal Three.js + trainless rule-based classifier). This is a **greenfield rebuild** on branch `feat/rps3d-maxxed`, not an iteration. Implement MUST build on that branch, never main.
- **Rough size:** **L→XL**. A from-scratch high-spec 3D build (PBR/HDR/post-processing + GLTF rigs + a physics lib + a richer gesture classifier) is materially larger than the shipped showcase (which was total effort 10). Expect this to fan out under the enhanced/standard budget.
- **Proposed GitHub labels:** `dlc:investigate` (already applied) — keep. No type-relabel needed; `enhancement` optional but the pipeline drives off `dlc:*` so no action required.

## 2. Scope decomposition (feeds requirements/budget)
Distinct feature clusters the maxxed rebuild implies (each a plausible child-card under the enhanced budget, max_child_cards≤3 standard):
- **F1 — Gesture engine (motion classifier).** The genuinely hard, differentiating part. Richer than the shipped trainless rule-based classifier: free-flick capture + confidence, possibly a small learned classifier. **Size L.** This is where the "cool" lives and the highest technical risk.
- **F2 — 3D render pipeline.** Three.js + PBR materials + HDR/IBL environment + post-processing (bloom, SSAO, tone mapping) via `postprocessing`/EffectComposer. **Size L.** Mostly integration of well-trodden libs; risk is perf budget (post-processing + physics on a browser frame).
- **F3 — Assets + animation.** Real GLTF hand rigs for rock/paper/scissors with skeletal or morph-target animation (vs low-poly placeholders). **Size M–L.** Risk: sourcing/licensing rigged GLTF hands, or authoring them; largest *unknown* on the asset side.
- **F4 — Physics / juice.** Rapier (WASM) or cannon-es for throw impact, particles, screen shake, camera choreography. **Size M.** Adds a WASM/physics dependency and a fixed-timestep loop.
- **F5 — Game shell + a11y.** Round state machine, result resolution, zero-install dev shell, accessible fallback (carry the button-fallback pattern from the shipped card). **Size S–M.**

## 3. Viability / money go-no-go (market addendum)
Reaffirming the #4 verdict against the higher-spec scope:
- **As revenue: NO-GO.** Browser 3D motion-gesture RPS has no retention loop, no meaningful ad surface, no defensible monetization. Going higher-spec does not change the economics — it *raises* the cost side without creating a revenue side. Non-goal "no monetization" in the issue is correct and stays.
- **As a showcase / portfolio / tech-demo: STRONG GO.** This is the honest purpose. The maxxed rebuild is a *better* showcase than the minimal card precisely because the hard, impressive parts (real-time gesture recognition + juicy PBR/physics 3D) are foregrounded. High demo value for a cybersecurity-architect/ML-researcher portfolio: the gesture classifier is a legitimate small-ML / signal-processing artifact.
- **Where the value concentrates:** F1 (gesture engine) is the differentiator and the interesting engineering; F2–F4 are impressive but comparatively commodity library integration. Recommend the pipeline invest depth in F1 and treat F2–F4 as bounded integration work — resist gold-plating the render before the gesture feels right.
- **Cost/risk flags to carry forward:** (a) asset sourcing for rigged GLTF hands (F3) is the biggest schedule unknown; (b) post-processing + physics + skeletal anim together can blow the frame budget on low-end browsers — needs a perf gate at design; (c) a *learned* classifier adds a training-data/tooling burden with unclear payoff over a well-tuned rule-based one — flag as an explicit design fork, do not assume learned.

## 4. Recommendation to the next step (gate-research → requirements)
- **GO** as a showcase; proceed to gate-research (human) then requirements.
- **Library set decided at design**, per the issue — do NOT lock Rapier-vs-cannon or learned-vs-rule-based here.
- Suggest requirements/budget **fan out F1 (gesture) as its own child card** under the enhanced budget so the hard part flows the ladder deeply, with F2–F5 as a second card — keeps the build high-res rather than one card relabeled through every stage. (Decision for the orchestrator at requirements, not forced here.)

## Effort attribution
- `effort.scope[investigate] = 3` (classification + viability + 5-cluster decomposition; richer than the shipped card's investigate=2 because this is a from-scratch scope read).

## Runtime note (crew routing)
The task requested `select_crew('dlcyolo-rps3d-market')` → run THROUGH the crew. This KiroCrew subagent runtime carries **read/write/shell only — no `select_crew`/`spawn_run` MCP tools**. Per the pipeline-workflow skill's M1 rule ("if it lacks crew-routing tools, PERFORM the step inline with the step agent — never fake a crew run or hang"), crew routing to `dlcyolo-rps3d-market` was **flattened to inline reasoning in that crew's market/viability persona**. The crew is confirmed present in the registry (`kirocrew agent list`). Ended on a terminal `step_status='done'` — no dangling pending.

## Decision Gate
NOT raised at investigate. The one consequential fork (learned-vs-rule-based classifier, library set) is explicitly deferred to design by the issue itself; surfacing it here would be premature. Investigation cleanly serves the stated intent.
