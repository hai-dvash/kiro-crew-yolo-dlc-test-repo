# Design — card-rps3d-max (issue #6)

**Title:** MAXXED-UP 3D Rock-Paper-Scissors — full rebuild from scratch with real 3D libraries
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #6 · **Pipeline:** pl-rps3d
**Step:** design · **Persona:** dlcyolo-rps3d-design (design-agent; crew routing flattened inline — see runtime note)
**Trust:** autonomous · **Depth:** deep · **Approach:** enhanced
**Branch:** feat/rps3d-maxxed (implement builds here, never main)
**Grounded on:** requirements.md (F1–F5, acceptance §4), investigation.md (STRONG-GO-as-showcase, invest depth in F1)

## 0. Design intent
Realize the requirements as a concrete, buildable architecture that **foregrounds F1 (gesture engine)** — the authoritative, evaluable, low-latency classifier — while treating F2–F4 (render / assets / physics) as **bounded, tiered library integration behind a perf budget**, and keeping the whole thing zero-install and a11y-complete. The prime directive from investigation stands: *do not gold-plate the render before the gesture feels right.* Design decisions below resolve the three deferred forks (classifier, physics lib, assets) and size the perf gate that was the carried risk from investigation.

## 1. System architecture (module map)

```
                         ┌─────────────────────────────────────────────┐
                         │                main.ts (bootstrap)           │
                         │  wires shell → engines, injects DI config    │
                         └───────────────┬─────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                 │                                │
┌───────▼────────┐              ┌─────────▼──────────┐            ┌────────▼─────────┐
│  F5 GAME SHELL │              │  F1 GESTURE ENGINE │            │  F2 RENDER LAYER │
│  round-machine │◀── result ───│  authoritative     │            │  three-scene     │
│  (xstate-lite) │   (≤100ms)   │  classify pipeline │            │  pbr + ibl + post│
│  a11y fallback │              │  capture→features→ │            │  quality tiers   │
│  reduced-motion│              │  classify→confidence│           └────────┬─────────┘
└───────┬────────┘              └─────────┬──────────┘                     │
        │  drives                          │ emits GestureResult   ┌───────▼──────────┐
        │                                  │  (shape, confidence)  │ F3 ASSETS/ANIM   │
        │                                  ▼                       │ gltf hand rigs   │
        │                        (dev) accuracy-harness ?dev       │ + morph/skeletal │
        │                                                          └───────┬──────────┘
        └───────────── cosmetic-only, off the result path ────────────────┤
                                                                   ┌───────▼──────────┐
                                                                   │ F4 PHYSICS/JUICE │
                                                                   │ fixed-timestep   │
                                                                   │ impact+particles │
                                                                   │ reduced-motion   │
                                                                   └──────────────────┘
```

**Layering rule (the core architectural invariant):** F1 (gesture) is the **authoritative source of truth** for the round result and runs on its own path with a **≤100 ms budget (R1.4)**. F2/F3/F4 (render/assets/physics) are **cosmetic consumers** of the result and MUST NOT be able to delay, block, or alter it. The round-machine (F5) advances on the `GestureResult` event alone; the visual throw is a fire-and-forget animation triggered *after* the result is committed. This is the same decoupling the shipped card proved, hardened for the heavier render.

### Module inventory (source layout on feat/rps3d-maxxed)
```
src/
  main.ts                     # bootstrap + DI wiring (R5.2)
  config.ts                   # QualityTier enum, feature flags, ?dev parse
  rules.ts                    # pure RPS resolution — all 9 combos (R5.1) [PURE, unit-tested]
  gesture/
    capture.ts                # F1: pointer sampling, ring buffer, motion-onset detector (R1.1)
    features.ts               # F1: kinematic feature extraction [PURE, unit-tested] (R1.3)
    classifier.ts             # F1: rule-based classifier + confidence (R1.2/R1.5) [PURE, unit-tested]
    engine.ts                 # F1: orchestrates capture→features→classify, emits GestureResult (R1.4)
    harness.ts                # F1: ?dev accuracy harness vs fixtures (R1.3) [dev-only]
    fixtures.ts               # F1: labeled gesture fixture set for the harness
  round/
    machine.ts                # F5: idle→capture→classify→resolve→replay (R5.1) [unit-tested]
  render/
    scene.ts                  # F2: three renderer, camera, PBR + IBL env (R2.1)
    post.ts                   # F2: EffectComposer — tonemap+bloom(+SSAO by tier) (R2.2)
    tiers.ts                  # F2: quality tier detection + graceful degrade (R2.3/R2.4)
    hands.ts                  # F3: GLTF hand rig loader + pose/morph animation (R3.1) + primitive fallback (R3.3)
  physics/
    world.ts                  # F4: fixed-timestep physics world (rapier) (R4.2)
    juice.ts                  # F4: impact/particles/shake/camera, reduced-motion-gated (R4.1/R4.3)
  a11y/
    fallback.ts               # F5: keyboard R/P/S controls sharing the round path (R5.3)
    motion.ts                 # prefers-reduced-motion detection, feeds juice + tiers
  index.html / style.css      # zero-install shell (R5.2/NFR1)
tests/                        # rules, features, classifier, round machine, harness (NFR6)
public/assets/hands/          # GLTF rigs + LICENSE.md provenance (R3.2/NFR5)
```

