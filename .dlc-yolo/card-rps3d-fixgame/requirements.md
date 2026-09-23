# Requirements — card-rps3d-fixgame ("Fix the game")

**Card:** card-rps3d-fixgame · **Issue:** [#33](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/33) "Fix the game"
**Raw intent:** *"i need you to fix my shitty game please"*
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Branch:** `dlc/pl-rps3d/card-rps3d-fixgame/fix-the-game` @ `5607aac` (= main HEAD, clean tree)
**Modes:** trust=assisted · depth=standard · capability=dlcyolo-authoring · scope band **M**
**Resolved direction (authoritative):** intent fork `dec-card-rps3d-fixgame-investigate-intent-fork` → **(a) Make it demonstrably playable** (resolved_by=user). Reproduce and fix on-screen defects (framing, gesture confidence, the objects/hands asset mismatch) and add a regression test on the untested render/boot surface. Branch (b) production-polish and (c) a specific user-supplied defect are **out of scope** by that resolution.

---

## 1. Problem statement

The rps3d game is architecturally sound and green in unit tests (gesture classifier, rules, framing math, and the `wireGame` boot-wiring seam are covered **in isolation**), yet the raw intent flags it as "shitty". The investigation (approved at gate-research) ground-truthed the tree and found the recurring **"green tests, broken on screen"** pattern: the shipped boot path has behavior that no test asserts end-to-end, and one concrete regression sits in the boot wiring. This card is a **bounded, behavior-preserving repair** on a healthy base — not a rewrite, not a quality/art pass.

The single confirmed structural defect and the untested surface both live at the boot/wiring seam:

- `src/main.ts` `boot()` wires the **player** rig via `loadHands: () => loadObjects(bootTier)` → an `RpsObjectRig` (from `src/render/objects.ts`). The object rig satisfies the `HandRig` interface and *is* driven each frame (`hands.setShape(st.playerShape, poseT*0.2)`), so the player visual itself renders.
- But `onRigLoaded` still gates the CC-BY credit on `hands instanceof GltfHandRig`. Because the shipped player is never a `GltfHandRig`, that branch is **inert**, and the entire `src/render/hands.ts` module (`GltfHandRig`, `loadHands`, the `MIN_FINGER_BONES` plausibility gate, the clips→morph→bones pose ladder) plus `public/assets/hands/hand.glb` are **orphaned** relative to the shipped player path — dead/misleading code that muddies art intent and invites future breakage.
- There is **no integration/render-loop test** proving the boot actually wires the object player path, frames it, and feeds both input paths into `RoundMachine.submit`. That gap is the root cause of the whole failure mode.

## 2. Hard invariants (constraints every requirement inherits)

These are preserved, not modified:

- **INV-1 (F1-first).** `RoundMachine.submit()` (`src/round/machine.ts`) is the sole result authority; `pickOpponent()` stays internal to it. Every render/physics/reveal module is a downstream `machine.onChange` consumer. No fix may move decision logic into a cosmetic consumer or gate the result on a cosmetic path.
- **INV-2 (zero new runtime dependency).** All fixes use the installed stack only (`three@0.160`, `three/examples/jsm`, `postprocessing@6.35`, `@dimforge/rapier3d-compat`). No new package.
- **INV-3 (quality tiers + reduced motion + FPS floor).** HIGH/MID/LOW tiers, `prefers-reduced-motion`, and the ≥30 fps LOW floor (`src/render/tiers.ts`, `src/a11y/motion.ts`) remain intact and degrade cleanly.
- **INV-4 (headless test seam).** New coverage must exercise the DOM/WebGL-free `wireGame(WireDeps)` seam and pure helpers (`computeFraming`, `computeRigScale`, the round machine) — no real WebGL/DOM in tests.
- **INV-5 (behavior-preserving).** Observable runtime behavior of the shipped player path is unchanged except where a fix corrects a genuine defect; removing dead code must not alter any live path.

## 3. Functional requirements

### FR-1 — Reproduce and record the on-screen defect(s) with a live run
- **What:** Before any code change, run the game (build + serve, or the `?dev` accuracy harness where a live render is not capturable) and record the actual on-screen state so "fix" has a concrete target. Capture at minimum: object framing on load, low-confidence UX on a real flick, and whether any orphaned hand-asset artifact (e.g. the CC-BY credit) appears.
- **Acceptance:** A defect log (screenshot or, if visual capture is unavailable in the harness environment, a documented `npm run build` + `npm test` result plus an explicit statement of which criteria could only be confirmed at review) is attached to the implement/review step. Any defect NOT reproducible is marked speculative and dropped from scope.
- **Grounds:** investigation §"No runtime proof"; resolved branch (a) "requires live run to discover defects".

### FR-2 — Reconcile the objects-vs-hands asset path (the confirmed regression)
- **What:** The shipped player is `RpsObjectRig`; the `GltfHandRig`/`hand.glb`/CC-BY-credit path is dead relative to it. Resolve the mismatch by making the shipped path self-consistent: remove or quarantine the orphaned hand-rig boot branch and unused asset so the code reflects the actual shipped player, OR (if a hand rig is intended to return) re-wire boot to actually select it. Under branch (a) the default is **remove the dead branch** (make code match shipped reality); the design step decides remove-vs-revert as a design-time detail, not a new human fork.
- **Acceptance (headless, at the `wireGame` seam):**
  - A boot test asserts the loaded player rig is the object rig (satisfies `HandRig`) and is `scene.add`-ed, scaled via `computeRigScale`, and `frameObject`-ed with its measured center/radius.
  - The `onRigLoaded` CC-BY credit branch either (i) is removed with the hand-rig path, so no `instanceof GltfHandRig` dead branch remains, or (ii) is proven reachable if a hand rig is intentionally re-wired. No inert branch may remain silently.
  - No live-path behavior changes for the object player (INV-5).
- **Grounds:** `src/main.ts` `onRigLoaded`; `src/render/objects.ts` `loadObjects`/`RpsObjectRig`; `src/render/hands.ts` `GltfHandRig`/`loadHands`; investigation §"Dead hand-rig / new-asset mismatch (highest-suspicion regression)".

### FR-3 — Confirm player-object framing on load
- **What:** The loaded player object must be framed on-screen at a consistent size across aspect ratios (the `framing.ts` defect class: camera fit, not just aspect update).
- **Acceptance:** Headless assertions that `computeRigScale(diagonal)` normalizes the rig to the target on-screen size and that `wireGame` invokes `frameObject` with the remeasured center/radius after scaling; the pure `computeFraming` continues to frame against the tighter of vertical/horizontal half-angle (portrait + landscape). Plus a visual confirmation at review that the object is not clipped/off-centre.
- **Grounds:** `src/render/framing.ts` (`computeFraming`, `computeRigScale`); `src/main.ts` `wireGame` load→measure→scale→frame chain.

### FR-4 — Confirm gesture-confidence UX reads correctly
- **What:** Real flicks must either resolve or surface an honest low-confidence prompt (not silently stick at an unusably low confidence). This is a live/interaction judgment; the requirement is to verify it and, only if a reproducible defect is found (FR-1), apply a bounded tuning fix within the existing capture/classifier/threshold seams.
- **Acceptance:** The low-confidence path (`RoundMachine` `lowConfidence` phase → `badge` "Low confidence (n%) — throw again", `config.confidenceThreshold = 0.2`) is verified. If no reproducible defect: documented as "confirmed acceptable, no change". If a defect is reproduced: a bounded change with a headless assertion on the classifier/threshold seam and a documented before/after. **No re-tuning without a reproduced defect** (avoids scope creep into branch b).
- **Grounds:** `src/config.ts` `confidenceThreshold`; `src/gesture/classifier.ts`/`capture.ts`; `src/main.ts` render() low-confidence branch; investigation §"Gesture confidence UX".

### FR-5 — Add the missing render/boot integration regression test (the root-cause fix)
- **What:** Close the gap that let "green-but-broken-on-screen" defects ship: add a headless integration test over the `wireGame` seam that asserts the shipped boot wiring end-to-end.
- **Acceptance (headless, DOM/WebGL-free via injected `WireDeps`):**
  - The gesture engine's `onResult` AND the a11y fallback both feed the **same** `machine.submit` sink (single source of truth).
  - The loaded player rig is added to the scene, scaled, and `frameObject` is called with the measured center/radius.
  - `onRigLoaded` runs and — post FR-2 — contains no dead `instanceof GltfHandRig` branch (or its reachability is asserted).
  - The test fails if any of these wirings regress.
- **Grounds:** `src/main.ts` `wireGame`/`WireDeps` (the designed test seam, card-rps3d-fix R6.4); investigation §"No integration/render-loop test".

## 4. Out of scope

- Production-polish / visual-quality / art-direction pass (branch **b**) — excluded by the resolved fork.
- Any specific user-named defect not in the issue (branch **c**) — none was supplied.
- Decision-path (`round/`, `rules.ts`, `gesture/` classification semantics) re-architecture — INV-1 forbids.
- Adding a new 3D library/engine or new runtime dependency — INV-2 forbids (that axis belongs to `card-rps3d-pimp`, a separate card).
- Sourcing a real licensed hand `.glb`; if the hand path is removed under FR-2, `public/assets/hands/LICENSE.md` provenance obligation is moot for this card.

## 5. Requirement ↔ diagnosis ↔ seam traceability

| Req | Diagnosis (investigation) | Concrete seam |
|-----|---------------------------|---------------|
| FR-1 | No runtime proof; "fix" needs a target | `npm run build` / `npm test` / `?dev` harness (`src/gesture/harness.ts`) |
| FR-2 | Dead hand-rig / new-asset mismatch (highest suspicion) | `src/main.ts` `onRigLoaded`; `objects.ts` `loadObjects`; `hands.ts` `GltfHandRig`/`loadHands`; `public/assets/hands/hand.glb` |
| FR-3 | Framing defect class | `src/render/framing.ts` `computeFraming`/`computeRigScale`; `main.ts` `wireGame` frame chain |
| FR-4 | Gesture confidence UX | `src/config.ts`; `src/gesture/classifier.ts`/`capture.ts`; `main.ts` render() low-confidence |
| FR-5 | No integration/render-loop test (root cause) | `src/main.ts` `wireGame(WireDeps)` seam |

## 6. Acceptance summary (definition of done for the card, at review)

1. A reproduced on-screen defect set (or a documented "no reproducible visual defect + green build/tests, visual half deferred to review") exists (FR-1).
2. The objects-vs-hands mismatch is reconciled with no inert boot branch remaining (FR-2), behavior-preserving for the object player (INV-5).
3. Player object framing verified headless + visually (FR-3).
4. Confidence UX verified; changed only if a defect was reproduced (FR-4).
5. A new headless `wireGame`-seam integration test guards the shipped boot wiring (FR-5) and the full suite is green.
6. All work honors INV-1..INV-5.
