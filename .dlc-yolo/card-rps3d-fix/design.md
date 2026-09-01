# Design — Game visually broken: green-cylinder hand, no camera framing, dead gesture input

- **Card:** card-rps3d-fix
- **Pipeline:** pl-rps3d (enhanced, self-enabling)
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Issue:** [#13](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/13)
- **Type:** bug (runtime/render + input regression)
- **Depth:** deep · **Trust:** autonomous
- **Authored by:** design step (`dlcyolo-rps3d-design` crew, `dlcyolo-authoring` profile — run inline, see Capability note)
- **Grounded on:** fresh read-only clone at owned-repo `main` HEAD `719c6eb` — the shipped `card-rps3d`
  game the user sees broken (`test/main.test.ts` does not exist; `public/assets/hands/hand.glb` is the
  15104-byte Khronos RiggedSimple). Design decisions below cite the actual source read this run.

## 0. Design goals (traceability)

Each requirement maps to a concrete, behavior-preserving change plus a RED-on-`719c6eb` /
GREEN-on-fix regression test. The RPS **rules** (`src/rules.ts`) and the classifier's **scoring
intent** are preserved; the fixes are surgical and target the three player-visible defects plus the
meta root cause (untested boot/render surface).

| Req | Change | Guarding test |
|-----|--------|---------------|
| R1 | `GltfHandRig` rejects a non-hand skeleton → RiggedSimple falls to `PrimitiveHandRig` | R6.1 |
| R2/NFR5 | Reconcile `LICENSE.md` + gated CC-BY credit to the shipped (primitive) asset state | R6.1 assertion + provenance review |
| R3 | Injectable `fitCameraToObject` + `normalizeRigScale`, called on load and `resize()` | R6.2 |
| R4 | Capture-onset tuning + confidence recalibration; optional common-mass trim (winner-preserving) | R6.3 |
| R5 | Primitive + a11y fallback unchanged; existing 41 tests stay green | full suite |
| R6 | Add `test/main.test.ts` (boot seam) + the three defect-class tests | R6.4 |

## 1. Resolved forks (the requirements' open questions, decided here under trust=autonomous)

The requirements step surfaced three open questions for gate-spec and recommended a direction for
each. The human approved gate-spec (`gate-spec → design`, 2026-09-01T04:10:40Z) without overriding,
so design adopts the recommended directions and records them:

- **Q1 — R1 direction → REJECT-TO-PRIMITIVE (not source a new asset).** Make `GltfHandRig` refuse a
  non-hand skeleton so RiggedSimple falls through the ladder to `null` and `loadHands` returns
  `PrimitiveHandRig`. Rationale: (a) `PrimitiveHandRig` already renders three correct, distinct
  hand-like poses (palm box + three finger capsules with per-shape extension) — it is a *correct*
  crude hand, not a bar; (b) zero new licensing risk (NFR1) — no `.glb` to source/vet; (c) preserves
  the `HandRig` interface, the `clips → morph → bones → null` ladder, and the `LICENSE.md` gate
  exactly; (d) sourcing a real rigged-hand `.glb` with RPS clips/morphs is a genuine upgrade but is a
  *separate* feature (a follow-up backlog card), not a bug-fix — coupling it here would inflate scope
  and re-open the asset-vetting gate. **The bug is "ships a bar"; the minimal correct fix is "stop
  shipping the bar," i.e. fall back to the primitive that already works.** A licensed real-hand asset
  is parked to `dlc-backlog` for a future upgrade card.

- **Q2 — R4 lever order → onset/segmentation + margin recalibration FIRST; common-mass trim only if
  needed and winner-preserving.** Lowest risk to the passing corpus. See §4.

- **Q3 — R6 scope → keep all four tests (R6.1–R6.4).** They are the point of the deep-depth repair;
  the boot smoke (R6.4) is the test that would have caught this class of defect originally.

## 2. R1 — reject the non-hand skeleton (defect 1: the green bar)

**Root cause (source-confirmed, `src/render/hands.ts`):** `findFingerBones(root)` collects a node if
`isBone === true` **OR** its name matches `/finger|index|middle|thumb|ring|pinky|bone/`. RiggedSimple
has 2 generic skinned joints (`isBone===true`), so `findFingerBones().length > 0` → the ladder picks
`poseStrategy='bones'`; `setShapeBones` then rotates those 2 joints by `curlFor` (±1.4 rad) →
a **bending bar**. The interface + ladder are correct; the *acceptance test for "bones"* is too
loose — it accepts any skeleton, including a non-hand one.

**Change — tighten the `bones` acceptance in the capability ladder (design §3.4 "primitive floor"):**

Introduce a **hand-plausibility gate** on the `bones` branch. `findFingerBones` stays as-is (it
gathers candidate bones), but the ladder only *accepts* `bones` when the skeleton is plausibly a hand:

- add `private static isHandSkeleton(bones: THREE.Object3D[]): boolean` returning true only when the
  bones look finger-like — the decision rule (design-fixed, testable):
  - **at least one bone whose name matches the finger name-regex** (`/finger|index|middle|thumb|ring|pinky/`,
    note: **drop the generic `bone` token** from the hand-plausibility check so a skeleton named only
    `Bone`/`Bone.001` — RiggedSimple — does NOT qualify), **OR**
  - **≥ `MIN_FINGER_BONES` (=3) bones** present (a real hand rig exposes ≥3 finger chains; a 2-joint
    demo skeleton like RiggedSimple does not clear this).
- `tryLoad` ladder becomes: `clips → morph → (bones AND isHandSkeleton) → null`. RiggedSimple has 2
  generic `Bone`-named joints → matches neither the finger-name rule nor the ≥3 count → `bones`
  rejected → `tryLoad` returns `null` → `loadHands` ships `PrimitiveHandRig`.

Why a count/name gate and not a mesh-shape heuristic: it is deterministic, cheap, DOM-free, and
**unit-testable via the existing injectable `GltfLoadFn` seam** (hand-build a synthetic 2-generic-bone
gltf → expect `tryLoad === null`; a synthetic 5-finger-named gltf → expect a `GltfHandRig` with
`poseStrategy='bones'`). No WebGL needed. `MIN_FINGER_BONES` is a named module const so a future real
asset can be validated against it.

**Interface / ladder / contract:** unchanged. `PrimitiveHandRig`, `loadHands(tier)` signature, and the
`clips`/`morph` branches are untouched. This is a strict tightening of one branch's acceptance test —
the FORK-3 "recorded downgrade to primitive when no usable GLTF" path the code already documents.

## 3. R2 / NFR5 — provenance + credit reconciliation (the asset is no longer shipped for its pose)

With Q1, RiggedSimple's `hand.glb` is **no longer used to pose the hand** (the primitive rig ships).
Two reconciliation paths — design picks **(A) keep the asset file, correct its status**, because the
file itself remains a valid CC-BY-4.0 redistributable and deleting it is unnecessary churn:

- **`public/assets/hands/LICENSE.md`:** update the RiggedSimple row's **Status** from
  "shipped / active hand rig" to **"present but NOT used as the active rig (rejected by the hand-
  plausibility gate; retained for a future real-hand upgrade — see backlog)"**. Provenance
  (source URL, CC-BY-4.0, redistributable=Yes) stays accurate. **No orphaned/false provenance row**
  (NFR5 acceptance).
