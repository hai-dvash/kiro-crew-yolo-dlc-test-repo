# Requirements — Game visually broken: green-cylinder hand, no camera framing, dead gesture input

- **Card:** card-rps3d-fix
- **Pipeline:** pl-rps3d (enhanced, self-enabling)
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Issue:** [#13](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/13)
- **Type:** bug (runtime/render + input regression) — NOT a feature
- **Depth:** deep · **Trust:** autonomous
- **Authored by:** requirements step (spec-agent persona / `dlcyolo-rps3d-spec` crew, `dlcyolo-authoring` profile — run inline, see Capability note)
- **Grounded on:** owned repo `main` HEAD `719c6eb` (the shipped `card-rps3d` game the user sees broken; the maxxed rebuild on `feat/rps3d-maxxed` is NOT in `main`)

## Context (grounded in the actual code, not just the issue text)

The shipped game builds green (tsc clean, vite build ok, 41/41 unit tests) yet renders broken,
because the unit suite exercises the classifier / rules / round machine / rigs **in isolation** and
`src/main.ts` (`boot()` + the `requestAnimationFrame` loop) has **zero test coverage**. Three
defects were confirmed against real source at `main` HEAD `719c6eb`:

### Defect 1 — green-cylinder "hand" (asset)
`loadHands(tier)` (`src/render/hands.ts`) loads `assets/hands/hand.glb`, which
`public/assets/hands/LICENSE.md` records as Khronos **RiggedSimple** (CC-BY-4.0, 1 skin / 2 joint
bones, no named RPS clips, no morph targets). `GltfHandRig.tryLoad` runs the capability ladder
`clips → morph → bones → null`; RiggedSimple falls to `poseStrategy='bones'`. `findFingerBones`
matches on `isBone === true` **or** the name-regex `/finger|index|middle|thumb|ring|pinky|bone/`, so
it grabs RiggedSimple's 2 generic skeleton joints, and `curlFor` rotates them ±1.4 rad — animating a
**bending bar**, i.e. the reported green pillar. The `HandRig` interface + ladder are sound; **the
asset is a demo bar, not a hand.**

### Defect 2 — no camera framing / scale normalization
`createScene()` (`src/render/scene.ts`) hard-codes `camera.position.set(0, 1.2, 4.5)` and
`lookAt(0, 0.6, 0)`, sized for a ~1-unit primitive hand. `resize()` updates **only** `camera.aspect`.
`main.ts` does `scene3d.scene.add(h.object)` with **no per-rig scale**. There is **no
fit-to-bounding-box and no scale normalization anywhere**. Any loaded rig whose native extents
differ from the primitive (RiggedSimple does) clips top + bottom.

### Defect 3 — dead gesture confidence (stuck "Low confidence (17%) — throw again")
The path is **wired**, not disconnected: `main.ts` does
`engine.attach(canvas)` → `engine.onResult((r) => machine.submit(r))`. The stall is
**confidence-math + capture tuning**:
- `classify` (`src/gesture/classifier.ts`) computes `confidence = (topScore − runnerUp) /
  (topScore + runnerUp + EPS)` with `LOW_CONFIDENCE_THRESHOLD = 0.2`. In `score()`, the `rock` and
  `paper` terms **share large common mass** (`(1 − reversalStrength) * 0.4`, plus the sharp/axis
  terms), so the top-1 and top-2 scores sit close → the margin is small → `confidence < 0.2` →
  `machine` enters `lowConfidence` and renders exactly `Low confidence (NN%) — throw again`. 17% is a
  live-plausible margin from this formula.
- `DEFAULT_CAPTURE.onsetSpeed = 0.35` px/ms with `pointermove`-only sampling (no `pointerdown`
  anchor) means a real mouse flick segments into short/partial windows whose features are weak,
  compounding the low margin.
Keyboard R/P/S + on-screen buttons work because `createFallback` submits a **synthesized
high-confidence** result, bypassing the classifier — masking the defect.

### Meta root cause
Wrong asset, missing camera-fit, and low-margin confidence all ship green because **nothing asserts
on the rendered/boot surface**. There is no `test/main.test.ts`; the render loop and rig-in-scene
wiring are untested. This is the surface the repair MUST close (design constraint below).

## Functional Requirements

- **R1 — The hand reads as a hand, not a bar.** After boot on a non-LOW tier, the on-screen model
  must read as a hand posing rock / paper / scissors — never a rotating cylinder/bar. **Acceptance:**
  the active rig produces three visually distinct, hand-like poses; a `bones`-strategy fall-through
  on a non-hand skeleton (2 generic joints, ±curl on a bar) is not an acceptable shipped state.
  - *Direction (from the issue, confirmed):* **A — replace the asset** with a rig that genuinely
    reads as a hand (a hand mesh with RPS clips/morphs, or a rig whose bones map to fingers), **or**
    make `GltfHandRig` reject a non-hand skeleton so it falls back to `PrimitiveHandRig`. The
    `HandRig` interface, the `clips → morph → bones → null` ladder, and the `LICENSE.md` NFR5
    provenance gate MUST be preserved.

- **R2 — Provenance preserved for any shipped asset (NFR5 gate).** If R1 ships a new/replacement
  `.glb`, its full provenance (Asset / Source URL / License / Redistributable / Status, plus a CC-BY
  attribution string if applicable) MUST be recorded in `public/assets/hands/LICENSE.md` **before**
  the asset is committed. If the RiggedSimple asset is *removed* (R1 via fallback), its
  now-stale provenance row and the visible CC-BY credit wiring in `main.ts`/`style.css` MUST be
  reconciled. **Acceptance:** `LICENSE.md` matches the shipped asset state exactly; no unlicensed or
  orphaned provenance row remains.

- **R3 — The model is framed and correctly scaled at all tiers/aspects.** The loaded rig is
  normalized to a consistent on-screen size and the camera fits it within the viewport (not clipped
  top/bottom) across quality tiers and window aspect ratios. **Acceptance:** on boot and on
  `resize()`, the full rig is visible with reasonable margins for both the primitive and any GLTF
  rig; framing survives portrait and landscape aspects. Implemented via bounding-box fit and/or
  per-rig scale normalization — no hard-coded per-asset camera constants.

- **R4 — Mouse-flick gestures classify with usable confidence.** A deliberate chop / sweep / snip
  mouse flick must classify as rock / paper / scissors above `LOW_CONFIDENCE_THRESHOLD` in the
  common case, so the game is playable **without** the keyboard/button fallback. **Acceptance:** a
  representative set of realistic flick sample windows for each shape classifies above threshold at
  a materially higher rate than the current build; the persistent "Low confidence" stall on genuine
  throws is gone.
  - *Constraint (from the issue):* **behavior-preserving on the RULES and on the classifier's
    scoring INTENT.** Fixes are limited to (a) confidence margin/normalization and/or
    `LOW_CONFIDENCE_THRESHOLD` recalibration, and/or (b) capture onset/segmentation tuning
    (`DEFAULT_CAPTURE`), and/or (c) reducing shared common-mass between shapes in `score()` **only
    insofar as it sharpens the margin without changing which shape wins** for the existing test
    corpus. The RPS rules (`src/rules.ts`) and the shape semantics MUST NOT change.

- **R5 — Fallback and no-regression preserved.** `PrimitiveHandRig` (LOW tier / missing / failed
  GLTF) and the a11y keyboard/button fallback MUST keep working unchanged. The existing 41 unit
  tests (classifier, rules, round machine, rigs, harness ≥85% overall + ≥75% per-shape gates) MUST
  stay green. **Acceptance:** full suite green; primitive path and a11y fallback behavior unchanged.

- **R6 — Close the untested render/boot surface (the meta fix — mandatory, deep).** Add regression
  coverage on the integration surface the unit suite skips, so a green build can no longer hide a
  broken screen. At minimum, one test per defect class:
  - **R6.1** an assertion that the active rig does not silently degrade to a non-hand `bones`
    bar for the shipped asset state (e.g. asset choice yields `clips`/`morph`, or a non-hand
    skeleton is rejected to primitive) — locks R1;
  - **R6.2** a headless test of the framing/scale-normalization logic (bounding-box fit math) that
    fails on the current no-fit `createScene` — locks R3;
  - **R6.3** a gesture-confidence regression: representative flick windows per shape classify above
    threshold under the tuned build and fail under the current build — locks R4;
  - **R6.4** a boot/wiring smoke test of `main.ts` (or an extracted boot-composition seam) that
    exercises rig-add-to-scene + engine→machine wiring without a real WebGL context (inject seams as
    `hands.ts` already does with `GltfLoadFn`).
  **Acceptance:** each of the three player-visible defects has at least one test that is RED on the
  current `719c6eb` build and GREEN after the fix; no fix ships without its guarding assertion.

## Non-Functional Requirements

- **NFR1 — Licensing integrity (hard gate).** Same as card-backlog-8 NFR1: if R1 replaces the asset
  and clean redistributable provenance for the new `.glb` cannot be established, do NOT commit it —
  ship the primitive fallback (R1 via `GltfHandRig` rejecting the non-hand skeleton) and record that
  decision. No unlicensed asset may be committed.
- **NFR2 — No monetization / no revenue path.** Coverage-by-absence: this is a repair to a showcase
  artifact; it introduces no monetization (consistent with the pipeline's settled showcase verdict).
- **NFR3 — Asset weight budget.** Any replacement `.glb` stays within the zero-install web budget
  (target ≤ ~2 MB; Draco/meshopt if larger, documented). **Acceptance:** asset size documented.
- **NFR4 — Perf / non-blocking boot.** The async `loadHands`/`tryLoad` boot path stays non-blocking;
  framing + confidence fixes add no synchronous work to the render loop that would drop the MID tier
  below its ≥50 fps NFR. **Acceptance:** no new synchronous boot-path work; render-loop cost
  unchanged within noise.
- **NFR5 — Provenance file is the source of truth** for the shipped asset (restates R2 as the
  governing gate).
- **NFR6 — Single owned repo, behavior-preserving core.** All work stays within
  `hai-dvash/kiro-crew-yolo-dlc-test-repo` on a feature branch; RPS rules and classifier scoring
  intent are preserved (R4 constraint). No cross-repo writes.

## Effort attribution

| ID | Feature | Size | Points |
|----|---------|------|--------|
| f1 | Replace/repair hand asset (real hand rig **or** reject non-hand skeleton → primitive), preserve `HandRig` interface + ladder + `LICENSE.md` NFR5 gate | S | 1 |
| f2 | Camera fit + per-rig scale normalization (bounding-box, tier/aspect-agnostic) | S | 1 |
| f3 | Gesture-confidence repair (margin/threshold + capture onset tuning), behavior-preserving on rules + scoring intent | M | 3 |
| f4 | Regression coverage on the untested render/boot surface — R6.1–R6.4 (asset-strategy guard, framing math, confidence regression, boot smoke) | M | 3 |

- **effort.total = 8**, `effort.scope[requirements] = 8`.
- **Deep-depth note:** f4 is sized **M (3)** rather than S because the meta root cause (untested
  boot/render surface) is the reason "ships green but broken" happened — deep depth invests in the
  guarding surface, not just the three point fixes.
- **Back-step check (deep `GROWTH_FACTOR = 3.0`):** predecessor `scope[investigate] = 3`;
  `8 > 3 × 3 = 9`? No → **no back-step**. (Under `standard` 2.0 this would trip: `8 > 6`; deep depth
  is deliberately lenient because deep work is expected to expand — the card is depth=deep.)

## Decision Gate — NOT raised

- **Intent-fidelity:** OK — the requirements serve the issue's true intent ("make the broken
  showcase actually demo"), and R6 explicitly targets the meta root cause the issue's symptoms point
  at, not just the three surface symptoms.
- **Unseen scope:** none new architecturally — the `HandRig` interface, ladder, `LICENSE.md` gate,
  the classifier/capture seams, and the injectable `GltfLoadFn` test seam all pre-exist; R6 uses the
  existing seam pattern.
- **Implicit technical fork:** the one real fork (R1: *replace the asset* vs *reject the non-hand
  skeleton to primitive*) is surfaced **explicitly** as R1's two named directions and left to design
  to choose — not decided implicitly here. Likewise R4 lists the three permitted tuning levers
  rather than silently picking one.
- **Capability-gap:** requirements authoring fits `dlcyolo-authoring`; the only gap is crew-routing
  tooling (see Capability note), which does not block producing this artifact.
- **Fan-out / budget:** four small/medium features under the deep budget (ceiling ~40 pts,
  8 ≪ 40) — no fan-out, no child cards.

## Open questions for gate-spec (human) — recorded, NOT blocking under trust=autonomous

Under `trust=autonomous` this step does not stall at these; they are recorded for the human gate and
carry the requirements step's recommendation. Design will pick unless a human interjects.

1. **R1 direction:** *(recommended)* source a genuine licensed hand rig with RPS clips/morphs so the
   GLTF path renders a real hand; **or** the cheaper/safer route — make `GltfHandRig` reject a
   non-hand skeleton (RiggedSimple) so it falls back to `PrimitiveHandRig` (which already reads as a
   crude but correct hand), deferring a real hand asset to a follow-up backlog card.
2. **R4 lever priority:** *(recommended)* start with capture-onset tuning + confidence
   margin/threshold recalibration (lowest risk to the passing corpus) before touching `score()`'s
   shared common-mass.
3. **R6 scope:** confirm all four regression tests (R6.1–R6.4) are in scope for this card vs
   splitting the boot-smoke (R6.4) into a follow-up — recommended: keep all four (they are the point
   of the deep-depth repair).

## Capability note

This requirements step is crew-assigned to `dlcyolo-rps3d-spec` (which the registry currently points
at `kiro_agent = kirocrew`, not `dlcyolo-authoring`). The coordinator session that ran this step does
**not** hold the `spawn_run` / `select_crew` MCP tools in its live tool list (this runtime is a
KiroCrew subagent carrying read/write/shell only — the same gap the investigate step on this card
recorded, and the same gap the sibling cards' inline runs recorded). Producing `requirements.md` is
an **authoring** pass fully within `dlcyolo-authoring` scope (read + scoped write); dispatching the
crew as a subagent is the *mechanism*, not the deliverable. Per pipeline-workflow **PRODUCE-OR-BLOCK**
("a run that cannot route via a crew performs the step inline … never fakes a crew run"), this step
was performed **inline as the `dlcyolo-rps3d-spec` / authoring persona** — not faked, not falsely
blocked. The routing gap is surfaced as a `capability-gap` decision on the card so it is visible, not
hidden.
