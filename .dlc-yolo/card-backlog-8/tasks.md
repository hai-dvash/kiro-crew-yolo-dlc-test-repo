# Tasks — Source licensed rigged GLTF hand assets (F3 upgrade)

- **Card:** card-backlog-8
- **Pipeline:** pl-rps3d (enhanced, self-enabling) · **Depth:** standard · **Trust:** autonomous
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** [#8](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/8)
- **Target branch:** `feat/rps3d-maxxed` (origin HEAD `cf25814`) — implement builds **on this branch, never main**
- **Authored by:** tasks step (impl-agent persona — step has no crew; run inline per skill M1)
- **Inputs:** `design.md` (§3 capability-detect ladder, §4 provenance workflow, §6 test design) + the ACTUAL code on `cf25814`

## Grounding (verified against `cf25814`, not paraphrase)

Read this step from the sandbox clone at origin HEAD `cf25814`:

- `src/render/hands.ts` — `export interface HandRig { object; setShape(shape,t); dispose() }`.
  `GltfHandRig` is a **class with a `private constructor(gltfScene, mixer)`**; the only public
  build path is `static async tryLoad(url)` (uses `GLTFLoader.loadAsync`, builds an
  `AnimationMixer` iff `gltf.animations.length`, returns `null` on any throw). `setShape(_shape, t)`
  is the **stub** — `if (this.mixer) this.mixer.update(t * 0.016)`; `_shape` is unused. This is the
  gap. `loadHands(tier)` calls `GltfHandRig.tryLoad('assets/hands/hand.glb')` for non-LOW tiers,
  else returns `new PrimitiveHandRig()`. `PrimitiveHandRig.extensionFor(shape)` is the primitive
  pose reference: rock `[0.1,0.1,0.1]`, paper `[1,1,1]`, scissors `[1,1,0.15]`.
- `public/assets/hands/LICENSE.md` — NFR5 gate present; status prose = *primitive rig shipped*;
  provenance table has one placeholder row `_(none in v1)_ | — | — | — | primitive rig shipped`.
  **No `hand.glb` present** (fallback active today — matches design).
- `test/` — Vitest; tests import from `../src/...`; conventions in `test/render-physics.test.ts`
  (`describe/it/expect`, no DOM/WebGL needed for the units they cover).

## Task list (atomic, dependency-ordered)

### T1 — Extend `GltfHandRig` with a capability-detect pose ladder [F3] — design §3
- **Modules:** `src/render/hands.ts`
- **Covers:** R4, design §3 (asset-shape-agnostic mapping)
- **Deps:** none (pure code seam work; independent of the sourced asset)
- **Do:**
  - Add a `poseStrategy` field typed `'clips' | 'morph' | 'bones' | null` on `GltfHandRig`, plus
    whatever the chosen strategy needs (per-shape `AnimationAction` map for clips; a
    `{ mesh, indices }` map for morph; a finger-bone list + rest/curl targets for bones).
  - In `tryLoad`, **after** the GLTF loads, run a detection ladder and set `poseStrategy` +
    populate the strategy state, in this priority order (design §3):
    1. **clips** — `gltf.animations` contains actions whose names case-insensitively match
       `rock|paper|scissors` (accept aliases `fist|open|peace`). Build one `AnimationAction`
       per shape off the existing `mixer`.
    2. **morph** — a mesh in `gltf.scene` exposes `morphTargetDictionary` keys matching the 3
       shapes (same alias set). Record `{ mesh, morphIndexForShape }`.
    3. **bones** — locate finger bones by name heuristic (`finger|index|middle|thumb`/`bone`);
       if ≥1 findable, record them for per-shape curl/extend rotations (GLTF analogue of
       `extensionFor`).
    4. **none** — no clips, no morphs, no findable bones ⇒ `tryLoad` returns `null` (so
       `loadHands` yields `PrimitiveHandRig` — the R5 floor; design §3 item 3 + U3).
  - **Preserve the interface:** `HandRig`, `setShape` signature, `tryLoad` return type
    (`GltfHandRig | null`), and `loadHands` contract UNCHANGED. Keep the private-constructor
    build path (thread detected strategy state through the constructor or a post-load init).
- **Acceptance:** `tsc --noEmit` clean; `GltfHandRig` compiles with the new field + branches;
  `HandRig`/`loadHands` signatures unchanged (grep confirms no downstream edit needed).

### T2 — Implement the `setShape` dispatch (close the stub) [F3] — design §3
- **Modules:** `src/render/hands.ts`
- **Covers:** R4 (three visually-distinct poses, interpolated by `t`)
- **Deps:** T1 (needs `poseStrategy` + strategy state)
- **Do:** replace the stub body `if (this.mixer) this.mixer.update(t*0.016)` with dispatch on
  `poseStrategy`:
  - **clips:** cross-fade to the shape's `AnimationAction`; set its normalized time from
    `clamp(t,0,1)` (or `mixer.update` toward the target action). No longer ignores `shape`.
  - **morph:** lerp `morphTargetInfluences` toward the shape's target by `clamp(t,0,1)`.
  - **bones:** lerp finger-bone rotations toward the shape's curl/extend target by `clamp(t,0,1)`
    (mirror `PrimitiveHandRig`'s `extensionFor` mapping: rock=curled, paper=extended, scissors=two-out).
  - Keep O(1)-per-frame work (NFR4); no synchronous allocation in the hot path.
- **Acceptance:** unit tests U1/U2 (T5) pass — `setShape('scissors',1)` selects the scissors
  action / drives morph influence toward scissors; `tsc`/`vite build` clean.

### T3 — Source a redistributable rigged/morph hand `.glb` (≤2MB) [F3] — R1, NFR3, design Q1/Q2
- **Modules:** (asset sourcing — external; no repo file yet)
- **Covers:** R1 (redistributable license), NFR3 (≤~2MB), Q1 (CC0 preferred, CC-BY acceptable
  with attribution), Q2 (single static pose per shape — NOT a skeletal throw-anim)
- **Deps:** none (parallel with T1/T2; the code is asset-shape-agnostic by design)
- **Do:** find a glTF 2.0 binary rigged/morph hand whose license is **CC0 or CC-BY** with
  redistribution rights (Quaternius CC0, Poly Pizza / Sketchfab CC-BY are candidate pools).
  Capture source URL, author, license, and (if CC-BY) the exact attribution string. Prefer
  low-poly; if >2MB, Draco/meshopt compress and record compressed size.
- **NFR1 STOP:** if no clean, recordable, redistributable provenance can be established, **do not
  proceed to T6/T7** — commit nothing, keep the primitive shipping, and this card resolves
  `blocked` (see "Blocked exit" below). Licensing failure is the one thing that stops this card.
- **Acceptance:** a `.glb` in hand + a complete provenance record (URL/author/license/redist/size),
  license verified redistributable and not NC/ND.

### T4 — Add a headless GLTF test fixture strategy [F3] — design §6 (enables U1–U3)
- **Modules:** `test/` (new fixture helper) — do NOT load a real WebGL context
- **Covers:** testability of U1/U2/U3 in a headless vitest run
- **Deps:** T1 (defines what detection reads)
- **Do:** decide + implement how the unit tests exercise `tryLoad`'s detection without a browser
  GLTF pipeline. Recommended: **mock `GLTFLoader.loadAsync`** (vitest `vi.mock`) to return
  synthetic `gltf` objects — (a) one with `animations: [{name:'rock'},{name:'paper'},{name:'scissors'}]`,
  (b) one whose scene mesh has a `morphTargetDictionary` for the 3 shapes, (c) one bare mesh with
  neither — so detection picks `clips` / `morph` / `null` respectively. This keeps the test on the
  *detection + dispatch logic* (the actual card work) rather than three.js internals.
- **Acceptance:** the fixture helper compiles and is importable by T5; no real network/WebGL.

### T5 — Unit tests U1–U4 for pose strategy + fallback [F3] — design §6
- **Modules:** `test/hands.test.ts` (new; follow `test/render-physics.test.ts` conventions)
- **Covers:** R4, R5 (AC: shapes distinguishable off the rig; missing/failed ⇒ primitive)
- **Deps:** T2 (dispatch), T4 (fixtures)
- **Do:**
  - **U1** — mocked `.glb` with named RPS clips ⇒ `tryLoad` returns a rig with
    `poseStrategy === 'clips'`; `setShape('scissors',1)` selects the scissors action.
  - **U2** — mocked `.glb` with morph targets ⇒ `poseStrategy === 'morph'`; influence moves
    toward the requested shape as `t → 1`.
  - **U3** — mocked `.glb` with a mesh but no clips/morphs/findable bones ⇒ `tryLoad` returns
    `null` (⇒ `loadHands` yields `PrimitiveHandRig`) — R5.
  - **U4** — `loadHands(QualityTier.Mid)` when `loadAsync` rejects (missing `hand.glb`) ⇒ returns
    a `PrimitiveHandRig`, no throw — R5.
- **Acceptance:** all four pass under `vitest`; none require a DOM/WebGL context.

### T6 — Record provenance in `LICENSE.md` BEFORE committing the asset [F3] — R2, NFR5, design §4
- **Modules:** `public/assets/hands/LICENSE.md`
- **Covers:** R2, NFR5 (provenance-file-as-SoT), NFR1
- **Deps:** T3 (a sourced asset with clean provenance)
- **Do:** replace the placeholder row `_(none in v1)_ | — | — | — | primitive rig shipped` with a
  real row: `hand.glb | <source URL> | <CC0|CC-BY-4.0> | Yes | shipped`. Flip the status prose in
  the two `## v1 shipped …` / `## GLTF upgrade slot (deferred)` sections from *primitive-only* to
  *GLTF shipped*. If **CC-BY**, add the attribution string here AND wire a user-visible credit
  line (About/credits) in the shell.
- **Acceptance:** `LICENSE.md` carries a complete non-placeholder row; if CC-BY, attribution
  present in file + visible credit rendered. **This task lands in the commit BEFORE T7.**

### T7 — Commit `hand.glb` at the seam path [F3] — R3
- **Modules:** `public/assets/hands/hand.glb`
- **Covers:** R3 (`loadHands` finds `assets/hands/hand.glb`; `tryLoad` returns non-null at runtime)
- **Deps:** T6 (provenance recorded first — order is load-bearing, design §4), T2 (dispatch ready)
- **Do:** add the compressed/sized `.glb` at exactly `public/assets/hands/hand.glb`. Verify a
  local `vite build` still serves it and the path resolves to `assets/hands/hand.glb` at runtime.
- **Acceptance:** file at the exact path; asset size within/documented against the ≤2MB budget (NFR3).

### T8 — NFR5 CI gate G1 (mechanical provenance enforcement) [F3] — design §6 G1
- **Modules:** `test/hands.test.ts` (or a small repo-check test)
- **Covers:** NFR5 enforced by CI, not convention
- **Deps:** T5 (test file exists)
- **Do:** add a test that, **if** `public/assets/hands/hand.glb` exists on disk, asserts
  `public/assets/hands/LICENSE.md` contains a non-placeholder provenance row (regex: a table row
  with a real license token, not `_(none in v1)_`/`—`). If `hand.glb` is absent, the test passes
  trivially (fallback build is legal). Reads files via node `fs` — no WebGL.
- **Acceptance:** gate fails a build that commits `hand.glb` without a recorded row; passes both
  the primitive-only build and the correctly-provenanced GLTF build.

### T9 — Full gate run + repo-root results mirror [F3] — NFR4, gates
- **Modules:** (verification) + `.dlc-yolo/card-backlog-8/` mirror (results_in_repo=true)
- **Covers:** NFR4 (perf parity — no synchronous boot regression), no-F1-regression
- **Deps:** T2, T5, T6, T7, T8
- **Do:** run `tsc --noEmit` + `vite build` + full `vitest` (**including the ≥85% gesture harness
  in `test/harness.test.ts` — F1 is untouched and MUST stay green**). Confirm `tryLoad` remains
  async/non-blocking on boot (no new synchronous work). Mirror the card's spec artifacts
  (`requirements.md`/`design.md`/`tasks.md` + an implement report) into `.dlc-yolo/card-backlog-8/`
  on `feat/rps3d-maxxed` and commit with the code (consistent with prior cards; the actual
  commit is the implement/pr step's job).
- **Acceptance:** all gates green; gesture harness ≥85% unchanged; results mirrored.

## Dependency graph & critical path

```
T1 ─┬─> T2 ─┬─> T5 ─> T8 ─┐
    └─> T4 ─┘             ├─> T9
T3 ─────────> T6 ─> T7 ───┘
```

- **Critical path:** `T1 → T2 → T5 → T8 → T9` (the code seam) runs in parallel with the
  **sourcing/provenance path** `T3 → T6 → T7`; both converge at **T9**.
- **T3 is the risk gate:** the code (T1/T2/T5/T8) can be built and unit-tested against mocked
  fixtures with NO sourced asset — so a licensing dead-end (NFR1) still leaves a clean,
  fully-tested seam; only T6/T7/T9's asset-commit is withheld.

## Blocked exit (NFR1 — the one thing that stops this card)

If T3 cannot establish clean, redistributable, recordable provenance: commit **nothing** to
`public/assets/hands/`, leave `PrimitiveHandRig` shipping, and the implement step resolves the
card `blocked` with `block_reason` = "no redistributable rigged-hand GLTF with recordable
provenance could be sourced (NFR1); primitive rig remains shipped". The seam code (T1/T2/T5/T8)
MAY still ship as a no-op upgrade path (it's inert without `hand.glb`), or be held — implement's
call. This is the design's §4 escape hatch, not a failure of this tasks step.

## Effort & back-step check

| ID | Feature | Size | Points |
|----|---------|------|--------|
| f1 | Capability-detect `setShape` mapping + source licensed `.glb` + record provenance + install behind the existing `HandRig` seam with primitive fallback | M | 3 |

- `effort.scope[tasks] = 3`, held **flat** vs `scope[design] = 3` (1:1 design-section → atomic-task
  elaboration; no new features surfaced — the 9 tasks decompose the single M feature).
- Back-step (standard `GROWTH_FACTOR = 2.0`): trips only if `scope[tasks] > 2 × scope[design] = 6`;
  `3 ≤ 6` ⇒ **no back-step** (design correctly sized, no under-specification, no fan-out).

## Decision Gate — NOT raised

- **Intent-fidelity:** OK — tasks execute the GLTF-upgrade goal (real-looking hands) without
  touching gameplay/judging; the capability-detect ladder + provenance-first order serve both the
  literal ask and the real intent (design §0).
- **Unseen scope:** none — every task maps to a design §3/§4/§6 handoff item + a covered
  requirement (R1–R5, NFR1/3/4/5); interface preserved, no new module or architecture, no new
  runtime dependency (three's `GLTFLoader` already imported).
- **Implicit technical fork:** none left open — the shape-mapping strategy (clips→morph→bones→
  primitive), provenance bar (Q1), fidelity scope (Q2), and fallback UX (Q3) were all resolved at
  design; the test-fixture approach (T4 mock `loadAsync`) is an execution detail, not a fork.
- **Capability-gap:** none — the tasks step only authors the plan; the code change + gate run
  happen at the implement (builder) step.
- **No tangents to park** (single-feature fidelity upgrade, fully inside the F3 render/asset layer).
