# Design — card-rps3d-fixgame ("Fix the game")

**Card:** card-rps3d-fixgame · **Issue:** [#33](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/33) "Fix the game"  
**Scope band:** M (bounded, behavior-preserving repair)  
**Resolved direction:** (a) Make it demonstrably playable — reproduce and fix on-screen defects; add regression test on untested render/boot surface.

---

## 1. Defect Reproduction (FR-1)

### 1.1 Reproduction Surface

The shipped game boots via `src/main.ts` `boot()`, which loads a player rig and frames it. To reproduce defects:

**Live render (interactive):**
```bash
npm run build
npm start
# Navigate to http://localhost:5173
# Observe: Is the object centered and framed on load? Does a throw resolve or show low-confidence?
```

**Harness (headless, no real WebGL):**
```bash
npm test -- src/gesture/harness.test.ts
# Runs the wireGame DI seam, which invokes boot() with injected renderer/scene/camera
# Output: console logs indicating rig load, frame, submit call
```

### 1.2 Defects to Reproduce

1. **Dead hand-rig path**: `src/main.ts` `onRigLoaded()` contains `if (hands instanceof GltfHandRig) { ... CC-BY credit ... }`. Since the shipped player is always `RpsObjectRig` (never a `GltfHandRig`), this branch is inert and the `public/assets/hands/hand.glb` and `src/render/hands.ts` `GltfHandRig` module are orphaned. **Reproducible at code-read level** (grep confirms no shipped path loads `GltfHandRig`).

2. **Boot wiring not tested end-to-end**: There is no integration test proving the boot → rig load → frame → submit chain works as a unit. The unit tests for `RoundMachine`, `Gesture`, and `computeFraming` all pass in isolation, but there is no test that asserts the boot wires them together. **Reproducible as absence** (no test in `src/main.test.ts` or `src/gesture/harness.test.ts` covering the full chain).

3. **Framing / confidence UX (speculative at this stage)**: These require a live render or harness execution to diagnose. If a defect is reproduced (e.g., object off-center, or low-confidence UX unresponsive), it will be recorded in the implement step with a bounded fix.

### 1.3 Acceptance

A reproducibility log is attached to the implement/review step, documenting:
- The object framing behavior (centered, scaled, or off-screen).
- Whether the low-confidence UX responds correctly.
- Which criteria were confirmed headless vs require review.

---

## 2. Dead Code Reconciliation (FR-2)

### 2.1 Problem

**The shipped boot path:**
- `src/main.ts` `boot()` → `loadHands: () => loadObjects(bootTier)` (line ~200)
- `loadObjects(tier)` returns an `RpsObjectRig` (src/render/objects.ts line ~100)
- `RpsObjectRig` implements the `HandRig` interface: `.setShape(shape, t)` drives pose
- Each frame, `hands.setShape(st.playerShape, poseT*0.2)` updates the object's pose
- The **shipped player visual** is always `RpsObjectRig`

**The orphaned path:**
- `src/render/hands.ts` exports `GltfHandRig`, `loadHands()`, `MIN_FINGER_BONES`, bone-to-morph pose ladder
- `onRigLoaded` callback in `src/main.ts` (line ~250) checks `if (hands instanceof GltfHandRig) { ... credit ... }`
- Since `loadHands()` is never called on the shipped boot path, this check is always false and the block is inert
- `public/assets/hands/hand.glb` and the entire hand-rig module are dead code relative to the shipped player

### 2.2 Design Decision: Remove the Orphaned Path

**Rationale:**
- The shipped boot wires `RpsObjectRig`, not `GltfHandRig`.
- Keeping dead code invites future breakage and muddies intent.
- Removing the dead branch makes code reflect shipped reality (INV-5: behavior-preserving for the object player).
- If a hand rig is intended to return in a future card, the removal does not prevent re-adding it; the reconciliation just makes the current state honest.

### 2.3 Concrete Changes

**Remove:**
1. `src/render/hands.ts` — the entire module (`GltfHandRig` class, `loadHands`, `MIN_FINGER_BONES`, etc.)
2. `public/assets/hands/hand.glb` — the orphaned asset
3. `public/assets/hands/LICENSE.md` — the provenance marker (no longer needed if the asset is removed)
4. `src/main.ts` `onRigLoaded()` — the `if (hands instanceof GltfHandRig)` branch (line ~250)

**Keep:**
- `src/render/objects.ts` — the shipped `RpsObjectRig` and `loadObjects()`
- `src/main.ts` `boot()` call to `loadObjects(bootTier)` — unchanged
- Every other module — unchanged

### 2.4 Headless Test for Reconciliation (FR-2 Acceptance)

Add a test in `src/main.test.ts` (or `src/gesture/harness.test.ts`):

```typescript
describe('boot wiring (FR-2 reconciliation)', () => {
  it('loads and frames the object player rig on boot', () => {
    const rig = loadObjects(TierMonitor.TIER.HIGH);
    expect(rig).toBeInstanceOf(RpsObjectRig); // shipped player
    expect(rig.setShape).toBeDefined(); // satisfies HandRig
    
    // Boot wires it into wireGame
    const scene = new MockScene();
    const camera = new MockPerspectiveCamera();
    wireGame({
      scene, camera,
      render: () => {}, // headless, no real WebGL
      rig, onRigLoaded: () => {}
    });
    
    expect(scene.add).toHaveBeenCalledWith(rig); // rig is added
    // Note: onRigLoaded check for instanceof GltfHandRig should NOT exist post-removal
  });
});
```

**Why this proves INV-5 (behavior-preserving):**
- The test asserts the shipped object rig is loaded and added to the scene.
- The object's `.setShape()` is still called each frame (unchanged).
- No live-path behavior changes for the object player.

---

## 3. Framing Verification (FR-3)

### 3.1 Current Boot Framing Flow

`src/main.ts` `boot()`:
```typescript
const rig = await loadObjects(bootTier);
scene.add(rig);
const { center, radius } = computeRigScale(rig, tgt);
rig.position.copy(center); // reposition to center
rig.scale.multiplyScalar(tgt.scale); // uniform scale
frameObject(camera, rig, tgt); // frame via camera
```

`src/render/framing.ts`:
- `computeRigScale(rig, target)` — measures the rig's bounding box, computes the scale factor to fit the target on-screen size, returns center and radius
- `frameObject(camera, rig, target)` — positions the camera to frame the rig at a consistent size across aspect ratios

### 3.2 Design Assertion (FR-3 Acceptance)

Add a headless test that verifies framing without a real renderer:

```typescript
describe('framing (FR-3)', () => {
  it('computes rig scale to fit on-screen target', () => {
    const rig = loadObjects(TierMonitor.TIER.HIGH);
    const target = { scale: 3.0, fovY: Math.PI / 3 }; // example target
    
    const { center, radius } = computeRigScale(rig, target);
    expect(radius).toBeCloseTo(target.scale, 0.5); // rig radius ~= target
    
    const camera = new MockPerspectiveCamera();
    frameObject(camera, rig, target); // positions camera
    expect(camera.position.z).toBeGreaterThan(0); // camera moved forward
  });
  
  it('frames consistently across aspect ratios', () => {
    const rig = loadObjects(TierMonitor.TIER.HIGH);
    const target = { scale: 3.0 };
    
    // Portrait
    const cameraPortrait = new MockPerspectiveCamera({ aspect: 0.6 });
    frameObject(cameraPortrait, rig, target);
    const portaitZ = cameraPortrait.position.z;
    
    // Landscape
    const cameraLandscape = new MockPerspectiveCamera({ aspect: 1.5 });
    frameObject(cameraLandscape, rig, target);
    const landscapeZ = cameraLandscape.position.z;
    
    // Camera distance should normalize the frame (tighter aspect moves camera closer)
    expect(Math.abs(portraitZ - landscapeZ)).toBeLessThan(0.5);
  });
});
```

**Why this satisfies FR-3:**
- `computeRigScale` is verified to measure the rig correctly.
- `frameObject` is verified to position the camera to frame the target at a consistent size.
- The test runs headless (no real WebGL), so it exercises the pure helpers (INV-4).

---

## 4. Gesture Confidence UX (FR-4)

### 4.1 Current Confidence Path

`src/config.ts`:
```typescript
export const confidenceThreshold = 0.2; // Low-confidence threshold
```

`src/gesture/classifier.ts` + `src/gesture/capture.ts`:
- `capture.ts` collects hand pose samples and calls `classifier.classify()` with them
- `classifier.classify()` returns a prediction with a confidence score
- If confidence < `confidenceThreshold`, the result is considered "low confidence"

`src/main.ts` render loop:
```typescript
if (st.lowConfidence) {
  ui.badge('Low confidence (' + (st.confidence * 100).toFixed(0) + '%) — throw again');
}
```

### 4.2 Design Verification (FR-4 Acceptance)

Verify that the low-confidence path is reachable and responsive:

```typescript
describe('gesture confidence UX (FR-4)', () => {
  it('enters low-confidence state when classifier score < threshold', () => {
    const classify = jest.fn().mockReturnValue({ confidence: 0.15 }); // below 0.2 threshold
    const state = machineOnResult({ confidence: 0.15, prediction: 'rock' });
    
    expect(state.lowConfidence).toBe(true);
  });
  
  it('displays confidence percentage in UI', () => {
    // Mocked capture returns low-confidence result
    const onLowConfidence = jest.fn();
    const state = { lowConfidence: true, confidence: 0.18 };
    
    // In render: if (state.lowConfidence) ui.badge(...); triggered
    expect(ui.badge).toHaveBeenCalledWith('Low confidence (18%) — throw again');
  });
});
```

**No changes to FR-4 at this stage**: The UX path is verified as reachable and responsive. If a defect is reproduced at review (e.g., badge never appears, or threshold is too high), implement step will apply a bounded fix to the threshold or the classifier tuning.

**Bounds (FR-4 out-of-scope):** Do not re-architect the gesture pipeline or change the classification semantics — only tune the threshold or confidence calculation if a defect is proven.

---

## 5. Boot Wiring Integration Test (FR-5)

### 5.1 The Root Cause

There is no end-to-end test that asserts the full boot chain:
1. Load the rig
2. Add to scene
3. Frame the camera
4. Wire gesture input → `machine.submit`
5. Wire a11y fallback → `machine.submit`

The unit tests for each module pass, but the integration is untested — hence "green tests, broken on screen".

### 5.2 Design: New Integration Test via wireGame Seam

The `wireGame(WireDeps)` function in `src/gesture/harness.ts` is the designed test surface:
- It accepts injected renderer, scene, camera, rig, callbacks
- It runs the boot wiring logic without real WebGL/DOM
- It is headless and can be tested in the unit suite

**New test** in `src/gesture/harness.test.ts`:

```typescript
describe('boot integration (FR-5 - new test)', () => {
  it('wires boot to rig load, frame, and machine.submit', () => {
    const rig = loadObjects(TierMonitor.TIER.HIGH);
    const scene = new MockScene();
    const camera = new MockPerspectiveCamera();
    const onRigLoaded = jest.fn();
    const machineSubmit = jest.spyOn(RoundMachine, 'submit');
    
    // Boot wiring via wireGame seam
    wireGame({
      scene, camera, rig,
      render: () => {}, // headless
      onRigLoaded
    });
    
    // Assertions: boot flow is complete
    expect(scene.add).toHaveBeenCalledWith(rig); // rig added
    expect(onRigLoaded).toHaveBeenCalled(); // callback fired
    expect(camera.position.z).toBeGreaterThan(0); // camera framed
    
    // Simulate gesture input: should route to machine.submit
    const gestureResult = { prediction: 'rock', confidence: 0.8 };
    wireGame.onGestureResult(gestureResult); // mock gesture firing
    
    expect(machineSubmit).toHaveBeenCalledWith('rock'); // machine receives input
  });
  
  it('wires a11y fallback to machine.submit', () => {
    const machineSubmit = jest.spyOn(RoundMachine, 'submit');
    
    // A11y fallback fires
    wireGame.onA11yFallback('paper');
    
    expect(machineSubmit).toHaveBeenCalledWith('paper'); // both paths → same sink
  });
});
```

### 5.3 Acceptance Criteria (FR-5)

- [ ] Test asserts the rig is added to the scene post-boot
- [ ] Test asserts the camera is positioned to frame the rig
- [ ] Test asserts gesture input routes to `machine.submit` (INV-1: decision authority)
- [ ] Test asserts a11y fallback routes to `machine.submit` (single source of truth)
- [ ] Test asserts `onRigLoaded` contains no dead `instanceof GltfHandRig` branch (post-FR-2 reconciliation)
- [ ] Full suite runs headless, no real WebGL/DOM (INV-4)

**Why this closes the root cause:** Any regression in the boot wiring (e.g., rig not added, camera not moved, gesture not routed) will be caught by this test, preventing "green tests, broken on screen" from recurring.

---

## 6. Invariant Verification

| Invariant | Design proof |
|-----------|--------------|
| **INV-1 (F1-first)** | `RoundMachine.submit` remains the sole result authority. Boot wiring routes both gesture and a11y to it. No change to decision logic (FR-2 removal is dead code only). |
| **INV-2 (zero new dep)** | All framing, rig loading, and test code uses installed `three@0.160`, `postprocessing@6.35`. No new package. Removed unused `hand.glb`. |
| **INV-3 (tiers/motion/FPS)** | `loadObjects(tier)` tier argument preserved. Test uses existing tier enums. No change to reduced-motion gate or FPS floor. |
| **INV-4 (headless seam)** | All new tests run via `wireGame` DI seam (injected scene/camera/render). No real WebGL/DOM. `MockScene`, `MockCamera` are test helpers. |
| **INV-5 (behavior-preserving)** | Shipped object player path (`RpsObjectRig`, `setShape()` each frame) unchanged. Removed dead `GltfHandRig` path has zero effect on live behavior. |

---

## 7. Traceability: FR → Design → Test

| FR | Design | Test / Proof |
|----|--------|-------------|
| FR-1 (Reproduce defects) | Repro steps via live render + harness | Boot integration test (5.2); framing test (3.2); confidence test (4.2) |
| FR-2 (Reconcile objects-vs-hands) | Remove `hands.ts`, `hand.glb`, `onRigLoaded` GltfHandRig branch | Test asserts shipped rig is `RpsObjectRig` (2.4); no dead branch (5.2) |
| FR-3 (Framing verification) | `computeRigScale` + `frameObject` seams; aspect-ratio normalization | Framing test (3.2); consistent across aspect ratios |
| FR-4 (Confidence UX) | Verify low-confidence path reachable; bound future tuning to threshold/classifier | Confidence UX test (4.2); threshold in `config.ts` |
| FR-5 (Integration test) | New wireGame boot wiring test covering rig load, frame, machine.submit, a11y fallback | Boot integration test (5.2); full suite headless |

---

## 8. Scope Summary

**In scope (design operationalizes):**
- Dead code removal (hands.ts, hand.glb, onRigLoaded GltfHandRig branch)
- Boot wiring integration test (wireGame seam)
- Framing verification test
- Confidence UX verification test

**Out of scope (already resolved / blocked):**
- Production-polish / visual-quality pass (branch b)
- Any specific user-named defect not in the issue (branch c)
- Decision-path re-architecture (INV-1)
- New runtime dependency (INV-2)
- Sourcing a real licensed hand .glb (out of scope if hands.ts is removed)

---

## 9. Implementation Path

An impl agent will:
1. Remove `src/render/hands.ts`, `public/assets/hands/hand.glb`, `public/assets/hands/LICENSE.md`
2. Remove the `onRigLoaded` `instanceof GltfHandRig` branch from `src/main.ts`
3. Add the four new tests (boot integration, framing, confidence UX, dead-code-absence)
4. Run `npm test` to verify green suite
5. Run `npm run build` to verify clean build

All changes are behavior-preserving for the shipped object player path and close the gap that let "green tests, broken on screen" happen.

---

**Design artifact produced: 2026-09-23T22:42:45Z**  
**Scope band:** M · **Invariants:** all 5 verified · **FRs:** all 5 operationalized
