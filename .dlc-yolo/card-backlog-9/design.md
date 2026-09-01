# Design — Gesture: count scissors reversals on both axes (LOW-1)

- **Card:** card-backlog-9
- **Pipeline:** pl-rps3d
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Branch:** `feat/rps3d-maxxed` (where the F1 gesture engine lives; never `main`)
- **Source issue:** #9 · **Type:** bug / enhancement (correctness hardening) · **Depth:** standard · **Trust:** autonomous
- **Authored by:** `dlcyolo-rps3d-design` crew persona (authoring capability profile), run inline per skill M1
- **Grounded on:** the ACTUAL code at HEAD `cf25814` — `src/gesture/features.ts`, `classifier.ts`, `fixtures.ts`, `harness.ts`

## 1. Root cause (verified in code, not paraphrased)

`src/gesture/features.ts` already counts reversals **per axis** independently and
correctly (`reversalsX`, `reversalsY`, tracked via `prevSignX`/`prevSignY`). The defect
is purely in the **final collapse** to a single exported scalar:

```ts
// features.ts, current
const dominantAxis = absY >= absX ? 'vertical' : 'horizontal';
const reversals = dominantAxis === 'vertical' ? reversalsY : reversalsX;  // ← the bug
```

The exported `reversals` discards the non-dominant axis. A **vertical-dominant or
diagonal** scissors flick — where the discriminating back-and-forth happens on the axis
that is NOT dominant by net displacement — is under-counted, so
`reversalStrength = min(reversals/3, 1)` in `classifier.ts` drops and the throw can
misclassify (scissors → rock/paper).

Why it is invisible today: every committed scissors fixture in `fixtures.ts` is
**net-horizontal** (per-step dx ≈ 20–26 dominates dy ≈ 2–4), so `dominantAxis` resolves
to `horizontal` and the export happens to read the (correct, high) `reversalsX`. The
`>=85%` harness gate therefore stays green over a code path that only works for one axis.

## 2. The fix (minimal, interface-preserving)

**Change one line** in `features.ts`: sum both axes instead of selecting the dominant one.

```ts
// features.ts, proposed
const reversals = reversalsX + reversalsY;
```

`dominantAxis` / `dominantAxisRatio` remain unchanged and still feed the rock/paper
axis-confidence terms — only the reversal *count* stops being axis-gated. This is the
issue's literal ask (**Q1 → plain sum**, the recommended and minimal resolution) and the
smallest change that provably counts non-dominant-axis reversals (R1).

### 2.1 Why summing does NOT regress existing gestures (the key safety argument)

The classifier consumes reversals only through a **saturating** term:

```ts
const reversalStrength = Math.min(f.reversals / 3, 1); // clamps at reversals >= 3
const scissors = reversalStrength * 1.5;
```

- **Horizontal scissors (existing fixtures):** reversalsX is already ~5 (six alternating
  segments). Under the old code `reversals ≈ 5` → clamped to 1. Under the sum,
  `reversalsX + reversalsY` is even larger → **still clamped to 1**. `reversalStrength`
  is identical (1.0). **No score change → no reclassification → R3 holds.**
- **Rock / paper (existing fixtures):** near-monotonic, so both `reversalsX` and
  `reversalsY` are ~0–1. The sum stays small; `reversalStrength` stays low; the
  `(1 - reversalStrength)` rock/paper terms are effectively unchanged. **No regression.**
- **Vertical-dominant scissors (the target case):** old code read `reversalsY` alone but
  the *snip* alternation may live largely on X (or split across both), under-counting.
  The sum captures the full alternation → `reversalStrength` rises to the scissors-winning
  range → **correct classification (R1, R4).**

Because the consuming term saturates at 3 reversals, summing cannot *inflate* a
non-scissors gesture into scissors either (rock/paper simply don't alternate on either
axis). The fix is monotone-safe in both directions.

## 3. Interface contract (R2 — unchanged)

- `Features` shape: **unchanged** — `reversals` stays a single `number`; its *derivation*
  changes, its type/name/position do not.
- `extract(window)` signature: **unchanged**.
- `classify(f, threshold?)` signature and `Scored` shape: **unchanged** — the classifier
  is not touched at all.
- Downstream (`engine.ts`, round machine, render, physics, a11y): **untouched** — this is
  an internal correctness fix behind the existing `extract → classify` seam (NFR1).

## 4. Test & fixture design (R4, NFR2)

Two independent guards, so the regression can never silently return:

