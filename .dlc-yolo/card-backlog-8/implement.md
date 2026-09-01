# Implement report — card-backlog-8 (Source licensed rigged GLTF hand assets, F3 upgrade)

- **Card:** card-backlog-8 · **Pipeline:** pl-rps3d (enhanced, self-enabling) · **Depth:** standard · **Trust:** autonomous
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** [#8](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/8)
- **Branch:** `feat/rps3d-maxxed` (built ON this branch, never main)
- **Step:** implement — impl-agent persona, run inline (step has no crew; this runtime lacks task_run/spawn_run → skill M1 flatten to inline)
- **Ownership guard:** PASS (issue #8 author `hai-dvash` == gh-auth user; state OPEN) — re-checked before every write/push.

## Outcome: PARTIAL — code seam shipped, asset-commit BLOCKED on NFR1

The task splits into two convergent paths (tasks.md dependency graph):

1. **Code seam** `T1 → T2 → T4 → T5 → T8` — **DONE, shipped, tested.**
2. **Sourcing / provenance** `T3 → T6 → T7` — **NOT DONE (NFR1 hard gate).**

### Delivered (code seam)

- **T1/T2 — `src/render/hands.ts`:** closed the `GltfHandRig.setShape` **stub** (which advanced a
  mixer and *ignored the shape*) with a **capability-detect pose ladder** picked at load time and
  stored as `poseStrategy: 'clips' | 'morph' | 'bones'`:
  - **clips** — GLTF has animation clips whose names match `rock|paper|scissors` (aliases
    `fist|open|peace|…`); `setShape` cross-fades to the shape's `AnimationAction` and drives it to a
    normalized pose time = `clamp(t)`.
  - **morph** — a mesh exposes `morphTargetDictionary` entries for the shapes; `setShape` lerps
    `morphTargetInfluences` toward the requested shape by `clamp(t)`.
  - **bones** — finger bones found by name/`isBone`; `setShape` lerps per-bone curl toward a
    rock=curled / paper=extended / scissors=two-out target (GLTF analogue of the primitive's
    `extensionFor`).
  - **none** — rig present but shapes indistinguishable ⇒ `tryLoad` returns `null` ⇒ `loadHands`
    yields `PrimitiveHandRig` (R5 floor).
  The code is **asset-shape-agnostic** — de-risks sourcing (any of a wide asset pool works).
  `HandRig` interface, `setShape` signature, `tryLoad` return type, and `loadHands` contract
  are **UNCHANGED** — strict, non-breaking upgrade; `src/main.ts` DI + render layer untouched.
  Added an **injectable loader seam** (`GltfHandRig.tryLoad(url, load = defaultLoad)`) so detection
  + dispatch are unit-testable headless without a real `GLTFLoader`/WebGL.
- **T4/T5 — `test/hands.test.ts` (new):** U1 (clips detection + dispatch), U2 (morph influence moves
  toward the shape as `t→1`), U3 (bare mesh ⇒ `tryLoad` null), U4 (missing asset ⇒ `loadHands(MID)`
  = `PrimitiveHandRig`, no throw), + LOW-tier always-primitive. Synthetic `LoadedGltf` fixtures built
  from real three.js primitives (no WebGL).
- **T8 — NFR5 CI gate G1** (in `test/hands.test.ts`): *if* `public/assets/hands/hand.glb` exists,
  `LICENSE.md` MUST carry a non-placeholder `hand.glb` provenance row; if the asset is absent the
  gate passes trivially (fallback build is legal). Dependency-free via Vite `import.meta.glob`
  (`?url`/`?raw`); required adding `vite/client` to `tsconfig.json` `types`.

### Gates (T9) — all green

- `tsc --noEmit` — CLEAN
- `vite build` — CLEAN (rapier WASM still code-split into its own chunk; no new synchronous boot work — NFR4 holds)
- `vitest run` — **40/40 passing** (was 34; +6 new hands tests). The **≥85% gesture harness**
  (`test/harness.test.ts`) stays green — **F1 untouched, no regression** (R5 / no-F1-regression).

### NOT delivered — T3/T6/T7 (BLOCKED, NFR1)

Sourcing a real rigged/morph `.glb` requires browsing asset repositories (Quaternius/Poly
Pizza/Sketchfab), **verifying** the license is genuinely CC0/CC-BY *with redistribution rights*,
and downloading a binary — none of which this inline runtime can do or verify. Per the design §4
NFR1 escape hatch and the tasks "Blocked exit", I did **not** fabricate provenance or commit an
unverified/synthetic asset. So **no `hand.glb` was committed**, `LICENSE.md` provenance table
stays at its placeholder row, and `PrimitiveHandRig` remains the shipped rig (R5). The GLTF simply
activates the instant a human (or a network-capable run) drops a licensed `hand.glb` in behind the
now-real `setShape` — and G1 will refuse a build that adds the asset without recording provenance.

## Effort & Decision Gate

- `effort.scope[implement]` held **flat at 3** vs design/tasks/requirements/investigate = 3 (the 9
  tasks executed 1:1; the blocked asset-commit does not add scope). Standard `GROWTH_FACTOR=2.0` →
  back-step trips only if `> 6`; `3 ≤ 6` ⇒ **no back-step**, no fan-out.
- **Decision Gate NOT raised as a fork** — the NFR1 sourcing stop is the *designed* blocked exit,
  not a new implicit choice; it is surfaced as the card's `block_reason` for a human, exactly as
  design §4 / tasks "Blocked exit" prescribe.
