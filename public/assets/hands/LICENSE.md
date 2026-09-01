# Hand asset provenance (NFR5 licensing gate)

## Status: GLTF shipped (card-backlog-8, F3 upgrade)

This build ships a **rigged GLTF hand model** (`hand.glb`) loaded by `GltfHandRig`
(`src/render/hands.ts`) behind the shared `HandRig` interface. The procedurally-authored
`PrimitiveHandRig` remains the guaranteed fallback (R5): if `hand.glb` is missing, fails to
load, its rig can't be posed, or the tier is `LOW`, the game ships the primitive rig with no
player-facing error (FORK-3 baseline, design §2).

The sourced asset expresses its three poses via its **skeleton** — `GltfHandRig` detects
`poseStrategy = 'bones'` at load time (no named RPS clips, no morph targets) and poses the
finger/joint bones per shape (rock=curled, paper=extended, scissors=two-extended), the GLTF
analogue of `PrimitiveHandRig.extensionFor` (design §3, ladder item 3).

## Provenance (NFR5 — recorded BEFORE the asset entered the repo, design §4)

| Asset | Source | License | Redistributable | Status |
|-------|--------|---------|-----------------|--------|
| hand.glb | Khronos glTF-Sample-Assets — [RiggedSimple](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/RiggedSimple) (glTF-Binary variant, `RiggedSimple.glb`) | CC-BY-4.0 ([SPDX: `CC-BY-4.0`](https://creativecommons.org/licenses/by/4.0/legalcode)) | Yes | shipped |

- **Asset size:** 15,104 bytes (~15 KB) — well within the ≤ ~2 MB zero-install web budget (NFR3);
  no compression needed.
- **Rig:** glTF 2.0 skinned mesh, 1 skin / 2 joint bones (`Bone`, `Bone.001`) — drives the
  `bones` pose strategy. Verified at load time via the real `GLTFLoader` (`poseStrategy === 'bones'`).
- **License excludes** logos and associated trademarks (per the upstream model LICENSE).

### Required attribution (CC-BY-4.0)

> "RiggedSimple" model from the Khronos Group glTF-Sample-Assets repository
> (https://github.com/KhronosGroup/glTF-Sample-Assets), licensed under
> CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/).

This attribution is rendered in a user-visible credits line in the game shell (see
`src/main.ts` / the About/credits UI) to satisfy the CC-BY-4.0 attribution requirement (design Q1).

## Fallback (always legal)

`GltfHandRig.tryLoad('assets/hands/hand.glb')` returns `null` on any missing/failed/undistinguishable
load, so `loadHands()` ships `PrimitiveHandRig` — which uses **no external asset** and carries no
third-party license. A build with no `hand.glb` is fully legal (the NFR5 CI gate `G1` passes
trivially when the asset is absent).