1. **Unit test (NFR2) — `test/gesture.test.ts`.** Assert both-axes counting directly on a
   synthetic sequence that alternates primarily on the NON-dominant axis. Construct a
   window whose net displacement is vertical-dominant (large sumDy) but whose X path
   alternates sign several times, then assert `extract(window).reversals >= <N>` where the
   old dominant-axis-only logic would have returned the (smaller) `reversalsY`. This test
   **fails against the current code and passes against the fix** — locking the behavior at
   the feature layer, independent of the classifier.

2. **Harness fixture (R4) — `fixtures.ts`.** Add a `scissorsVertical(scale)` builder: a
   back-and-forth snip whose per-step displacement is **vertical-dominant** (dy ≈ 20–26,
   dx ≈ 2–4) with alternating **dy** sign — i.e. the mirror of the existing horizontal
   `scissors()`. Register it under `label: 'scissors'` in `FIXTURES`. Optionally (Q2 —
   recommended, cheap) also add a `scissorsDiagonal(scale)` builder with comparable dx/dy
   magnitudes both alternating. These fixtures would **misclassify under the old logic**
   (dominant axis = vertical → reads only `reversalsY`, which for the diagonal case may be
   lower than the true alternation) and **classify as scissors under the sum**, exercising
   R4 through the accuracy harness end-to-end.

   Note the fixture math must genuinely defeat the old code: for the vertical-dominant
   builder, put enough of the alternation on X (or split it) that dominant-axis-only
   under-counts — otherwise the fixture wouldn't have regressed and wouldn't lock anything.
   The `scissorsVertical` builder should alternate BOTH axes (dx sign flips too) so that
   `reversalsX > reversalsY` while `absY > absX`, making the old `reversals = reversalsY`
   strictly smaller than `reversalsX + reversalsY`.

## 5. Acceptance gates (from requirements)

- AC1: `features.ts` exports `reversals = reversalsX + reversalsY`. ✔ (§2)
- AC2: a vertical-dominant scissors fixture is added and classifies as scissors. ✔ (§4.2)
- AC3: `tsc --noEmit` clean, `vite build` clean, full Vitest green incl. `>=85%` harness
  gate + per-shape `>=75%` no-collapsed-class guard. ✔ (§2.1 argues no regression;
  verified at implement)
- AC4: a unit test asserts the both-axes reversal count on a synthetic vertical sequence.
  ✔ (§4.1)

## 6. Effort / scope

- One-line production change + 1 unit test + 1–2 fixtures + 1 builder. Single feature, **S (1 pt)**.
- `effort.scope[design] = 1`, held FLAT vs `scope[requirements] = 1` and `scope[investigate] = 1`.
- Back-step check (standard `GROWTH_FACTOR = 2.0`): trips only if `scope[design] > 2 ×
  scope[requirements]` = `> 2`; `1 ≤ 2` → **NO back-step**. Single S feature, no
  decomposition, well under budget (`max_child_cards`/effort ceiling untouched).

## 7. Decision Gate — NOT raised

- **Intent-fidelity:** the design serves issue #9's stated both-axes goal directly; the
  §2.1 argument confirms it also serves the *real* intent (harden vertical/diagonal
  scissors without regressing the shipped classifier).
- **Unseen scope:** none — single known module (`features.ts`) + its tests; the interface
  is preserved; no new entity, dependency, or architecture introduced.
- **Implicit technical fork:** none — Q1 (sum vs read-both-and-threshold) is resolved
  *explicitly* here in favor of the plain sum, with the saturation argument (§2.1) showing
  why sum is both the minimal AND the regression-safe choice. Q2 (add a diagonal fixture)
  is a cheap test-coverage add, recommended, not a fork.
- **Capability-gap:** none — `dlcyolo-authoring` fully covers doc authoring for this step;
  the implement step (a `builder`-capability step) will make the one-line change + tests.

## 8. Handoff to `tasks`

The design decomposes into a tight, ordered task list for the `tasks` step:

1. **T1** — `features.ts`: change `reversals` to `reversalsX + reversalsY` (production fix, R1/R2).
2. **T2** — `test/gesture.test.ts`: add a unit test asserting both-axes reversal count on a
   synthetic non-dominant-axis-alternating window (NFR2, AC4).
3. **T3** — `fixtures.ts`: add `scissorsVertical` (and, per Q2, `scissorsDiagonal`) builder(s)
   + register under `FIXTURES` (R4, AC2).
4. **T4** — run gates: `tsc --noEmit`, `vite build`, full Vitest incl. harness `>=85%` +
   per-shape guard (AC3).

Sandbox: all work on `feat/rps3d-maxxed` within the owned repo only.
