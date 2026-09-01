# Design — Source licensed rigged GLTF hand assets (F3 upgrade)

- **Card:** card-backlog-8
- **Pipeline:** pl-rps3d (enhanced, self-enabling) · **Depth:** standard · **Trust:** autonomous
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** [#8](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/8)
- **Target branch:** `feat/rps3d-maxxed` (F3 seam lives here, origin HEAD `cf25814`)
- **Authored by:** design step — `dlcyolo-rps3d-design` crew persona (`dlcyolo-authoring` profile), run inline per skill M1
- **Inputs:** `requirements.md` (R1–R5, NFR1–5) + the ACTUAL code on `feat/rps3d-maxxed`

## 0. What this card actually means (plain-language framing)

> Addresses the pending design-step interjection ("i wonder what this means").

The shipped game draws each player's hand as a **procedural low-poly shape** — a palm box
plus three capsule "fingers" that extend/curl to read as rock / paper / scissors
(`PrimitiveHandRig`). It works and ships with zero licensing risk. **This card is a pure
visual-fidelity upgrade:** swap that blocky primitive for a *real rigged 3D hand model*
(a `.glb` file) so the hands look like hands. The plumbing to accept such a model
(`GltfHandRig` + `loadHands()`) was already built as an upgrade seam; nothing here changes
how the game plays or how a throw is judged. Two things make it non-trivial and worth a
design pass rather than a one-line drop:

1. **Licensing** — a 3D model committed to a public repo must be provably redistributable
   (the `LICENSE.md` gate). This is the only real risk.
2. **Shape mapping** — the current `GltfHandRig.setShape()` is a **stub** (see §3): it
   advances an animation mixer but ignores the requested shape. A real rig needs actual
   logic to pose it into distinct rock/paper/scissors, and that logic depends on what the
   sourced asset ships (named clips vs morph targets vs plain bones). That is the core
   design decision below.

## 1. Grounding — verified seam (read from source, HEAD `cf25814`)

`src/render/hands.ts`:

- `interface HandRig { object: THREE.Object3D; setShape(shape: Shape, t: number): void; dispose(): void }`
- `PrimitiveHandRig` — always ships; poses 3 capsules via `extensionFor(shape)` lerped by `t`. (R5 baseline, verified.)
- `GltfHandRig.tryLoad(url)` — `GLTFLoader.loadAsync`; builds an `AnimationMixer` **iff**
  `gltf.animations.length`; returns `null` on any failure. (Non-blocking, async — NFR4 holds.)
- `GltfHandRig.setShape(_shape, t)` — **STUB**: `if (this.mixer) this.mixer.update(t*0.016)`;
  the `_shape` arg is unused. **This is the gap this card must close.**
- `loadHands(tier)` — for non-LOW tiers tries `GltfHandRig.tryLoad('assets/hands/hand.glb')`,
  else returns `PrimitiveHandRig`. (R3 path + R5 fallback, verified.)

`public/assets/hands/LICENSE.md` exists as the NFR5 gate: status = *primitive shipped*,
empty provenance table awaiting a row. `hand.glb` is **not** present (fallback active today).

## 2. Gate-spec question resolutions (design decisions)

The requirements surfaced 3 open questions. Resolved here with rationale (trust=autonomous —
recorded, not asked; a human may still interject at the design gate):

- **Q1 — Provenance bar → allow CC0 *or* CC-BY, prefer CC0.** CC0 is simplest (no attribution
  burden). CC-BY is acceptable **iff** the required attribution string is recorded in
  `LICENSE.md` AND rendered somewhere user-visible (an About/credits line). Anything more
  restrictive (NC/ND, "no redistribution") is **rejected** — fails NFR1. Rationale: widens the
  sourcing pool (Poly Pizza / Sketchfab CC-BY, Quaternius CC0) while keeping the hard gate.
- **Q2 — Rig fidelity → single static pose per shape (morph *or* bone), NOT a skeletal throw
  animation.** The throw *motion* is already owned by the gesture/animation layer; the rig only
  needs 3 visually-distinct target poses interpolated by `t` — exactly the `PrimitiveHandRig`
  contract. A full skeletal throw-anim is explicitly **out of scope** (that is the separate
  parked animation work; pulling it in would grow F3 scope and trip a fan-out). Keeps this a
  clean **M**.
- **Q3 — Silent fallback → confirmed acceptable.** Missing/failed GLTF or LOW tier ⇒
  `PrimitiveHandRig`, no player-facing error (R5). A single dev-only `console.info` on fallback
  is allowed for diagnosability; nothing user-visible.

## 3. Core design — closing the `setShape` gap (shape mapping strategy)

The sourced asset can express the 3 shapes in one of three ways. Design a **capability-detect
ladder** in `GltfHandRig` so the same code works regardless of which the chosen asset ships,
with the primitive as the ultimate floor:

1. **Named animation clips** (preferred if present): look for clips named (case-insensitive)
   `rock` / `paper` / `scissors` (or `fist`/`open`/`peace` aliases). `setShape(shape, t)` drives
   the matching clip's `AnimationAction` to a normalized time = `t`, cross-fading from the prior
   shape. Uses the existing `mixer`.
2. **Morph targets** (if the mesh has `morphTargetDictionary` entries for the 3 shapes): set
   `morphTargetInfluences` toward the target shape by `t`. No mixer needed.
3. **Static bone/root fallback** (rig present but no clips/morphs): map each shape to a small
   set of finger-bone rotations (curl/extend), lerped by `t` — the GLTF analogue of
   `extensionFor`. Requires locating finger bones by name heuristics; if bones aren't findable,
   **drop to `PrimitiveHandRig`** (R5) rather than ship a rig that can't distinguish shapes.

`tryLoad` extends to **detect capability and pick the strategy at load time**, storing a
`poseStrategy` on the instance; `setShape` dispatches on it. This makes the design **asset-
shape-agnostic** — implement/sourcing can pick any of a wide pool of assets and the code adapts,
which de-risks the sourcing step (the real unknown).

**Interface unchanged:** `HandRig`, `setShape` signature, `loadHands` contract all preserved —
downstream (`src/main.ts` DI, render layer) is untouched. Strict upgrade.

## 4. Provenance workflow (NFR5 hard gate — the governing constraint)

Order is load-bearing: **record before commit.**

1. Source a rigged/morph/bone hand `.glb`, CC0 or CC-BY-with-attribution, redistributable.
2. **Add the provenance row** to `public/assets/hands/LICENSE.md` (Asset / Source URL / License /
   Redistributable=Yes / Status=shipped) and flip the status prose from *primitive-only* →
   *GLTF shipped*; if CC-BY, add the attribution string + wire a visible credit line.
3. **Only then** commit `public/assets/hands/hand.glb`.
4. **NFR1 escape hatch:** if no clean provenance can be established, commit **nothing** — leave
   the primitive shipping and mark the card `blocked` (`block_reason`) for a human, rather than
   ship an unlicensed or unclear asset. Licensing failure is the one thing that stops this card.

## 5. NFR handling

- **NFR3 (weight ≤ ~2MB):** budget the `.glb` ≤ 2MB; if larger, Draco/meshopt compress and note
  the compressed size in `LICENSE.md`. Prefer a low-poly rigged hand to begin with.
- **NFR4 (perf parity, MID ≥ 50fps):** `tryLoad` is already async/non-blocking on boot; the pose
  strategies are O(1) per frame (clip time set / morph influence / few bone lerps) — no added
  synchronous boot work. No regression expected.
- **NFR2 (no monetization):** unaffected — coverage by absence.

## 6. Test / acceptance design (handoff to tasks)

- **U1** — `GltfHandRig.tryLoad` on a fixture `.glb` **with named RPS clips** ⇒ returns a rig
  whose `poseStrategy === 'clips'`; `setShape('scissors', 1)` selects the scissors action.
- **U2** — fixture with **morph targets** ⇒ `poseStrategy === 'morph'`; influences move toward
  the requested shape by `t`.
- **U3** — a `.glb` with a mesh but **no clips/morphs/findable bones** ⇒ `tryLoad` returns `null`
  (or `loadHands` yields `PrimitiveHandRig`) — the R5 fallback, asserted.
- **U4** — **missing** `hand.glb` ⇒ `loadHands(MID)` returns `PrimitiveHandRig`, no throw (R5).
- **G1 (CI gate)** — a repo check: if `public/assets/hands/hand.glb` exists, `LICENSE.md` MUST
  contain a non-placeholder provenance row (NFR5 enforced mechanically, not by convention).
- Existing gates unchanged: `tsc --noEmit`, `vite build`, full vitest incl. the ≥85% gesture
  harness (F1 untouched — this card cannot regress it).

## 7. Effort & back-step check

| ID | Feature | Size | Points |
|----|---------|------|--------|
| f1 | Source licensed rigged GLTF + record provenance + implement capability-detect `setShape` mapping behind the existing `HandRig` seam with primitive fallback | M | 3 |

- `effort.scope[design] = 3`, held **flat** vs `scope[requirements] = 3` and `scope[investigate] = 3`.
- Back-step (standard `GROWTH_FACTOR = 2.0`): trips only if `scope[design] > 2 × 3 = 6`; `3 ≤ 6`
  ⇒ **no back-step**. Single M feature, no decomposition, well under the standard budget ⇒ no fan-out.

## 8. Decision Gate — NOT raised

- **Intent-fidelity:** OK — design serves the stated GLTF-upgrade goal AND the real intent
  (make the hands look real without changing gameplay).
- **Unseen scope:** none — the `HandRig` interface, `loadHands` fallback, and `LICENSE.md` gate
  all pre-exist; the capability-detect ladder fills the *existing* `setShape` stub, it does not
  introduce new architecture.
- **Implicit technical fork:** none left open — the shape-mapping strategy (§3), provenance bar
  (Q1), fidelity scope (Q2), and fallback UX (Q3) are all resolved here with rationale. Which
  specific asset to source is an execution detail for implement, deliberately kept open by the
  asset-agnostic design so sourcing isn't over-constrained.
- **Capability-gap:** none — `dlcyolo-authoring` covers design authoring; the code change +
  tests happen at the implement (builder) step.

## 9. Handoff to `tasks`

1. Extend `GltfHandRig.tryLoad` to detect pose capability (clips → morph → bones) and store
   `poseStrategy`; implement the 3 dispatch branches in `setShape` (§3).
2. Source a CC0/CC-BY redistributable rigged hand `.glb` (≤2MB); **record provenance in
   `LICENSE.md` first** (§4), flip status prose, add CC-BY attribution + credit line if needed.
3. Commit `public/assets/hands/hand.glb`.
4. Tests U1–U4 + the NFR5 CI gate G1; re-run tsc/vite/vitest incl. the ≥85% harness.
5. **NFR1 stop:** if no clean provenance ⇒ commit nothing, keep primitive, mark `blocked`.
