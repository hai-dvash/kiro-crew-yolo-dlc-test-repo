# Design — card-rps3d-headline (issue #19)

**Title:** Overengineered headline: player knows with 10000% confidence they are playing RPS
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #19 (OPEN)
**Modes:** trust=assisted · depth=standard · capability=dlcyolo-coordinator (step crew=`dlcyolo-rps3d-design`, profile dlcyolo-authoring)
**Step:** design — 3D + gesture-feel design (here: additive HUD/copy design)
**Branch:** `dlc/card-rps3d-headline` (reused — investigate `e607f8e` + requirements `f11901e`)
**Predecessor:** requirements → R1–R5, NFR1–NFR4, 6 acceptance criteria; ONE card (no fan-out), effort S/1pt.

---

## 0. Design goal & the one load-bearing constraint

Deliver a **maximal-comedy headline + truthful RPS legend** as a **purely additive HUD layer**,
within the requirements' bounded touch set (`index.html`, `src/main.ts` HUD copy only,
`src/a11y/fallback.ts` labels only, a new copy-constants module, CSS), with **zero** change to
`round/`, `gesture/`, `physics/`, `render/{scene,post,tiers,hands,framing}.ts`, or `rules.ts`.

**The load-bearing design constraint discovered from the live code: the vitest environment is
`node`, not jsdom/happy-dom** (`vite.config.ts:12 environment: 'node'`; the entire existing suite —
incl. `main.test.ts` — is DOM-free and asserts logic through the injected-deps `wireGame` seam,
never against a real `document`). Therefore NFR3's "headless HUD regression test" **cannot** assert
against a rendered DOM. The design's central move mirrors the `card-rps3d-fix` `wireGame` extraction:
**put all comedic copy + the gesture→shape legend into a pure, DOM-free module that returns plain
data/strings**, so a node-env test asserts the copy + truthful mapping directly, and both
`index.html`/`main.ts` consume that same single source (R1.1 / NFR4). This is the design decision
that makes R1.1, NFR3 and NFR4 simultaneously satisfiable without adding a DOM test dependency (R4).

---

## 1. Architecture — additive HUD copy layer over the committed-result render path

```
                       ┌────────────────────────────────────────────┐
                       │  src/hud/copy.ts  (NEW, pure, DOM-free)      │
                       │  • HEADLINE  (comedic const strings)         │
                       │  • RPS_LEGEND: {gesture,key,shape,icon}[]    │  ← single source (R1.1/NFR4)
                       │  • assertions-friendly: pure exports only    │
                       └───────────────┬──────────────────┬──────────┘
                                       │ imported by       │ imported by
                       ┌───────────────▼──────┐   ┌────────▼───────────────┐
   index.html (static) │ src/main.ts          │   │ test/hud.test.ts (NEW) │
   • one <h1> host      │  renderHudChrome()   │   │  node-env, DOM-free     │
   • #status/#badge     │  (NEW, static, once) │   │  asserts copy+mapping   │
   • legend host <ul>   │  writes headline+leg │   │  + #status/#badge intact│
                        │  render(s) UNCHANGED │   └─────────────────────────┘
                        └──────────────────────┘
```

- **`#status` (flick/verdict/score) and `#badge` (low-confidence) are the authoritative live-region
  lines and are LEFT EXACTLY AS-IS** (R3.1 / NFR1). `render(s)` in `main.ts` is not touched in its
  status/badge logic — the comedic layer is written **once** at chrome-setup time, never inside the
  per-state `render()` (so it can never spam the `aria-live` region — NFR1).
- The comedic layer is **static chrome**: rendered once (from `index.html` markup + a one-shot
  `renderHudChrome()` that injects the legend text from `copy.ts`), never re-rendered on gesture
  state changes. No subscription to gesture/round events (R3 / NFR2).

### Why a one-shot injector rather than pure static HTML
Requirement R1.1/NFR4 demand the copy be a **single editable source (a constant/module)**. Two
options considered:

- **(A) Hardcode all copy in `index.html`.** Simplest, but violates R1.1/NFR4 (copy scattered in
  markup, not a const) and makes the truthful-legend test assert against a DOM (impossible in the
  node env without a new dep → violates R4/NFR3-DOM-free).
- **(B, CHOSEN) Copy module + minimal HTML hosts.** `index.html` provides empty semantic **host
  elements** (the `<h1>` already exists; add a legend `<ul id="rps-legend-list" role="list">` host +
  headline sub-line `<p>` hosts); a tiny `renderHudChrome(doc)` in `main.ts` fills them from
  `copy.ts` at boot. The pure `copy.ts` is what the node-env test asserts. This satisfies R1.1,
  NFR4, NFR3 (DOM-free) and R4 (no new dep) together.

