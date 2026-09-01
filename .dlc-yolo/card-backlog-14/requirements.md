# Requirements — card-backlog-14

**Source a licensed real rigged-hand `.glb` (RPS clips/morphs) to replace the primitive rig**

- **Card:** `card-backlog-14`  ·  **Pipeline:** `pl-rps3d`
- **Repo (owned):** `hai-dvash/kiro-crew-yolo-dlc-test-repo`
- **Issue:** [#14](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/14) — OPEN
- **Effective modes:** trust=`autonomous`, depth=`deep`, capability resolved=`dlcyolo-coordinator`
- **Step crew (assigned):** `dlcyolo-rps3d-spec`
- **Requirements at:** 2026-09-01T09:15:00+03:00 · session `b2f6e728` (coordinator profile)
- **Branch:** `dlc/card-backlog-14` (single card branch — one PR per card)

## Dispatch note (capability grounding — no faked crew run)

The step is crew-assigned to `dlcyolo-rps3d-spec` and this session was spawned as
`dlcyolo-coordinator`, which per the task text should hold `select_crew` / `spawn_run`. In
THIS runtime those crew-routing MCP tools are **not present** in the tool list (only
`read` / `write` / `shell` are wired — same finding recorded at the intake and investigate
steps). Per the PRODUCE-OR-BLOCK contract, a run lacking crew-routing tools **performs the
step inline** rather than faking a crew run or silently downgrading. Requirements authoring
is a read/analyze/write pass (the `dlcyolo-authoring` profile's job — a subset of this
coordinator session's scope), so it is performed inline here, grounded in live source, and
recorded honestly. This is **not** a hard capability-gap block: the missing tool is only the
*dispatch mechanism*, not a tool the requirements work itself needs.

## Context — engineering is already complete (verified live on `dlc/card-backlog-14`)

Read `src/render/hands.ts` (12 KB) at HEAD `7945440`. The rig scaffolding is finished and
**asset-shape-agnostic**, so this card is purely *source + vet + drop-in a licensed asset*:

- `HandRig` interface + `PrimitiveHandRig` (always-legal floor) + `GltfHandRig`.
- `GltfHandRig.tryLoad(url, load?)` runs a capability ladder **`clips → morph → bones → null`**;
  it picks a `poseStrategy` at load and `setShape` dispatches on it, so any `.glb` works
  regardless of how it expresses the three poses.
- Hand-plausibility gate `isHandSkeleton(bones)`: accepts iff a bone is finger-named
  (`/finger|index|middle|thumb|ring|pinky/`) **or** `bones.length >= MIN_FINGER_BONES (=3)`.
- `SHAPE_ALIASES`: rock←`rock|fist|closed`, paper←`paper|open|flat|hand`,
  scissors←`scissors|peace|victory|two`.
- **Injectable loader seam** `GltfLoadFn` (`type GltfLoadFn = (url) => Promise<LoadedGltf>`) +
  the loose `LoadedGltf { scene, animations }` view — this is the **key testability hook**:
  a headless unit test can feed a synthetic `LoadedGltf` to exercise detection + dispatch
  with no GLTFLoader/WebGL.
- NFR5 provenance gate: `public/assets/hands/LICENSE.md` (must record every shipped asset);
  CC-BY credit line in `src/main.ts` gated on `h instanceof GltfHandRig` (inactive by design
  while the primitive ships).
- `loadHands(tier)` calls `GltfHandRig.tryLoad('assets/hands/hand.glb')` for non-Low tiers and
  falls back to `PrimitiveHandRig` on `null`.
- Current asset: `public/assets/hands/hand.glb` = Khronos **RiggedSimple**, CC-BY-4.0, 15,104 B
  — present, redistributable, but **correctly rejected** (2 generic joints, not a hand) → the
  primitive rig ships today.

**Guaranteed non-regression:** any unclearable asset → `tryLoad` returns `null` → `PrimitiveHandRig`
floor. Worst case we ship exactly today's quality; the downside risk of the upgrade is ~zero.

## Functional Requirements

- **R1 — Source a licensed real-hand asset.** Acquire a rigged hand `.glb` and place it at
  `public/assets/hands/hand.glb` (replacing the RiggedSimple placeholder as the active rig).
  The asset MUST clear `GltfHandRig.tryLoad` to a **non-null** strategy (`clips`, `morph`, or
  `bones` + `isHandSkeleton`). Sourcing lanes (investigate handoff): C1 Quaternius CC0 · C2
  Poly Pizza · C3 Sketchfab (filtered) · **C4 author-our-own** (fallback). License/rig claims
  are **must-verify-at-download**, never asserted.
- **R2 — Distinct RPS poses.** With the sourced asset active, `setShape('rock'|'paper'|'scissors', 1)`
  MUST produce three visually distinct rig states. Named `clips`/`morph` are preferred for
  readable poses; the `bones` procedural-curl strategy is an acceptable coarse fallback (it
  already clears the gate for any finger-rigged mesh).
- **R3 — Provenance recorded (NFR5).** Before the asset enters the repo, append a provenance
  row to `public/assets/hands/LICENSE.md` (asset, source URL, author, SPDX license,
  redistributable Y/N, attribution string). The existing RiggedSimple row stays (retained,
  not active) or is superseded — the LICENSE.md must accurately reflect the active asset.
- **R4 — Attribution renders iff CC-BY + active.** If the shipped asset is CC-BY-4.0, the
  `src/main.ts` credit line (gated on `h instanceof GltfHandRig`) MUST render while the rig is
  active; if CC0, no credit is required (line stays hidden). No code change needed — the wiring
  exists; this is a verification requirement.
- **R5 — Asset-validation tests.** Add unit tests (using the `GltfLoadFn` seam, headless) that:
  (a) a synthetic asset representing the sourced rig loads to a **non-null** `GltfHandRig`
  (activates a real strategy); (b) `isHandSkeleton` accepts its bone set (if `bones` strategy);
  (c) the three poses are distinct. These lock the integration against future regressions.
- **R6 — Budget + provenance CI guardrail.** A check that `public/assets/hands/hand.glb` is
  **≤ 2 MB** (NFR3; prefer ≤ 500 KB) and that any shipped `.glb` has a matching LICENSE.md row
  (NFR5). Enforced as a test / CI assertion so a future oversized or unattributed asset fails
  the build.

## Non-Functional Requirements

- **NFR1 — License allowlist.** CC0 or CC-BY-4.0 **only**. Explicitly EXCLUDE `-SA`, `-NC`,
  `-ND` (share-alike / non-commercial / no-derivatives conflict with a permissive showcase
  repo). Verified at download, recorded in LICENSE.md.
- **NFR2 — Non-breaking.** `HandRig` interface + `loadHands` contract UNCHANGED. The upgrade is
  strictly additive; the primitive floor remains the fallback.
- **NFR3 — Web budget.** `.glb` ≤ 2 MB (zero-install web budget); decimate if needed.
- **NFR4 — Headless-testable.** All new tests use the `GltfLoadFn` injection — no real
  GLTFLoader / WebGL in CI.
- **NFR5 — Provenance-before-commit.** No `.glb` enters the repo without its LICENSE.md row.

## Acceptance Criteria (the four investigate gates + test pins)

1. **License gate:** shipped asset is CC0 or CC-BY-4.0 with a recorded provenance row; NFR5
   check green. (`-SA/-NC/-ND` rejected.)
2. **Plausibility gate:** asset clears `GltfHandRig.tryLoad` to a non-null strategy; if `bones`,
   `isHandSkeleton` accepts it.
3. **Pose gate:** `rock`/`paper`/`scissors` render distinctly.
4. **Budget gate:** `hand.glb` ≤ 2 MB.
5. **Attribution gate (CC-BY only):** credit line renders while `GltfHandRig` active, hidden for
   `PrimitiveHandRig`.
6. **Regression floor:** removing/breaking the asset still ships `PrimitiveHandRig` (no crash).

## Effort attribution

| id | feature | size | pts |
|----|---------|------|-----|
| f1 | Source + license-vet + integrate the real-hand `.glb` (drop-in; C1/C4 fallback) | M | 3 |
| f2 | Asset-validation test harness (tryLoad→non-null, isHandSkeleton, 3 distinct poses) via `GltfLoadFn` seam | M | 3 |
| f3 | Budget (≤2MB) + provenance/attribution CI guardrail (NFR3 + NFR5 + R4) | S | 1 |
| **total** | | | **7** |

`effort.scope[requirements] = 7`. Deep GROWTH_FACTOR = 3.0; predecessor `investigate` scope = 3.
Back-step check: `7 > 3 × 3 (=9)`? **NO** — no back-step.

## DECOMPOSE (depth=deep, budget=unlimited → fan out per feature)

Under `depth=deep` with `budget.max_child_cards="unlimited"`, the three features above are
**independently shippable units** (distinct files, distinct acceptance, no ordering coupling
beyond f2/f3 validating whatever f1 lands), so the requirements step fans out **one child card
per feature** rather than piling all three on one card:

- **Child A (f1):** source + license-vet + integrate the licensed real-hand `.glb`.
- **Child B (f2):** asset-validation test harness via the `GltfLoadFn` seam.
- **Child C (f3):** budget + provenance/attribution CI guardrail.

Each child is filed as a GitHub issue with `dlc:investigate` (first step) on the owned repo,
recorded in this card's `child_tickets[]`, and given `parent_ticket = #14`. This parent card is
`handed-off` once the children are filed; it retires only when all children are `consumed`
(no-retire-until-consumed guard).

## Decision gate

No new fork raised at requirements. The one material fork (external-hunt vs author-our-own) was
already raised + auto-resolved at investigate (`dec-cb14-viability`, CONDITIONAL-GO, time-boxed
external sourcing with C4 fallback). Requirements inherits that decision; the sourcing-lane
choice is delegated to Child A's implement step under the same time-box + fallback clause.

## Handoff

Requirements complete — artifact produced grounded in live source, decomposed into 3 child
cards (f1/f2/f3). Written to the durable results area and mirrored to the repo
(`.dlc-yolo/card-backlog-14/requirements.md`, `results_in_repo=true`) on the single card branch
`dlc/card-backlog-14`. Under `trust=autonomous`, the end-of-step gate (`gate-spec`) auto-approves.
`step_status['requirements'] = done`.
