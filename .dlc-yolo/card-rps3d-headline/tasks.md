# Tasks — card-rps3d-headline (issue #19)

**Title:** Overengineered headline: player knows with 10000% confidence they are playing RPS
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #19 (OPEN)
**Modes:** trust=assisted · depth=standard · capability=dlcyolo-authoring (step `impl-agent` — "break design into atomic tasks")
**Step:** tasks — break design into atomic implementation tasks
**Branch:** `dlc/card-rps3d-headline` (reused — investigate `e607f8e` + requirements `f11901e` + design `cc40cb8`)
**Predecessor:** design → additive HUD copy layer: pure `src/hud/copy.ts` + one-shot `renderHudChrome()` + node-env `test/hud.test.ts`; ONE card (no fan-out), effort S/1pt.

---

## 0. Posture — one card, additive-only, DOM-free-testable

This is a single S/1-pt cohesive additive HUD feature (no children — decomposition decided KEEP-ONE
at requirements and unchanged through design). The tasks below map **1:1 onto design §2–§4** and stay
strictly inside the requirements' NFR2 touch set:

- **Allowed to touch:** `index.html`, `src/main.ts` (HUD chrome only), `src/a11y/fallback.ts` (labels
  only, optional), a NEW `src/hud/copy.ts`, `style.css`, a NEW `test/hud.test.ts`.
- **MUST NOT touch:** anything under `src/round/`, `src/gesture/`, `src/physics/`,
  `src/render/{scene,post,tiers,hands,framing}.ts`, `src/rules.ts`, `src/types.ts` (import-only).

The load-bearing constraint (design §0): vitest runs in **`environment: 'node'`** (confirmed live at
`vite.config.ts:12`), so the regression test asserts the **pure copy module + a static string read of
`index.html`** — never a rendered DOM. This is the same discipline `test/main.test.ts` uses.

---

## 1. Atomic tasks

### T1 — Create the pure copy module `src/hud/copy.ts` [design §2]
- **Do:** Create `src/hud/copy.ts` (NEW). Export `interface LegendRow { gesture; key; shape: Shape;
  icon; label }` (import `Shape` from `../types` — import only, no type change). Export
  `RPS_LEGEND: readonly LegendRow[]` with EXACTLY the three truthful rows:
  `chop/R/rock/🪨/Rock`, `sweep/P/paper/📄/Paper`, `snip/S/scissors/✂️/Scissors`. Export a `HEADLINE`
  const object: `{ h1, certainty, reassurance, legendTitle }` in maximal-comedy tone (over-the-top,
  redundant, "10,000% … confidence"). No DOM / `three` / `window` imports — plain consts/interfaces only.
- **Verify:** `npx tsc --noEmit` clean (the `shape: Shape` field makes any untruthful shape value a
  compile error); module imports with no side effects.
- **Traces:** R1, R1.1, R2, R2.1, NFR4.
- **Accept:** `RPS_LEGEND.length === 3`; each `shape` ∈ `Shape`; `HEADLINE.h1` is the RPS name;
  `HEADLINE.certainty` contains "10,000%" (or "10000%") + the three shape names.

### T2 — Add additive host elements to `index.html` [design §3.1]
- **Do:** Give the EXISTING single `<h1>` `id="headline"` (do not add a second `<h1>`). Keep
  `#status` (`role="status" aria-live="polite"`) and `#badge` (`role="alert"`, hidden) EXACTLY as-is
  and FIRST in DOM/reading order after the h1. Add (empty) hosts to be filled at boot:
  `<p id="headline-certainty" class="headline-sub"></p>`, `<p id="headline-reassurance"
  class="headline-sub"></p>`, and near `.hint` a legend region
  `<section id="rps-legend" class="rps-legend" role="note" aria-label="How to play Rock Paper
  Scissors"><p id="rps-legend-title" class="legend-title"></p><ul id="rps-legend-list"
  role="list"></ul></section>`.
- **Verify:** `vite build` clean; markup has exactly one `<h1`; `#status`/`#badge` unchanged.
- **Traces:** R1.2, R2, R3.1, NFR1, NFR2.
- **Accept:** one `<h1 id="headline">`; `#status`+`#badge` present with original roles, first in order;
  new hosts are empty (filled by T3), no inline copy literals in markup (copy comes from `copy.ts`).

### T3 — Add one-shot `renderHudChrome()` in `src/main.ts` + one boot call [design §3.2]
- **Do:** Add a small, static, DOM-writing `renderHudChrome(doc: Document)` in `main.ts` that:
  (1) sets `#headline`.textContent = `HEADLINE.h1`, `#headline-certainty`/`#headline-reassurance` from
  the copy consts; (2) sets `#rps-legend-title`.textContent = `HEADLINE.legendTitle`; (3) for each
  `RPS_LEGEND` row appends an `<li>` with an `aria-hidden="true"` emoji span + a text span
  `"{gesture} → {label} (key {key})"`. Call `renderHudChrome(document)` ONCE from `boot()` (near where
  `statusEl`/`badgeEl` are grabbed). Import `HEADLINE`, `RPS_LEGEND` from `./hud/copy`.