- **`src/main.ts` + `style.css`:** the CC-BY visible-credit `<div class="asset-credit">` is already
  gated behind `h instanceof GltfHandRig`. Once the primitive ships, `h` is a `PrimitiveHandRig`, so
  **the credit correctly does not render** — CC-BY attribution is only required while the asset is
  actually displayed, and it no longer is. No code change strictly required, but the design **verifies
  this branch** (R6.1 can assert `loadHands(MID)` returns a `PrimitiveHandRig`, i.e. not a
  `GltfHandRig`, so the credit path is inert). Keep the credit wiring in place (harmless, and it
  re-activates correctly if a future upgrade card ships a real-hand `GltfHandRig`).

**NFR1 (licensing) satisfied by construction:** no new asset is committed; the retained asset already
has clean recorded provenance; the shipped rig is a code-only primitive (no license).

## 4. R3 — camera framing + rig scale normalization (defect 2: clipped model)

**Root cause (source-confirmed, `src/render/scene.ts` + `src/main.ts`):** `createScene` hard-codes
`camera.position.set(0,1.2,4.5)` / `lookAt(0,0.6,0)` for a ~1-unit primitive; `resize()` updates
**only** `camera.aspect`; `main.ts` does `scene3d.scene.add(h.object)` with **no per-rig scale**.
Nothing fits the camera to the loaded object or normalizes its size. (The primitive fits *by luck* of
its authored size; any rig with different extents clips.)

