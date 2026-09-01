# Implement — card-rps3d-headline (issue #19)

**Title:** Overengineered headline: player knows with 10000% confidence they are playing RPS
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #19 (OPEN)
**Modes:** trust=assisted · depth=standard · capability=dlcyolo-builder
**Step:** implement — write code + tests
**Branch:** `dlc/card-rps3d-headline` (reused — one branch per card) · **Commit:** `3fdbcb5`
**Predecessor:** tasks → 7 atomic tasks T1-T7 (design §2-4), ONE card, effort S/1pt.

---

## 0. What was built

An **additive HUD comedy layer** realizing the maximal-comedy over-engineered headline + a
truthful on-screen RPS legend, delivered strictly inside the requirements' NFR2 touch set with
**zero** change to core/gesture/physics/render/rules/types. All 7 tasks executed in dependency
order (T1/T2 → T3/T4 → T6 → T7); T5 skipped by design default.

| Task | File | What |
|------|------|------|
| **T1** | `src/hud/copy.ts` (NEW) | Pure DOM-free copy module. `HEADLINE` (comedic h1 + certainty/reassurance/legendTitle, "10,000% … confidence") + typed `RPS_LEGEND` where `shape: Shape` makes an untruthful mapping a **tsc compile error**. One editable source (R1.1/NFR4). |
| **T2** | `index.html` | Existing single `<h1>` → `#headline` host; `#status`(role=status/aria-live=polite) + `#badge`(role=alert) LEFT AS-IS and FIRST in reading order; additive empty `.headline-sub` `<p>` hosts + a `role="note"` legend section. |
| **T3** | `src/main.ts` | New one-shot `renderHudChrome(document)` called ONCE from `boot()`; fills the hosts + builds legend `<li>`s (aria-hidden emoji span + mandatory text label). `render(s)` status/badge logic **byte-for-byte unchanged** — the comedic layer never writes the aria-live region (NFR1). |
| **T4** | `style.css` | Additive `.headline-sub`/`.rps-legend`/`.legend-title`/list rules; legend is `pointer-events:none`, positioned so it does not overlay/obscure `#status`/`#badge` (R3.1). |
| **T5** | — | **SKIPPED** (design default): comedy lives in headline + legend; leaving `fallback.ts` untouched keeps the diff smaller and the submit path provably unchanged. `fallback.ts` is NOT in the diff. |
| **T6** | `test/hud.test.ts` (NEW) | node-env DOM-free regression net (10 tests). Asserts (a) headline present + comedic ("10,000%" + all 3 shape names), (b) truthful legend chop/R/rock · sweep/P/paper · snip/S/scissors with key set `{R,P,S}` and shape set = the full `Shape` union, (c) `index.html` (read via Vite `?raw` glob — same dependency-free discipline as `hands.test.ts`) still has `#status` role/aria-live + `#badge` role + **exactly one `<h1>`** (locks NFR1). |
| **T7** | — | Global gate (below). |

## 1. Verification (T7)

- `npm run build` (`tsc --noEmit && vite build`) — **clean** (only the pre-existing rapier
  chunk-size warning).
- `npm test` (vitest, node env) — **9 files / 67 passed** (baseline 57 → +10 from `hud.test.ts`).
- **Guard bites:** breaking a legend row (rock→paper) turns 2 tests RED; reverted → 10/10 green.
- **Additive-only diff within the NFR2 touch set** (origin/main..HEAD, code/test): exactly
  `src/hud/copy.ts` (new), `index.html`, `src/main.ts`, `style.css`, `test/hud.test.ts` (new).
- **Zero forbidden edits:** no touches under `src/round|gesture|physics`,
  `src/render/{scene,post,tiers,hands,framing}.ts`, `src/rules.ts`, `src/types.ts` (import-only),
  `src/a11y/fallback.ts`, `src/config.ts` — confirmed via `git status`.
- **`render(s)` unchanged:** the only new top-level symbol is `renderHudChrome` (a separate
  one-shot function); the per-state `render()` status/badge/verdict/score logic is untouched.

## 2. Deviation from the design (documented)

Design §4 suggested reading `index.html` via `fs.readFileSync` OR a `?raw` import. `fs` was tried
first but the project ships **no `@types/node`** (tsc `TS2307` on `node:fs/url/path`). Switched to
Vite's `import.meta.glob('../index.html', { query: '?raw', import: 'default', eager: true })` —
the exact dependency-free pattern already used in `test/hands.test.ts` (and `card-backlog-14`'s
asset-budget test). No new dependency (R4 preserved). Additionally, two `index.html` comments
that contained a literal `<h1` token were reworded ("level-1 heading" / "second heading") so the
static single-`<h1>` regression count is not fooled by comment text.

## 3. Effort / scope

- `effort.features` unchanged: **f1 = S / 1pt**.
- `effort.scope[implement] = 1` (the single feature built; scope NOT grown — same 1pt as
  investigate=1 / requirements=1 / design=1 / tasks=1).
- Scope-growth back-step (standard GROWTH_FACTOR = 2.0): `implement(1) > 2.0 × tasks(1)` → `1 > 2`?
  **NO.** No back-step. No feature parked.

## 4. Decision-gate self-check (§3b)

- **Serves intent?** Yes — literal (over-the-top redundant headline + on-screen RPS cues so
  "it's RPS" is unmistakable) and underlying (showcase clarity + comedic personality).
- **Unseen scope?** No — strictly within the sanctioned additive-HUD touch set (NFR2). The `?raw`
  substitution + comment reword are in-file, dependency-free, no scope change.
- **Consequential implicit choice?** No — the copy-module-vs-DOM-test fork was resolved at design;
  the `fs`→`?raw` swap follows the codebase's existing pattern, not a new decision.
- **Capability-gap?** No — implement is buildable work = exactly `dlcyolo-builder` scope
  (read/write/shell all held); no crew-dispatch needed.
- **Result: NO decision gate raised.** Clean, additive, intent-serving, verified green.

## 5. Handoff to next step (review → gate-review)

- Card trust=**assisted** → the human gate downstream (`gate-review`) is **PARKED for a human**,
  not auto-approved. Review runs next; its verdict + the parked gate wait for a human decision.
- Everything landed on the single card branch `dlc/card-rps3d-headline` (one PR per card):
  e607f8e + f11901e + cc40cb8 + 6ecdbeb + **3fdbcb5** (implement).