- **Verify:** `render(s)` is **byte-for-byte unchanged** (`git diff` shows no edit to the status/badge
  render branch); `vite build` + `tsc --noEmit` clean.
- **Traces:** R1, R2, R3, R3.1, NFR1, NFR2.
- **Accept:** exactly one added call site in `boot()`; the comedic layer is written once at chrome
  setup, NEVER inside `render()` (so it can never write the `aria-live` region — NFR1); emoji spans
  carry `aria-hidden="true"` and each row has a text label.

### T4 — Additive CSS in `style.css` [design §3.4]
- **Do:** Add rules ONLY for `.headline-sub`, `.rps-legend`, `.legend-title`, and the legend list.
  Ensure the comedic layer sits below the functional `#status`/`#badge` (does not overlay/obscure them
  — R3.1) and does not alter the canvas/stage layout.
- **Verify:** `vite build` clean; visual sanity that sub-lines/legend render below the status line and
  the status/badge remain readable/unobscured.
- **Traces:** R3.1, R4, R5, NFR2.
- **Accept:** additive selectors only (no edits to existing `#status`/`#badge`/`.stage` rules that
  would relocate/obscure the functional line); no new asset/font/dependency.

### T5 — (OPTIONAL) comedic button labels in `src/a11y/fallback.ts` [design §3.3]
- **Do:** If included, give the R/P/S buttons a slightly more emphatic **visible** `textContent` while
  keeping `aria-label="Throw {shape}"` and the `submit()`/`emit(GestureResult)` path EXACTLY as-is.
  **Default recommendation: SKIP** — the headline + legend already carry the comedy; leaving labels
  untouched keeps the diff smaller and the fallback path provably unchanged.
- **Verify:** if done — `test/gesture.test.ts` + full suite still green, submit path diff-clean (only
  the visible label string changed, aria + emit untouched).
- **Traces:** R2, NFR1, NFR2.
- **Accept:** aria-label + submit/emit path unchanged; if skipped, `fallback.ts` is NOT in the diff.

### T6 — Add the headless HUD regression test `test/hud.test.ts` [design §4]
- **Do:** Create `test/hud.test.ts` (NEW, node-env, DOM-free) asserting:
  - **(a)** `HEADLINE.h1` non-empty and equals the RPS name; `HEADLINE.certainty` contains the
    over-the-top "10,000%"/"10000%" confidence claim + the shape names (comedic copy genuinely present).
  - **(b)** `RPS_LEGEND` has exactly 3 rows; each `(gesture,key,shape)` matches ground truth
    `chop/R/rock`, `sweep/P/paper`, `snip/S/scissors`; assert the `key` set === `{R,P,S}` and the
    `shape` set === the full `Shape` union `{rock,paper,scissors}` (a truthfulness-breaking edit fails RED).
  - **(c)** Read `index.html` as a string (`fs.readFileSync`) and assert it still contains
    `id="status"` with `role="status"` + `aria-live="polite"`, `id="badge"` with `role="alert"`, and
    **exactly one `<h1`** token — locking NFR1 the same way `main.test.ts` locked the boot-wiring defects.
- **Verify:** `npm test` (vitest, node env) green including this new suite; deliberately breaking a
  legend row or removing `#status` makes it fail RED (sanity-check the guard bites).
- **Traces:** R1, R2.1, R3.1, NFR1, NFR3, and AC-1/AC-2/AC-3/AC-5.
- **Accept:** new suite passes; imports `copy.ts` (proves single-source, NFR4); (c) reads the committed
  `index.html`, no new dependency added.

### T7 — Global gate: build + full suite green, additive-only diff [requirements AC-4/AC-6]
- **Do:** Run `npm run build` (`tsc --noEmit && vite build`) and `npm test` (vitest). Inspect
  `git diff --stat origin/main..HEAD` (code/test, excluding the `.dlc-yolo` mirror) and confirm the
  changed set ⊆ { `src/hud/copy.ts` (new), `index.html`, `src/main.ts`, `style.css`,
  `test/hud.test.ts` (new), and `src/a11y/fallback.ts` ONLY if T5 was included }.
- **Verify:** build clean (pre-existing rapier chunk warning is acceptable); full suite green
  (baseline + the new `hud.test.ts`); ZERO edits under `src/round|gesture|physics`,
  `src/render/{scene,post,tiers,hands,framing}.ts`, `src/rules.ts`, `src/types.ts`.
- **Traces:** NFR2, AC-4, AC-6.
- **Accept:** the diff is additive-only within the NFR2 touch set; no new npm dependency/asset; change
  is one-file-layer revertible (R4).

---

## 2. Dependency graph