**Change — add a pure, injectable framing helper + normalize the rig, and call both on load + resize.**

New module `src/render/framing.ts` (pure math, no WebGL, unit-testable):

```ts
// Fit a perspective camera so `target`'s world-AABB fills the frame with a margin.
// Pure geometry: returns the camera distance + a recentred look-at; the caller applies them.
export interface FramingInput {
  fovDeg: number;          // camera.fov
  aspect: number;          // camera.aspect (w/h)
  boundingRadius: number;  // half the AABB diagonal of the target
  center: [number, number, number];
  marginFactor?: number;   // default 1.25 — headroom so nothing clips
}
export interface FramingResult {
  distance: number;        // camera distance along its current view dir
  lookAt: [number, number, number];
}
export function computeFraming(inp: FramingInput): FramingResult;

// Uniform scale that maps a rig's current AABB diagonal to a target on-screen size.
export function computeRigScale(diagonal: number, targetDiagonal?: number): number; // default target ~2 units
```

- `computeFraming` accounts for BOTH vertical and horizontal FOV (uses the tighter of
  `fov` and `2*atan(tan(fov/2)*aspect)`), so **portrait and landscape** aspects both frame the full
  object (R3 aspect acceptance) — this is the piece `resize()` currently misses.
- **Wiring in `main.ts`:** after `loadHands(...)` resolves and `scene3d.scene.add(h.object)`, compute
  the rig's world AABB (`new THREE.Box3().setFromObject(h.object)`), apply
  `h.object.scale.setScalar(computeRigScale(diagonal))`, recompute the AABB, then call a new
  `scene3d.frameObject(center, radius)` that internally calls `computeFraming` and sets
  `camera.position`/`lookAt`. Re-invoke `frameObject` inside the existing `resize()` (store the last
  framed center+radius on the Scene3D so resize re-frames with the new aspect).
- **`Scene3D` interface gains `frameObject(center, radius)`** (additive; existing callers unaffected).
  `createScene` keeps its current camera as the pre-load default (so boot before the async rig loads
  still shows the ground/scene), then `frameObject` overrides once the rig is in.
- **No hard-coded per-asset constants** (R3 acceptance): distance is derived from the measured AABB +
  FOV + aspect; `marginFactor`/`targetDiagonal` are asset-agnostic tuning consts.

**NFR4 (perf):** `Box3().setFromObject` runs **once on load and once per resize** — not in the RAF
loop. The render loop (`frame`) is unchanged. No new synchronous per-frame work.

## 5. R4 — mouse-flick confidence repair (defect 3: stuck "Low confidence 17%")

**Root cause (source-confirmed, `src/gesture/classifier.ts` + `src/gesture/capture.ts`):**
`confidence = (top − runnerUp) / (top + runnerUp + EPS)`, `LOW_CONFIDENCE_THRESHOLD = 0.2`. In
`score()`, `rock` and `paper` both carry `(1 − reversalStrength) * 0.4` **plus** their axis/sharp
terms, so for a real flick the top-1 and top-2 scores sit close → small margin → `confidence < 0.2`.
`DEFAULT_CAPTURE.onsetSpeed = 0.35` px/ms with `pointermove`-only sampling segments a real flick into
short/partial windows whose features are weak, compounding it. **Constraint (R4): preserve the RULES
and the classifier's scoring INTENT — which shape wins on the existing corpus must not change.**

**Levers, applied in the Q2-decided order (each with a guard):**

1. **Capture onset tuning (lowest risk — no scoring change).** Lower `DEFAULT_CAPTURE.onsetSpeed`
   `0.35 → 0.28` px/ms and raise `releaseMs` `90 → 120` so a deliberate flick is captured as ONE
   coherent window instead of fragmenting. This strengthens the *features* fed to `score()` (clearer
   dominant axis, truer reversal count) → the correct shape's raw score rises → the **margin widens
   with no change to `score()` at all**. Guarded by re-running the existing `segment` unit tests
   (windows must not over-merge) + the harness gate.