**Chosen: B.** It is the same discipline the codebase already uses (extract the untestable-DOM part;
assert the pure part) and adds no runtime dependency.

---

## 2. The copy module — `src/hud/copy.ts` (NEW, pure, DOM-free)

Exported, plain, no DOM/`three`/`window` imports (so it imports cleanly in the node test env):

```ts
import type { Shape } from '../types';

/** One legend row: the maximal-comedy gesture→shape mapping, truthful to the classifier + keys. */
export interface LegendRow {
  gesture: string;   // the mouse-flick verb the engine recognizes
  key: string;       // the keyboard fallback key (R/P/S)
  shape: Shape;      // MUST be a real Shape ('rock'|'paper'|'scissors') — type-checked truthfulness
  icon: string;      // decorative emoji (aria-hidden at render time)
  label: string;     // the human shape label ('Rock'/'Paper'/'Scissors')
}

/**
 * Truthful mapping — MUST match src/gesture (chop=rock, sweep=paper, snip=scissors) and
 * src/a11y/fallback KEY_MAP (r=rock, p=paper, s=scissors). `shape: Shape` makes an untruthful
 * value a COMPILE error; the hud test additionally asserts row-by-row consistency (R2.1).
 */
export const RPS_LEGEND: readonly LegendRow[] = [
  { gesture: 'chop',  key: 'R', shape: 'rock',     icon: '🪨', label: 'Rock'     },
  { gesture: 'sweep', key: 'P', shape: 'paper',    icon: '📄', label: 'Paper'    },
  { gesture: 'snip',  key: 'S', shape: 'scissors', icon: '✂️', label: 'Scissors' },
] as const;

/** Maximal-comedy headline copy (R1). Deliberately over-the-top + redundant — the joke IS the over-
 *  engineering. Sub-lines are <p>/<small>, NEVER a 2nd <h1> (R1.2/NFR1). One editable source. */
export const HEADLINE = {
  /** Fills the EXISTING single <h1> (keeps one semantic h1). */
  h1: 'ROCK · PAPER · SCISSORS',
  /** Comedic over-confidence sub-line (a <p>, not <h1>). */
  certainty:
    'You are — with 10,000% mathematically-certified, notarized, ISO-9001 confidence — ' +
    'playing ROCK · PAPER · SCISSORS.',
  /** A second absurd reassurance line. */
  reassurance:
    'In case of any doubt whatsoever: yes. Still Rock. Still Paper. Still Scissors. Definitely RPS.™',
  /** Short absurd title repeated near the legend. */
  legendTitle: 'The Three (3) Sacred Throws, Officially Certified:',
} as const;
```

- `Shape` is imported from `src/types` (the real union the classifier + machine use), so a wrong
  `shape:` value is a **tsc compile error** — truthfulness is partly enforced by the type system, and
  fully by the test (§4). No behavior/type change to `types.ts` (it is only imported).
- Everything is a plain const/interface — **no DOM, no side effects** → imports safely under
  `environment: 'node'`.

---

## 3. Markup + injection

### 3.1 `index.html` (additive hosts only)
Keep the existing single `<h1>` (give it `id="headline"`; its text is overwritten from `HEADLINE.h1`
at boot so `copy.ts` is the one source). Add, inside `<header class="hud">`, **after**
`#status`/`#badge` (so the functional live lines stay first in DOM + reading order — NFR1):

```html
<h1 id="headline">Rock · Paper · Scissors</h1>          <!-- text overwritten from HEADLINE.h1 -->
<p id="status" role="status" aria-live="polite">Loading…</p>   <!-- UNCHANGED, stays authoritative -->
<p id="badge" class="badge" role="alert" hidden></p>           <!-- UNCHANGED -->
<p id="headline-certainty" class="headline-sub"></p>    <!-- filled from HEADLINE.certainty -->
<p id="headline-reassurance" class="headline-sub"></p>  <!-- filled from HEADLINE.reassurance -->
```

And a legend region (`role="note"`; `aria-label` set), placed near the existing `.hint`:

```html
<section id="rps-legend" class="rps-legend" role="note" aria-label="How to play Rock Paper Scissors">
  <p id="rps-legend-title" class="legend-title"></p>
  <ul id="rps-legend-list" role="list"></ul>
</section>
```

