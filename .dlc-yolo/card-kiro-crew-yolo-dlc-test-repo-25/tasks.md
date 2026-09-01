# Tasks — card-kiro-crew-yolo-dlc-test-repo-25 (f3)

**Card:** `card-kiro-crew-yolo-dlc-test-repo-25`
**Issue:** [#25](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/25) — "[card-rps3d-objects · f3] Hidden-CPU board/occluder + reveal sequencing + regression seam"
**Parent:** #22 (card `card-rps3d-objects`), feature **f3 (S/1)**. **Depends on f1 (#23).**
**Step:** tasks · **trust:** assisted (inherited) · **depth:** deep · **capability:** dlcyolo-authoring
**Upstream:** design.md (this dir, §2–§6 + NFR5 test contract), requirements.md (R1–R5 / NFR1–NFR5 / 8 AC), investigation.md (`dec-25-viability` = GO).

---

## 0. Dispatch grounding (no faked crew run)

The tasks step (assigned to `impl-agent` "break design into atomic tasks") is a
read-design → analyze → write-task-list pass. This runtime's tool surface is **read / write / shell
only** — it does **not** hold `select_crew`/`spawn_run` (same empirically-confirmed finding as every
prior step on `pl-rps3d`: card-backlog-14, card-rps3d-headline, parent card-rps3d-objects, and this
card's own investigate/requirements/design runs). Per **PRODUCE-OR-BLOCK**, a run lacking the
crew-routing *mechanism* PERFORMS the step inline — task-breakdown is exactly dlcyolo-authoring
scope, done inline honestly. **NOT a capability-gap:** the absent tool is only dispatch, not one the
task work needs.

## 1. Live-source grounding (re-verified this step, not trusting the design paraphrase)

Synced owned repo to `origin/dlc/card-kiro-crew-yolo-dlc-test-repo-25 @ 29e0d83` (based off
`origin/main dcdb2e4`). Re-read the real seams the tasks touch:

- **`src/round/machine.ts`** — `RoundState { phase: 'idle'|'capturing'|'lowConfidence'|'resolved';
  playerShape; opponentShape; result; lastConfidence; score }`. `submit(r)` **synchronously**
  `pickOpponent()` → `resolve()` → sets `playerShape`/`opponentShape`/`result` → `phase='resolved'`
  → `emit()`. `begin()` sets `phase='capturing'`, clears shapes/result, `emit()`. `pickOpponent` is
  constructor-injected (deterministic in tests). **F1-first CONFIRMED.**
- **KEY SEQUENCING FACT (corrects the design's re-hide sketch):** `submit()` starts with
  `if (this.state.phase === 'resolved') this.begin();` — so calling `submit()` a **second** time
  (already resolved) FIRST calls `begin()` which emits a `capturing` state (→ controller `cover()`),
  THEN falls through to resolve + emit `resolved` (→ controller `reveal()`). The fresh-round re-hide
  (R5) is driven by that intermediate `capturing` emit. The NFR5 re-hide test must therefore call
  `begin(); submit(R); submit(R)` (or `submit; submit`) and assert `cover` fired **≥ 2** times.
- **`src/main.ts`** — `machine.onChange((s) => { render(s); if (phase==='resolved' && result) {
  poseT=0; juice.onResult(...) } })`; RAF `frame()` calls `juice.update(dt / 1000)`. The wire-in
  APPENDS `reveal.onState(s)` **after** `render(s)` and `reveal.update(dt / 1000)` next to
  `juice.update`. `boot()` is the real-DOM adapter; the testable logic lives in the new modules.
- **`src/a11y/motion.ts`** — `shouldTweenOnly({ reducedMotion, tier, physicsReady })` returns true on
  reduced-motion OR `QualityTier.Low` OR `!physicsReady`. This is the `instant()` signal.
- **`test/main.test.ts`** — node-env, fake-collaborator DI (`makeHarness`), **no THREE, no DOM**. The
  NFR5 test mirrors this discipline.
- **`package.json`** — `test = vitest run`, `build = tsc --noEmit && vite build`. **No `@types/node`**
  (only `@types/three`), so tests must stay DOM/WebGL/`fs`-free — use injected fakes + real
  `RoundMachine` (matches the design sketch, which uses no `fs`).
- **`src/types.ts`** — `Shape = 'rock'|'paper'|'scissors'`, `RoundResult = 'a'|'b'|'draw'`,
  `GestureResult { shape; confidence; lowConfidence; latencyMs }`. Import-only for f3 (NFR2).

## 2. Atomic tasks

Each task: **Do / Verify / Traces / Accept.** Dependency graph in §3.

### T1 — `src/render/occluder.ts` (NEW): interfaces + `NullOccluder` + `BoardOccluder` skeleton
- **Do:** Create `src/render/occluder.ts` exporting:
  - `interface OpponentObject { setVisible(visible: boolean): void; setShape(shape: Shape): void }`
    (imports `Shape` from `../types`, import-only).
  - `interface Occluder { cover(): void; reveal(instant: boolean): void; update(dt: number): void;
    isRevealed(): boolean }`.
  - `class NullOccluder implements Occluder` — always-ships fallback: `cover()`/`update()` no-op,
    `reveal()` sets an internal `_revealed=true`, `isRevealed()` returns it, initial `_revealed=true`
    (opponent simply stays shown when no board mesh exists yet).
  - `class BoardOccluder implements Occluder` — Three.js plane/panel skeleton in front of the
    opponent that slides/fades out on `reveal`; art direction (mesh form, material, slide-vs-fade,
    easing) is bounded by the interface. May be a minimal stub whose visible placement completes at
    f1 integration (T3 note).
- **Verify:** `tsc --noEmit` compiles; `NullOccluder` satisfies `Occluder` with no THREE import
  needed for the null path.
- **Traces:** R1, R4, NFR2, NFR4 (NullOccluder = always-ships/reversible).
- **Accept:** File exists; both classes implement `Occluder`; `NullOccluder` is THREE-free.

### T2 — `src/render/reveal.ts` (NEW): `RevealController` (pure, DOM/WebGL-free)
- **Do:** Create `src/render/reveal.ts` exporting:
  - `interface RevealDeps { occluder: Occluder; opponent: OpponentObject; instant: () => boolean }`
    (imports the two ifaces from `./occluder`, `RoundState` from `../round/machine`).
  - `class RevealController` with `private revealedThisRound = false`, `constructor(deps)`,
    `onState(s: RoundState)`, `update(dt: number)`.
  - `onState` beat logic (grounded in the real `RoundPhase` union):
    - `phase === 'capturing' || phase === 'idle'` → `revealedThisRound = false`;
      `occluder.cover()`; return. (R1/R5 re-hide + re-arm)
    - `phase === 'resolved' && s.result && s.opponentShape && !revealedThisRound` →
      `opponent.setShape(s.opponentShape)`; `occluder.reveal(deps.instant())`;
      `revealedThisRound = true`. (R2/R3; F1-first — reads ALREADY-committed shape/result)
    - `phase === 'lowConfidence'` → intentionally no-op (stay covered; player re-throws).
  - `update(dt)` → `occluder.update(dt)`.
- **Verify:** `tsc --noEmit` compiles; no `document`/`window`/THREE reference; depends only on the
  injected handles + `RoundState`.
- **Traces:** R2, R3, R4, R5, NFR1 (pure downstream consumer; never relocates `pickOpponent`, never
  reads timing to derive result), NFR3 (`instant()` path).
- **Accept:** Controller is a pure class over `RevealDeps` + `RoundState`; idempotent per round via
  `revealedThisRound`; low-confidence stays covered.

### T3 — `src/main.ts`: additive wire-in
- **Do:** In `boot()`, ADDITIVE only:
  1. After the `juice` construction, build `const occluder = new NullOccluder()` + a stub
     `OpponentObject` (opponent stays text-only via the unchanged `render(s)` until f1 lands) +
     `const reveal = new RevealController({ occluder, opponent: <stub>, instant: () =>
     shouldTweenOnly({ reducedMotion: reduced, tier: monitor.getTier(), physicsReady: !!physics }) })`.
     (Reuse the exact `shouldTweenOnly` call shape already used for `juice`'s `tweenOnly`.)
  2. In the existing `machine.onChange` handler, **APPEND** `reveal.onState(s)` **after** `render(s)`
     — render (a11y-authoritative status/badge) fires first, then the cosmetic reveal. `render(s)`
     stays **byte-for-byte unchanged** (NFR3). Do NOT move it into the `resolved` guard — the
     controller needs `capturing`/`idle`/`lowConfidence` states too.
  3. In the RAF `frame()` loop, ADD `reveal.update(dt / 1000)` next to `juice.update(dt / 1000)`
     (same cosmetic timing channel, seconds delta — matches `juice.update`, NOT the raw-ms `poseT`).
  4. **f1 seam (T7, sequenced):** the ONLY line gated on f1 is swapping the stub for f1's real
     `OpponentObject` (and a `BoardOccluder`) in `onRigLoaded`. Leave a clearly-commented seam;
     `NullOccluder` + stub keep f3 non-regressive until then.
- **Verify:** `render(s)` diff shows no change; `machine.onChange` gains exactly one appended
  `reveal.onState(s)` call after `render(s)`; `frame()` gains exactly one `reveal.update(...)`;
  `tsc --noEmit && vite build` clean.
- **Traces:** R1, R2, R5, NFR1 (append after render, no upstream coupling), NFR3 (render unchanged),
  NFR4 (existing RAF channel, no new dep).
- **Accept:** Additive `main.ts` diff only; `render(s)` unchanged; reveal wired as a downstream
  consumer; game boots green with `NullOccluder` (no visible regression pre-f1).

### T4 — `test/reveal.test.ts` (NEW): NFR5 headless regression (the acceptance-defining artifact)
- **Do:** Create `test/reveal.test.ts`, `environment: 'node'`, mirroring `test/main.test.ts`
  fake-collaborator discipline (no THREE, no DOM, no `fs`). Fake `Occluder` records a `calls: string[]`
  stream (`'cover'`, `'reveal'`, `'reveal:instant'`); fake `OpponentObject` records `shownShape`.
  Drive a **real** `new RoundMachine(() => 'rock')` with `m.onChange(s => ctrl.onState(s))`. Five
  assertions (design §5):
  1. **hidden-then-shown:** `m.begin()` → `calls` contains `'cover'`, not `'reveal'`; `m.submit(R)`
     (`R.shape='scissors'`) → `calls` contains `'reveal'`.
  2. **committed-before-reveal (F1-first):** snapshot machine state at the moment the controller
     reveals (wrap the onChange to capture `{ phase, result, opponentShape }` when a `reveal*` call
     is appended); after `m.submit(R)` assert snapshot `=== { phase:'resolved', result:'a',
     opponentShape:'rock' }` (scissors beats rock ⇒ `'a'`) and `shownShape === 'rock'`.
  3. **reduced-motion instant:** `instant: () => true` → after `begin(); submit(R)` → `calls`
     contains `'reveal:instant'`, no plain `'reveal'`.
  4. **low-confidence stays covered:** `submit({ shape:'rock', confidence:0.2, lowConfidence:true,
     latencyMs:5 })` → `calls` does NOT contain any `reveal*`.
  5. **fresh-round re-hide (R5):** `m.begin(); m.submit(R); m.submit(R)` → `cover` count **≥ 2**
     (the 2nd `submit` re-enters via `begin()`'s `capturing` emit — verified in live `machine.ts`).
- **Verify:** `npm test` — the 5 new tests pass; total suite count rises by 5.
- **Traces:** NFR5, AC1, AC2, AC3, AC5, AC7, AC8.
- **Accept:** Node-env DOM-free test using injected fakes + real `RoundMachine`; all 5 pass.

### T5 — build/gate + guard-bite + additive-only diff
- **Do:** Run `npm run build` (`tsc --noEmit && vite build`) and `npm test` (full suite). Confirm the
  **additive-only** touch set via `git diff --name-only origin/main..HEAD` (code/test excluding the
  `.dlc-yolo` mirror) = EXACTLY `src/render/occluder.ts` (new) + `src/render/reveal.ts` (new) +
  `src/main.ts` + `test/reveal.test.ts` (new). Run the NFR2 protected-surface guard:
  `git diff --name-only origin/main..HEAD -- 'src/round/**' src/rules.ts src/types.ts` returns
  **EMPTY** (types import-only). **Guard-bite proof:** temporarily (a) move the reveal trigger off
  `phase==='resolved'` (or before commit) → the committed-before-reveal test goes RED; (b) drop the
  fresh-round `cover()` → the re-hide test goes RED; then revert → all green.
- **Verify:** Build clean (pre-existing rapier chunk warning only); full suite green; protected-surface
  guard EMPTY; guard-bite observed RED then reverted to green.
- **Traces:** AC4 (additive diff), AC6 (zero new dep — `package.json` unchanged), AC7 (guard bites),
  NFR2.
- **Accept:** All gates pass; diff is additive-only; guard demonstrably bites.

### T7 — f1-gated visible integration (SEQUENCED after f1 #23 merges)
- **Do:** Once f1 (#23) lands its `OpponentObject` render path + throwable-object rig, in
  `onRigLoaded`: swap the stub opponent for f1's real `OpponentObject`, construct a `BoardOccluder`
  positioned in front of it, and pass both into the `RevealController` (replacing `NullOccluder` +
  stub). No logic change to `reveal.ts` — only the boot-time handle swap.
- **Verify:** Board visibly covers the opponent object from round-begin and plays the reveal on
  resolve; reduced-motion shows instantly; each round re-hides. (Manual/visual — f3 unit tests
  already lock the sequencing.)
- **Traces:** R1, R2, R3, R5 (visible end-to-end); dependency in requirements §5 / design §6.
- **Accept:** **Sequenced, NOT part of this card's own PR gate.** T1–T5 ship GREEN standalone via the
  null-safe `NullOccluder` + stub; T7 is the one line gated on f1 and lands when f1 is merged. Called
  out explicitly so implement does not block f3's PR on f1.

> **Note on numbering:** tasks are T1–T5 + T7 to mirror the design's §6 target IDs (no T6 in the
> design's target list — §6 uses T5 for build/gate and marks the sequencing as its own bullet). Kept
> aligned to avoid renumber drift against design.md.

## 3. Dependency graph

```
T1 (occluder.ts: ifaces + NullOccluder + BoardOccluder skeleton)
 ├─▶ T2 (reveal.ts: RevealController — needs the ifaces)
 │    └─▶ T4 (reveal.test.ts — tests the controller against fake Occluder/OpponentObject)
 └─▶ T3 (main.ts wire-in — constructs NullOccluder + RevealController)
T2, T3, T4 ──▶ T5 (build/gate + guard-bite + additive-only diff)   [f3's OWN PR gate]

T7 (f1-gated visible integration) ── sequenced AFTER f1 (#23) merges ── NOT in f3's PR gate
```

T1 → T2 → T4 and T1 → T3 are the build order; T5 is the exit gate for f3's single-card PR. T7 is
isolated behind the f1 dependency (T1/T2/T4 are f1-independent, T3 uses `NullOccluder`+stub).

## 4. Global acceptance (parent exit criteria for f3's own PR — maps 1:1 to requirements AC)

1. **AC1** Opponent hidden from round-begin until the reveal beat, then shown — T2 logic + T4 test #1.
2. **AC2** Reveal is a discrete beat — T1 `reveal()`/`update()` transition + T2 sequencing.
3. **AC3** `pickOpponent()` stays in `submit()`; result/opponentShape committed before reveal — T4
   test #2 (committed-before-reveal snapshot).
4. **AC4** No edits to `src/round/**` / `rules.ts` / `types.ts` (import only) — T5 protected-surface
   guard EMPTY.
5. **AC5** Committed outcome still announced (status/badge) with the board present; reduced-motion
   collapses to instant show — T3 (`render(s)` unchanged) + T4 test #3.
6. **AC6** Zero new dependency — T5 (`package.json` unchanged).
7. **AC7** Node-env DOM-free regression exists and BITES — T4 + T5 guard-bite proof.
8. **AC8** Fresh round re-hides — T4 test #5 (cover ≥ 2 via the `begin()` re-entry emit).

## 5. Additive touch set (NFR2, enumerated for implement)

- **NEW** `src/render/occluder.ts`
- **NEW** `src/render/reveal.ts`
- **EDIT (additive)** `src/main.ts` — construct + `onState` append after `render` + `update` in RAF
- **NEW** `test/reveal.test.ts`
- **ZERO** edits to `src/round/**`, `src/rules.ts`, `src/types.ts` (import-only), `src/gesture/**`,
  `src/physics/**`, `src/a11y/**`, `src/render/{scene,post,tiers,hands,framing}.ts`.

## 6. Effort & back-step

`effort.features=[f3 S/1]`; `effort.total=1`; `effort.scope[tasks]=1` (leaf slice broken into atomic
tasks, scope NOT grown vs investigate=1 / requirements=1 / design=1). deep GROWTH_FACTOR=3.0
back-step `1 > 3×1(design=1)=3`? **NO.** No feature parked, no children created (leaf — f2/#24 and
f1/#23 are siblings under parent #22, not f3's children).

## 7. Decision-gate self-check (ASK-BEFORE-DONE, run against inputs at step start)

- **Serves intent?** Yes — tasks map 1:1 onto design §2–§6 and the 8 requirement AC (hide the CPU
  pick, big reveal beat, over an already-committed result).
- **Unseen scope?** No — introduces no entity design/requirements didn't sanction (occluder +
  controller + one test + additive wire-in).
- **Consequential implicit choice changing WHAT is produced?** None. The occluder mesh form /
  slide-vs-fade / easing / offset are implement TUNING knobs bounded by the `Occluder` contract and
  guarded by T4. The one design fork (how to express the reveal headlessly) was resolved at design by
  the injectable interface. The f1 dependency is a **sequencing** constraint isolated to T7, not a
  fork changing WHAT is built.
- **Human-only fork / routing change?** None — the single structural fork (single-card vs fan-out)
  was answered by the human interjection at the parent (#22); f3 exists because of it.
- **Capability-gap?** No — task-breakdown needs read/write/shell only; the absent `select_crew`/
  `spawn_run` is only the dispatch mechanism. Performed inline per PRODUCE-OR-BLOCK.

→ **No blocking `ask_question`; no new decision-gate entry required.** Proceed to `done`.

## 8. Next

`gate-impl` — card trust=**assisted**, so the advance cron does NOT auto-approve; it PARKS the human
gate-impl for a human to approve the task list before implement runs (assisted/manual gates wait for
a human, never forced). **f3's implement:** T1–T5 land now against the interface + `NullOccluder`
(f1-independent, ship green in f3's own single-card PR); T7's visible board activation sequences
after **f1 (#23)** lands the opponent object it hides/reveals. Parent #22 retires only when
#23/#24/#25 are all consumed.