2. **Confidence normalization / threshold recalibration (no winner change).** The margin formula
   `(top − runnerUp)/(top + runnerUp)` is conservative because the denominator includes both scores.
   Change the denominator to `top + EPS` (i.e. `confidence = (top − runnerUp) / (top + EPS)`) — a
   **relative-drop-from-the-winner** margin that is strictly ≥ the old value and never reorders shapes
   (it is a monotonic rescale of the same `top − runnerUp` gap). This alone lifts genuine throws above
   0.2 without touching `score()` or which shape wins. `LOW_CONFIDENCE_THRESHOLD` stays `0.2`
   (recalibrate to `0.18` ONLY if the harness shows residual borderline windows — documented if used).
3. **Common-mass trim (only if 1+2 insufficient; winner-preserving — guarded).** If, after 1+2, the
   harness still shows a class of genuine throws below threshold, reduce the *shared* `(1 −
   reversalStrength) * 0.4` term that rock and paper BOTH carry to `* 0.3` (equal reduction on both,
   so their **relative order is unchanged** — it only shrinks the common floor that compresses the
   margin). **Hard guard:** this may ship ONLY if `test/harness.test.ts` still passes the ≥85% overall
   and ≥75% per-shape gates AND the per-shape argmax on every existing fixture is unchanged (add an
   assertion that the winning shape per fixture is identical pre/post — that is the mechanical
   "scoring intent preserved" proof). If it would flip any fixture's winner, it is NOT applied.

**Behavior-preserving proof obligation (R4 constraint):** the shipped change must keep the existing
gesture/harness suite green AND (for lever 3, if used) prove argmax-per-fixture invariance. Lever 1+2
are winner-neutral by construction (feature-quality + monotonic-rescale); lever 3 is gated on the
invariance assertion. `src/rules.ts` and shape semantics are untouched.

## 6. R6 — close the untested boot/render surface (the meta fix)

Four tests, each **RED on `719c6eb`** and **GREEN after the fix**, using DOM-free seams:

- **R6.1 — asset-strategy / hand-plausibility guard** (`test/hands.test.ts`, extends existing):
  - synthetic 2-generic-`Bone` gltf via injected `GltfLoadFn` → `GltfHandRig.tryLoad(...)` resolves
    **`null`** (RED today: returns a `bones` rig); and `loadHands`-equivalent path yields a
    `PrimitiveHandRig` (assert `!(rig instanceof GltfHandRig)`).
  - synthetic 5-finger-**named** gltf → `tryLoad` resolves a `GltfHandRig` with
    `poseStrategy==='bones'` (proves the gate accepts a *real* hand skeleton — no false negative).
- **R6.2 — framing math** (`test/framing.test.ts`, new, pure): `computeFraming` for a known AABB +
  fov + aspect returns a distance that keeps the AABB within the frustum (assert the projected extents
  ≤ frame with the margin) for BOTH a landscape and a portrait aspect; `computeRigScale` maps a large
  and a small diagonal to the target size. RED today: no such module/logic exists (framing is
  hard-coded), so the "full object visible at aspect X" property is unprovable on `719c6eb`.
