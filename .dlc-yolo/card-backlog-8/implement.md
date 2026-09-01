# Implement report — card-backlog-8 (F3: licensed rigged GLTF hand assets)

- **Card:** card-backlog-8 · **Pipeline:** pl-rps3d (enhanced, self-enabling)
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** [#8](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/8)
- **Branch:** `feat/rps3d-maxxed` (never main) · **Depth:** standard · **Trust:** autonomous
- **Step:** implement — run inline as the impl-agent (implement step has no crew; the Task-Runner
  phase-trigger engine is flattened to inline per skill M1 — this KiroCrew subagent runtime carries
  read/write/shell only, no `task_run`/`spawn_run`).

## What was already in place (grounding, verified against live branch HEAD)

The code seam for this card was **already implemented and committed** in `d200c8c`
("F3: GltfHandRig capability-detect pose ladder + tests"):

- `src/render/hands.ts` — `GltfHandRig` with the capability-detect ladder (clips → morph →
  bones → null), an injectable `GltfLoadFn` loader seam for headless tests, and the `setShape`
  dispatch closing the old stub. Interface + `loadHands` fallback preserved (R5).
- `test/hands.test.ts` — U1–U4 (clips/morph/null/fallback) **and** the NFR5 CI gate G1.

So tasks T1, T2, T4, T5, T8 landed in `d200c8c`. What genuinely remained for the implement
step was the **risk-gated asset path: T3 (source) → T6 (provenance) → T7 (commit)** + T9 (gate run).

## What this implement pass produced

### T3 — Sourced a redistributable rigged `.glb` (the NFR1 risk gate — PASSED, not blocked)

- **Asset:** `RiggedSimple.glb` from the **Khronos glTF-Sample-Assets** repository
  (`Models/RiggedSimple/glTF-Binary/RiggedSimple.glb`).
- **License:** **CC-BY-4.0** (SPDX `CC-BY-4.0`) — redistributable in a public repo; NOT NC/ND.
  Verified against the model's upstream `LICENSE.md`.
- **Size:** 15,104 bytes (~15 KB) — far under the ≤ ~2 MB budget (NFR3); no compression needed.
- **Rig:** glTF 2.0 skinned mesh, 1 skin / 2 joint bones (`Bone`, `Bone.001`).

### T6 — Recorded provenance BEFORE committing (design §4 order; NFR5)

`public/assets/hands/LICENSE.md` now carries a complete non-placeholder row
(`hand.glb | <source URL> | CC-BY-4.0 | Yes | shipped`), the flipped status prose
(*primitive-only* → *GLTF shipped*), the required CC-BY attribution string, and a note that
the attribution is rendered user-visibly (Q1).

### CC-BY visible credit (Q1)

`src/main.ts` appends an `.asset-credit` line (styled in `style.css`) **only when a
`GltfHandRig` is actually active** — so the primitive-only fallback build carries no
unnecessary credit, and the CC-BY attribution is user-visible whenever the licensed asset is in use.

### T7 — Committed the asset at the seam path (R3)

`public/assets/hands/hand.glb` (exact path `loadHands()` requests). Confirmed vite emits it to
`dist/assets/hands/hand.glb` at build time — the runtime R3 path resolves.

## Verification (T9 — proven end-to-end, not just "green")

- **R4 runtime detection:** loading the committed `hand.glb` through the **real `GLTFLoader`**
  yields `poseStrategy === 'bones'` (boneCount = 2; no named RPS clips, no morph targets — falls
  through the ladder to `bones` exactly as designed). `GltfHandRig` activates (not `null`).
- **NFR5 G1 gate is live, not trivial:** negative-tested — with the asset present and the LICENSE
  reverted to the placeholder row, `test/hands.test.ts` G1 **FAILS**; with the recorded provenance
  row it **PASSES**. Mechanical licensing enforcement genuinely covers the asset-present branch.
- **Gates:** `tsc --noEmit` clean · `vite build` clean (emits `hand.glb`) · `vitest` **41/41**
  passing, **including** the ≥85% gesture accuracy harness (F1 untouched — no regression) and the
  per-shape guard.
- **NFR4 (perf parity):** `tryLoad` remains async/non-blocking on boot; pose strategies are
  O(1)/frame. No new synchronous boot work.

## Effort & back-step

`effort.scope[implement] = 3`, held flat vs `scope[tasks] = scope[design] = 3` (implemented the
plan 1:1; the code seam pre-existed, this pass added the asset + provenance + credit only).
Back-step (standard `GROWTH_FACTOR = 2.0`): trips only if `implement > 2 × design = 6`; `3 ≤ 6`
⇒ **no back-step**.

## Decision Gate — NOT raised

- **Intent-fidelity:** OK — real rigged hand model swapped in behind the seam; gameplay/judging
  untouched (design §0 intent satisfied).
- **Unseen scope:** none — single asset + provenance + a gated credit line; interface, `loadHands`
  contract, and architecture all preserved; no new runtime dependency (`GLTFLoader` already imported).
- **Implicit technical fork:** none — asset choice was the deliberately-open execution detail the
  asset-agnostic design left to implement; picking a CC-BY skinned model that drives the existing
  `bones` strategy introduces no new decision.
- **Capability-gap:** none — builder-tier work fits the implement step.
- **No tangents to park.**

## Ownership guard

Re-verified live immediately before commit/push: `gh api user` → `hai-dvash`; `gh issue view 8`
→ author `hai-dvash` == gh-auth user (trusted), state OPEN ⇒ **PASS**. Stayed strictly within the
owned repo on `feat/rps3d-maxxed` the whole run; repo-local git identity only (global untouched).
