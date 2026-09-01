# Requirements — Source licensed rigged GLTF hand assets (F3 upgrade)

- **Card:** card-backlog-8
- **Pipeline:** pl-rps3d (enhanced, self-enabling)
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Issue:** [#8](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/8)
- **Type:** chore / enhancement (asset sourcing + provenance; no game-logic change)
- **Depth:** standard · **Trust:** autonomous
- **Authored by:** requirements step (spec-agent persona / `dlcyolo-rps3d-spec` crew, `dlcyolo-authoring` profile)
- **Target branch:** `feat/rps3d-maxxed` (the F3 seam lives here, at origin HEAD `cf25814`)

## Context (grounded in the actual code, not just the issue text)

The F3 upgrade seam already exists on `feat/rps3d-maxxed` and was verified this step:

- `src/render/hands.ts` exports `interface HandRig { object; setShape(shape,t); dispose() }`.
- `PrimitiveHandRig` implements it procedurally and **always ships** (zero licensing risk — FORK-3 baseline).
- `GltfHandRig.tryLoad(url)` loads a GLTF **if present** behind the *same* interface and returns
  `null` on missing/failed load.
- `loadHands(tier)` calls `GltfHandRig.tryLoad('assets/hands/hand.glb')` for non-LOW tiers and
  **falls back to `PrimitiveHandRig`** otherwise.
- `public/assets/hands/LICENSE.md` already exists as the NFR5 provenance gate, with an empty
  provenance table awaiting a sourced asset.

Therefore this card is a **strict, non-breaking upgrade**: drop a properly-licensed
`hand.glb` into `public/assets/hands/`, record its provenance, and `GltfHandRig` activates
automatically with the primitive rig as the guaranteed fallback. **No interface, no
architecture, and no game-logic change.**

## Functional Requirements

- **R1 — Source a redistributable rigged hand GLTF.** Obtain a rigged (skeletal or morph-target)
  hand model in glTF 2.0 binary (`.glb`) form whose license permits redistribution in a public
  repo. **Acceptance:** license is CC0, CC-BY, or equivalently permissive with redistribution
  rights; source URL, author, and license are all knowable and recordable.
- **R2 — Record provenance before the asset enters the repo (NFR5 gate).** Add a row to the
  table in `public/assets/hands/LICENSE.md` capturing Asset / Source (URL) / License /
  Redistributable / Status, and update the "Status" prose from *primitive-only* to *GLTF
  shipped*. **Acceptance:** `LICENSE.md` records complete, verifiable provenance; if CC-BY,
  the required attribution string is present. **No unlicensed asset may be committed.**
- **R3 — Install the asset at the path the seam expects.** Commit the model as
  `public/assets/hands/hand.glb` so `loadHands()` finds it. **Acceptance:** file exists at that
  exact path; `GltfHandRig.tryLoad('assets/hands/hand.glb')` returns a rig (not `null`) at
  runtime for non-LOW tiers.
- **R4 — Map the three shapes onto the rig.** `GltfHandRig.setShape(shape, t)` must pose the
  loaded model to visually distinct rock / paper / scissors poses (via animation clips or
  morph targets), interpolated by `t`. **Acceptance:** each shape is visually distinguishable;
  posing is driven off the loaded rig, not hard-coded primitives.
- **R5 — Preserve the fallback.** If the GLTF is missing, fails to load, or the tier is LOW,
  the game **must** still ship `PrimitiveHandRig` unchanged. **Acceptance:** deleting/omitting
  `hand.glb` yields the current primitive behavior with no error surfaced to the player.

## Non-Functional Requirements

- **NFR1 — Licensing integrity (hard gate).** If clean, redistributable provenance **cannot**
  be established, do **not** commit any GLTF; keep shipping the primitive rig and leave this
  card blocked/parked. Licensing diligence is the single real risk on this card.
- **NFR2 — No monetization.** Consistent with the pipeline NFR (coverage-by-absence): this is a
  fidelity/polish upgrade to a showcase; it introduces no revenue path.
- **NFR3 — Asset weight budget.** The `.glb` should stay within a reasonable zero-install web
  budget (target ≤ ~2 MB) so first paint / tier-HIGH load is not regressed. **Acceptance:**
  asset size documented; if larger, justify or compress (Draco/meshopt) and note it.
- **NFR4 — Perf parity.** Loading the GLTF must not drop the MID tier below the ≥50 fps NFR;
  the async `tryLoad` already keeps boot non-blocking. **Acceptance:** no added synchronous work
  on the boot path.
- **NFR5 — Provenance file is the source of truth** (R2) — restated as the governing gate.

## Effort attribution

| ID | Feature | Size | Points |
|----|---------|------|--------|
| f1 | Source CC/royalty-free rigged hand GLTF + record provenance in LICENSE.md + wire `hand.glb` so `GltfHandRig` activates behind the existing `HandRig` seam | M | 3 |

- **effort.total = 3**, `effort.scope[requirements] = 3`.
- Back-step check (standard `GROWTH_FACTOR = 2.0`): predecessor scope[investigate] = 3;
  `3 > 2 × 3`? No → **no back-step**. Scope held flat (single crisp feature, no decomposition).

## Decision Gate — NOT raised

- **Intent-fidelity:** OK — requirements squarely serve the issue's stated GLTF-upgrade goal.
- **Unseen scope:** none — the `HandRig` interface + `loadHands` fallback + `LICENSE.md` gate
  all pre-exist; nothing new is introduced architecturally.
- **Implicit technical fork:** none — the seam predetermines the integration (drop-in `hand.glb`);
  the only open variable is *which* licensed asset, an execution detail for design/implement.
- **Capability-gap:** none — `dlcyolo-authoring` fully covers a requirements-authoring pass.
- **Fan-out / budget:** single M feature under the standard budget — no fan-out.

## Open questions for gate-spec (human)

1. **Provenance bar:** CC0 only (simplest, no attribution burden), or allow CC-BY with an
   attribution string recorded in `LICENSE.md`?
2. **Rig fidelity:** is a single morph/clip per shape sufficient, or is a skeletal rig with a
   throw animation desired (raises F3 scope toward the parked animation work)?
3. **Fallback UX:** silent fallback to primitive (current behavior) is assumed acceptable — confirm.
