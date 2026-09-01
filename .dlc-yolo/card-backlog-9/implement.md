# Implement — Gesture: count scissors reversals on both axes (LOW-1)

- **Card:** card-backlog-9 · **Pipeline:** pl-rps3d
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Branch:** `feat/rps3d-maxxed`
- **Source issue:** #9 · **Type:** bug / enhancement · **Depth:** standard · **Trust:** autonomous
- **Grounded on:** the ACTUAL code at branch HEAD (origin `d200c8c` at run time — the
  branch had advanced past the tasks-recorded `cf25814`, so the fix was grounded on the
  live source, not the stale line numbers).

## What changed

### T1 — production fix (`src/gesture/features.ts`)
Replaced the axis-gated reversal collapse

```ts
const reversals = dominantAxis === 'vertical' ? reversalsY : reversalsX; // dropped the non-dominant axis
```

with the both-axes sum

```ts
const reversals = reversalsX + reversalsY;
```

`reversalsX` / `reversalsY` were already counted correctly per axis; only the final
selection changed. `dominantAxis` / `dominantAxisRatio` are unchanged and still feed the
rock/paper axis-confidence terms. `Features` shape, `extract()` / `classify()` signatures:
all unchanged (R2 / NFR1).

### T2 — fail-then-pass unit test (`test/gesture.test.ts`)
Added a test on a vertical-dominant window whose `dy` is monotone (so the OLD code's
`reversalsY = 0`) while `dx` alternates every step. Asserts `dominantAxis === 'vertical'`
and `reversals >= 3`. Red on the old logic, green on the fix.

### T3 — regression-locking fixtures (`src/gesture/fixtures.ts`)
- `scissorsVertical(scale)` — net vertical-leaning (dy monotone → old `reversalsY = 0`)
  with an X-axis snip (dx alternating → high `reversalsX`). Ratio kept **moderate** (~1.6)
  so the classifier's axis-gated `rock` term does not swamp `scissors` (a near-pure
  vertical chop reads as rock regardless of reversals — that is a real classifier property,
  not a bug in this card, so the fixture models a realistic vertical-*leaning* snip).
- `scissorsDiagonal(scale)` — comparable dx/dy magnitude, both axes alternate (Q2 coverage).
- Both registered under `label: 'scissors'` across scales `0.8 / 1 / 1.25 / 1.5`.

## Verification

- `npx tsc --noEmit` — **clean**
- `npx vite build` — **clean**
- `npx vitest run` — **41/41 passing**, including `test/harness.test.ts`'s `>=85%` overall
  accuracy gate AND the per-shape `>=75%` no-collapsed-class guard, now with the 8 new
  vertical/diagonal scissors fixtures added.
- **Masking-premise proof:** of the 8 new fixtures, **4** (the `scissorsVertical` set)
  misclassify under the OLD axis-gated logic and classify as scissors after the fix — so
  the regression is genuinely locked, not a no-op fixture.
- **No regression** on existing rock / paper / horizontal-scissors: the classifier consumes
  `reversals` only through the saturating term `min(reversals/3, 1)`; horizontal scissors
  were already `reversalsX ≈ 5` (clamped to 1), so the sum stays clamped to 1 → identical
  score (design §2.1). All pre-existing tests remain green.

## Scope

Single S (1 pt) feature; `effort.scope[implement] = 1`, flat vs design/tasks/requirements.
No back-step, no fan-out, no Decision Gate, no parked tangents. All work confined to the
owned repo on `feat/rps3d-maxxed`.