- **R6.3 — gesture-confidence regression** (`test/gesture.test.ts`, extends existing): a small corpus
  of representative per-shape flick windows (reuse/extend `fixtures.ts`) classifies **above**
  `LOW_CONFIDENCE_THRESHOLD` under the tuned build; the SAME windows fall **below** threshold under a
  faithful reconstruction of the current `(top−runnerUp)/(top+runnerUp)` + `onsetSpeed=0.35` build
  (RED-on-old proof, mirroring the sibling cards' fixture-math discipline). Also assert argmax-per
  existing fixture unchanged (scoring-intent invariance) if lever 3 is used.
- **R6.4 — boot/wiring smoke** (`test/main.test.ts`, new): extract a **testable boot-composition seam**
  from `main.ts`. `main.ts` currently defines `boot()` as one closure that touches `document` + WebGL —
  untestable. Refactor: pull the **wiring** into an exported pure-ish function
  `wireGame(deps)` where `deps` are injected (`makeScene`, `loadHands`, `makeMachine`, `makeEngine`,
  `makeFallback`, DOM elements as minimal stubs) and `boot()` becomes the thin real-DOM adapter that
  calls `wireGame` with real deps. The test injects fakes and asserts: (a) the loaded rig is added to
  the scene (`scene.add` called with `rig.object`); (b) `engine.onResult` → `machine.submit` is wired
  (fire a fake result, assert `submit` received it); (c) the fallback is wired to the same `submit`;
  (d) after load, `frameObject` is invoked with the rig's measured center/radius. **No real WebGL** —
  `makeScene` fake returns a scene stub recording `add`/`frameObject`. This is the test that would have
  caught all three defects at ship time (the meta root cause).

**Seam extraction is behavior-preserving:** `boot()`'s observable runtime behavior is identical; it
simply delegates its wiring to `wireGame(realDeps)`. This is the deep-depth investment: the boot
surface becomes injectable, so "green build, broken screen" cannot recur silently.

## 7. Effort attribution & back-step check

Design implements the requirements 1:1; no new features introduced. Realized design scope tracks the
requirements features:

| ID | Feature | Size | Points |
|----|---------|------|--------|
| f1 | R1 hand-plausibility gate (`isHandSkeleton`, ladder tighten) + R2/NFR5 provenance/credit reconcile | S | 1 |
| f2 | R3 `framing.ts` (`computeFraming`/`computeRigScale`) + `Scene3D.frameObject` + main.ts wiring | S | 1 |
| f3 | R4 capture-onset + confidence recalibration (+ guarded common-mass trim) | M | 3 |
| f4 | R6 `wireGame` seam extraction + four regression tests (R6.1–R6.4) | M | 3 |

- **`effort.scope[design] = 8`** (equals `scope[requirements] = 8` — design added structure, not scope).
- **Back-step check (deep `GROWTH_FACTOR = 3.0`):** predecessor `scope[requirements] = 8`;
  `8 > 3 × 8 = 24`? No → **no back-step**. (Even under `standard` 2.0: `8 > 16`? No.)

## 8. Decision Gate — NOT raised (blocking)

- **Intent-fidelity:** OK — every change targets the issue's real intent ("make the broken showcase
  actually demo") and R6 targets the meta root cause, not just symptoms.
- **Unseen scope:** none architecturally new — the hand-plausibility gate tightens an existing ladder
  branch; framing is a new pure helper wired through the existing load/resize seams; the confidence
  levers stay within the R4-permitted set; `wireGame` is a refactor of existing `boot()` wiring. No new
  runtime dependency (Three's `Box3` is already available). The **one** structural addition — the
  `wireGame` boot seam — is explicitly *required* by R6.4, not unsanctioned scope.
- **Implicit technical fork:** the two real forks (R1 direction, R4 lever order) were surfaced by
  requirements and are **resolved explicitly in §1** with recorded rationale — not decided silently.
  The R1 "defer a real-hand asset to backlog" choice is recorded here and will be parked at the tasks/
  implement step (a `dlc-backlog` issue), not smuggled into this card.
- **Capability-gap:** design authoring fits `dlcyolo-authoring`; the only gap is crew-routing tooling
  (see Capability note), which does not block producing this artifact.
- **Fan-out / budget:** four small/medium features, `8 ≪` deep ceiling (~40) — no fan-out, no child
  cards. One follow-up upgrade idea (real rigged-hand asset) to be parked to backlog at implement.

## 9. Capability note

This design step is crew-assigned to `dlcyolo-rps3d-design` (registry currently points it at
`kiro_agent = dlcyolo-authoring`). The coordinator session that ran this step does **not** hold the
`spawn_run` / `select_crew` MCP tools in its live tool list (this runtime is a KiroCrew subagent
carrying read/write/shell only — the same gap the investigate and requirements steps on this card
recorded, and the same gap the sibling cards' inline runs recorded). Producing `design.md` is an
**authoring** pass fully within `dlcyolo-authoring` scope (read + scoped write) — dispatching the crew
as a subagent is the *mechanism*, not the deliverable. Per pipeline-workflow **PRODUCE-OR-BLOCK** ("a
run that cannot route via a crew performs the step inline … never fakes a crew run, never a false
blocked"), this step was performed **inline as the `dlcyolo-rps3d-design` / authoring persona** — not
faked, not falsely blocked. The routing gap is surfaced as a `capability-gap` decision on the card so
it is visible, not hidden.
