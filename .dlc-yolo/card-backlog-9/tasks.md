# Tasks — Gesture: count scissors reversals on both axes (LOW-1)

- **Card:** card-backlog-9
- **Pipeline:** pl-rps3d
- **Repo (owned):** hai-dvash/kiro-crew-yolo-dlc-test-repo
- **Branch:** `feat/rps3d-maxxed` (the F1 gesture engine lives here; never `main`)
- **Source issue:** #9 · **Type:** bug / enhancement · **Depth:** standard · **Trust:** autonomous
- **Authored by:** `impl-agent` persona (tasks step has no crew), run inline per skill M1
- **Grounded on:** `design.md` §2/§4/§8 + the ACTUAL code at HEAD `cf25814` —
  `src/gesture/features.ts`, `src/gesture/fixtures.ts`, `test/gesture.test.ts`,
  `test/harness.test.ts`

Every task is atomic, dependency-ordered, and carries the modules it touches, the
requirements/ACs it covers, its dependencies, and a concrete acceptance check. Line
numbers are against `cf25814`.

---

## T1 — Sum reversals across both axes (production fix)

- **File:** `src/gesture/features.ts`
- **Change:** replace the axis-gated collapse (currently line 67)

  ```ts
  const reversals = dominantAxis === 'vertical' ? reversalsY : reversalsX;
  ```

  with the both-axes sum:

  ```ts
  const reversals = reversalsX + reversalsY;
  ```

  `reversalsX` / `reversalsY` are already counted correctly per-axis (lines 30, 54–61);
  only the final selection changes. `dominantAxis` / `dominantAxisRatio` stay as-is —
  they still feed the rock/paper axis-confidence terms; only the reversal *count* stops
  being axis-gated.
- **Modules:** `src/gesture/features.ts` (the `extract()` return only)
- **Covers:** R1 (count both axes), R2 (interface preserved — `Features.reversals` stays a
  single `number`; type/name/position unchanged), AC1
- **Deps:** none (first task)
- **Acceptance check:** the diff is exactly the one-line change; `Features` type in
  `src/types` is untouched; `classify()` / `extract()` signatures unchanged.

---

## T2 — Unit test: both-axes reversal count on a non-dominant-axis window

- **File:** `test/gesture.test.ts` (extend the existing
  `describe('features.extract — kinematics (T4, R1.3)')` block; reuse the in-file
  `stream(steps, dt, x0, y0)` helper already defined there)
- **Change:** add a test that builds a **vertical-dominant** window (large net `dy`) whose
  **X path alternates sign** several times, so `reversalsX > reversalsY` while
  `absY > absX`. Assert the summed count, which the old dominant-axis-only logic
  (`reversals = reversalsY`) would have under-reported.

  ```ts
  it('counts reversals on BOTH axes, not just the dominant one (issue #9)', () => {
    // Net displacement is vertical-dominant (sum dy >> sum dx) so the OLD code
    // read reversalsY only; but the snip alternation lives on X (dx sign flips
    // every step) -> reversalsX is high. The sum must capture it.
    const f = extract(stream([[18, 30], [-16, 34], [17, 31], [-15, 33], [16, 30]]));
    expect(f.dominantAxis).toBe('vertical');           // old code would read reversalsY
    expect(f.reversals).toBeGreaterThanOrEqual(3);      // sum captures the X alternation
  });
  ```

  Verify by construction that this **fails on `cf25814`** (old `reversals = reversalsY`,
  where dy never changes sign → `reversalsY = 0`) and **passes after T1**. If the exact
  step tuple yields a different `reversalsY`/`reversalsX` split once run, adjust the steps
  so `dy` stays single-sign (monotone down) while `dx` alternates — that is what makes the
  old code return a strictly smaller count than the sum.
- **Modules:** `test/gesture.test.ts`
- **Covers:** NFR2 (deterministic, test-backed), AC4
- **Deps:** T1 (the assertion passes only after the fix; author the test to fail-then-pass)
- **Acceptance check:** the new test is red against `cf25814` and green after T1; existing
  tests in the file unchanged and still green.

---

## T3 — Harness fixture(s): vertical-dominant (and diagonal) scissors

- **File:** `src/gesture/fixtures.ts`
- **Change:** add a `scissorsVertical(scale)` builder mirroring the existing horizontal
  `scissors()` — **vertical-dominant net displacement** (per-step `dy` ≈ 20–26) with the
  **X axis alternating sign** each step (so `reversalsX > reversalsY` while `absY > absX`,
  exactly the case the old code under-counts). Use the existing `build(steps, dtMs)`
  helper. Register it under `label: 'scissors'` in the `FIXTURES` array across the same
  scale set (`0.8, 1, 1.25, 1.5`).

  ```ts
  // scissors (vertical-dominant): net motion is vertical, but the snip alternates on X.
  // Old dominant-axis-only logic reads reversalsY (~0) and under-counts -> misclassifies;
  // the both-axes sum reads the X alternation and classifies scissors. (issue #9)
  function scissorsVertical(scale = 1): Sample[] {
    const s = scale;
    return build([
      [22, 24 * s], [-20, 22 * s], [21, 25 * s], [-19, 23 * s], [20, 22 * s], [-18, 20 * s],
    ]);
  }
  ```

  Per design §4.2 / requirements Q2 (recommended, cheap): also add a `scissorsDiagonal(scale)`
  builder with comparable alternating `dx`/`dy` magnitudes, registered under
  `label: 'scissors'`.

  ```ts
  // scissors (diagonal): comparable dx/dy magnitude, BOTH axes alternate sign.
  function scissorsDiagonal(scale = 1): Sample[] {
    const s = scale;
    return build([
      [20 * s, 18 * s], [-18 * s, -16 * s], [19 * s, 17 * s], [-17 * s, -15 * s], [18 * s, 16 * s],
    ]);
  }
  ```

  Extend `FIXTURES`:

  ```ts
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'scissors' as Shape, window: scissorsVertical(s) })),
  ...[0.8, 1, 1.25, 1.5].map((s) => ({ label: 'scissors' as Shape, window: scissorsDiagonal(s) })),
  ```
