# Tasks — Game visually broken: green-cylinder hand, no camera framing, dead gesture input

- **Card:** card-rps3d-fix
- **Pipeline:** pl-rps3d (enhanced, self-enabling)
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Issue:** [#13](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/13)
- **Type:** bug (runtime/render + input regression) · **Depth:** deep · **Trust:** autonomous
- **Authored by:** tasks step (`impl-agent` persona, `dlcyolo-authoring` profile — run inline, see Capability note)
- **Grounded on:** fresh read-only clone at owned-repo `main` HEAD `719c6eb`. Every source anchor
  below was re-verified against actual source this run (line numbers cited are from `719c6eb`):
  - `src/render/hands.ts` — `findFingerBones` (`:180`, matches `isBone || /finger|…|bone/` `:185`);
    `tryLoad(url, load: GltfLoadFn = defaultLoad)` (`:190`) accepts `bones` when
    `findFingerBones(gltf.scene).length > 0` (`:196`); ladder `clips→morph→bones→null`; `GltfLoadFn`
    injectable seam (`:107`); `loadHands(tier)` (`:284`) calls `GltfHandRig.tryLoad('assets/hands/hand.glb')`.
  - `src/render/scene.ts` — `createScene` hard-codes `camera.position.set(0,1.2,4.5)` (`:33`) /
    `lookAt(0,0.6,0)` (`:34`); `resize(w,h)` updates only `camera.aspect` (`:49–51`); `Scene3D` iface (`:10`).
  - `src/gesture/classifier.ts` — `confidence = (topScore−runnerUp)/(topScore+runnerUp+EPS)` (`:50–51`);
    `LOW_CONFIDENCE_THRESHOLD = 0.2` (`:41`); `score()` rock/paper share `(1−reversalStrength)*0.4` (`:33,:36`).
  - `src/gesture/capture.ts` — `DEFAULT_CAPTURE.onsetSpeed = 0.35` (`:21`), `releaseMs = 90` (`:23`);
    pure exported `segment` (`:39`); `pointermove`-only listener (`:106`).
  - `src/main.ts` — `boot()` one closure (`:24`); `loadHands(bootTier).then((h) => { scene3d.scene.add(h.object) })`
    with NO per-rig scale (`:54–56`); credit gated on `h instanceof GltfHandRig` (`:59`);
    `engine.onResult((r) => machine.submit(r))` (`:105`); `createFallback((r) => machine.submit(r))` (`:107`).
  - `test/` — `gesture`, `hands`, `harness`, `render-physics`, `round`, `rules` (the 41 tests).
    `test/main.test.ts` and `src/render/framing.ts` are **ABSENT** at `719c6eb` (confirms R6.2 + R6.4 are new/RED).

## Conventions

- **TDD, RED-first where a defect class allows it (R6).** For each defect, write/extend the guarding
  test so it is **RED on `719c6eb`** before applying the fix, then GREEN after. R6.1/R6.3 extend
  existing suites; R6.2/R6.4 add new files.
- **Behavior-preserving core (NFR6 / R4 constraint):** `src/rules.ts` and the classifier's *scoring
  intent* (which shape wins on the existing corpus) MUST NOT change. Lever 3 (§T7) is gated on an
  argmax-invariance assertion and ships ONLY if it holds.
- **Single owned repo, feature branch only.** All work on `hai-dvash/kiro-crew-yolo-dlc-test-repo`;
  push an explicit feature branch `feat/card-rps3d-fix-implement`; NEVER push `main`. `results_in_repo=true`
  → mirror `requirements/design/tasks` (+ an `implement.md` report at implement) into repo-root
  `.dlc-yolo/card-rps3d-fix/`.
- **Gate obligation (T10):** every task's guarding test RED-on-719c6eb / GREEN-on-fix; full suite
  (existing 41 + new) green; `tsc --noEmit` + `vite build` clean.

---

## Task list (atomic, ordered)

### T1 — [R1 · design §2] Hand-plausibility gate: reject a non-hand skeleton to primitive
**File:** `src/render/hands.ts`
- Add module const `MIN_FINGER_BONES = 3` (named, so a future real asset validates against it).
- Add `private static isHandSkeleton(bones: THREE.Object3D[]): boolean` returning true only when the
  candidate bones look finger-like:
  - **at least one bone whose name matches the finger name-regex** — a **narrowed** regex
    `/finger|index|middle|thumb|ring|pinky/` that **drops the generic `bone` token** (so a skeleton
    named only `Bone`/`Bone.001` — RiggedSimple — does NOT qualify), **OR**
  - **`bones.length >= MIN_FINGER_BONES`**.
- Tighten the ladder in `tryLoad` (`:196`): replace
  `if (GltfHandRig.findFingerBones(gltf.scene).length > 0) return new GltfHandRig(gltf, 'bones');`
  with a gated form — collect `const fb = GltfHandRig.findFingerBones(gltf.scene);` then
  `if (fb.length > 0 && GltfHandRig.isHandSkeleton(fb)) return new GltfHandRig(gltf, 'bones');`.
  Ladder becomes `clips → morph → (bones AND isHandSkeleton) → null`.
- **Do NOT change** `findFingerBones` itself (it still *gathers* candidates), the `clips`/`morph`
  branches, the `HandRig` interface, `PrimitiveHandRig`, or `loadHands(tier)` signature. This is a
  strict tightening of ONE branch's acceptance test — the documented "downgrade to primitive when no
  usable GLTF" path.
- **Effect:** RiggedSimple's 2 generic `Bone`-named joints match neither rule → `bones` rejected →
  `tryLoad` returns `null` → `loadHands` ships `PrimitiveHandRig` (the crude-but-correct hand).
**Guarding test:** T2 (R6.1). **Size:** S.

### T2 — [R6.1 · design §6] Asset-strategy / hand-plausibility guard test (RED-first)
**File:** `test/hands.test.ts` (extend)
- Using the injectable `GltfLoadFn` seam (no WebGL):
  - **Synthetic 2-generic-`Bone` gltf** (nodes named `Bone`, `Bone.001`, `isBone:true`, no clips, no
    morph): assert `await GltfHandRig.tryLoad(url, fakeLoad)` resolves **`null`**.
    → **RED on `719c6eb`** (today returns a `bones` rig); GREEN after T1.
  - Assert the `loadHands`-equivalent outcome is a `PrimitiveHandRig`: `expect(rig instanceof GltfHandRig).toBe(false)`.
  - **Synthetic 5-finger-*named* gltf** (nodes `thumb`,`index`,`middle`,`ring`,`pinky`): assert
    `tryLoad` resolves a `GltfHandRig` with `poseStrategy === 'bones'` (no false-negative — the gate
    accepts a *real* hand skeleton).
- Order: write this test and confirm the 2-bone case is RED **before** committing T1.
**Depends on:** none (write first). **Size:** S (part of f4).

### T3 — [R2/NFR5 · design §3] Provenance + credit reconciliation
**File:** `public/assets/hands/LICENSE.md` (+ verify `src/main.ts`/`style.css`, no code change expected)
- Update the RiggedSimple row **Status** → `"present but NOT used as the active rig (rejected by the
  hand-plausibility gate; retained for a future real-hand upgrade — see backlog)"`. Keep source URL,
  `CC-BY-4.0`, `Redistributable=Yes` accurate. **No orphaned/false provenance row** (NFR5 acceptance).
- Verify (do NOT remove) the `main.ts :59` credit `<div class="asset-credit">` — it is gated on
  `h instanceof GltfHandRig`; once the primitive ships, `h` is `PrimitiveHandRig` → credit correctly
  does not render (CC-BY attribution only required while the asset is displayed). Keep the wiring so a
  future real-hand `GltfHandRig` re-activates it. T2's `!(rig instanceof GltfHandRig)` assertion
  proves the credit path is inert.
- **NFR1 satisfied by construction:** no new asset committed; retained asset keeps clean provenance;
  shipped rig is code-only primitive.
**Depends on:** T1. **Size:** S (part of f1).

### T4 — [R3 · design §4] New pure framing module `src/render/framing.ts` (no WebGL)
**File:** `src/render/framing.ts` (new)
- `export interface FramingInput { fovDeg; aspect; boundingRadius; center:[x,y,z]; marginFactor?=1.25 }`
- `export interface FramingResult { distance; lookAt:[x,y,z] }`
- `export function computeFraming(inp: FramingInput): FramingResult` — pure geometry; account for
  BOTH vertical and horizontal FOV (use the tighter of `fov` and `2*atan(tan(fov/2)*aspect)`) so
  portrait AND landscape frame the full object; return camera `distance` along view dir + recentred `lookAt`.
- `export function computeRigScale(diagonal: number, targetDiagonal = ~2): number` — uniform scale
  mapping a rig's AABB diagonal to a target on-screen size. Asset-agnostic; **no per-asset constants**.
**Guarding test:** T5 (R6.2). **Depends on:** none. **Size:** S (part of f2).

### T5 — [R6.2 · design §6] Framing math test (RED-first, new)
**File:** `test/framing.test.ts` (new)
- `computeFraming` for a known AABB + fov + **landscape** aspect AND **portrait** aspect returns a
  distance whose projected extents keep the AABB within the frustum with the margin (assert
  projected half-extent ≤ frame half at that distance for BOTH aspects).
- `computeRigScale` maps a large diagonal and a small diagonal to the target size (bounded assertion).
- **RED on `719c6eb`:** no such module/logic exists (framing hard-coded), so the property is unprovable today.
**Depends on:** T4. **Size:** S (part of f4).

### T6 — [R3 · design §4] `Scene3D.frameObject` + main.ts wiring on load + resize
**Files:** `src/render/scene.ts`, `src/main.ts`
- **`scene.ts`:** add `frameObject(center:[x,y,z], radius:number): void` to the `Scene3D` interface
  (`:10`) and `createScene` return (`:60`). Impl calls `computeFraming({fovDeg:camera.fov, aspect:camera.aspect,
  boundingRadius:radius, center})` and sets `camera.position` (along current view dir at `distance`) +
  `camera.lookAt(...)`. Store the last `{center, radius}` on the Scene3D closure; re-invoke
  `frameObject` inside `resize()` (`:49`) with the stored values so re-frame survives aspect changes.
  Keep the current hard-coded camera as the **pre-load default** (boot before async rig shows the scene).
  Additive — existing callers unaffected.
- **`main.ts` (`:54–56`):** after `loadHands(...)` resolves and `scene3d.scene.add(h.object)`:
  compute `const box = new THREE.Box3().setFromObject(h.object)` → diagonal/center;
  `h.object.scale.setScalar(computeRigScale(diagonal))`; recompute box; call
  `scene3d.frameObject(center, radius)`. (`Box3` already available via Three — no new dependency.)
- **NFR4:** `Box3().setFromObject` runs once on load + once per resize — NOT in the RAF `frame` loop; render loop unchanged.
**Guarding test:** T5 (math) + T9 (R6.4 asserts `frameObject` invoked on load). **Depends on:** T4. **Size:** S (part of f2).

### T7 — [R4 · design §5] Mouse-flick confidence repair (Q2 lever order, each guarded)
**Files:** `src/gesture/capture.ts`, `src/gesture/classifier.ts`
Apply in the design-decided order; each lever is winner-preserving by construction or by guard:
1. **Capture onset tuning (no scoring change).** `DEFAULT_CAPTURE.onsetSpeed 0.35 → 0.28` (`:21`),
   `releaseMs 90 → 120` (`:23`) so a deliberate flick is ONE coherent window. **Guard:** existing
   `segment` unit tests must still pass (windows must not over-merge) + harness gate green.
2. **Confidence denominator rescale (monotonic, no reorder).** In `classify` (`:50–51`) change the
   denominator from `topScore + runnerUp + EPS` to `topScore + EPS` — i.e.
   `confidence = clamp01((topScore − runnerUp) / (topScore + EPS))`. Strictly ≥ the old value, a
   monotonic rescale of the same `top − runnerUp` gap → **never reorders shapes**. `LOW_CONFIDENCE_THRESHOLD`
   stays `0.2` (recalibrate to `0.18` ONLY if the harness shows residual borderline windows — document if used).
3. **Common-mass trim — ONLY if 1+2 insufficient, winner-preserving, HARD-GATED.** Reduce the shared
   `(1 − reversalStrength) * 0.4` that rock AND paper both carry (`:33,:36`) to `* 0.3` (equal
   reduction on both → relative order unchanged). **Ships ONLY if** `test/harness.test.ts` still passes
   ≥85% overall + ≥75% per-shape AND the per-shape **argmax on every existing fixture is unchanged**
   (add the invariance assertion in T8 — the mechanical "scoring intent preserved" proof). If it would
   flip any fixture's winner, **do NOT apply it.**
- `src/rules.ts` and shape semantics untouched.
**Guarding test:** T8 (R6.3). **Depends on:** none (but validate against T8). **Size:** M (f3).

### T8 — [R6.3 · design §6] Gesture-confidence regression + scoring-intent invariance (RED-first)
**File:** `test/gesture.test.ts` (extend), reuse/extend `src/gesture/fixtures.ts`
- Build a small corpus of representative per-shape flick windows (rock chop / paper sweep / scissors
  snip). Assert each classifies **above** `LOW_CONFIDENCE_THRESHOLD` under the **tuned** build.
- Assert the SAME windows fall **below** threshold under a faithful reconstruction of the current
  `(top−runnerUp)/(top+runnerUp)` denominator + `onsetSpeed=0.35` build → **RED-on-old proof**
  (mirrors the sibling cards' fixture-math discipline: the regression must be genuinely locked, not a
  no-op fixture).
- **If lever 3 (§T7.3) is used:** add the **argmax-per-existing-fixture-unchanged** assertion
  (scoring-intent invariance) as the ship gate for that lever.
**Depends on:** T7 (tuned side); reconstruct old side inline. **Size:** M (part of f4).

### T9 — [R6.4 · design §6] `wireGame` boot seam + boot/wiring smoke test (RED-first, new)
**Files:** `src/main.ts` (refactor), `test/main.test.ts` (new)
- **Refactor `boot()` (`:24`) — behavior-preserving.** Extract the WIRING into an exported
  `export function wireGame(deps)` where `deps` are injected: `{ makeScene, loadHands, makeMachine,
  makeEngine, makeFallback }` (+ minimal DOM-element stubs). `boot()` becomes the thin real-DOM adapter
  that calls `wireGame` with real deps. Observable runtime behavior identical.
- **`test/main.test.ts` (new)** injects fakes (a `makeScene` fake returning a scene stub that records
  `add`/`frameObject`; a `loadHands` fake resolving a stub rig with a measurable `object`) and asserts:
  1. the loaded rig is added to the scene (`scene.add` called with `rig.object`);
  2. `engine.onResult → machine.submit` is wired (fire a fake result, assert `submit` received it);
  3. the fallback is wired to the same `submit`;
  4. after load, `frameObject` is invoked with the rig's measured center/radius.
  **No real WebGL.** RED on `719c6eb` (`wireGame`/`test/main.test.ts` do not exist).
- **This is the meta fix** — the one test that would have caught all three defects at ship time.
**Depends on:** T6 (frameObject exists to assert), T1 (rig type). **Size:** M (part of f4).

### T10 — [R5 · full-suite gate] Green gate + no-regression
- Run in the sandbox clone: `npx tsc --noEmit` (exit 0), `npx vite build` (clean), `npx vitest run`
  → **all existing 41 + the 4 new/extended tests green**, including `test/harness.test.ts`'s ≥85%
  overall + ≥75% per-shape gates (R5 no-regression; F1 untouched).
- Confirm each defect's guarding test was **RED on `719c6eb`** and is **GREEN after fix** (T2, T5, T8, T9).
- `vite build` must emit the primitive-path build cleanly; asset file retained (T3) but not driving the rig.
**Depends on:** T1–T9. **Size:** S.

### T11 — [ship] Commit + mirror + push feature branch (implement step)
- Mirror `requirements.md` / `design.md` / `tasks.md` (+ an `implement.md` evidence report) into
  repo-root `.dlc-yolo/card-rps3d-fix/` (`results_in_repo=true`).
- Commit on `feat/card-rps3d-fix-implement`; **push the explicit branch only, never `main`**.
- Re-verify ownership guard live immediately before push (`gh issue view 13` author == gh-auth, state OPEN).
- The orchestrator's `pr` step (not this task) opens the PR (`Closes #13`); single-card scoped.
**Depends on:** T10. **Size:** S.

---

## Backlog to park (at implement, per design §1 Q1 / §8)

- **Real rigged-hand `.glb` upgrade** (a hand mesh/rig with true RPS clips or morphs) — a genuine
  *feature* upgrade, deliberately deferred from this bug-fix to avoid re-opening the asset-vetting
  gate. File as a `dlc-backlog` issue on the owned repo at the implement step (mirrors how card-rps3d-max
  parked #8/#9). NOT part of card-rps3d-fix's scope.

## Effort attribution & back-step check

Tasks decompose the design 1:1 — no new features introduced. Realized tasks scope tracks the design:

| Design feature | Tasks | Size | Points |
|----------------|-------|------|--------|
| f1 — R1 gate + R2/NFR5 reconcile | T1, T3 | S | 1 |
| f2 — R3 framing.ts + Scene3D.frameObject + main wiring | T4, T6 | S | 1 |
| f3 — R4 onset + confidence (+ guarded trim) | T7 | M | 3 |
| f4 — R6 wireGame seam + 4 regression tests | T2, T5, T8, T9 | M | 3 |
| (gate/ship — overhead, not new scope) | T10, T11 | — | 0 |

- **`effort.scope[tasks] = 8`** (= `scope[design] = 8` = `scope[requirements] = 8`; tasks added
  ordering + test-first structure, not scope).
- **Back-step check (deep `GROWTH_FACTOR = 3.0`):** predecessor `scope[design] = 8`; `8 > 3 × 8 = 24`?
  **No → no back-step.** (Even under `standard` 2.0: `8 > 16`? No.)

## Decision Gate — NOT raised (blocking)

- **Intent-fidelity:** OK — tasks realize the design's intent-preserving fixes; T9 (boot smoke) is the
  meta-root-cause guard, not a symptom patch.
- **Unseen scope:** none — every task maps to an existing design section; the two structural additions
  (`framing.ts`, `wireGame` seam) are design-mandated by R3/R6.4, not new. No new runtime dependency
  (`THREE.Box3` already available).
- **Implicit technical fork:** the real forks (R1 direction, R4 lever order) were resolved at design
  §1 and are carried here verbatim; the one conditional (lever 3 common-mass trim) is explicitly
  gated on an argmax-invariance assertion (T7.3/T8), not decided silently.
- **Capability-gap:** authoring `tasks.md` fits `dlcyolo-authoring`; the only gap is crew-routing
  tooling (see Capability note) — non-blocking for producing this artifact.
- **Fan-out / budget:** 8 pts ≪ deep ceiling (~40) — no fan-out, no child cards; one upgrade idea
  parked to backlog at implement.

## Capability note

The `tasks` step's agent is `impl-agent` with **no `crew`** assigned (pipeline `steps[]`), so there is
no crew to route regardless of tooling. Additionally, this KiroCrew subagent runtime carries
read/write/shell only — it does not hold `spawn_run` / `task_run` / `select_crew` in its live tool
list (the same gap the investigate/requirements/design steps on this card recorded, and the sibling
cards' inline runs recorded). Producing `tasks.md` is an **authoring** pass fully within
`dlcyolo-authoring` scope (read + scoped write). Per pipeline-workflow **PRODUCE-OR-BLOCK** ("a run
that cannot route via a crew performs the step inline … never fakes a crew run, never a false
blocked"), this step was performed **inline as the `impl-agent` / authoring persona** — not faked,
not falsely blocked. The Phase-Triggers "Task Runner" option (spawn a `task_run` subagent from
`tasks.md`) is the *implement*-phase mechanism and is likewise flattened to inline when reached; it
does not gate producing the `tasks.md` artifact here. The routing gap is surfaced as a
`capability-gap` decision on the card so it is visible, not hidden.