```
T1 (copy.ts) ─┬─> T3 (renderHudChrome + boot call) ──┐
              └─> T6 (hud.test.ts, part a/b)          │
T2 (index.html hosts) ─> T3 (fills hosts)             ├─> T7 (build + full suite + additive-diff gate)
T2 (index.html) ─────────────────────────> T6 (part c string-read)
T4 (CSS) ─────────────────────────────────┘
T5 (OPTIONAL button labels) ──────────────┘ (skip by default)
```

- **T1** and **T2** are independent and can land first (copy module + markup hosts).
- **T3** depends on both (fills T2's hosts from T1's consts).
- **T4** is independent (styling) but should land with T2/T3 so the layer renders correctly.
- **T6** depends on T1 (imports copy) + T2 (string-reads index.html); **T5** is optional/skipped.
- **T7** is the terminal verification gate over everything.

---

## 3. Global acceptance (parent exit criteria)

Maps 1:1 to the requirements' 6 acceptance criteria:

1. **AC-1** — over-the-top redundant headline renders, centralized in `copy.ts`, one `<h1>` (T1+T2+T3).
2. **AC-2** — additive truthful legend chop→rock/sweep→paper/snip→scissors, consistent with keys/
   buttons/classifier (T1+T3, locked by T6b).
3. **AC-3** — `#status`/`#badge` present, unobscured, aria intact (T2+T4, locked by T6c).
4. **AC-4** — additive-only diff within the touch set; no core/gesture/physics/render change; build +
   full suite green (T7).
5. **AC-5** — new headless HUD test asserts headline + truthful mapping + surviving aria (T6).
6. **AC-6** — zero new deps/assets; trivially revertible (T1–T7 by construction).

---

## 4. Effort / scope self-attribution

- `effort.features` unchanged: **f1 = S / 1pt** (one cohesive additive HUD feature).
- `effort.scope[tasks] = 1` (the single feature broken into atomic tasks; scope NOT grown — same 1pt
  as investigate=1, requirements=1, design=1).
- Scope-growth back-step (standard GROWTH_FACTOR = 2.0): `tasks(1) > 2.0 × design(1)` → `1 > 2`?
  **NO.** No back-step. No feature parked.

## 5. Decomposition decision (depth=standard)
**Keep ONE card — no child fan-out** (inherited, unchanged). A 1-pt additive HUD edit is one cohesive
visual unit; fanning it would produce trivial split PRs. Tasks created **no** child tickets (fan-out,
if any, happens at requirements; re-fanning here would duplicate). Card proceeds as one unit.

## 6. Decision-gate self-check (§3b)
- **Serves intent?** Yes — the task list realizes the literal (over-the-top redundant headline + on-
  screen RPS cues) and underlying (showcase clarity + comedic personality) intent.
- **Unseen scope introduced?** No — every task stays inside the design's/requirements' sanctioned
  additive-HUD touch set (NFR2); the only new files are `copy.ts` + `hud.test.ts`, both allowed.
- **Consequential implicit technical choice?** No — the one real fork (copy-as-pure-module vs a
  DOM-based test) was surfaced + resolved at design toward the codebase's DOM-free discipline; tasks
  merely sequence it, adding no dependency and no scope.
- **Capability-gap materially improving the step?** No — task breakdown is a read-design→analyze→write
  pass = exactly dlcyolo-authoring scope (read/write/shell all held). The runtime lacks
  `select_crew`/`spawn_run`, but that is the dispatch MECHANISM, not a tool the task-breakdown needs;
  per PRODUCE-OR-BLOCK the step is performed inline honestly, not faked or blocked.
- **Result: NO decision gate raised.** Clean, additive, intent-serving; taste/a11y calibration is
  guarded by R5 + NFR1 and realized in implement (T3/T4/T6), not a blocking fork now.

## 7. Handoff to next step (gate-impl → implement)
- Card trust=**assisted** → the next human gate (`gate-impl`) is **PARKED for a human**, NOT auto-
  approved. The advance cron will not auto-advance through it; it waits for the human to approve the
  task list before implement runs.
- Implement should execute T1–T7 in dependency order (T1/T2 → T3/T4 → T6 → T7), keep `render(s)` byte-
  for-byte unchanged, default to SKIP T5, and land it all on the single card branch
  `dlc/card-rps3d-headline` (one PR per card).

---
_Dispatch grounding (no faked crew run): this cron-spawned runtime's tool surface is read/write/shell
ONLY — it does NOT hold `select_crew`/`spawn_run` (same empirically-confirmed finding as this card's
investigate/requirements/design runs and card-backlog-14's intake→pr runs). The tasks step is a
read-design → analyze → write-task-list pass = exactly dlcyolo-authoring scope, performed inline per
PRODUCE-OR-BLOCK, grounded in live artifacts + source (design.md `cc40cb8`, requirements.md `f11901e`,
index.html, src/main.ts, src/a11y/fallback.ts, src/types.ts, vite.config.ts on branch
dlc/card-rps3d-headline @ cc40cb8). NOT a hard capability-gap: the missing tool is only dispatch, not
one the task-breakdown needs. Nothing faked; the crew's deliverable was produced directly._
