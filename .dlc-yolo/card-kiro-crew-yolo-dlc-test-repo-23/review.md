# Review — f1 (#23): throwable RPS object-rig + opponent-object render path

- **Card:** card-kiro-crew-yolo-dlc-test-repo-23 (f1 FOUNDATION child of parent #22, Order-4 deep-decomposition proof)
- **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Branch:** dlc/card-kiro-crew-yolo-dlc-test-repo-23 @ 7d7ae49 (based off origin/main dcdb2e4)
- **Modes:** trust=assisted (inherited) · depth=deep · capability=dlcyolo-authoring
- **Reviewer step:** review vs requirements.md + design.md
- **Reviewed:** 2026-09-01 (grounded in LIVE git + GitHub + build/tests, not the implement note)

## Verdict: PASS

No Critical / High / Medium findings. One non-blocking **Low** (informational). Recommend approve at gate-review → proceed to pr (one PR: dlc/card-kiro-crew-yolo-dlc-test-repo-23 → main).

## What was verified live (not asserted)

1. **Ownership guard** — `gh api user` → hai-dvash == issue #23 author hai-dvash (is_bot=false), issue OPEN, carries `dlc:review`. PASS, fail-closed.
2. **Branch chain / single-card diff** — `origin/main..HEAD` = exactly the 6 card-23 commits (investigate 6666420 → implement 7d7ae49); code/test diff = EXACTLY `src/render/objects.ts` (A) + `test/objects.test.ts` (A) + `src/main.ts` (M); full changed set adds only the `.dlc-yolo/card-kiro-crew-yolo-dlc-test-repo-23/` mirror. ZERO cross-card bleed (no card-24/f2 or card-25/f3 files).
3. **NFR2 additive-only** — protected-surface guard over `src/round/**`, `src/rules.ts`, `src/types.ts` (import-only), `src/a11y/**`, `src/render/hands.ts` returned **EMPTY**. Diff-confirmed additive, not asserted.
4. **Build** — `tsc --noEmit && vite build` clean (pre-existing rapier chunk >500 kB warning only).
5. **Tests** — `npm test` = 9 files, **63 passed** (baseline 57 + 6 new in objects.test.ts). implement's 57→63 claim ACCURATE.
6. **Guard-bites (F1-first net genuinely bites)** — flipped the deterministic `pickOpponent` `'rock'→'paper'` in the committed-result case WITHOUT changing the expected shape → case went RED (`expected 'paper' to be 'rock'`), proving the assertion reads the REAL committed pick, not a tautology. Reverted → 63 green. Tree clean.

## Requirement / NFR conformance

| Ref | Requirement | Status | Evidence |
|-----|-------------|--------|----------|
| R1 | Object-rig replaces HandRig as player visual, same HandRig contract | PASS | `RpsObjectRig implements HandRig` (object/setShape/dispose); `loadObjects(tier):Promise<HandRig>` matches `loadHands`; `wireGame` consumes it with `loadHands: () => loadObjects(bootTier)` — no structural change |
| R2 | NEW opponent-object render path off committed opponentShape | PASS | `opponent = makeRpsObjectRig()` added at (0,0,-3); driven by `opponent.setShape(s.opponentShape, 1)` inside the existing `machine.onChange` resolved branch |
| R3 | Reads instantly as RPS | PASS | Distinct parametric silhouettes (icosahedron rock / thin box paper / crossed-box scissors); player + opponent share the factory (same visual language) |
| R4 | Same input/DI seams, no gameplay coupling | PASS | `objects.ts` imports only THREE/types/config/HandRig iface — NO round-layer import; opponent NOT in `computeRigScale`/`frameObject` (single-object framing intact) |
| R5 | Zero new dependency | PASS | Parametric Three.js primitives + MeshStandardMaterial; no asset, no async load, no new package |
| NFR1 | **F1-first / render-as-consumer (LOAD-BEARING)** | PASS | `pickOpponent()` stays solely in `RoundMachine.submit()` (submit unchanged); opponent driven off ALREADY-committed `s.opponentShape`; render(s) untouched; test asserts committed-before-observed + submit() untouched |
| NFR2 | Additive-to-core | PASS | Diff-confirmed: only objects.ts (new) + objects.test.ts (new) + main.ts (edit); protected-surface guard EMPTY |
| NFR3 | a11y preserved | PASS | `render(s)` status/badge branch byte-for-byte unchanged; outcome still announced; no new aria-live writes from the object layer |
| NFR4 | Regression on the untested render/wiring surface | PASS | `test/objects.test.ts` node-env DOM/WebGL-free, reuses the wireGame makeHarness DI seam; closes the exact card-rps3d-fix broken-green gap class (the render/wiring surface is now covered) |
| NFR5 | Reversible / graceful always-ships floor | PASS | `RpsObjectRig` always constructs (never null); `loadObjects` is the always-ships baseline mirroring PrimitiveHandRig; a future sourced-mesh upgrade slots behind the same seam |

Acceptance criteria (7) mapped 1:1 to the delivered files + test cases; all met.

## Test substance (read, not counted)

`test/objects.test.ts` (6 cases):
- (1) rig satisfies HandRig contract (object/setShape/dispose).
- (1) wires through `wireGame`: added to scene, scaled `[0.25]` (radius 4 → diagonal 8), framed with measured center/radius — mirrors `main.test.ts`.
- setShape selects the active object + decays others; clamps t; exposes no machine/submit ref (render-only consumer).
- opponent path renders the committed `opponentShape` from the onChange subscriber, asserting `opponentShape` committed BEFORE observed (F1-first proof) with `submit()`/`pickOpponent()` untouched (deterministic pick=rock, player=scissors → rock beats scissors → result 'b', grounded in the real BEATS map).
- guard-bites case pinning rendered opponent == `machine.getState().opponentShape`.

The `emphasisOf` helper reads `object.children[idx]` with `{rock:0,paper:1,scissors:2}`; children are added in `SHAPES` order (rock, paper, scissors) in the constructor, so the index mapping is correct.

## Findings

**Low-1 (non-blocking, informational).** `RpsObjectRig` builds three child meshes and disposes geometries on `dispose()`, but the shared `MeshStandardMaterial` instances created by `objectMaterial()` / the scissors blades are not disposed (only geometries are traversed+disposed). For a single long-lived player rig + one opponent rig this is negligible (two rigs for the app lifetime, materials GC on teardown), and it matches the existing `PrimitiveHandRig.dispose()` pattern (also geometry-only) — so it is consistent with the codebase, not a regression. Optional future tidy: dispose materials in `dispose()` if object-rigs are ever created/destroyed per round. Not worth churn for a foundation slice with two lifetime instances; NOT routed as a blocking fork.

## Effort / back-step

- `effort.scope[review] = 2` (read 3 files + conformance matrix + live build/tests + guard-bites probe; scope not grown/shrunk).
- depth=deep → GROWTH_FACTOR 3.0. Back-step check: 2 > 3 × 3 (implement scope 3)? NO. No back-step.
- No feature parked. No decision gate raised (serves literal + underlying intent; no unseen scope; the four design forks were resolved at design and only realized at implement; the single-card-vs-fan-out fork was answered by the human interjection at parent #22; dlcyolo-authoring read/shell/write sufficed — the absent select_crew/spawn_run is only the dispatch mechanism, not a review-work capability-gap).

## Dispatch grounding

This runtime's tool surface is read/write/shell only — it does not hold `select_crew`/`spawn_run` (same finding as every prior step on pl-rps3d). Review is a read-source → run-build+tests → analyze → write pass = exactly the review-agent's dlcyolo-authoring scope, performed inline per PRODUCE-OR-BLOCK; nothing faked.

## Handoff

NEXT = gate-review. Card trust=ASSISTED → the advance cron does NOT auto-approve; it PARKS the human gate-review for a human decision (assisted gates wait for a human). Reviewer recommends **approve** → proceed to pr. f1 LANDS FIRST — it is the foundation f2 (#24, pop) and f3 (#25, board/reveal) both depend on; parent #22 retires only when f1/f2/f3 are all consumed.
