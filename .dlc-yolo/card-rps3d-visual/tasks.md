# Tasks — card-rps3d-visual (issue #29): Visual quality lift

**Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #29
**Step:** tasks · **Capability:** authoring (dlcyolo-authoring) · **Modes:** trust=assisted, depth=standard
**Result scope:** standard detail; alternatives when-material; evidence [functional, rationale]; validation [normal]
**Upstream input:** design.md (accepted; `env-b5dddb06`) which consumes gate-spec-APPROVED requirements.md (A+B+C, zero-new-dependency).
**Design ref:** `.dlc-yolo/card-rps3d-visual/design.md` (app-data: `data/results/card-rps3d-visual/design.md`)
**Requirements ref:** `.dlc-yolo/card-rps3d-visual/requirements.md`
**Base commit:** `5607aac0af93f46a05f1264601b437293b07029e` · **Branch:** `dlc/pl-rps3d/card-rps3d-visual/...`

> This task list is the **executable decomposition of the accepted design**. It does not re-derive
> requirements or design — every task cites the design change site (§4 of design.md) and the REQ/AC/NFR/VER
> it satisfies. Tasks are ordered by dependency so the implement step can execute them top-to-bottom.
> **Feed to Task Runner** (implement phase) with this file, or hand inline. Each task is atomic (one
> coherent change, independently reviewable) and carries an explicit Done-when.

---

## Global constraints (apply to EVERY task — from NFR-I1 / NFR-Z1 / NFR-P1)

- **G1 (F1-first / NFR-I1):** NO task may import or call `round/machine`, `pickOpponent`, or `machine.submit`
  from any render/reveal symbol. Render + reveal are read-only consumers of committed round state.
- **G2 (zero-dep / NFR-Z1):** NO task may add a `package.json` dependency, add a file under an asset path
  (`public/assets/**`), or introduce a runtime `fetch`/import of a texture/HDR. All maps are runtime-generated.
- **G3 (tier-gating / NFR-P1/P2):** every new fidelity feature (shadows, procedural maps, retuned SSAO,
  punch-in) MUST route through `TIER_FIDELITY` / `applyFidelity` / the existing `instant()` signal — never a
  hard-coded always-on cost.
- **G4 (test stability):** `test/objects.test.ts` reads the rig's child meshes by index (rock=0/paper=1/
  scissors=2) and forbids `Math.random`. Any geometry rebuild MUST preserve child construction order and use
  **deterministic** (seeded/hash) displacement.
- **G5 (worktree):** all edits happen only in the leased worktree on the card branch; never touch main; never
  `git push` anything but the lease branch by explicit name.

---

## Phase 0 — Foundation (must land first; everything depends on it)

### T0 — Create `src/render/config.ts` (single source of deferred constants)
- **Design site:** §4.1, §2 · **Satisfies:** NFR-M1; provides constants for A3/A2/A4/B1/B3/C2.
- **Do:** Create `src/render/config.ts` exporting exactly the design's committed values:
  - `PALETTE` — `bg 0x11151c`, `ground 0x1b222c`, `rock 0x6b7480`, `paper 0xeef1f4`, `scissors 0xb8c0cc`,
    `accent 0xffb454`, `rim 0xff9d5c` (§2.1 value ladder — rock↔scissors ≥30% lightness apart).
  - `TIER_FIDELITY` keyed by `QualityTier` — high `{castShadows:true, shadowMapSize:2048, procMapRes:512, ssao:true}`,
    mid `{castShadows:true, shadowMapSize:1024, procMapRes:256, ssao:false}`,
    low `{castShadows:false, shadowMapSize:0, procMapRes:0, ssao:false}` (§2.2).
  - `POST_TUNE` — `bloom {luminanceThreshold:0.72, intensity:0.7}`, `ssao {radius:0.08, intensity:0.9}` (§2.3).
  - `PUNCH_IN` — `{dollyIn:0.28, punchMs:220, holdMs:380, settleMs:520}` (§2.4).
  - `procSurface(res)` — runtime canvas/`DataTexture` generator returning
    `{roughnessMap, normalMap} | null` (null when `res===0`); deterministic tileable value-noise + Sobel-derived
    normal map; `wrapS/T = RepeatWrapping`; NO import/fetch (see T4 for the body).
- **Pure data + one generator; no THREE scene state, no round import (G1).**
- **Done-when:** module compiles under `tsc --noEmit`; imported by no one yet (wired in later phases);
  `procSurface(0)` returns `null`, `procSurface(512)` returns two `THREE.Texture`s.

---

## Phase 1 — Scope A: clean-studio pass (depends on T0)

