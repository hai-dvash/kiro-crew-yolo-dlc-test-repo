# Implement — card-kiro-crew-yolo-dlc-test-repo-25 (f3)

**Card:** `card-kiro-crew-yolo-dlc-test-repo-25` · **Issue:** [#25](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/25)
**Parent:** #22 (`card-rps3d-objects`), feature **f3 (S/1)**. **Depends on f1 (#23).**
**Step:** implement · **trust:** assisted (inherited) · **depth:** deep · **capability:** dlcyolo-builder
**Branch:** `dlc/card-kiro-crew-yolo-dlc-test-repo-25` (ONE branch per card → ONE PR).

## What shipped (T1–T5; T7 deferred)

f3 adds the hidden-CPU board/occluder + reveal-sequencing controller as a **pure downstream
consumer** of the already-committed round result (F1-first / NFR1). Strictly additive.

- **T1 — `src/render/occluder.ts` (NEW):** `Occluder` + `OpponentObject` capability interfaces;
  `NullOccluder` (THREE-free always-ships fallback — keeps the opponent shown when no board mesh
  exists yet, so f3 is non-regressive before f1); `BoardOccluder` (Three.js fade-panel skeleton,
  opacity 1→0 over `REVEAL_MS=320`, `instant` collapses to immediate show). Art direction bounded
  by the contract.
- **T2 — `src/render/reveal.ts` (NEW):** `RevealController`, pure DOM/WebGL-free `onChange`
  subscriber. Beat logic on the real `RoundPhase` union: `capturing|idle` → `cover()` + re-arm
  (`revealedThisRound=false`); `resolved && result && opponentShape && !revealedThisRound` →
  `opponent.setShape(committed)` then `occluder.reveal(instant())`; `lowConfidence` → no-op
  (stays covered). Idempotent per round.
- **T3 — `src/main.ts` (additive edit):** import `NullOccluder`/`OpponentObject` + `RevealController`;
  construct `NullOccluder` + `opponentStub` + `RevealController` (with `instant` reusing the exact
  `shouldTweenOnly({reducedMotion,tier,physicsReady})` shape `juice` uses); **append**
  `reveal.onState(s)` AFTER `render(s)` in `machine.onChange` (render/a11y first, cosmetic reveal
  second — same ordering that governs `juice`); add `reveal.update(dt/1000)` next to `juice.update`
  in the RAF loop (seconds delta). `render(s)` body is **byte-for-byte unchanged** (NFR3).
- **T4 — `test/reveal.test.ts` (NEW):** node-env DOM/WebGL/fs-free NFR5 regression, drives a REAL
  `RoundMachine(()=>'rock')` + fake `Occluder`/`OpponentObject`. 5 assertions: hidden-then-shown
  (AC1); result committed-before-reveal snapshot — F1-first (AC3); reduced-motion → instant show
  (AC5); low-confidence stays covered; fresh-round re-hide `cover ≥ 2` (R5/AC8).
- **T5 — gate:** `tsc --noEmit && vite build` clean (pre-existing rapier chunk warning only);
  `npm test` **57 → 62** (+5). Additive-only diff confirmed = EXACTLY `src/main.ts` +
  `src/render/occluder.ts` + `src/render/reveal.ts` + `test/reveal.test.ts`; NFR2 protected-surface
  guard (`src/round/**`, `rules.ts`, `types.ts`, `gesture/**`, `physics/**`, `a11y/**`, render-core)
  returned **EMPTY**; `package.json` unchanged (AC6 zero new dep). **Guard-bites verified:** removing
  the `capturing/idle → cover()` turns the hidden-then-shown + re-hide tests RED (2 failed), reverted
  → 62 green.
- **T7 — DEFERRED (f1-gated):** the visible board activation (swap `NullOccluder`+stub for a
  `BoardOccluder` + f1's real `OpponentObject` in `onRigLoaded`) is left as a clearly-commented seam.
  f1 (#23) is OPEN/unmerged — there is no opponent object to hide yet, so faking it would violate
  PRODUCE-OR-BLOCK + NFR2. T1–T5 ship GREEN standalone via the null-safe fallback.

## Deviation from the design/tasks sketch (documented)

The upstream test sketch asserted `resolve('scissors','rock') === 'a'` ("scissors beats rock"). That
is **wrong about RPS** — live `src/rules.ts` `BEATS.rock='scissors'`, so rock beats scissors and
`resolve('scissors','rock')` returns **`'b'`** (opponent wins). Corrected the F1-first assertion to
`result:'b'` to match the real game authority (the controller code is unaffected — it reads whatever
`submit()` committed). This is the test being fixed to ground truth, not a behavior change.

## Verification (live, on the branch)

- Build: `tsc --noEmit && vite build` → clean.
- Tests: `vitest run` → **9 files, 62 passed** (baseline 57 + 5 f3).
- Guard-bite: RED (2) with `cover()` removed → GREEN (62) reverted.
- Diff: additive-only; protected-surface guard EMPTY; `render(s)`/`package.json` unchanged.

`effort.scope[implement]=1` (leaf S/1 slice built, not grown). deep GF=3.0 back-step `1 > 3×1`? **NO.**
No feature parked, no children created. **NEXT = review.**
