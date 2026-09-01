# Design — card-backlog-14

**Source a licensed real rigged-hand `.glb` (RPS clips/morphs) to replace the primitive rig**

- **Card:** `card-backlog-14` · **Pipeline:** `pl-rps3d`
- **Repo (owned):** `hai-dvash/kiro-crew-yolo-dlc-test-repo`
- **Issue:** [#14](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/14) — OPEN
- **Effective modes:** trust=`autonomous`, depth=`deep`, capability spawned=`dlcyolo-coordinator`
- **Step crew (assigned):** `dlcyolo-rps3d-design` (`dlcyolo-authoring` profile)
- **Design at:** 2026-09-01T10:44:00+03:00 · session/cron `e43828c6` (coordinator profile)
- **Branch:** `dlc/card-backlog-14` (single card branch — one PR per card)
- **Derives from:** `requirements.md` (R1–R6, NFR1–NFR5) @ `5a7d0f2`; live source `src/render/hands.ts`,
  `public/assets/hands/LICENSE.md`, `test/hands.test.ts` @ HEAD `5a7d0f2`.

## Dispatch note (capability grounding — no faked crew run)

The step is crew-assigned to `dlcyolo-rps3d-design` and this session was spawned as
`dlcyolo-coordinator`, which per the task text should hold `select_crew` / `spawn_run`. In THIS
runtime those crew-routing MCP tools are **not present** in the tool list (only `read` / `write` /
`shell` are wired — the same empirically-confirmed finding recorded at intake, investigate, and
requirements). Per the PRODUCE-OR-BLOCK contract, a run lacking the crew-routing *mechanism*
**performs the step inline** rather than faking a crew run or silently downgrading. Design authoring
is a read/analyze/write pass — exactly the `dlcyolo-rps3d-design` crew's `dlcyolo-authoring` scope,
a subset of this coordinator session's scope — so it is performed inline, grounded in live source,
and recorded honestly. This is **not** a hard capability-gap block: the missing tool is only the
*dispatch mechanism*, not a tool the design work itself needs.

## §0 — Design posture: this card designs an INTEGRATION, not new engine code

The rig engine is **already complete and asset-shape-agnostic** (`src/render/hands.ts`, verified
live). The capability ladder `clips → morph → (bones ∧ isHandSkeleton) → null`, the `GltfLoadFn`
injectable seam, the `isHandSkeleton` plausibility gate, `SHAPE_ALIASES`, and the `LICENSE.md`
provenance gate all pre-exist. Therefore this design does **not** introduce new happy-path posing
code. It specifies:

1. **How a sourced asset drops in** and which of the three strategies it will light up (§2).
2. **How each strategy renders the three poses distinctly** and what to author into the asset so
   the readable ones (`clips`/`morph`) are used over the coarse `bones` fallback (§3).
3. **The headless test design** (R5/NFR4) against the `GltfLoadFn` seam (§4).
4. **The budget + provenance CI-guardrail design** (R6/NFR3/NFR5) as a vitest assertion (§5).
5. The **decomposition mapping** to the three already-filed child cards #16/#17/#18 (§7).

**Non-regression is structural, not a hope:** any unclearable asset → `tryLoad` returns `null` →
`PrimitiveHandRig` floor. Worst case ships exactly today's quality. Downside risk ≈ 0.

## §1 — Component map (what changes, what does NOT)

| Artifact | Change | Rationale |
|----------|--------|-----------|
| `public/assets/hands/hand.glb` | **replace** RiggedSimple with a sourced hand rig (or C4-authored) | R1 — the active asset |
| `public/assets/hands/LICENSE.md` | **append/supersede** the provenance row for the active asset | R3/NFR5 |
| `src/render/hands.ts` | **NO CODE CHANGE on the happy path** (engine is asset-agnostic) | NFR2 — strictly additive |
| `test/hands.test.ts` (or new `test/hand-asset.test.ts`) | **add** synthetic-asset tests via `GltfLoadFn` | R5/NFR4 |
| `test/asset-budget.test.ts` (new) | **add** budget + provenance guardrail asserts | R6/NFR3/NFR5 |
| `src/main.ts` | **NO CHANGE** — credit line already gated on `h instanceof GltfHandRig` | R4 (verify-only) |

Interface (`HandRig`) and `loadHands(tier)` contract are **frozen** (NFR2). The only production-code
touch is *the asset bytes and its LICENSE row*; everything else is test scaffolding.

## §2 — Asset → strategy selection (the drop-in contract)

`GltfHandRig.tryLoad` runs the ladder at load time and fixes `poseStrategy`:

```
tryLoad(url, load):
  gltf = load(url)                          // GltfLoadFn — defaults to real GLTFLoader
  if hasNamedClips(gltf)         -> 'clips'  // animation whose name matches rock|paper|scissors aliases
  else if findMorphMesh(gltf)    -> 'morph'  // a mesh with a morph target matching the aliases
  else fb = findFingerBones(gltf)
       if fb.length>0 ∧ isHandSkeleton(fb) -> 'bones'   // finger-named OR ≥3 bones
  else -> null                              // → PrimitiveHandRig floor
```

**Design guidance to whoever sources the asset (child #16):** author or pick an asset that lands as
high on the ladder as possible, because readability degrades down the ladder:

- **`clips` (best):** three baked animations named to hit `SHAPE_ALIASES`
  (`rock|fist|closed`, `paper|open|flat|hand`, `scissors|peace|victory|two`). Poses are whatever the
  artist authored → maximally readable. `setShapeClips` cross-fades (0.15s) and drives clip time to
  `k*duration`.
- **`morph` (good):** a single mesh with three morph targets named per the aliases. `setShapeMorph`
  lerps influences toward 1 for the active shape, 0 for the others.
- **`bones` (coarse fallback, acceptable):** any finger-rigged mesh with no clips/morphs.
  `setShapeBones` applies a procedural per-bone x-curl (`curlFor`: rock=1.4rad all, paper=0 all,
  scissors=[0,0,1.4]). This clears R2's "distinct" bar but reads crudely — **prefer clips/morph**.

**Naming is the contract.** Because dispatch keys entirely off `SHAPE_ALIASES` (case-insensitive
substring), the sole authoring requirement for `clips`/`morph` is that the clip/morph names *contain*
a recognized alias. This is the single most important instruction to hand to child #16.

## §3 — Pose distinctness per strategy (R2 / Pose gate)

R2 requires `setShape('rock'|'paper'|'scissors', 1)` to yield three visually distinct rig states.
By strategy:

- **clips/morph:** distinctness is a property of the *authored* poses. Design requirement on the
  asset: the three named clips/morphs must be visibly different hand shapes (fist / flat / two-out).
  The test (§4) asserts the engine *selects a different pose target* per shape; visual fidelity is an
  authoring acceptance checked at sourcing time (child #16), not unit-testable headlessly.
- **bones:** distinctness is guaranteed by `curlFor` producing different curl vectors per shape
  against a shared rest pose. `setShapeBones` writes `rest.x + curl[i%len]`, so rock (all 1.4) ≠
  paper (all 0) ≠ scissors ([0,0,1.4]) for any bone set of length ≥ 1. Testable headlessly (§4c).

**Design note (path resolution, flagged not fixed):** `loadHands` calls
`GltfHandRig.tryLoad('assets/hands/hand.glb')` — a **relative** URL. Under Vite it resolves against
the current document base; the file lives at `public/assets/hands/hand.glb` → served at
`/assets/hands/hand.glb`. This already works today for the retained RiggedSimple, so the sourced
asset must keep the **exact same filename/path** (`public/assets/hands/hand.glb`) — a rename would
break loading. Documented as a drop-in constraint for child #16; **no code change** proposed (out of
this card's non-breaking scope, and the current path works).

## §4 — Test design (R5 / NFR4 — headless, via the `GltfLoadFn` seam)

All tests inject a synthetic `LoadedGltf` (`{ scene: THREE.Object3D, animations: AnimationClip[] }`)
into `GltfHandRig.tryLoad(url, syntheticLoad)` — **no GLTFLoader / WebGL** (NFR4). This mirrors the
existing `test/hands.test.ts` pattern (already present in the repo, so the harness is proven).

Test cases (child #17 implements; design fixes the shape):

- **T-a (activates a real strategy):** feed a synthetic gltf representing the sourced rig; assert
  `tryLoad` returns a **non-null** `GltfHandRig` and `.poseStrategy` equals the expected lane for the
  chosen asset (`clips` if the real asset ships named clips, etc.). Guards the Plausibility gate.
- **T-b (`isHandSkeleton` accepts, bones-lane only):** if the sourced asset is `bones`-lane, build a
  synthetic scene of finger-named (or ≥3) bones; assert `tryLoad` → `'bones'` (not `null`). Also
  keep a **negative** fixture (2 generic `Bone`/`Bone.001` joints, RiggedSimple-shaped) asserting
  `null` → primitive floor, so the regression that card-rps3d-fix closed cannot silently reopen.
- **T-c (distinct poses):** call `setShape('rock'|'paper'|'scissors', 1)` and assert the observable
  per-shape state differs:
  - `bones`: capture each bone's `rotation.x` after each shape → assert the three vectors are
    pairwise distinct (deterministic from `curlFor`).
  - `morph`: assert the influence array differs per shape (active idx → 1, others → 0 after `k=1`).
  - `clips`: assert a different `AnimationAction` is `.play()`-active per shape (the cross-fade path
    sets `activeShape`); a spy/inspection on the mixer's actions suffices headlessly.
- **T-d (regression floor):** `tryLoad` on a throwing/empty loader → `null`; `loadHands`-level
  contract stays PrimitiveHandRig. (Complements the negative fixture in T-b.)

These tests **lock the integration** so a future asset swap or engine edit that breaks detection or
distinctness fails CI.

## §5 — Budget + provenance CI guardrail (R6 / NFR3 / NFR5)

A new headless vitest suite (`test/asset-budget.test.ts`, child #18) enforces two invariants over the
shipped repo files (Node `fs`, no browser):

- **G-budget (NFR3):** if `public/assets/hands/hand.glb` exists, `statSync().size` ≤ `2 * 1024 * 1024`
  (2 MB hard; the design *recommends* ≤ 500 KB and the test can warn above that). If the asset is
  absent the assert passes trivially (legal no-asset build).
- **G-provenance (NFR5):** for every shipped `*.glb` under `public/assets/hands/`, assert
  `LICENSE.md` contains a row referencing that filename. This makes "an asset entered the repo
  without a LICENSE row" a **build failure**, enforcing provenance-before-commit as CI, not honor
  system.
- **License allowlist (NFR1) — design choice:** the SPDX allowlist (`CC0-1.0`, `CC-BY-4.0`; reject
  `-SA/-NC/-ND`) is *verified by a human at download time* and recorded in `LICENSE.md`. The CI test
  asserts the *presence* of a provenance row (machine-checkable); it does **not** try to parse/validate
  the license legality (not reliably machine-checkable from a `.glb`). This split is deliberate:
  automate what's mechanical (size, row-exists), keep the legal call human (recorded in the row).

## §6 — Attribution wiring (R4 — verify-only, NO code change)

`src/main.ts` already renders the credit line gated on `h instanceof GltfHandRig`. Design decision:
**do not touch it.** If the sourced asset is CC-BY-4.0, activating a real `GltfHandRig` makes the
credit render automatically; if CC0, no credit is required and the line stays hidden. R4 is therefore
a *verification* acceptance (confirm the line renders when the real rig is active), added to child
#16's acceptance criteria — not a code task.

## §7 — Decomposition mapping (already handed off at requirements)

The requirements step already fanned out three independently-shippable child cards on the owned repo;
this design fixes **what each child builds**:

| Child | Issue | Feature | This design pins |
|-------|-------|---------|------------------|
| A | [#16](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/16) | f1 source + license-vet + integrate `.glb` | §2 strategy target (prefer clips/morph), §3 path/filename constraint, §6 attribution verify, R3 LICENSE row |
| B | [#17](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/17) | f2 asset-validation test harness | §4 T-a…T-d via `GltfLoadFn` seam (headless) |
| C | [#18](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/18) | f3 budget + provenance CI guardrail | §5 `asset-budget.test.ts` (G-budget, G-provenance) |

No **new** child cards are created at design (the fan-out happened at requirements; re-fanning would
duplicate #16/#17/#18). Design's job here is to give each existing child a concrete build target.
This card stays `handed-off`; it retires only when #16/#17/#18 are `consumed`.

## §8 — Alternatives considered (depth=deep)

- **Author-our-own minimal finger-skeleton `.glb` (C4) vs external source (C1–C3):** the
  external-vs-author fork was raised + auto-resolved at investigate (`dec-cb14-viability`,
  CONDITIONAL-GO, time-boxed external with C4 fallback). Design inherits it: prefer a time-boxed
  external CC0/CC-BY clips/morph asset; if the box expires, author a C4 `bones`-lane rig (guaranteed
  to clear `isHandSkeleton` with finger-named bones). Either way non-regression holds. **No new gate.**
- **Extend the engine (e.g. new posing strategy, retargeting):** rejected — violates NFR2
  (non-breaking) and is unnecessary; the three-strategy ladder already covers every plausible sourced
  rig. Keeping the engine frozen is the whole point of the asset-agnostic design.
- **Change the load path to absolute `/assets/...`:** rejected for this card — the relative path
  works today; a change is out of the non-breaking scope and belongs to a separate ticket if ever
  needed (flagged §3, not actioned).

## §9 — Effort attribution & back-step check

`effort.scope[design] = 7` (design pins the same three features f1=3 / f2=3 / f3=1; it fixed build
targets and test/CI shapes without introducing new scope — the count is inherited, not grown).

Back-step heuristic (deep `GROWTH_FACTOR = 3.0`): predecessor `requirements` scope = 7.
`scope[design] (7) > 3.0 × 7 (=21)`? **NO** — no back-step. Design did not outgrow requirements
(it detailed them). No new features surfaced → no park.

## §10 — Decision gate

**No new decision gate raised.** Self-check: (a) the artifact serves the card's intent — a licensed
real-hand rig, drop-in, non-regressing; (b) no entities introduced that requirements didn't sanction
(the three children pre-exist; the two test files are the literal R5/R6 deliverables); (c) no implicit
consequential technical choice — the one real fork (external vs author-our-own) was already raised +
resolved at investigate and is inherited; (d) capability-gap: the only missing tool is the crew
*dispatch mechanism*, not a tool the design work needs (handled inline per PRODUCE-OR-BLOCK, §Dispatch
note) — not a fork worth a gate. Clean serve → no gate.

## §11 — Handoff

Design complete — grounded in live source (`hands.ts`, `LICENSE.md`, `test/hands.test.ts` @ `5a7d0f2`),
strictly additive (NFR2), non-regression structural. Written to the durable results area and mirrored
to the repo (`.dlc-yolo/card-backlog-14/design.md`, `results_in_repo=true`) on the single card branch
`dlc/card-backlog-14`. Under `trust=autonomous`, the downstream `gate-*` auto-approves; the next
pipeline step is `tasks`. This parent card remains `handed-off` (children #16/#17/#18 carry the actual
build); design's contribution is the concrete per-child build target (§7). `step_status['design'] = done`.