### T1 — Rebuild the three object builders in `src/render/objects.ts` (REQ-A1)
- **Design site:** §3 REQ-A1, §4.2 · **Satisfies:** REQ-A1 / AC-A1 · **Guards:** G4.
- **Do:** In `objects.ts`, replace the three private builders, Three built-ins only:
  - `makeRock()` → `IcosahedronGeometry(0.9, 1)` (detail 1, ~80 faces) + **deterministic** per-vertex
    displacement (seeded hash on vertex index, NOT `Math.random`).
  - `makePaper()` → `PlaneGeometry(1.3,1.7,6,8)` with a small sine bend + slight thickness (curl/body,
    not a flat slab).
  - `makeScissors()` → a `THREE.Group`: two blades + a `CylinderGeometry` hinge pivot at the crossing +
    two `TorusGeometry` finger loops at the handle ends.
- Keep `RpsObjectRig` child add-order **rock, paper, scissors** (G4). Keep `loadObjects`'s synchronous
  always-ships contract and the `HandRig`/`WireRig` shape the tests assert.
- **Done-when:** `npm test` (`test/objects.test.ts`) still green (index map + no-`Math.random` hold);
  each shape has a distinct silhouette.

### T2 — Enable grounding soft shadows in `src/render/scene.ts` (REQ-A2)
- **Design site:** §3 REQ-A2, §4.3, §1.2 · **Satisfies:** REQ-A2 / AC-A2 · **Guards:** G3.
- **Do:**
  - Change `createScene(canvas)` → `createScene(canvas, tier)`.
  - `renderer.shadowMap.enabled = TIER_FIDELITY[tier].castShadows`; `renderer.shadowMap.type = PCFSoftShadowMap`.
  - `key.castShadow = true`; `key.shadow.mapSize` from `TIER_FIDELITY[tier].shadowMapSize`; tight ortho
    shadow-camera frustum (~±3 units) around the play area.
  - `ground.receiveShadow = true`; set `castShadow = true` on each shape mesh in `objects.ts` (T1 output),
    `receiveShadow = false` on shapes.
  - Add `scene.applyFidelity(t)` toggling `shadowMap.enabled` + `key.castShadow` + `mapSize` at runtime.
- **Done-when:** High-tier build renders contact shadows; Low tier renders with shadows off, no console error.

### T3 — Apply the three-value palette + warm rim light (REQ-A3) and retune post (REQ-A4)
- **Design site:** §3 REQ-A3/REQ-A4, §4.3/§4.4 · **Satisfies:** REQ-A3/AC-A3, REQ-A4/AC-A4.
- **Do:**
  - `objects.ts` builders/`objectMaterial` read `PALETTE.rock/paper/scissors`.
  - `scene.ts`: `scene.background = new THREE.Color(PALETTE.bg)`; ground material uses `PALETTE.ground`;
    add a warm rim `DirectionalLight(PALETTE.rim, ~0.6)` opposite the key (un-gated, no shadow).
  - `post.ts`: construct `bloom`/`ssao` from `POST_TUNE` instead of inline literals; **leave `applyTier`
    opacity-toggling unchanged** (only base numbers move).
- **Done-when:** screenshot shows three shapes separable by value; bloom confined to highlights, SSAO reads
  as contact darkening (judged at VER-2/gate).

---

## Phase 2 — Scope B: procedural materials (depends on T0, T1, T3)

### T4 — Implement `procSurface(res)` body in `config.ts` (REQ-B1, NFR-Z1)
- **Design site:** §2.5, §3 REQ-B1 · **Satisfies:** REQ-B1 (partial), AC-B2 · **Guards:** G2.
- **Do:** Implement the generator body: deterministic tileable value-noise height field →
  `roughnessMap` (canvas/`DataTexture`) + Sobel-gradient-derived `normalMap` (`DataTexture`, RGB-encoded).
  DOM path uses `document.createElement('canvas')`; headless/test path uses `DataTexture`. `res===0 → null`.
  No image import/fetch.
- **Done-when:** returns valid `THREE.Texture`s for res∈{256,512}, `null` for 0; diff shows no new asset file.

### T5 — Attach tier-gated procedural maps + `objectsApplyFidelity` in `objects.ts` (REQ-B1/B3)
- **Design site:** §3 REQ-B1/REQ-B3, §4.2 · **Satisfies:** REQ-B1/AC-B1, REQ-B3/AC-B3 · **Guards:** G3.
- **Do:** Materials attach `roughnessMap`/`normalMap` from `procSurface(TIER_FIDELITY[tier].procMapRes)`
  when `procMapRes > 0`; plain `PALETTE`-colored `MeshStandardMaterial` when `0`. Export
  `objectsApplyFidelity(rig, t)` that swaps map presence at runtime and **disposes** replaced generated
  textures (no leak). `loadObjects(tier)` threads tier into map res.
- **Done-when:** High shows micro-surface variation; Low renders plain material, no console error; runtime
  tier drop disposes old textures.

