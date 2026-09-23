# Tasks — card-rps3d-fixgame ("Fix the game")

**Card:** card-rps3d-fixgame · **Issue:** [#33](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/33)  
**Branch:** `dlc/pl-rps3d/card-rps3d-fixgame/fix-the-game` @ `5607aac`  
**Scope band:** M — bounded, behavior-preserving repair  
**Resolved direction:** (a) make it demonstrably playable: reproduce + fix on-screen defects (framing, gesture confidence, objects/hands asset mismatch) + add regression test on the untested render/boot surface.  
**Gate input for:** `gate-impl`  
**Input consumed from:** requirements.md + design.md (both verified on disk)

---

## Pre-condition (verify before starting)

```
cd /home/haid/.dlc-yolo/workspaces/default/worktrees/card-rps3d-fixgame
git rev-parse --abbrev-ref HEAD   # must == dlc/pl-rps3d/card-rps3d-fixgame/fix-the-game
npm test                           # must be green before any change
npm run build                      # must be clean before any change
```

---

## Task List

All tasks run in the leased worktree at `/home/haid/.dlc-yolo/workspaces/default/worktrees/card-rps3d-fixgame`.  
Tasks are sequential; do not start T-n before T-(n−1) is verified green.  
No new runtime dependency may be added (INV-2). Every new test must be headless via the `wireGame` / `WireDeps` DI seam (INV-4).

---

### TASK 1 — Baseline: reproduce defects + record defect log (FR-1)
**Effort:** S (pure observation — no code change)  
**Files touched:** none (produces a defect log note for the review artifact)

1. Run `npm run build` and confirm the build is clean.  
2. Run `npm test` and confirm all tests pass.  
3. Start the dev server (`npm run dev` or `npm start`) and open the game.  
4. Record:
   - Is the thrown object centred / correctly framed on the first render?  
   - Does a real flick resolve, or does a low-confidence badge appear?  
   - Does any orphaned artefact appear (e.g. CC-BY credit)?  
5. If the environment cannot serve (e.g. no display), document that visual criteria will be confirmed at review; the headless test suite (T4–T7) is still required.  
6. Attach the reproduction note to the implement/review result artifact.

**Done when:** Build clean, tests green, defect log recorded (or "visual deferred to review" documented).

---

### TASK 2 — Remove the orphaned hand-rig dead code (FR-2)
**Effort:** S  
**Files modified:**
- `src/render/hands.ts` — **delete the entire file**
- `public/assets/hands/hand.glb` — **delete**
- `public/assets/hands/LICENSE.md` — **delete**
- `src/main.ts` — remove the `GltfHandRig` import and the `if (hands instanceof GltfHandRig) { ... CC-BY credit ... }` block inside `onRigLoaded`

**Why:** `loadHands()` / `GltfHandRig` are never reached on the shipped boot path (boot wires `loadObjects` → `RpsObjectRig`). The `instanceof GltfHandRig` branch in `onRigLoaded` is therefore permanently false and dead. Removing it makes the code reflect shipped reality (INV-5: behavior-preserving — the live object-player path is unchanged).

**Concrete steps:**

1. Delete `src/render/hands.ts`:
   ```
   git rm src/render/hands.ts
   ```

2. Delete the hand asset files:
   ```
   git rm public/assets/hands/hand.glb public/assets/hands/LICENSE.md
   ```
   (If `public/assets/hands/` is now empty, `rmdir public/assets/hands` and `git rm -r public/assets/hands`.)

3. In `src/main.ts`:
   - Remove the import line: `import { GltfHandRig, type HandRig } from './render/hands';`
   - Remove the block inside `onRigLoaded` callback passed to `wireGame`:
     ```typescript
     // DELETE this block:
     if (hands instanceof GltfHandRig) {
       const credit = document.createElement('div');
       credit.className = 'asset-credit';
       credit.innerHTML = '...';
       app.appendChild(credit);
     }
     ```
   - The variable `hands` is still used in the render loop (`hands.setShape(...)`), so keep its declaration and assignment; only remove the `GltfHandRig` type annotation and replace with `HandRig | null` using the interface already imported from `types.ts` (or from `objects.ts` if `HandRig` is re-exported there). Check imports.
   - Verify: after edit, no remaining reference to `GltfHandRig` or `hands.ts`.

4. Run `npm run build` — must compile cleanly (no missing-module error).  
5. Run `npm test` — suite must still be green.

**Acceptance assertion:** `grep -r 'GltfHandRig\|loadHands\|hands\.ts\|hand\.glb' src/ public/` returns nothing.

---

### TASK 3 — Confirm framing code path (FR-3) — source audit only
**Effort:** S  
**Files touched:** none (unless a defect is found)

1. Read `src/render/framing.ts` and confirm `computeRigScale(diameter)` returns a normalising scale factor and `computeFraming`/`frameObject` positions the camera against the tighter of vertical/horizontal half-angle.  
2. Read the `wireGame` call in `src/main.ts` `boot()`:
   - `loadObjects(bootTier)` returns an `RpsObjectRig` (check `objects.ts`)
   - `measureThreeRig(rig.object)` measures the loaded object's AABB
   - `computeRigScale(radius * 2)` normalises to on-screen size
   - `applyScale(object, scale)` sets `object.scale.setScalar(scale)`
   - `measureThreeRig` is called again to re-measure after scaling
   - `frameObject(center, radius)` is called on the post-scale measurement
3. If the chain is intact, document "framing chain verified at code level" in the review artifact — visual confirmation is deferred to review.  
4. If a code-level gap is found (e.g. `frameObject` receives pre-scale measurement), apply a minimal fix and add a headless assertion in T6.

**Done when:** Either "chain verified — no change" documented, or a bounded fix is applied and covered by T6.

---

### TASK 4 — Confirm gesture-confidence UX path (FR-4) — source audit + threshold check
**Effort:** S  
**Files touched:** none (unless a reproduced defect is found in T1)

1. Read `src/config.ts` — note `confidenceThreshold` (should be 0.2).  
2. Read `src/round/machine.ts` — confirm the `lowConfidence` phase is reachable when `result.confidence < cfg.confidenceThreshold`.  
3. Read `src/main.ts` `render(s)`:
   - Confirm `if (s.phase === 'lowConfidence')` sets the badge text and unhides `badgeEl`.  
4. If T1 reproduced a concrete confidence defect (e.g. badge never appears, threshold too high), apply a **bounded** fix (adjust `confidenceThreshold` or the classifier's score normalisation) and add a headless assertion in T6.  
5. If no defect was reproduced, document "confidence UX verified at code level — no change".

**Constraint:** Do not re-tune without a reproduced defect (FR-4 out-of-scope clause).

---

### TASK 5 — Confirm existing tests still cover the wireGame seam (pre-flight for T6)
**Effort:** S

1. Run `npm test -- --reporter verbose 2>&1 | grep -E 'PASS|FAIL|wireGame|harness'`.  
2. Identify which test files exercise the `wireGame` / `WireDeps` seam (`src/gesture/harness.ts`).  
3. Read those tests to understand the existing mock shapes (`MockScene`, `MockCamera`, etc.) so T6 uses the same patterns — do NOT invent new incompatible mocks.

---

### TASK 6 — Write the boot-wiring integration tests (FR-5 + FR-2 + FR-3)
**Effort:** M (new test file or additions to existing harness test)  
**Files modified:** `src/gesture/harness.test.ts` (or a new `src/main.test.ts` if that file doesn't exist yet)

Add four headless assertions that guard the shipped boot wiring end-to-end.  
All use the DOM/WebGL-free `wireGame(WireDeps)` DI seam from `src/main.ts`.

**Test 1 — boot wires both input paths to the same machine.submit sink (FR-5)**

```typescript
it('wires gesture engine and a11y fallback to the same machine.submit', () => {
  let engineCallback: ((r: GestureResult) => void) | null = null;
  let fallbackCallback: ((r: GestureResult) => void) | null = null;

  const mockEngine: WireEngine = {
    onResult(cb) { engineCallback = cb; },
  };
  const mockMachine = { submit: jest.fn() };

  wireGame({
    scene: makeWireScene(),
    loadHands: () => Promise.resolve(makeWireRig()),
    engine: mockEngine,
    fallbackOnResult: (submit) => { fallbackCallback = submit; },
    machine: mockMachine,
    measureRig: () => ({ center: [0, 0, 0], radius: 1 }),
  });

  // Both callbacks must be wired to the SAME submit sink
  const result: GestureResult = { shape: 'rock', confidence: 0.9 };
  engineCallback!(result);
  fallbackCallback!(result);

  expect(mockMachine.submit).toHaveBeenCalledTimes(2);
  expect(mockMachine.submit).toHaveBeenNthCalledWith(1, result);
  expect(mockMachine.submit).toHaveBeenNthCalledWith(2, result);
});
```

**Test 2 — rig is added to the scene + measured + scaled + framed on load (FR-5 + FR-3)**

```typescript
it('adds the rig to the scene and frames it on load', async () => {
  const mockScene = makeWireScene();
  const mockRig = makeWireRig();
  let frameCallArgs: [[number, number, number], number] | null = null;

  mockScene.frameObject = (center, radius) => {
    frameCallArgs = [center, radius];
  };

  let applyScaleObject: unknown = null;
  let applyScaleValue = 0;

  const { loaded } = wireGame({
    scene: mockScene,
    loadHands: () => Promise.resolve(mockRig),
    engine: { onResult: () => {} },
    fallbackOnResult: () => {},
    machine: { submit: jest.fn() },
    measureRig: () => ({ center: [0.1, 0.2, 0.3], radius: 2.5 }),
    applyScale: (object, scale) => {
      applyScaleObject = object;
      applyScaleValue = scale;
    },
  });

  await loaded;

  expect(mockScene.scene.add).toHaveBeenCalledWith(mockRig.object); // rig added
  expect(applyScaleObject).toBe(mockRig.object);                     // scale applied
  expect(applyScaleValue).toBeGreaterThan(0);                        // scale is positive
  expect(frameCallArgs).not.toBeNull();                              // frameObject called
  expect(frameCallArgs![0]).toEqual([0.1, 0.2, 0.3]);               // center forwarded
  expect(frameCallArgs![1]).toBeCloseTo(2.5, 1);                    // radius forwarded
});
```

**Test 3 — onRigLoaded is called and contains no GltfHandRig dead branch (FR-2 + FR-5)**

```typescript
it('calls onRigLoaded callback after load and frame (post-FR-2: no dead GltfHandRig branch)', async () => {
  const onRigLoaded = jest.fn();

  const { loaded } = wireGame({
    scene: makeWireScene(),
    loadHands: () => Promise.resolve(makeWireRig()),
    engine: { onResult: () => {} },
    fallbackOnResult: () => {},
    machine: { submit: jest.fn() },
    measureRig: () => ({ center: [0, 0, 0], radius: 1 }),
    onRigLoaded,
  });

  await loaded;

  expect(onRigLoaded).toHaveBeenCalledTimes(1);
  // Post-FR-2: the GltfHandRig dead-branch is removed; if main.ts still references GltfHandRig
  // this import will fail at module load, catching any regression.
  // (Import of src/main.ts above this test implicitly asserts no GltfHandRig import remains.)
});
```

**Test 4 — full suite must stay green after FR-2 dead-code removal**

This is not a new test — it's a mandate: run `npm test` after T2 and confirm no existing test references `hands.ts` / `GltfHandRig`. If any test does, update that test to use the `WireDeps` mock pattern instead.

**Done when:**
- All four new assertions pass headlessly.
- `npm test` is fully green.
- No test imports `src/render/hands.ts` or references `GltfHandRig`.

---

### TASK 7 — Commit + push all changes to the lease branch (results_in_repo=true)
**Effort:** S  
**Files touched:** state.json mirror (repo-local copy)

1. Mirror the results artifacts to the repo:
   ```
   mkdir -p .dlc-yolo/card-rps3d-fixgame
   cp /home/haid/.dlc-yolo/workspaces/default/data/results/card-rps3d-fixgame/tasks.md .dlc-yolo/card-rps3d-fixgame/tasks.md
   ```

2. Stage all changes (dead-code removals + new tests + mirror):
   ```
   git add src/ public/ .dlc-yolo/
   git status   # review — confirm no secrets, no unintended files
   ```

3. Commit:
   ```
   git commit -m "fix(rps3d): remove dead hand-rig path + add boot-wiring integration tests

   FR-2: Remove src/render/hands.ts, public/assets/hands/hand.glb,
         public/assets/hands/LICENSE.md and the dead GltfHandRig branch in
         onRigLoaded (src/main.ts). The shipped player is always RpsObjectRig;
         the hand-rig path was inert and orphaned.

   FR-5: Add wireGame DI-seam integration tests asserting the boot wires
         gesture engine + a11y fallback to the same machine.submit sink,
         the rig is scene.add-ed + measured + scaled + framed, and
         onRigLoaded is invoked post-load (no dead GltfHandRig branch).

   All changes are behavior-preserving for the shipped object-player path (INV-5).
   Full suite green. INV-1..INV-5 verified."
   ```

4. Push to the lease branch by explicit name:
   ```
   git push origin dlc/pl-rps3d/card-rps3d-fixgame/fix-the-game
   ```
   (Never push to main/master. Never bare `git push`. Never `--force`.)

5. Verify the push succeeded: `git log --oneline -3`.

**Done when:** Commit on disk, push confirmed.

---

## Scope, effort, and invariant summary

| Task | FR | Files | Effort |
|------|----|-------|--------|
| T1 — Reproduce defects | FR-1 | none | S |
| T2 — Remove dead hand-rig code | FR-2 | `hands.ts`, `hand.glb`, `LICENSE.md`, `main.ts` | S |
| T3 — Framing code audit | FR-3 | none (or minimal fix) | S |
| T4 — Confidence UX audit | FR-4 | none (or bounded threshold fix) | S |
| T5 — Existing harness pre-flight | FR-5 | none | S |
| T6 — Boot-wiring integration tests | FR-5 + FR-2 + FR-3 | `harness.test.ts` (or new `main.test.ts`) | M |
| T7 — Commit + push | all | `.dlc-yolo/` mirror, git | S |

**Total scope: M (1×M + 5×S)**

### Invariant check per task

| Invariant | T2 | T4 | T6 |
|-----------|----|----|-----|
| INV-1 F1-first | ✓ dead code only | ✓ no decision-logic change | ✓ machine.submit is the single sink |
| INV-2 zero new dep | ✓ removes asset | ✓ | ✓ only existing seam |
| INV-3 tiers/motion | ✓ untouched | ✓ | ✓ |
| INV-4 headless seam | n/a | n/a | ✓ wireGame DI only |
| INV-5 behavior-preserving | ✓ RpsObjectRig path unchanged | ✓ | ✓ |

---

## Acceptance (gate-impl checklist)

- [ ] T1: Defect log exists (visual or "deferred to review" documented)
- [ ] T2: `grep -r 'GltfHandRig\|loadHands\|hands\.ts\|hand\.glb' src/ public/` returns nothing
- [ ] T3: Framing chain verified at code level (or bounded fix applied + covered)
- [ ] T4: Confidence UX verified at code level (or bounded fix applied + covered)
- [ ] T6: Four new headless assertions pass — boot wiring, rig scene-add + frame, onRigLoaded, suite green
- [ ] T7: Commit on lease branch, push confirmed, build clean

**Definition of done:** Full `npm test` suite green, clean build, all items above checked.

---

*Tasks artifact produced: 2026-09-24T00:41:00+03:00*  
*Scope band: M · Design commit consumed: requires.md + design.md (verified on disk) · No crew passes (pass_allocation.crew_passes=0)*
