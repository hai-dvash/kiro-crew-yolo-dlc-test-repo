# Investigation — card-rps3d-headline (issue #19)

**Title:** Overengineered headline: player knows with 10000% confidence they are playing RPS
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo · **Issue:** #19 (OPEN)
**Modes:** trust=assisted · depth=standard · capability=dlcyolo-coordinator
**Step:** investigate (crew-assigned dlcyolo-rps3d-market [dlcyolo-readonly] + viability/monetization addendum, same crew)
**Run:** performed inline by the coordinator — see "Dispatch grounding" below.

## Classification

| Field | Value |
|---|---|
| **Type** | `feature` (UI/copy/presentation enhancement — additive, no behavior change) |
| **Rough size** | **S (~1–2 pts)** — copy + a few DOM cue elements + styling; no engine/gesture/render-core changes |
| **Surface** | HUD only: `index.html` header + `src/main.ts render()` + (optionally) the a11y controls' labels/legend |
| **Risk** | Low — purely additive on-screen text/cues; no gameplay, physics, gesture, or scoring paths touched |
| **Proposed GitHub labels** | keep `dlc:investigate` (stage) · add `enhancement` · add `ui` (cosmetic/copy) |

## Intent (from card)

- **Tone:** maximal-comedy — deliberately over-the-top, redundant, absurd. The over-engineering *is* the joke.
- **Scope:** headline copy/presentation **plus** supporting on-screen RPS cues (labeled controls, legend, hints).
- **Frame:** showcase piece, **no revenue dimension**.

## Grounding — current on-screen surface (read live from source on dlc/card-rps3d-headline)

- `index.html`: `<h1>Rock · Paper · Scissors <small>— maxxed</small></h1>`, `#status` (role=status, aria-live=polite),
  `#badge` (role=alert, hidden), and a `.hint` line ("Keyboard: press R / P / S, or use the buttons below").
- `src/main.ts` `render(s)`:
  - idle/capturing → status = "Flick the mouse: chop = rock · sweep = paper · snip = scissors"
  - lowConfidence → badge = "Low confidence (N%) — throw again"
  - resolved → status = "You: <shape> · CPU: <shape> → <verdict> (W/L/D …)"
- `src/a11y/fallback.ts`: R/P/S buttons, each `aria-label="Throw <shape>"`, `role="group" aria-label="Choose your throw"`.

So the "does the player know they're playing RPS?" surface today = a title + a one-line hint + 3 buttons. The card asks
to make that *comically unmistakable*: a loud headline + reinforcing on-screen cues.

## Triage note

This is the shallowest-risk kind of card: additive presentation copy on an already-working, well-layered showcase.
Nothing here touches the authoritative core (round machine advances on GestureResult; render subscribes after commit).
The comedy/redundancy is a *content* decision, not an architecture one. The one real design judgment for the spec/design
steps is **taste calibration** — "maximal comedy" without wrecking usability or a11y (the cues must still be truthful,
screen-reader-sane, and not obscure the status/verdict/score the game already relies on). That is spec/design work, not a
blocking fork here.

**No decision gate raised:** the artifact serves the card's literal + underlying intent, introduces no entities the
predecessor never sanctioned, makes no consequential implicit technical choice, and needs no missing tool for the
*research*. Clean go.

## Viability / Monetization addendum (dlcyolo-rps3d-market's real job on this card)

- **Revenue:** none, and none intended. The card itself declares "showcase piece, no revenue dimension." There is no ad
  slot, no retention loop, no funnel — a headline gag does not change that and is not meant to.
- **Viability of the *work*:** trivially viable. S-sized, additive, reversible, zero dependency risk, zero new libraries.
  It cannot regress gameplay because it only adds HUD copy/cues layered above the committed-result render path.
- **Value it *does* buy (showcase currency, not money):** clarity + personality. For a portfolio/demo piece the headline
  gag is cheap polish that improves first-impression legibility ("oh, it's RPS, got it") while carrying the maxxed comedic
  tone — a good ROI in *showcase* terms precisely because it's tiny.
- **Go/No-Go: GO (unconditional).** No monetization gate to clear (there is no money), no viability blocker. The only
  guardrails to hand downstream are *taste + a11y*: keep the cues truthful and screen-reader-sane, don't bury the
  functional status/verdict/score line under the comedy.

## Recommendation to the next step (requirements)

Proceed to `gate-research` → `requirements`. Spec the headline + supporting cues as an **additive HUD layer**:
- a loud, deliberately-redundant headline ("YOU ARE (with 10000% confidence) PLAYING ROCK · PAPER · SCISSORS" energy),
- reinforcing labeled cues/legend mapping gesture ↔ shape (chop/sweep/snip ↔ rock/paper/scissors) alongside the existing
  keyboard/buttons,
- acceptance: comedy tone lands, but the functional status/verdict/score stays readable and a11y (roles/aria-live) is
  preserved; add a small render/DOM assertion so the new cues are covered on the untested HUD surface.

---
_Dispatch grounding (no faked crew run): this cron-spawned runtime's tool surface is read/write/shell only — it does NOT
hold `select_crew`/`spawn_run` (same empirically-confirmed finding as card-backlog-14's intake/investigate/requirements
runs on this pipeline). Per PRODUCE-OR-BLOCK, a run lacking crew-routing tools PERFORMS the step inline rather than faking
a crew or silently downgrading. investigate is a read-only research/classification pass — exactly the assigned
`dlcyolo-readonly` market crew's scope (+ its viability/monetization addendum) — needing only read+shell+write, all held by
the coordinator (a superset of the readonly crew's scope). This is NOT a hard capability-gap: the missing tool is only the
dispatch mechanism, not a tool the underlying research needs. Nothing was faked; the crew's deliverable was produced
directly._
