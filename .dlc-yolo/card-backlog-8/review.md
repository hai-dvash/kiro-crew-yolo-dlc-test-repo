# Review — Source licensed rigged GLTF hand assets (F3 upgrade)

- **Card:** card-backlog-8 · **Pipeline:** pl-rps3d (enhanced, self-enabling) · **Depth:** standard · **Trust:** autonomous
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** [#8](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/8)
- **Branch reviewed:** `feat/rps3d-maxxed` @ origin tip `201c69b` (card-backlog-8 landed in `d200c8c` seam + `e5555bd` asset)
- **Reviewed by:** review step (`review-agent` persona), run inline per skill M1 — code review vs requirements + design
- **Verdict:** ✅ **PASS — no Critical/High findings.** Recommend PROCEED TO gate-review.
- **Ownership guard:** PASS (issue #8 author `hai-dvash` == gh-auth `hai-dvash`, state OPEN, label `dlc:review`) — re-verified live at review start.

## Method — grounded in ACTUAL code + independently re-run gates (not the implement note)

Reviewed the real source on the synced branch and **independently re-ran every gate** in a
sandbox clone rather than trusting the implement report:

| Gate | Result (re-run this review) |
|------|------|
| `npx tsc --noEmit` | exit 0 — clean typecheck |
| `npx vite build` | exit 0; emits `dist/assets/hands/hand.glb` (15104 B) + `LICENSE.md` (**R3 runtime path confirmed**) |
| `npx vitest run` | **41/41 passing**, 6 files incl. `test/hands.test.ts` (U1–U4 + LOW-tier + G1) |
| `test/harness.test.ts` (≥85% gesture + ≥75% per-shape) | 2/2 passing — **F1 untouched, no regression (R3/NFR)** |
| **NFR5 G1 negative test** | Reverted `LICENSE.md` to the `_(none in v1)_` placeholder → **G1 FAILED** as designed; restored (tree clean). Proves mechanical licensing enforcement is real, not trivially-passing. |

## Requirements traceability

- **R1 — redistributable rigged GLTF:** ✅ RiggedSimple.glb, Khronos glTF-Sample-Assets, **CC-BY-4.0** (redistributable, not NC/ND). Source URL + author + license all recorded.
- **R2 — provenance recorded before asset (NFR5 gate):** ✅ `public/assets/hands/LICENSE.md` carries a complete non-placeholder row (`hand.glb | source URL | CC-BY-4.0 | Yes | shipped`), status prose flipped primitive-only → GLTF-shipped, CC-BY attribution string present. Order verified via commit sequence (provenance + asset in `e5555bd`).
- **R3 — asset at seam path:** ✅ committed at exactly `public/assets/hands/hand.glb`; `vite build` emits `dist/assets/hands/hand.glb`; `loadHands()` requests `assets/hands/hand.glb`.
- **R4 — three shapes mapped off the rig:** ✅ `setShape` dispatches on `poseStrategy`; asset detects `bones` (2 joint bones, no RPS clips/morphs), `setShapeBones` lerps per-shape curl (rock=curled / paper=extended / scissors=two-extended), the GLTF analogue of `PrimitiveHandRig.extensionFor`.
- **R5 — primitive fallback preserved:** ✅ `tryLoad` returns `null` on missing/failed/undistinguishable load; `loadHands` ships `PrimitiveHandRig`; U3 (bare mesh ⇒ null), U4 (missing asset ⇒ primitive), LOW-tier all asserted + passing. Interface + `loadHands` contract unchanged.
- **NFR1 — licensing integrity:** ✅ clean recordable provenance established; hard gate satisfied (asset legitimately committed, not blocked).
- **NFR3 — weight ≤ ~2MB:** ✅ 15,104 B (~15 KB), well under budget; no compression needed.
- **NFR4 — perf parity:** ✅ `tryLoad` async/non-blocking on boot (`loadHands(...).then(...)` in `main.ts`); pose strategies are O(1)/frame (few bone lerps). No synchronous boot work added.
- **NFR5 — provenance-file-as-SoT:** ✅ enforced mechanically by G1 (negative-tested above).

## Design-fidelity notes

- **Capability-detect ladder (design §3):** implemented exactly — clips → morph → bones → null, detection at load time, `poseStrategy` stored, `setShape` dispatches. Asset-shape-agnostic as designed.
- **Q1 (CC-BY attribution):** correctly gated — the visible credit line in `src/main.ts` renders **only when `h instanceof GltfHandRig`**, so a primitive-only build stays credit-free. Precise, minimal CC-BY compliance. `.asset-credit` style added.
- **Q2 (single static pose per shape, not a throw-anim):** honored — bones strategy poses static curls; no skeletal throw animation pulled in (parked-scope stays parked).
- **Q3 (silent fallback):** honored — no player-facing error on fallback.
- **Injectable loader seam (`GltfLoadFn`):** clean testability decision — lets U1–U3 feed synthetic `LoadedGltf` objects headless (no WebGL). Interface-preserving and not shipped into the hot path.

## Findings

- **Critical:** none.
- **High:** none.
- **Medium:** none.
- **Low (non-blocking, NOT parked — informational only):**
  - **LOW-A — bone-detection heuristic breadth.** `findFingerBones` matches `isBone === true` OR a name regex (`finger|index|middle|thumb|ring|pinky|bone`). On the shipped RiggedSimple asset (2 bones named `Bone`/`Bone.001`) this grabs both joints and animates all of them with the same `curlFor` index cycle — visually a generic curl/extend, not anatomically per-finger. Acceptable for a 2-bone showcase asset and fully within R4 ("visually distinguishable"), but if a future high-poly 5-finger asset is dropped in, the flat `curl[i % curl.length]` mapping won't map to specific fingers. Not a defect against this card's asset or requirements; noted for the eventual richer-asset upgrade. No action needed now.

## Scope / back-step / decision gate

- `effort.scope[implement]=3` vs `scope[design]=3` — flat, 1:1. Back-step check (standard `GROWTH_FACTOR=2.0`): trips only if `> 6`; 3 ≤ 6 → **no back-step**.
- **Decision Gate — NOT raised.** Intent-fidelity OK (real rigged hand behind the seam, gameplay untouched); no unseen scope (single asset + provenance + gated credit; interface/architecture preserved); no implicit technical fork (asset choice was the deliberately-open execution detail); no capability-gap. No tangents to park.

## Recommendation

**PASS — proceed to `gate-review`** (human). The F3 upgrade is a clean, non-breaking, correctly-licensed
enhancement: real rigged GLTF hand active behind the existing seam, primitive fallback intact, provenance
mechanically enforced, all gates green, F1 gesture accuracy unregressed. No fix loop required.
