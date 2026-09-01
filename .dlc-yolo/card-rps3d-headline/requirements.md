# Requirements — card-rps3d-headline (issue #19)

**Title:** Overengineered headline: player knows with 10000% confidence they are playing RPS
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #19 (OPEN)
**Modes:** trust=assisted · depth=standard · capability=dlcyolo-coordinator (step crew=dlcyolo-rps3d-spec)
**Step:** requirements — produce requirements.md
**Predecessor:** investigate → verdict GO (unconditional), type=feature, size S, additive HUD-only.

## Intent (authoritative, from card + investigation)

- **Tone:** *maximal-comedy* — deliberately over-the-top, redundant, absurd. The over-engineering **is** the joke: the player should know "with 10000% confidence" they are playing Rock · Paper · Scissors.
- **Scope:** the comedic **headline** *plus* **supporting on-screen RPS cues** (labeled controls, legend, gesture↔shape mapping, hints).
- **Frame:** showcase piece, **no revenue dimension**. Cheap polish that buys clarity + personality.
- **Hard constraint (inherited):** additive HUD layer only — must NOT touch the authoritative core (round machine advances on `GestureResult`; render subscribes after the result commits) or any gesture/physics/scoring path. Comedy must not bury the functional status/verdict/score line, and must stay screen-reader-sane.

## Current on-screen surface (grounded live on `dlc/card-rps3d-headline` @ e607f8e)

- `index.html`: `<h1>Rock · Paper · Scissors <small>— maxxed</small></h1>`, `#status` (`role="status" aria-live="polite"`), `#badge` (`role="alert"`, hidden), `.hint` line ("Keyboard: press R / P / S, or use the buttons below").
- `src/main.ts` `render(s)`: idle/capturing → "Flick the mouse: chop = rock · sweep = paper · snip = scissors"; lowConfidence → "Low confidence (N%) — throw again"; resolved → "You: … · CPU: … → verdict (W/L/D)".
- `src/a11y/fallback.ts`: R/P/S buttons (`aria-label="Throw <shape>"`), group `aria-label="Choose your throw"`.

So today's "is-it-RPS?" surface = a title + a one-line hint + 3 buttons. This card makes it *comically unmistakable*.

## Functional Requirements

**R1 — Overengineered comedic headline.**
The header MUST present a deliberately over-the-top, redundant headline that makes it unmistakable the game is Rock · Paper · Scissors, in the maximal-comedy tone (e.g. "YOU ARE — with 10000% mathematically-certified confidence — PLAYING ROCK · PAPER · SCISSORS" energy). It replaces/augments the existing `<h1>` while keeping the page `<title>` and the single semantic `<h1>` per document.
- R1.1 The headline copy MUST be centralized as a constant/string (not scattered inline literals) so the comedy is one editable source.
- R1.2 The headline MUST NOT introduce a second `<h1>` (a11y: one top-level heading); comedic sub-lines use `<p>`/`<small>`/`<span>`.

**R2 — Supporting on-screen RPS cues (legend).**
An additive cue/legend region MUST reinforce the gesture↔shape mapping already spoken in the hint, presented as a labeled, comically-emphatic legend: **chop → 🪨 Rock**, **sweep → 📄 Paper**, **snip → ✂️ Scissors** (icon/emoji optional; text label mandatory). It sits alongside — not replacing — the existing keyboard/buttons hint.
- R2.1 The legend MUST be truthful: the mapping shown MUST match the real classifier mapping (chop=rock, sweep=paper, snip=scissors) and the R/P/S keys/buttons.
- R2.2 The legend MUST reinforce, not duplicate-confusingly — it is fine to be redundant *for comedy* as long as it is consistent.

