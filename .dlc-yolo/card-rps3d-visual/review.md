# Review — card-rps3d-visual (issue #29): Visual quality lift

**Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #29
**Step:** review · **Capability:** authoring (dlcyolo-authoring) · **Modes:** trust=assisted, depth=standard
**Envelope:** `env-f8900f340897463e8ce67e3ab6780cf3` (rev 6) · **Branch:** `dlc/pl-rps3d/card-rps3d-visual/visual-quality-game-is-functional-but-ugly-research-grounded-art-direction-rende`
**Base:** `5607aac` → tasks `a0a54b4` → implement `c304594` → mirror `d6711b3` (review HEAD)

Independent review of the gate-impl-approved implementation against the accepted requirements
(REQ-A1..A4 / REQ-B1..B3 / REQ-C1..C3, NFRs, VER-1..4) and the design change-sites. Grounded in a
fresh source read + an independent build/test run in the leased worktree — not a re-read of the
implement step's self-report.

## Verdict: **APPROVE (with one deferred acceptance artifact for the human gate)**

The change delivers the accepted A+B+C zero-new-dependency visual-quality scope, holds every hard
invariant, and passes an independently re-run build and test suite. The one shortfall (per-tier
screenshot evidence) is environmental, was correctly declared upstream, and is a preferred — not
required — item that lands on the human reviewer at gate-review.

## Independent verification (this review session, in the leased worktree)

| Check | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | **clean** (exit 0) |
| Test suite | `vitest run` | **89 passed / 89, 13 files** (incl. boot-smoke ×4, F1-first guard ×1, objects 6/6, reveal 6/6) |
| Diff scope | `git diff --stat 5607aac d6711b3` | 10 source/style/test files + 2 doc mirrors; +1021 / −118 |
| G2 zero-dep | `git diff 5607aac d6711b3 -- package.json package-lock.json` | **empty** — dependencies untouched |
| G1 F1-first | grep render path for `pickOpponent`/`machine.submit`/round coupling | render/reveal files reference **none**; `reveal.ts` imports only the `RoundState` *type* (read-only committed-result consumer) |
| Occluder wiring | `main.ts` | real `BoardOccluder` + opponent adapter wired into `RevealController` at boot, replacing `NullOccluder`+stub (main.ts:209/218) |

The Three.js object printed to stdout during the test run is a passing test's diagnostic dump, not
a failure — all 13 files/89 tests report green.

## Requirement coverage (against accepted requirements.md)

- **REQ-A1** distinct silhouettes + `castShadow`: PASS — faceted rock (seeded, deterministic
  displacement, no `Math.random`), curled paper, bladed scissors group; `objects.test.ts` 6/6 holds.
- **REQ-A2** tier-gated `PCFSoftShadowMap` + key-light shadow + tight ortho frustum + ground
  `receiveShadow`: PASS (`scene.ts`).
- **REQ-A3/A4** palette bg/ground + warm rim light + post base numbers from `POST_TUNE`: PASS.
- **REQ-B1** procedural roughness + Sobel normal maps, tier-gated attach, dispose-on-replace
  (no leak), no import/fetch: PASS (`objects.ts` `procSurface`).
- **REQ-B2** gradient skydome + `RoomEnvironment`→PMREM IBL kept intact: PASS.
- **REQ-C1** real `BoardOccluder` wired (accent panel at z≈-3), `NullOccluder`+stub removed: PASS.
- **REQ-C2** transient dolly-in→hold→settle punch-in on the reveal beat, skipped on `instant()`,
  never mutates the stored `frameObject` target: PASS (`scene.ts` + `reveal.ts onReveal`).
- **NFR-P1/P2** tier degrade fan-out (post + shadows + object maps) via `applyFidelity`: PASS.
- **NFR-I1 / AC-C3 / VER-4** F1-first: committed result / opponentShape / playerShape identical
  with vs without the reveal path wired — statically asserted by `test/reveal.test.ts` (T11): PASS.
- **VER-1** wireGame survives the T7 swap through a full reveal beat: PASS (`test/boot-smoke.test.ts`).

## Invariant audit

- **G1 F1-first (hard):** HELD — render/reveal is a downstream committed-result consumer; no
  opponent-selection coupling; guarded by a dedicated test.
- **G2 zero-dependency (hard):** HELD — no `package.json`/lockfile change, no asset file, all maps
  generated at runtime.
- **G3 tier-gating:** HELD — shadows, procedural maps, retuned SSAO, punch-in all route through
  `TIER_FIDELITY`/`applyFidelity`/`instant()`.
- **G4 test stability:** HELD — rig child-index order + no-`Math.random` preserved.
- **G5 worktree discipline:** HELD — all edits on the leased card branch; committed by explicit
  branch name; no checkout/switch/reset; no push to main.

## Findings

**Blocking:** none.

**Non-blocking / for the human gate:**
1. **VER-2 per-tier screenshots not captured (preferred, deferred).** The headless sandbox has no
   WebGL/display/browser; a screenshot harness (playwright/puppeteer) would violate G2 (zero-dep).
   The render path is exercised headlessly by the boot-smoke reveal-beat test, but pixel fidelity —
   the actual subject of #29 ("functional but ugly") — is not machine-verified. **The human reviewer
   should run `npm run dev` and eyeball each tier (or attach screenshots) before merge.** This was
   correctly declared as a gate-review acceptance artifact upstream, not concealed.
2. **App chunk ~677 kB + a pre-existing Rapier chunk-size build warning** — informational; unchanged
   by this card and outside the visual scope.

## Alternatives considered

- **Reject pending screenshots:** rejected — the shortfall is environmental (no GPU/browser in the
  build sandbox), not a defect in the change; requirements already designated screenshots a
  human-gate artifact. Blocking here would stall a correct implementation on a check the automated
  environment structurally cannot perform.
- **Request a visual-regression harness in-scope:** rejected — it requires a new dependency
  (violates the hard G2 invariant this card committed to) and belongs to a separate tooling card.

## Known risks carried to gate-review

- Pixel quality is human-judged, not machine-verified (see finding 1). Occluder transform is
  positioned relative to the opponent at z≈-3; a wrong transform would hide the player or nothing —
  a live visual check at the gate is the mitigation.
- Perf headroom: shadows + extra lights + procedural detail raise GPU cost; tier-gating is in place
  (NFR-P), but the ≥50fps NFR bar is only provable on a real device at the human gate.

## Deviations

- VER-2 screenshots deferred to the human gate-review (preferred shortfall, see finding 1).
- Review ran with research_policy=on-demand and did not exercise web research (research_passes
  budget 1 unused) — the accepted requirements/design + live source fully grounded the review; no
  project data egressed.
- Applied reasoning effort not recorded (host exposes no per-run effort metadata; requested='high'
  unbound-by-contract).