### 3.2 `renderHudChrome()` in `src/main.ts` (NEW, static, one-shot)
A small function called once from `boot()`. The DOM write stays in `boot`/this thin adapter (mirroring
how `wireGame` kept the DOM adapter thin and the asserted logic pure). It:

1. Sets `#headline`.textContent = `HEADLINE.h1`, `#headline-certainty`/`#headline-reassurance` from
   the copy consts.
2. Sets `#rps-legend-title`.textContent = `HEADLINE.legendTitle`.
3. For each `RPS_LEGEND` row, appends an `<li>`: an **`aria-hidden="true"`** emoji span + a text span
   `"{gesture} → {label}  (key {key})"` so a screen reader hears the mapping **once, cleanly** as
   text (NFR1: decorative emoji hidden, text label present).
4. Is called **once at boot**, before/independent of the render loop — it never runs on gesture state
   changes (no live-region spam).

`render(s)` is **not modified** — the status/verdict/score/low-confidence logic is byte-for-byte the
existing code. `boot()` gains exactly one `renderHudChrome(document)` call near where it grabs
`statusEl`/`badgeEl`.

### 3.3 `src/a11y/fallback.ts` (labels only, submit path UNCHANGED)
Optional comedic flourish permitted by the touch set: the three buttons may take a slightly more
emphatic **visible** label while **keeping `aria-label="Throw {shape}"` and the `submit()`/`emit`
`GestureResult` path exactly as-is** (R2/NFR2). Minimal, reversible. Default recommendation: **leave
labels unchanged** — the legend + headline already carry the comedy; the tasks step decides whether to
include this micro-touch.

### 3.4 CSS (`style.css`)
Additive rules only: `.headline-sub`, `.rps-legend`, `.legend-title`, list styling. Ensure the comedic
layer does **not** overlay/obscure `#status`/`#badge` (R3.1) — the sub-lines sit below the functional
status line, the legend below the hint. No layout change to the canvas/stage.

---

## 4. Headless HUD regression test — `test/hud.test.ts` (NEW, node-env, DOM-free)

Mirrors `main.test.ts`'s discipline (assert the pure extracted logic; no `document`). Asserts:

- **(a) Headline present + comedic (R1, AC-1).** `HEADLINE.h1` non-empty and equals the RPS name;
  `HEADLINE.certainty` contains the over-the-top "10,000%" confidence claim and the shape names — the
  comedic copy is genuinely present (not an empty stub).
- **(b) Truthful legend mapping (R2.1, AC-2).** `RPS_LEGEND` has exactly 3 rows; each row's
  `(gesture, key, shape)` matches the ground-truth triples derived from the real modules:
  `chop/R/rock`, `sweep/P/paper`, `snip/S/scissors`. Assert the `key` set === `{R,P,S}` and the
  `shape` set === the full `Shape` union, so a future copy edit that breaks truthfulness fails RED.
- **(c) Functional aria elements intact (R3.1, NFR1, AC-3).** Read `index.html` as a string (via
  `fs.readFileSync` or a `?raw` import) and assert it still contains `id="status"` with `role="status"`
  + `aria-live="polite"`, and `id="badge"` with `role="alert"`, and that there is **exactly one `<h1`**
  token — locking NFR1's single-h1 + live-region preservation as a regression, the same way
  `main.test.ts` locked the boot-wiring defects.
- **(d) Single source (NFR4).** Covered implicitly by importing from `copy.ts` (proves copy is a
  module-level const).

Rationale for the `index.html`-as-string assertion in (c): with no DOM env, the cheapest truthful guard
that `#status`/`#badge` survived and no 2nd `<h1>` crept in is a static-text assertion over the
committed `index.html` — a real regression net on the exact untested presentation surface that let the
`card-rps3d-fix` defects ship green, with zero new dependency.

Run gate: `npm run build` (tsc --noEmit && vite build) clean + `npm test` (vitest, node env) green
including the new suite.

---

## 5. Requirements traceability

| Req | Design element |
|-----|----------------|
| R1 / R1.1 / R1.2 | `HEADLINE` consts in `copy.ts` (one source); fills existing single `<h1>` + `<p>` sub-lines (no 2nd h1) |
| R2 / R2.1 / R2.2 | `RPS_LEGEND` (typed, truthful) → `renderHudChrome` list; icons decorative, text mandatory |
| R3 / R3.1 | static one-shot chrome; `render(s)` + `#status`/`#badge` untouched, placed first in DOM/reading order |
| R4 | pure copy+DOM+CSS, no dep/asset, one-file-revertible layer |
| R5 | comedic copy present + functional status stays the primary readable line |
| NFR1 | one `<h1>`, aria-live/role intact, emoji `aria-hidden`+text, no live-region writes in comedic layer |
| NFR2 | touch set = index.html, main.ts (chrome only), fallback.ts (labels only), copy.ts (new), style.css; zero core/gesture/physics/render edit |
| NFR3 | `test/hud.test.ts` node-env asserts headline + truthful mapping + surviving `#status`/`#badge` aria |
| NFR4 | single `copy.ts` module |