### T6 — Gradient environment tint in `scene.ts` (REQ-B2)
- **Design site:** §3 REQ-B2, §4.3 · **Satisfies:** REQ-B2 · **Guards:** G2.
- **Do:** Add an inward-facing skydome (`SphereGeometry` + `ShaderMaterial` or a `CanvasTexture` vertical
  gradient `PALETTE.bg` → slightly lighter cool) set as `scene.background`. **Keep `RoomEnvironment`→PMREM
  `scene.environment` unchanged** (reflections intact; only the visible backdrop gains a gradient). Un-gated.
- **Done-when:** backdrop shows a gradient complementing the palette; IBL reflections unchanged; no new dep.

---

## Phase 3 — Scope C: reveal choreography (depends on T2, T3; independent of B)

### T7 — Wire the real `BoardOccluder` + opponent adapter at the main.ts T7 swap (REQ-C1)
- **Design site:** §3 REQ-C1, §4.7 · **Satisfies:** REQ-C1/AC-C1 · **Guards:** G1.
- **Do:** At the `onRigLoaded`/boot wiring in `main.ts`, replace `NullOccluder` + `opponentStub` with:
  - `const boardOccluder = new BoardOccluder()`; position `object` in front of the opponent at
    `(0, 0.6, -3 + 0.6)`; `scene3d.scene.add(boardOccluder.object)`.
  - an `opponentAdapter: OpponentObject` delegating `setVisible`→`opponent.object.visible`,
    `setShape(s)`→`opponent.setShape(s,1)` (adapts f1's already-constructed rig — f1 has landed).
  - `reveal = new RevealController({ occluder: boardOccluder, opponent: opponentAdapter, instant: ... })`.
  - Retune `BoardOccluder` material (accent-edged panel) from `config.ts`; optional short slide via
    `object.position.y` inside its existing `update()` — bounded by the `Occluder` contract the tests use.
- **F1-first (G1):** occluder/adapter only READ committed `opponentShape` via `RevealController.onState`.
- **Done-when:** on a real round the opponent is hidden until reveal then disclosed (before/after pair).

### T8 — Reveal camera punch-in: `scene.punchIn()` + `reveal.ts onReveal` trigger (REQ-C2)
- **Design site:** §3 REQ-C2, §4.3/§4.6 · **Satisfies:** REQ-C2/AC-C2 · **Guards:** G1, G3.
- **Do:**
  - `scene.ts`: add `punchIn()` + an internal per-frame settle driven from the existing RAF loop —
    temporary camera distance = fit distance × `(1 - PUNCH_IN.dollyIn)`, ease in `punchMs`, hold `holdMs`,
    ease back to the `frameObject()` distance over `settleMs`, using the existing `applyFraming` direction.
    **Never mutate the stored `frameObject` target** (resize must still re-fit).
  - `reveal.ts`: add an **optional** `onReveal?: () => void` dep; call it from the same `resolved` branch
    that calls `occluder.reveal()`. On `instant()` (reduced-motion / Low) → skip the punch-in.
  - `main.ts`: pass `() => scene3d.punchIn()` as `reveal`'s `onReveal`.
- **Done-when:** camera punches in on reveal and settles back to a stable frame; skipped on instant().

---

## Phase 4 — Verification & tier plumbing (depends on all above)

### T9 — Widen `TierMonitor.onDegrade` fan-out in `main.ts` (NFR-P1/P2)
- **Design site:** §1.2, §4.7 · **Satisfies:** NFR-P1/P2 · **Guards:** G3.
- **Do:** In `main.ts`, replace the degrade callback with an `applyFidelity` fan-out (NOT changing
  `tiers.ts`): `const applyFidelity = (t) => { post.applyTier(t); scene3d.applyFidelity(t); objectsApplyFidelity(rig, t); };`
  `const monitor = new TierMonitor(bootTier, applyFidelity);` Apply the initial tier once at boot to all
  three consumers. Pass `bootTier` into `createScene`/`loadObjects`.
- **Done-when:** a simulated tier degrade toggles shadows + maps + post together with no gameplay/layout change.

### T10 — Boot smoke test `test/boot-smoke.test.ts` (VER-1)
- **Design site:** §5 VER-1 · **Satisfies:** VER-1.
- **Do:** New node-env test driving the DOM/WebGL-free `wireGame` seam (like `test/main.test.ts`): assert
  the four wiring props survive the T7 swap (rig added, engine→submit, fallback→submit, `frameObject`
  called); assert a full `RevealController` beat (`cover()` on `capturing` → `reveal(false)` on `resolved`
  → `update()` reaches `isRevealed()===true`) runs with no throw and the opponent adapter's `setShape` is
  called with the committed shape. MUST fail if reveal wiring or occluder errors.
- **Done-when:** test file exists and passes; fails if the T7 wiring/occluder path throws.

### T11 — F1-first guard in `test/reveal.test.ts` (VER-4 / NFR-I1 / AC-C3)
- **Design site:** §5 VER-4, §3 REQ-C3 · **Satisfies:** AC-C3, NFR-I1.
- **Do:** Extend `test/reveal.test.ts` to assert the reveal/punch-in path never mutates round state: given
  a fixed committed state, `s.result`/`s.opponentShape` are identical with vs without the occluder present;
  `RevealController.onState` is read-only. (Static guard complementing the VER-4 diff review.)
- **Done-when:** test asserts committed result is invariant to the occluder/reveal path.

### T12 — Build + unit green (VER-3) and per-tier screenshot evidence (VER-2)
- **Design site:** §5 VER-2/VER-3 · **Satisfies:** VER-2 (gate evidence), VER-3.
- **Do:**
  - VER-3: `npm run build` (`tsc --noEmit && vite build`) + `npm test` (vitest) pass.
  - VER-2: `npm run dev`, drive `?tier=high` and `?tier=low` (+`?dev`) via the existing `forcedTier` URL
    param (no new code), capture with the implement step's screenshot flow:
    (a) High idle frame — three distinguishable objects + contact shadows;
    (b) Low frame — correct render with shadows/maps off;
    (c) occluder→reveal before/after pair on High (drive a round via the a11y keyboard fallback) showing
    the punch-in. Attach as the card's visual evidence for NFR-Q1 gate judgment.
- **Done-when:** build+units green AND the three screenshot artifacts are captured and attached.

### T13 (optional, low priority) — `style.css` HUD tint coherence (NFR-Q1)
- **Design site:** §4.9 · **Satisfies:** NFR-Q1 (preferred, non-blocking).
- **Do:** Retune `:root --bg`/HUD panel tints to match `PALETTE` so the HUD reads with the brighter scene.
  No functional change.
- **Done-when:** HUD reads coherently with the new scene; skip acceptable (preferred, not a functional gate).

---

## Execution order (dependency-topological)

```
T0
 ├─ T1 ─┐
 ├─ T2 ─┤
 ├─ T3 ─┤ (A complete: T1,T2,T3)
 ├─ T4 ─ T5 ─┐
 │           ├ (B complete: T4,T5,T6)
 ├─ T6 ──────┘
 ├─ T7 ─ T8   (C complete: T7,T8)
 └─ T9        (tier fan-out, after scene/objects APIs exist)
T10, T11  (tests, after wiring)
T12       (build + units + screenshots — the acceptance gate)
T13       (optional polish)
```

Parallelizable within a phase; A / B / C are largely independent after T0 (B depends on A's material path
via T3; C is independent of B). T9 requires T2/T5/T3 APIs. T12 is last.

---

## Effort attribution (this phase) & scope-growth check

Realized **tasks-phase** scope (S=1 / M=3 / L=5 / XL=8) — decomposition granularity, not new scope:

| Cluster | Tasks | Size | Points |
|---|---|---|---|
| Foundation | T0 | M | 3 |
| Scope A | T1, T2, T3 | L | 5 |
| Scope B | T4, T5, T6 | M | 3 |
| Scope C | T7, T8 | M | 3 |
| Tier + verification | T9, T10, T11, T12 (+T13 opt) | S | 1 |

**Tasks-phase total ≈ 15 points** — identical to the design-phase scope (≈15) and 15/15 = **1.0×**, well
under `GROWTH_FACTOR = 2.0`. The decomposition introduces **no new entities** beyond the design (the config
module is design-mandated). **No back-step fork raised**; scope stays inside approved A+B+C.

---

## Coverage summary (task → design site → REQ/NFR/VER)

| Task | Design site | Satisfies |
|---|---|---|
| T0 | §4.1/§2 | NFR-M1 (+ constants for A2/A3/A4/B/C) |
| T1 | §4.2 | REQ-A1 / AC-A1 |
| T2 | §4.3/§1.2 | REQ-A2 / AC-A2 |
| T3 | §4.3/§4.4 | REQ-A3/AC-A3, REQ-A4/AC-A4 |
| T4 | §2.5 | REQ-B1 (gen), AC-B2 |
| T5 | §4.2 | REQ-B1/AC-B1, REQ-B3/AC-B3 |
| T6 | §4.3 | REQ-B2 |
| T7 | §4.7 | REQ-C1 / AC-C1 |
| T8 | §4.3/§4.6 | REQ-C2 / AC-C2 |
| T9 | §1.2/§4.7 | NFR-P1 / NFR-P2 |
| T10 | §5 | VER-1 |
| T11 | §5 | AC-C3 / NFR-I1 (VER-4 static) |
| T12 | §5 | VER-2 (evidence) / VER-3 |
| T13 | §4.9 | NFR-Q1 (preferred) |
| (all) | G1–G5 | NFR-I1, NFR-Z1, NFR-P1, test stability, worktree |
