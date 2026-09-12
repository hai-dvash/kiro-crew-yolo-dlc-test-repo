# Implement — card-rps3d-visual (issue #29): Visual quality lift

**Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #29
**Step:** implement · **Capability:** builder (dlcyolo-builder) · **Modes:** trust=assisted, depth=standard
**Envelope:** `env-c4ee1f98d3aa4d09a72c8d495d99d2a3` (rev 5) · **Branch:** `dlc/pl-rps3d/card-rps3d-visual/...`
**Base:** `5607aac` → tasks commit `a0a54b4` → implement commit `c304594`

Executes the gate-impl-approved tasks T0–T13 (see `tasks.md`), bounded to the accepted
A+B+C **zero-new-dependency** scope. Every task cites its design change-site + REQ/AC/NFR/VER.

## What shipped

### Scope A — clean-studio pass
- **T0** `src/render/config.ts`: single source of the deferred constants (`PALETTE` 3-value
  ladder, `TIER_FIDELITY`, `POST_TUNE`, `PUNCH_IN`) — NFR-M1.
- **T1** `objects.ts`: three distinct silhouettes — faceted subdivided-icosahedron rock with
  **deterministic** (seeded-hash) displacement, curled segmented paper, bladed scissors group
  (2 blades + cylinder hinge + 2 torus loops). Child add-order rock/paper/scissors preserved,
  no `Math.random` (G4). `castShadow=true` on all shapes. — REQ-A1.
- **T2** `scene.ts`: `createScene(canvas, tier)`, tier-gated `PCFSoftShadowMap`, key light
  `castShadow` + tight ±3.5 ortho frustum + bias, ground `receiveShadow`. — REQ-A2.
- **T3** palette bg/ground + warm rim `DirectionalLight(PALETTE.rim)`; `post.ts` bloom/SSAO
  base numbers sourced from `POST_TUNE`. — REQ-A3/A4.

### Scope B — procedural materials (zero asset)
- **T4** `procSurface(res)`: runtime tileable value-noise → `DataTexture` roughness map +
  Sobel-gradient normal map; `null` at res 0; `RepeatWrapping`; no import/fetch (G2). — REQ-B1.
- **T5** `objects.ts`: tier-gated map attach via `RpsObjectRig.setTier` + `objectsApplyFidelity`,
  disposes replaced textures (no leak). — REQ-B1/B3.
- **T6** `scene.ts`: gradient skydome backdrop; `RoomEnvironment`→PMREM IBL kept intact. — REQ-B2.

### Scope C — reveal choreography (visual-only, F1-first)
- **T7** `main.ts`: wired the real `BoardOccluder` (accent-edged palette panel, positioned in
  front of the opponent at z≈-3) + an opponent adapter over f1's rig, into `RevealController`
  (replaces `NullOccluder`+stub). — REQ-C1.
- **T8** `scene.ts` `punchIn()`/`updateCamera()` + `reveal.ts` optional `onReveal`: RAF-driven
  transient dolly-in→hold→settle on the reveal beat, skipped on `instant()`, **never mutates the
  stored `frameObject` target**. — REQ-C2.

### Tier plumbing + verification
- **T9** `main.ts`: `applyFidelity` fan-out (post + scene shadows + object maps) on `TierMonitor`
  degrade; boot tier applied to all consumers. — NFR-P1/P2.
- **T10** `test/boot-smoke.test.ts` (VER-1): wireGame wiring survives the T7 swap + a full reveal
  beat (cover→setShape(committed)→reveal→update→isRevealed; punch-in fired non-instant / skipped
  instant).
- **T11** `test/reveal.test.ts` (VER-4/AC-C3/NFR-I1): F1-first guard — committed result /
  opponentShape / playerShape are identical with vs without the reveal path wired.
- **T13** `style.css`: HUD tints aligned to `PALETTE` (NFR-Q1, cosmetic).

## Invariant guards held
- **G1 F1-first:** no render/reveal symbol imports `round/machine`/`pickOpponent`/`submit`;
  the reveal path is a read-only committed-result consumer (T11 static guard).
- **G2 zero-dep:** no `package.json` change, no asset file, no texture/HDR fetch — all maps generated.
- **G3 tier-gating:** shadows, procedural maps, retuned SSAO and punch-in all route through
  `TIER_FIDELITY`/`applyFidelity`/`instant()`.
- **G4 test stability:** rig child index order + no-`Math.random` preserved (`objects.test.ts` green).
- **G5 worktree:** all edits in the leased worktree on the card branch; pushed by explicit name.

## Verification (VER-3 green)
- `tsc --noEmit`: clean.
- `vite build`: green (677 kB app chunk; Rapier chunk-size warning pre-existing).
- `vitest run`: **89/89 pass, 13 files** (was 84/12; +T10 boot-smoke ×4, +T11 F1-first ×1;
  `objects.test.ts` 6/6 and `reveal.test.ts` 6/6 hold).
- `git diff --check`: clean.

## Deviations
- **VER-2 per-tier screenshots deferred to review/gate.** The headless build sandbox has no
  WebGL/display and no browser binary; adding a screenshot harness (playwright/puppeteer) would
  violate G2 (zero-dep). Requirements made screenshots a **gate-review acceptance artifact** (a
  review-phase / human deliverable), not an implement-phase blocker — the render path is otherwise
  exercised headlessly by the boot-smoke reveal-beat test. Preferred shortfall, not a required gap.
- Repo-local git identity `dlc-yolo-pipeline` used for the commit (global config untouched;
  no branch checkout/switch/create/reset).
