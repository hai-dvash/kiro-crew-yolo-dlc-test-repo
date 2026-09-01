# Implement — card-kiro-crew-yolo-dlc-test-repo-23 (f1, child of #22)

**Issue:** [#23](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/23) —
`[card-rps3d-objects · f1] Throwable RPS object-rig + opponent-object render path`
**Parent:** #22 (card-rps3d-objects), the DEEP-decomposed RPS-object visual redesign (Order-4 proof).
**Step:** implement · **Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Effective modes:** trust=assisted (inherited: card.trust=null → pipeline assisted) · depth=**deep** · capability=**dlcyolo-builder**
**Grounded in live source @ branch `dlc/card-kiro-crew-yolo-dlc-test-repo-23`** (based off origin/main dcdb2e4) + live GitHub (issue #23 OPEN, author hai-dvash == gh-auth, ownership guard PASS).

---

## 0. Dispatch grounding

Spawned as `dlcyolo-builder`. Implement is buildable work = exactly the builder scope (read/write/shell,
all held); no `select_crew`/`spawn_run` needed — the crew-dispatch tool absence is irrelevant here because
the work is builder scope, done inline honestly.

## 1. What shipped (tasks T1–T7)

Grounded in the live `HandRig` contract (`src/render/hands.ts`), the `wireGame` seam + `boot()`
(`src/main.ts`), `RoundMachine.submit()` (`src/round/machine.ts`), `resolve()` (`src/rules.ts`), and the
`makeHarness` DI pattern (`test/main.test.ts`).

- **T1–T3 — NEW `src/render/objects.ts`:**
  - `makeRock()` = `IcosahedronGeometry(0.9, 0)` high-roughness stone; `makePaper()` = thin
    `BoxGeometry(1.3, 1.7, 0.02)` sheet; `makeScissors()` = two elongated boxes crossed into an X
    (FORK D1 — parametric, zero asset, zero new dep, reads instantly as RPS).
  - `class RpsObjectRig implements HandRig` — holds the three child meshes under `object` (a `Group`);
    `setShape(shape, t)` = **active-object select + emphasis scale tween** clamped by `t∈[0,1]` (FORK D2,
    behavior-preserving of the RAF call `hands.setShape(st.playerShape, poseT*0.2)`); `dispose()` mirrors
    `PrimitiveHandRig`. Constructor settles to `'rock'`. **No round-layer import** — a pure render entity.
  - `makeRpsObjectRig()` factory (used by both player + opponent) and
    `loadObjects(tier): Promise<HandRig>` — signature-identical to `loadHands`, never-null (the always-
    ships floor, NFR5).
- **T4 — `src/main.ts` player wiring:** swapped the `wireGame` dep from `loadHands(bootTier)` →
  `loadObjects(bootTier)` (identical `Promise<HandRig>` signature → `wireGame` structurally UNCHANGED). The
  RAF `hands.setShape(st.playerShape, poseT*0.2)` now poses the object rig (behavior-preserving). Dropped
  the now-unused `loadHands` import symbol (kept `GltfHandRig` for the instanceof credit block).
- **T5 — `src/main.ts` opponent path (FORK D3 + D4, committed-result consumer):** built
  `const opponent = makeRpsObjectRig()`, positioned at a fixed offset `(0, 0, -3)`, added to the scene;
  inside the EXISTING `machine.onChange` `phase==='resolved' && result` branch added
  `if (s.opponentShape) opponent.setShape(s.opponentShape, 1)`. Opponent does NOT participate in
  `computeRigScale`/`frameObject` (single-object framing intact). Meshes start invisible until set — the
  seam f3's board later hides. **F1-first (NFR1):** `pickOpponent()` stays solely in `submit()`; the
  opponent object reflects already-committed `opponentShape`, never re-picks at render time.
- **T6 — NEW `test/objects.test.ts` (NFR4, node-env DOM/WebGL-free, 6 cases):**
  1. rig satisfies the `HandRig` contract (`object`/`setShape`/`dispose`);
  2. rig wires through `wireGame` — **added** to the scene, **scaled** (`computeRigScale` → 0.25 for
     radius 4), **framed** with the measured center/radius (mirrors `main.test.ts`);
  3. `setShape` selects the active object + decays the others, clamps `t`, exposes **no** machine/submit;
  4. opponent path renders off the **committed** `opponentShape` from the `onChange` subscriber, with
     `opponentShape` committed by `submit()` **before** the subscriber observes it (F1-first proof), and
     `submit()`/`pickOpponent()` untouched;
  5. guard-bites case pinning that the rendered opponent shape equals `machine.getState().opponentShape`.
  **Guard-bites verified:** flipping the deterministic pick `'rock'→'paper'` without updating the expected
  shape turns the committed-shape assertion RED (`expected 'paper' to be 'rock'`) — the assertion reads
  the real committed pick, not a tautology; restored → green.
- **T7 — global gate:** `npm run build` (tsc --noEmit && vite build) clean (pre-existing rapier chunk-size
  warning only); `npm test` = **9 files, 63 passed** (baseline 57 + 6 new). NFR2 additive-only diff
  confirmed: staged code/test = EXACTLY `src/render/objects.ts` (new) + `test/objects.test.ts` (new) +
  `src/main.ts` (edit); protected-surface guard over `src/round/**`, `rules.ts`, `types.ts`, `src/a11y/**`,
  `src/render/hands.ts` returned EMPTY.

## 2. F1-FIRST invariant (NFR1) — held

`RoundMachine.submit()` synchronously `pickOpponent()`→`resolve()`→commits both shapes + result →
`phase='resolved'`→`emit()` (verified live). The player object-rig AND the opponent object are
committed-result CONSUMERS subscribing AFTER commit — exactly like `HandRig`/`juice` today. No task
relocated `pickOpponent()` or coupled the committed result/`opponentShape` to render/animation timing.
`round.test.ts` + `render-physics.test.ts` remain green.

## 3. Concurrency hazard caught + isolated (the exact prior-sibling trap)

The shared repo clone `/tmp/dlc-yolo/repos/kiro-crew-yolo-dlc-test-repo` was concurrently checked out to
the SIBLING branch `dlc/card-kiro-crew-yolo-dlc-test-repo-24` (f2) mid-run by a parallel run — my first
pass of writes was clobbered (my `objects.ts` vanished; `main.ts` showed f2's RevealPop edit). Rather than
patch against a racing tree, I created a **dedicated git worktree** `/tmp/dlc-yolo/wt-card23` bound to the
card-23 branch (git blocks the same branch in two worktrees, and my files live in a separate dir), then
re-applied all of T1–T7 there atomically and committed before any race could touch it. ZERO card-24 bleed:
`origin/main..HEAD` code diff = only the 3 f1 files.

## 4. Effort & back-step

`effort.features = [f1 M/3]`; `effort.scope[implement] = 3` (the foundation slice built as designed, NOT
grown vs investigate=3 / requirements=3 / design=3 / tasks=3). depth=deep GROWTH_FACTOR=3.0; back-step:
scope[implement]=3 > 3.0 × scope[tasks](=3) = 9? **NO.** No feature parked. No new child fan-out.

## 5. Decision-gate / ASK-BEFORE-DONE self-review

- **Intent-fidelity:** serves both the literal ask (throw the ACTUAL objects; opponent as an object) and
  the underlying intent (the redesign reads instantly as RPS). ✔
- **Scope-drift:** every change inside the sanctioned additive touch set (objects.ts + objects.test.ts +
  main.ts). ✔
- **Technical fork:** the four real forks (D1–D4) were resolved at design; implement only realized them.
  The offset transform / geometry dims / emphasis magnitude are tuning knobs guarded by the NFR4 test. ✔
- **Capability-gap:** builder read/write/shell sufficed; no crew-dispatch needed. ✔
- **Ask-before-done:** the one consequential structural fork (single-card vs fan-out) was answered by the
  human interjection at parent #22; f1 exists because of it. **No un-asked, human-only blocking question
  remains** → no `ask_question`, no new decision-gate entry, terminal status = done.

## 6. Handoff

`step_status['implement'] = done` — real additive code + tests genuinely produced, verified green live
(nothing faked). ONE BRANCH PER CARD: committed on `dlc/card-kiro-crew-yolo-dlc-test-repo-23` (code
`eba101f`), pushed by name (no main/bare/force). NEXT = **review** — under trust=assisted the advance cron
relabels `dlc:implement → dlc:review` and escalates review; the downstream human gate-review PARKS for a
human. f1 LANDS FIRST — it is the foundation f2 (#24, pop) and f3 (#25, board/reveal) both depend on;
parent #22 retires only when f1/f2/f3 are all consumed.