All 6 acceptance criteria map onto §2–§4.

---

## 6. Effort / scope self-attribution

- `effort.features` unchanged from requirements: **f1 = S / 1pt** (one cohesive additive HUD feature).
- `effort.scope[design] = 1` (design detailed the single feature; scope not grown — same 1pt).
- Scope-growth back-step (standard GROWTH_FACTOR = 2.0): `design(1) > 2.0 × requirements(1)` → `1 > 2`?
  **NO.** No back-step. No feature parked.

## 7. Decomposition decision (depth=standard)
**Keep ONE card — no child fan-out** (inherited from requirements + unchanged). A 1-pt additive HUD
edit is one cohesive visual unit; fanning it would produce multiple trivial PRs for one screen's copy.
Design created **no** child tickets (fan-out, if any, happens at requirements; re-fanning here would
duplicate). Card proceeds down its own ladder as one unit.

## 8. Decision-gate self-check (§3b)
- **Serves intent?** Yes — literal (over-the-top redundant headline + on-screen cues so "it's RPS" is
  unmistakable) and underlying (showcase clarity + comedic personality).
- **Unseen scope introduced?** No — strictly within the additive-HUD touch set requirements sanctioned
  (NFR2). The one new module (`copy.ts`) + one new test (`hud.test.ts`) are inside the allowed set.
- **Consequential implicit technical choice?** One real design choice — **copy-as-pure-module vs a
  DOM-based test** — was surfaced (§0/§1) and resolved toward the codebase's existing DOM-free
  discipline; it is design-internal, adds no dependency, and does not change the pipeline/scope, so it
  does NOT warrant a blocking gate.
- **Capability-gap materially improving the step?** No for the *work* (design authoring = read/analyze/
  write = the assigned `dlcyolo-rps3d-design`/dlcyolo-authoring scope, held). Dispatch nuance only: this
  runtime lacks `select_crew`/`spawn_run`, so the crew could not be routed as a separate session — but
  that is the dispatch MECHANISM, not a tool the design work needs, so per PRODUCE-OR-BLOCK the step is
  performed inline honestly, not faked or blocked.
- **Result: NO decision gate raised.** Clean, additive, intent-serving; the taste/a11y calibration is
  guarded by R5 + NFR1 and realized in tasks/implement, not a blocking fork now.

## 9. Handoff to next step (tasks)
Tasks should produce atomic tasks for: create `src/hud/copy.ts` (`HEADLINE` + `RPS_LEGEND`, truthful,
typed); add the host elements to `index.html` (one h1, status/badge first); add `renderHudChrome()` in
`main.ts` + one boot call (render(s) untouched); additive CSS; OPTIONAL comedic button labels (keep
aria + submit); `test/hud.test.ts` (headline present + truthful mapping + surviving `#status`/`#badge`
aria + single-h1). Global acceptance = build + full suite green, diff additive-only within the NFR2
touch set. Card trust=**assisted**: there is no gate between design and tasks in this ladder, so the
advance cron advances design→tasks; the human gates already passed (gate-spec approved 09:15).

---
_Dispatch grounding (no faked crew run): this cron-spawned coordinator runtime's tool surface is
read/write/shell ONLY — it does NOT hold `select_crew`/`spawn_run` (same empirically-confirmed finding
as this card's investigate/requirements runs and card-backlog-14's intake→pr runs). Per PRODUCE-OR-
BLOCK, a run lacking the crew-routing MECHANISM performs the step inline rather than faking a crew or
silently downgrading. Design authoring is a read→analyze→write pass = exactly `dlcyolo-rps3d-design`'s
dlcyolo-authoring scope (a subset of coordinator scope), done inline honestly against live source.
NOT a hard capability-gap: the missing tool is only dispatch, not one the design work needs. Grounded
in live source (index.html, src/main.ts, src/a11y/fallback.ts, src/config.ts, test/main.test.ts,
vite.config.ts) on branch dlc/card-rps3d-headline @ f11901e; nothing faked._
