# Hand asset provenance (NFR5 licensing gate)

## v1 shipped: PrimitiveHandRig (no external asset)

This build ships **procedurally-authored primitive hand rigs** (`PrimitiveHandRig` in
`src/render/hands.ts`) — low-poly boxes/capsules posed per shape. There is **no external
GLTF asset** in this repo, so there is **no third-party license to record** for the shipped
v1. Zero licensing risk (FORK-3 baseline, design §2).

## GLTF upgrade slot (deferred)

`GltfHandRig` loads `assets/hands/hand.glb` **if present**, behind the same `HandRig`
interface. No such file ships in v1. Per the T13 licensing gate:

> Any GLTF that ships MUST record source + license + redistributability here before it
> enters the repo. If clean provenance cannot be recorded, ship `PrimitiveHandRig` and file
> GLTF sourcing as a `dlc-backlog` upgrade.

**Status:** clean provenance for a rigged GLTF hand could not be sourced within this
implement pass → shipped the primitive rig; the GLTF sourcing is a parked upgrade tangent
(orchestrator to file `dlc-backlog`, per the pipeline sandbox — agents don't call `gh`).

| Asset | Source | License | Redistributable | Status |
|-------|--------|---------|-----------------|--------|
| _(none in v1)_ | — | — | — | primitive rig shipped |