## 2. Resolved design forks (the three deferred decisions)

### FORK 1 — Classifier: **rule-based (tuned), NOT learned** [resolves R1.5]
**Decision: well-tuned rule-based kinematic classifier.** Rationale, weighed against a learned baseline per the requirement's explicit "do not assume learned":
- The shipped card already proved a trainless rule-based classifier clears the accuracy bar; the maxxed target (≥85%, R1.3) is reachable by *tuning + a richer feature set + free-flick capture*, not by switching to ML.
- A learned model imports a training-data pipeline, a model artifact in the bundle, and a labeling burden — real cost — for **unclear payoff** on a 3-class kinematic signal that is well-separated in feature space. Investigation flagged exactly this.
- **Evaluability wins either way:** the `?dev` harness (R1.3) measures accuracy on a fixture suite regardless of classifier internals, so the fork is reversible — if tuning stalls below 85%, a learned classifier can slot behind the same `classify(features): GestureResult` interface without touching capture/engine/shell. This keeps the door open (a `dlc-backlog` candidate) without paying the cost now.

**Feature set (features.ts, kinematic):** peak speed, dominant-axis ratio, net displacement vector, direction-reversal count (the scissors discriminator), gesture duration, jerk/onset sharpness. Classifier = thresholded decision over these with a **confidence = margin between top-1 and top-2 shape scores**, normalized 0–1 (R1.2).

**Free-flick capture (capture.ts, resolves R1.1):** replace the shipped rigid press-hold-release with a **motion-onset detector** — a ring buffer samples pointer position continuously; a gesture *starts* when instantaneous speed crosses an onset threshold and *ends* when speed decays below a release threshold for N ms (or max-duration cap). No explicit hold ritual. This is the single biggest UX upgrade over the shipped card and the primary F1 engineering.

### FORK 2 — Physics library: **Rapier (WASM), NOT cannon-es** [resolves R4.2]
**Decision: `@dimforge/rapier3d-compat` (WASM).** Rationale:
- Rapier is actively maintained, deterministic under fixed-timestep (required by R4.2), and markedly faster than cannon-es for the particle/impact counts the juice implies — which matters because F4 shares the frame budget with post-processing and skeletal anim (R2.3 perf gate).
- `-compat` build ships the WASM inline-loadable, preserving zero-install (NFR1) — no separate WASM fetch/CORS setup.
- **Scope guard:** physics is used ONLY for cosmetic juice (impact reaction, debris, camera choreography), never for gameplay logic. It runs on a **fixed 60 Hz accumulator loop decoupled from render**, and is fully **gated off by reduced-motion (R4.3)** and by the low quality tier (below). If Rapier's WASM init proves a perf/size problem at implement, `juice.ts` degrades to a **CSS/tween-only juice fallback** with no physics — a recorded downgrade, gameplay unaffected.

### FORK 3 — Assets: **author minimal rigged primitives first; source licensed GLTF as an upgrade** [resolves R3.2, the biggest unknown]
**Decision: primitive-based rigged hand poses as the v1 baseline (R3.3), with a clean seam to swap in sourced/licensed GLTF hands (R3.1) if sourcing lands in budget.**
- `hands.ts` exposes a single interface `loadHands(tier): HandRig` returning `{ setShape(shape, t) }`. Two implementations behind it: (a) **PrimitiveHandRig** — low-poly boxes/capsules posed per shape via morph-target-like lerp, authored in-repo (zero licensing risk, always ships); (b) **GltfHandRig** — loads a rigged GLTF and drives skeletal/morph animation.
- **Licensing gate (NFR5):** any GLTF that ships MUST land in `public/assets/hands/LICENSE.md` with source + license + redistributability recorded. NO unlicensed asset enters the repo — if we cannot record clean provenance, we ship PrimitiveHandRig and file the GLTF sourcing as a `dlc-backlog` upgrade.
- This makes F3 (the "biggest schedule unknown") **non-blocking**: the card is always shippable on primitives; GLTF is a strict visual upgrade behind the same interface.

