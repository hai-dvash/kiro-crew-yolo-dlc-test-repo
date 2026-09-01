# Hand asset provenance (NFR5 licensing gate)

## Status: primitive rig ships (card-rps3d-fix, R1 hand-plausibility gate)

`hand.glb` (Khronos RiggedSimple) is **present in the repo but NOT the active rig.** It is a
2-joint demo skeleton, not a hand, so `GltfHandRig`'s hand-plausibility gate (`isHandSkeleton`,
`src/render/hands.ts`, card-rps3d-fix R1) rejects it: the capability ladder
`clips → morph → (bones AND isHandSkeleton) → null` falls through to `null`, and `loadHands` ships
the procedurally-authored `PrimitiveHandRig` (a correct, distinct-per-shape crude hand). Before this
fix the loose `bones` acceptance posed those 2 generic joints as a bending bar — the reported
"green cylinder" defect. The asset file is **retained** (valid CC-BY-4.0, redistributable) for a
future real-hand upgrade card; it simply no longer drives the on-screen rig.

The `PrimitiveHandRig` uses **no external asset** and carries no third-party license, so the shipped
build needs no attribution (see the credit note below).

## Provenance (NFR5 — recorded BEFORE the asset entered the repo, design §4)

| Asset | Source | License | Redistributable | Status |
|-------|--------|---------|-----------------|--------|
| hand.glb | Khronos glTF-Sample-Assets — [RiggedSimple](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/RiggedSimple) (glTF-Binary variant, `RiggedSimple.glb`) | CC-BY-4.0 ([SPDX: `CC-BY-4.0`](https://creativecommons.org/licenses/by/4.0/legalcode)) | Yes | present but NOT used as the active rig (rejected by the hand-plausibility gate; retained for a future real-hand upgrade — see backlog) |

- **Asset size:** 15,104 bytes (~15 KB) — well within the ≤ ~2 MB zero-install web budget (NFR3).
- **Rig:** glTF 2.0 skinned mesh, 1 skin / 2 joint bones (`Bone`, `Bone.001`). These 2 generic
  joints are NOT a plausible hand skeleton (no finger-named bones, fewer than `MIN_FINGER_BONES=3`),
  so the card-rps3d-fix hand-plausibility gate rejects the `bones` strategy for this asset.
- **License excludes** logos and associated trademarks (per the upstream model LICENSE).

### Attribution (CC-BY-4.0) — currently inactive

CC-BY attribution is required only **while the asset is displayed**. Since the primitive rig ships
and this asset is not rendered, the visible credit line in the game shell (gated on
`h instanceof GltfHandRig`, `src/main.ts`) correctly does **not** render. The attribution wiring is
retained so a future real-hand `GltfHandRig` re-activates it automatically:

> "RiggedSimple" model from the Khronos Group glTF-Sample-Assets repository
> (https://github.com/KhronosGroup/glTF-Sample-Assets), licensed under
> CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/).

## Fallback (always legal)

`GltfHandRig.tryLoad('assets/hands/hand.glb')` returns `null` on any missing/failed/undistinguishable
load, so `loadHands()` ships `PrimitiveHandRig` — which uses **no external asset** and carries no
third-party license. A build with no `hand.glb` is fully legal (the NFR5 CI gate `G1` passes
trivially when the asset is absent).
