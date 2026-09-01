# Requirements — Gesture: count scissors reversals on both axes (LOW-1)

- **Card:** card-backlog-9
- **Pipeline:** pl-rps3d
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Source issue:** #9 (https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/9)
- **Origin:** parked LOW-1 finding from card-rps3d-max review (issue #6 / PR #7)
- **Type:** bug / enhancement (correctness hardening)
- **Depth:** standard · **Trust:** autonomous
- **Authored by:** dlcyolo-rps3d-spec persona (authoring capability profile), run inline (M1)

## Problem (grounded in the actual code)

`src/gesture/features.ts` on branch `feat/rps3d-maxxed` already tracks direction
reversals **per axis** — `reversalsX` and `reversalsY` are counted independently
(lines 30, 54–58). But the exported `reversals` value collapses to the **dominant
axis only**:

```ts
const dominantAxis = absY >= absX ? 'vertical' : 'horizontal';
const reversals = dominantAxis === 'vertical' ? reversalsY : reversalsX; // line 67
```

A scissors flick that is **vertical-dominant or diagonal** — where the meaningful
back-and-forth happens on the *non-dominant* axis — has its reversals **under-counted**,
which can cause the classifier to misclassify it (scissors → rock/paper). The gap is
currently masked because all committed scissors fixtures are net-horizontal, so the
`>=85%` accuracy harness stays green and hides it.

Non-blocking today: the shipped harness passes and the no-silent-guess re-throw catches
ambiguous throws. This card hardens the vertical-dominant / diagonal case.

## Functional Requirements

- **R1 — Count reversals on both axes.** The reversal signal fed to the scissors
  classifier MUST reflect direction changes on **both** axes, not just the dominant one.
  Combine `reversalsX + reversalsY` (rather than selecting one) so a flick that reverses
  primarily on the non-dominant axis is counted.
- **R2 — Preserve the `classify()` interface.** The `GestureFeatures` shape and the
  `classify()` signature/contract MUST NOT change. This is an internal correctness fix
  behind the existing interface; downstream (classifier, round machine, render) is
  untouched.
- **R3 — No regression on existing gestures.** Rock / paper / horizontal-scissors
  classification MUST remain correct. The existing committed fixtures MUST continue to
  pass at their current accuracy (>=85% harness gate, per-shape >=75% no-collapsed-class
  guard).
- **R4 — Add a vertical-dominant scissors fixture.** The dev accuracy harness MUST gain
  at least one **vertical-dominant** (and ideally one diagonal) scissors fixture that
  fails under the old dominant-axis-only logic and passes under the both-axes logic —
  i.e. a fixture that would have regressed silently before.

## Non-Functional Requirements

- **NFR1 — Single-module scope.** The change is confined to `src/gesture/features.ts`
  (reversal aggregation) plus the harness fixtures/test. No new architecture, no new
  dependency, no cross-repo dependency.
- **NFR2 — Deterministic & test-backed.** The both-axes counting MUST be covered by a
  unit test asserting the reversal count on a synthetic vertical-dominant sequence, in
  addition to the harness fixture.
- **NFR3 — Sandbox.** All work stays within the owned repo
  (`hai-dvash/kiro-crew-yolo-dlc-test-repo`), on `feat/rps3d-maxxed` (the branch where
  the F1 gesture engine lives), never `main`.

## Acceptance Criteria

1. `features.ts` exports a `reversals` that sums both-axis reversals (`reversalsX +
   reversalsY`), or otherwise provably counts non-dominant-axis reversals.
2. A new vertical-dominant scissors fixture is added and classifies as scissors.
3. `tsc --noEmit` clean, `vite build` clean, full Vitest suite green including the
   `>=85%` harness gate and the per-shape guard.
4. A unit test asserts the both-axes reversal count on a synthetic vertical sequence.

## Effort

- **F1** — Count scissors reversals on both axes (`reversalsX + reversalsY`) + vertical-dominant fixture + unit test — **S (1 pt)**
- **Total: 1** · `effort.scope[requirements] = 1`

## Open questions for gate-spec

- Q1: Should combined reversals be a plain **sum** (`reversalsX + reversalsY`), or should
  the classifier instead read **both raw counts** and threshold on `max`/`sum`? (Sum is
  the issue's literal ask and the minimal change; recommended.)
- Q2: Include a **diagonal** fixture in addition to the vertical-dominant one, or is the
  vertical-dominant fixture sufficient to lock the regression? (Recommend: add both — cheap.)

## Notes

- Decision Gate NOT raised: intent-fidelity OK (requirement squarely serves issue #9's
  stated both-axes goal); no unseen scope (single known module, interface preserved);
  no implicit technical fork (the aggregation choice is surfaced as Q1 for gate-spec, not
  decided implicitly); no capability-gap (authoring profile fully covers doc authoring).
- No back-step: `scope[requirements]=1` vs `scope[investigate]=1`; standard
  GROWTH_FACTOR=2.0 → trips only if >2 → NO back-step (flat, single feature).
- No tangents to park.
