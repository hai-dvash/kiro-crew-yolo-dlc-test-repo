# Investigate — card-rps3d-fix (issue #13)

**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **main HEAD:** `719c6eb` (the shipped
`card-rps3d` game — the maxxed rebuild on `feat/rps3d-maxxed` is NOT in main, confirming
this triage is against the game the user sees broken).
**Persona:** dlcyolo-rps3d-market (readonly). **Trust:** assisted · **Depth:** standard.
**Ownership guard:** PASS — issue #13 author `hai-dvash` (is_bot:false) == gh-auth user.

## 1. Classification

- **Type:** bug (runtime/render + input regression), not a feature.
- **Size:** **M (3 pts)** — three localized fixes across known files; the real cost is the
  missing test surface, not algorithmic difficulty.
- **Affected modules (grounded in files read):**
  - `src/render/hands.ts` — `GltfHandRig` + `loadHands()` (asset defect)
  - `public/assets/hands/hand.glb` + `LICENSE.md` (the wrong asset + its provenance)
  - `src/render/scene.ts` — `createScene()` camera (framing defect)
  - `src/main.ts` — `boot()` render loop, `hands.setShape` drive, pose timing (framing + integration)
  - `src/gesture/capture.ts` `DEFAULT_CAPTURE`, `src/gesture/classifier.ts` `score()`/`classify()` (confidence defect)

## 2. Proposed GitHub labels for #13 (proposals only — assisted = human accepts)

`bug` · `render` · `gesture-input` · `needs-regression-test` · `good-first-scope`
(Do NOT auto-apply under assisted trust.)

## 3. Confirm-or-correct the three diagnosed defects (against real code)

**Defect 1 — green cylinder hand: CONFIRMED.**
`public/assets/hands/LICENSE.md` records `hand.glb` = Khronos **RiggedSimple** (CC-BY-4.0,
1 skin / 2 joint bones). `GltfHandRig.tryLoad` runs the capability ladder clips→morph→bones→null;
RiggedSimple has no named RPS clips and no morph targets, so it falls to `poseStrategy='bones'`
and `findFingerBones` grabs its 2 `isBone` nodes. `curlFor` rotates them ±1.4 rad — which animates
a *bending bar*, not fingers. It renders exactly as the reported green pillar. The interface + ladder
are sound; **the asset is wrong.** Fix must be an asset swap that preserves `HandRig` +
ladder + the `LICENSE.md` NFR5 provenance gate (issue's direction A).

**Defect 2 — no camera framing / scale: CONFIRMED.**
`createScene()` hard-codes `camera.position.set(0, 1.2, 4.5)` / `lookAt(0, 0.6, 0)` for a
~1-unit primitive hand. `resize()` updates only `aspect` — there is **no fit-to-object / bounding-box
framing and no scale normalization** anywhere. `main.ts` adds `h.object` to the scene with no
per-asset scale. RiggedSimple's native extents differ from the primitive, so it clips top+bottom.
Fix: normalize the loaded rig's scale + fit the camera to its bounding box (tier/aspect-agnostic).

**Defect 3 — dead gesture confidence: CONFIRMED, root-caused.**
The path is *wired* (`main.ts`: `engine.attach(canvas)` → `engine.onResult` → `machine.submit`),
so it's not disconnected. The stall is a **confidence-math + capture-tuning** issue:
- `classifier.classify` computes `confidence = (top − runnerUp) / (top + runnerUp)`. `score()`'s
  rock and paper terms share large common mass (`(1−reversalStrength)*0.4`, the sharp/axis terms),
  so top and runner-up sit close together → margin small → `confidence < LOW_CONFIDENCE_THRESHOLD (0.2)`
  → `machine` goes to `lowConfidence` and shows exactly the reported "Low confidence (17%) — throw
  again". 17% is a live-plausible margin from this formula.
- `DEFAULT_CAPTURE.onsetSpeed=0.35 px/ms` with `pointermove`-only sampling (no `pointerdown`
  anchor) means a real mouse flick often segments into short/partial windows whose features are weak,
  compounding the low margin.
Keyboard R/P/S + buttons work because `createFallback` calls `machine.submit` with a synthesized
**high-confidence** result, bypassing the classifier. Fix: restore a usable confidence path
(recalibrate the margin/threshold and/or capture onset) **without** changing the rules or the
classifier's scoring *intent* (issue constraint: behavior-preserving on rules + scoring internals —
so tuning/margin, not a rules rewrite).

**Meta root cause — CONFIRMED:** `src/main.ts` (`boot()` + the `requestAnimationFrame` loop) has
**zero test coverage** (no `test/main.test.ts`; the suite covers classifier/rules/round/hands-in-isolation).
A wrong asset, missing camera-fit, and a low-margin confidence path all ship green because nothing
asserts on the rendered/boot surface.

## 4. Viability / monetization addendum (market persona, folded in)

GO. Viability is already settled for this pipeline: RPS-3D is a **showcase / portfolio piece, not a
revenue play** — that verdict predates this card. There is no monetization gate to re-open here;
this is "repair the broken showcase so it actually demos," which is unambiguously worth doing to
protect the portfolio artifact. No new-product go/no-go applies.

## 5. Recommendation

**GO to requirements/spec.** The spec must nail the **untested render/boot regression surface**:
every fix (asset swap, camera-fit/scale, gesture-confidence) needs at least one test that asserts on
the boot/render/integration behavior the unit suite skipped — otherwise the repair can itself ship
green-but-broken. Behavior-preserving on rules + classifier scoring internals; single owned repo.

## Capability note

This investigate step is crew-assigned to `dlcyolo-rps3d-market` (readonly). The coordinator
session that ran it did **not** have `spawn_run`/`select_crew` in its live tool list, so the crew
could not be dispatched as a subagent. Because investigate is a read-only classification pass fully
within the readonly profile's own scope (read + read-only gh), it was performed **inline as the
market/readonly persona** rather than faked or falsely blocked. Recorded as a `capability-gap`
decision on the card so the routing gap is surfaced, not hidden.