## 3. Perf budget & quality tiers (sizes R2.3/R2.4 — the carried risk gate)
The investigation demanded a **perf gate at design** because post-processing + physics + skeletal anim together can blow the frame budget. Design answer: a **3-tier quality ladder** auto-selected at boot and downgradable at runtime, holding **≥50 fps mid-tier (NFR4)**.

| Tier | Trigger | Post-processing | Physics | Hands | Target |
|------|---------|-----------------|---------|-------|--------|
| **HIGH** | discrete GPU / high FPS probe | tonemap + bloom + SSAO | Rapier full particles | GLTF skeletal (if present) | ≥60 fps |
| **MID** *(the NFR4 bar)* | default mid-tier laptop | tonemap + bloom (no SSAO) | Rapier reduced particle count | GLTF or primitive | **≥50 fps** |
| **LOW** | integrated GPU / low FPS probe / reduced-motion | tonemap only | physics OFF (tween juice) | primitive | ≥30 fps, never stutter gameplay |

- **Boot detection (tiers.ts):** WebGL renderer-string heuristic + a short FPS probe over the first ~30 frames on an idle scene. **Runtime degrade:** a rolling FPS monitor drops a tier (bloom→off, SSAO→off, physics→tween) *before* frame-drops become visible (R2.4) — effects downgrade, gameplay never stutters.
- **reduced-motion (a11y/motion.ts) forces LOW-ish behavior for juice** regardless of GPU: screen shake off, particles off, camera choreography minimized (R4.3) — but keeps PBR/IBL static beauty. a11y and perf share the same tier plumbing.

## 4. Data contracts (the seams that keep F1 authoritative)
```ts
// gesture/engine.ts — the ONE authoritative event the shell consumes
type Shape = 'rock' | 'paper' | 'scissors';
interface GestureResult {
  shape: Shape;
  confidence: number;      // 0..1, margin-based (R1.2)
  lowConfidence: boolean;  // confidence < THRESHOLD → badge + allow re-throw, no silent guess (R1.2)
  latencyMs: number;       // gesture-end → result; asserted ≤100 in dev harness (R1.4)
}
// rules.ts — PURE, the only gameplay authority
function resolve(a: Shape, b: Shape): 'a' | 'b' | 'draw';  // all 9 combos (R5.1)
// render + physics subscribe to GestureResult AFTER the round-machine commits it — read-only, cosmetic.
```
The a11y fallback (fallback.ts) emits the **same `GestureResult`** (confidence=1, lowConfidence=false) into the **same round path** (R5.3) — one code path, no gameplay divergence between gesture and button input.

## 5. Requirement → module coverage matrix
| Req | Covered by | Note |
|-----|-----------|------|
| R1.1 free-flick capture | gesture/capture.ts (motion-onset) | primary F1 upgrade |
| R1.2 confidence, no silent guess | classifier.ts + round/machine.ts + a11y badge | margin-based confidence |
| R1.3 ≥85% accuracy harness | gesture/harness.ts + fixtures.ts (?dev) | evaluability surface |
| R1.4 ≤100 ms, decoupled | engine.ts path + layering invariant §1 | asserted in harness |
| R1.5 classifier fork | FORK 1 → rule-based, seam kept for learned | reversible |
| R2.1 PBR + HDR/IBL | render/scene.ts | env map IBL |
| R2.2 post-processing | render/post.ts (EffectComposer) | tonemap+bloom+SSAO by tier |
| R2.3 ≥50 fps budget | render/tiers.ts | MID tier = the bar |
| R2.4 graceful degrade | render/tiers.ts runtime monitor | effects downgrade first |
| R3.1 GLTF rigs | render/hands.ts GltfHandRig | upgrade path |
| R3.2 licensing recorded | public/assets/hands/LICENSE.md gate | NFR5 |
| R3.3 primitive fallback | render/hands.ts PrimitiveHandRig | always ships |
| R4.1 juice | physics/juice.ts | impact/particles/shake |
| R4.2 physics lib + fixed-step | FORK 2 → Rapier, physics/world.ts | off the result path |
| R4.3 reduced-motion safe | a11y/motion.ts gates juice | tween fallback |
| R5.1 round machine 9 combos | round/machine.ts + rules.ts | pure resolution |
| R5.2 zero-install build | Vite+TS, main.ts | tsc + vite build clean |
| R5.3 a11y fallback WCAG AA | a11y/fallback.ts | shares round path |
| NFR1 zero-install | Vite scaffold | npm i && npm run dev |
| NFR2 no monetization | (omission) | coverage-by-absence |
| NFR3 a11y playable | fallback + reduced-motion | WCAG 2.1 AA controls |
| NFR4 perf | tier ladder §3 | ≥50 mid, ≤100ms |
| NFR5 asset licensing | LICENSE.md gate | no unlicensed assets |
| NFR6 testability | tests/ + ?dev harness | deep → adversarial review |