**R3 — Additive, layered above the committed-result render path.**
All new copy/cues MUST be rendered as static/HUD DOM (in `index.html` and/or `render()`'s HUD-writing branch) layered above gameplay. No new subscription to gesture events, no change to `RoundMachine`, `GestureEngine`, scoring, or the render loop's authoritative state.
- R3.1 The functional lines the game relies on — `#status` (flick prompt / verdict / score) and `#badge` (low-confidence) — MUST remain present, readable, and unobscured by the comedic layer.

**R4 — Reversibility / zero new dependencies.**
The change MUST be pure copy + DOM + CSS. No new npm dependency, no new asset, no gesture/physics/render-core edit. It MUST be trivially revertible.

**R5 — Comedy tone lands but stays usable.**
The headline+cues MUST read as intentional maximal-comedy (redundant, absurd confidence claims) while the game remains legible: a first-time viewer instantly reads "it's RPS", and the functional status/score stays the most important readable line.

## Non-Functional Requirements

- **NFR1 — Accessibility (WCAG 2.1 AA, preserve existing).** Keep exactly one `<h1>`; keep `#status` `aria-live="polite"` and `#badge` `role="alert"` semantics intact. Any new legend region carries a sensible role/label (e.g. `role="note"`/`aria-label`), and decorative emoji are `aria-hidden` with a text label present so a screen reader hears the mapping once, cleanly (comedy MUST NOT spam the live region). The functional live-region text MUST NOT be relocated into the comedic layer.
- **NFR2 — No behavior regression (diff is additive).** `tsc --noEmit && vite build` clean; the full existing vitest suite stays green; no change to any file under `src/round/`, `src/gesture/`, `src/physics/`, `src/render/{scene,post,tiers,hands,framing}.ts`, `src/rules.ts`. Allowed touch set: `index.html`, `src/main.ts` (HUD copy only), `src/a11y/fallback.ts` (labels/legend only, submit path unchanged), a copy-constants module, and CSS.
- **NFR3 — Regression coverage on the untested HUD surface.** Add a headless DOM/render assertion (the codebase already has a DOM-free `wireGame` seam + vitest) that (a) the comedic headline text is present, (b) the RPS legend maps the three gestures/shapes truthfully, and (c) the functional `#status`/`#badge` elements still exist with their aria roles — so the new HUD copy is covered on the previously-untested presentation surface (the same class of gap that let the card-rps3d-fix defects ship green).
- **NFR4 — Single source for copy.** Comedic strings live in one module/const so tone can be tuned without hunting literals (supports R1.1).

## Acceptance Criteria (parent exit)

1. A deliberately over-the-top, redundant headline renders in the header making "this is Rock · Paper · Scissors" unmistakable (R1), centralized as copy constants (R1.1, NFR4), with exactly one `<h1>` (R1.2, NFR1).
2. An additive, truthful RPS cue/legend maps chop→rock / sweep→paper / snip→scissors, consistent with keys/buttons/classifier (R2, R2.1).
3. The functional `#status` (flick/verdict/score) and `#badge` (low-confidence) remain present, unobscured, with aria-live/role intact (R3.1, NFR1).
4. Diff is additive-only within the allowed touch set; no core/gesture/physics/render change (NFR2); build + full existing suite green.
5. A new headless HUD test asserts headline presence + truthful legend mapping + surviving functional aria elements (NFR3).
6. Zero new dependencies/assets; change is trivially revertible (R4).

## Effort Attribution

| id | Feature | Size | Points |
|----|---------|------|--------|
| f1 | Overengineered comedic headline + supporting on-screen RPS cue/legend (additive HUD layer) + a11y-preserving copy module + HUD regression test | **S** | **1** |

- **effort.total = 1** · **effort.scope[requirements] = 1**
- One cohesive additive HUD feature. The headline and its reinforcing cues are a single unit of presentation — splitting "headline" and "cues" into separate cards would fragment one screen's copy and produce two trivial PRs for one visual change.

## Decomposition decision (depth=standard, budget.max_child_cards ≤ 3)

**Keep ONE card — no child fan-out.** Rationale: this is a single S-sized (1-pt), additive, cohesive HUD feature (headline + reinforcing cues are the same visual surface, must ship together to read as one comedic unit). depth=standard permits ≤3 children but does not *require* fanning; the "quick keeps one card, deeper fans out" rule maps a 1-pt single-feature card to one card. Fanning a 1-pt copy change into child tickets would be pure overhead (two/three PRs for one HUD edit) and violate the "solve what was asked, no extra abstraction" discipline. The card proceeds straight down its own ladder (gate-spec → design → tasks → … → PR) as a single unit.

## Scope-growth self-check (back-step heuristic)

- Predecessor scope: `effort.scope[investigate] = 1`. This phase: `effort.scope[requirements] = 1`.
- standard GROWTH_FACTOR = 2.0. Back-step trigger: `requirements > 2.0 × investigate` → `1 > 2`? **NO.** No back-step; scope stable.

## Decision Gate self-check (§3b)

- **Serves intent?** Yes — literal (over-the-top redundant headline so you know "with 10000% confidence" it's RPS) and underlying (showcase clarity + comedic personality).
- **Unseen scope introduced?** No — stays within the additive-HUD scope the investigate step sanctioned; the allowed touch set is explicitly bounded (NFR2).
- **Consequential implicit technical choice?** No — copy + DOM + CSS; no architecture, no dependency, no core edit.
- **Capability-gap that would materially improve the step?** No for the *work* (requirements authoring is a read/analyze/write pass = the assigned dlcyolo-rps3d-spec / dlcyolo-authoring scope, held). The only nuance is *dispatch*: this runtime lacks `select_crew`/`spawn_run`, so the crew could not be routed as a separate session — but that is the dispatch mechanism, NOT a tool the requirements work needs, so per PRODUCE-OR-BLOCK the step was performed inline honestly rather than faked or blocked. Not a hard capability-gap.
- **Result: NO decision gate raised.** Clean, additive, intent-serving. The only downstream judgment (taste calibration — comedy without wrecking usability/a11y) is design work, guarded here by R5 + NFR1, not a blocking fork now.

## Handoff to next step (gate-spec → design)

- Card trust=**assisted** → the next human gate (`gate-spec`) is **parked for a human**, NOT auto-approved. The advance cron will NOT auto-advance it; it waits for the human to approve the spec.
- Design should specify: exact headline copy (maximal-comedy, redundant, "10000% confidence"), the legend markup + a11y roles, the copy-constants module shape, and the headless HUD test design (assert headline text + truthful mapping + surviving `#status`/`#badge` aria), all additive within the NFR2 touch set.

---
_Dispatch grounding (no faked crew run): this cron-spawned coordinator runtime's tool surface is read/write/shell only — it does NOT hold `select_crew`/`spawn_run` (same empirically-confirmed finding as this card's investigate run and card-backlog-14's intake/investigate/requirements runs). Per PRODUCE-OR-BLOCK, a run lacking the crew-routing MECHANISM performs the step inline rather than faking a crew or silently downgrading. Requirements authoring is a read→analyze→write pass = exactly dlcyolo-rps3d-spec's dlcyolo-authoring scope (a subset of coordinator scope), done inline honestly. NOT a hard capability-gap: the missing tool is only dispatch, not one the requirements work needs. Nothing faked; the crew's deliverable was produced directly._