- **Fixture-math obligation (design §4.2):** the vertical-dominant builder MUST make the
  old code strictly worse — i.e. `dy` net-dominant (so `dominantAxis='vertical'`) while the
  discriminating alternation is on `dx` (so old `reversals = reversalsY` under-counts). If
  a drafted builder does not misclassify under `cf25814`, retune the step magnitudes until
  it does (otherwise the fixture locks nothing). Confirm empirically at T4.
- **Modules:** `src/gesture/fixtures.ts`
- **Covers:** R4 (vertical-dominant/diagonal fixture that regressed silently before), AC2
- **Deps:** none for authoring; its **passing** depends on T1 (verified at T4)
- **Acceptance check:** the new fixtures misclassify when run against `cf25814`’s harness
  and classify as `scissors` after T1; the `FIXTURES` array stays well-typed (`Shape`).

---

## T4 — Gates: type-check, build, full test suite incl. accuracy harness

- **Commands (run in the repo root on `feat/rps3d-maxxed`):**
  - `npx tsc --noEmit` → clean
  - `npx vite build` → clean
  - `npx vitest run` → all green, specifically:
    - the new T2 unit test (both-axes count),
    - `test/harness.test.ts` — the `>=85%` accuracy gate AND the per-shape `>=75%`
      no-collapsed-class guard, now including the new vertical/diagonal scissors fixtures,
    - all pre-existing tests (`rules`, `round`, `capture`, `classifier`, `render-physics`)
      unchanged and green (R3 no-regression — the §2.1 saturation argument predicts
      horizontal scissors/rock/paper scores are unchanged).
- **Modules:** none (verification only)
- **Covers:** AC3, R3 (no regression on existing gestures)
- **Deps:** T1, T2, T3 (all code changes must be in place)
- **Acceptance check:** all three gate commands exit 0; the harness accuracy stays
  `>=85%` overall and `>=75%` per shape **with the new fixtures added** (the fix must lift
  the new vertical/diagonal scissors into the scissors class, not just leave them failing).

---

## Ordering & critical path

```
T1 (fix) ─┬─> T2 (unit test, fail→pass) ─┐
          └─> T3 (fixtures) ─────────────┴─> T4 (gates)
```

- **Critical path:** T1 → T3 → T4 (the harness fixtures are what exercise the fix
  end-to-end through the accuracy gate). T2 is parallelizable with T3 after T1.
- All work confined to `src/gesture/features.ts`, `src/gesture/fixtures.ts`,
  `test/gesture.test.ts` + running the existing gate commands. No new files, no new
  dependency, no interface change (NFR1).

## Effort / scope

- 1 one-line prod change + 1 unit test + 1–2 fixture builders + registry lines + gate run.
  Single feature, **S (1 pt)**.
- `effort.scope[tasks] = 1`, held FLAT vs `scope[design] = 1` / `scope[requirements] = 1`.
- Back-step check (standard `GROWTH_FACTOR = 2.0`): trips only if `scope[tasks] > 2 ×
  scope[design]` = `> 2`; `1 ≤ 2` → **NO back-step** (1:1 module→task elaboration, no new
  scope surfaced, design was correctly sized).

## Decision Gate — NOT raised

- **Intent-fidelity:** tasks execute the design’s both-axes fix + fixtures that lock the
  regression; serves issue #9’s literal ask and the real intent (harden vertical/diagonal
  scissors without regressing the shipped classifier, per §2.1).
- **Unseen scope:** none — every task maps to a design §8 handoff item and a covered
  requirement/AC; interface preserved; no new module/dependency.
- **Implicit technical fork:** none — Q1 (plain sum) was resolved at design with the
  saturation rationale; T1 merely executes it. Q2 (diagonal fixture) is a cheap
  test-coverage add already recommended, executed as an optional-but-included builder in T3.
- **Capability-gap:** none — the tasks step only authors the plan; the `implement` step
  (a `builder`-capability step) makes the one-line change + tests + runs gates.

## No tangents to park

Single-module correctness fix; nothing out of scope to park to `dlc-backlog`.

## Sandbox

All tasks execute on `feat/rps3d-maxxed` within the owned repo
(`hai-dvash/kiro-crew-yolo-dlc-test-repo`) only.