**Every F1–F5 requirement and NFR maps to a concrete module.** NFR2 is covered by absence (no monetization module exists).

## 6. Effort attribution & back-step check
Realized design scope (component count × size, consistent with the requirements point currency S=1/M=3/L=5):

| Feature | Design modules | Size | Points |
|--------|----------------|------|--------|
| F1 gesture | capture + features + classifier + engine + harness + fixtures (6 modules, the differentiator, deepest) | L | 5 |
| F2 render | scene + post + tiers (3 modules + tier ladder) | L | 5 |
| F3 assets | hands.ts (dual impl + licensing gate) | L | 5 |
| F4 physics | world + juice (fixed-step + reduced-motion) | M | 3 |
| F5 shell+a11y | main + config + rules + round/machine + a11y/fallback + a11y/motion | M | 3 |

- **effort.scope[design] = 21** — held **FLAT** vs `scope[requirements] = 21`. The design elaborates the F1–F5 clusters into modules 1:1 without introducing new features; the fork resolutions (rule-based / Rapier / primitive-first) *reduce* risk rather than add scope.
- **Back-step check (deep, GROWTH_FACTOR = 3.0):** back-step trips only if `scope[design] > 3.0 × scope[requirements] = 63`. `21 ≤ 63` → **NO back-step.** Design did not outgrow requirements; the deep budget is respected (effort 21 < ceiling ~40).

## 7. Decision Gate — NOT raised at design
The three consequential forks the requirements explicitly deferred to design (classifier R1.5, physics lib R4.2, asset strategy R3.2) are **resolved here with recorded rationale in §2** — that is the design step doing its job, not an unresolved fork to escalate. The perf gate (the carried risk) is **sized in §3** (tier ladder), not left open. No new unsanctioned scope was introduced (scope held flat at 21), so no scope-drift gate. No implicit consequential choice remains hidden. The design cleanly serves the stated intent (foreground F1, bound F2–F4, ship-safe fallbacks everywhere). **Gate correctly skipped.**

**Note on the still-open fan-out (dec-rps3dmax-fanout from requirements):** that Decision Gate entry — fan out F1/F2–F4/F5 into child cards under the deep budget — is a **handoff/orchestrator action requiring `gh` issue-create authority**, unchanged by this design step. This inline runtime carries read/write/shell only (no issue-create-as-child-card handoff machinery), so the fan-out remains **RECORDED and pending the orchestrator's post-gate handoff**, exactly as requirements left it. This design.md is written to be **fan-out-friendly**: the module map (§1) is already cleanly partitioned along F1 / F2+F3+F4 / F5 lines, so if the orchestrator later splits into child cards A/B/C, each child inherits its own coherent slice of this design without a rewrite. Producing the design artifact is not blocked on the fan-out.

## 8. Risks carried forward to tasks/implement
1. **Rapier WASM init cost/size** (F4) — if it hurts NFR1/perf, fall back to tween juice (recorded, §2 FORK 2).
2. **GLTF sourcing/licensing** (F3) — primitive rig always ships; GLTF is a strict upgrade behind the interface (§2 FORK 3).
3. **≥85% accuracy on free-flick** (F1) — richer capture is less constrained than press-hold, so tuning the onset/release thresholds + feature weights is the real implement risk; the `?dev` harness is the guardrail and the rule-based/learned seam is the escape hatch (§2 FORK 1).
4. **Frame budget with all effects on** (F2+F3+F4) — the tier ladder (§3) is the mitigation; MID (the NFR4 bar) deliberately drops SSAO and reduces particles.

## Runtime note (crew routing)
The task requested `select_crew('dlcyolo-rps3d-design')` → run THROUGH the crew. This KiroCrew subagent runtime carries **read/write/shell only — no `select_crew`/`spawn_run` MCP tools**. Per the pipeline-workflow skill's **M1 rule** ("if it lacks crew-routing tools, PERFORM the step inline with the step agent — never fake a crew run or hang"), crew routing to `dlcyolo-rps3d-design` was **flattened to inline reasoning in that crew's design-agent persona**. The crew is confirmed present in the registry (`kirocrew agent list` → `dlcyolo-rps3d-design`). Ownership guard re-checked at this step: issue #6 author `hai-dvash` == gh-auth user (trusted). Stayed within the owned repo throughout. Ended on a terminal `step_status='design'='done'` — no dangling pending. Repo-root `.dlc-yolo` mirror (results_in_repo=true) DEFERRED — repo not cloned in this sandbox; the implement/pr step mirrors + commits on feat/rps3d-maxxed as it did for the shipped card.
