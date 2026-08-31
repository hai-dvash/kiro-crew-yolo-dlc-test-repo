# Requirements — card-rps3d

**Card:** 3D Rock-Paper-Scissors with Wii-style mouse-gesture throws
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo (issue #4)
**Step:** requirements (crew: dlcyolo-rps3d-spec)
**Depth:** standard → spec type `feature` · **Trust:** assisted
**Run:** escalated subagent, executed INLINE (read/write/shell only — no `select_crew`/`spawn_run`
in this runtime; crew routing to `dlcyolo-rps3d-spec` flattened to inline reasoning per the
tool-inheritance fix, same as the investigate step). Grounded in issue #4 body + `investigation.md`.

## Framing (carried from investigate)

Verdict is **GO as a showcase, NO-GO as a revenue play.** Requirements are therefore scoped
around **gesture-recognition feel** as the primary acceptance driver, with the 3D render as
supporting/table-stakes. **No monetization requirements** — explicitly out of scope per the
investigation and the issue.

## Personas & primary flow

- **Visitor (only persona).** Lands on a page, is prompted to flick the mouse to throw, sees a
  3D throw play out, and gets an immediate win/lose/draw result against a CPU. Single session,
  no account. Success feels like "I swung and it *got* what I meant."

## Functional Requirements (EARS)

### R1 — Gesture capture & classification (PRIMARY, the hard part)
- **R1.1** WHEN the visitor presses-and-flicks (or flicks) the mouse within the play area,
  the system SHALL sample pointer position/velocity over the gesture window and classify it
  into exactly one of {rock, paper, scissors}.
- **R1.2** WHERE the gesture is ambiguous or below a motion threshold, the system SHALL NOT
  guess silently; it SHALL either prompt a re-throw or surface a low-confidence indication.
- **R1.3** The system SHALL classify a clear intended throw correctly in **≥ 80%** of attempts
  for a first-time user after a one-line instruction (primary acceptance metric; measured on a
  small manual test set, not a formal study).
- **R1.4** WHEN a throw is classified, the system SHALL resolve it within a perceptible-but-snappy
  window (target ≤ 150 ms from gesture-end to result state) so the motion feels responsive.

### R2 — 3D render of the throw (SUPPORTING, table-stakes)
- **R2.1** WHEN a throw is classified, the system SHALL render a 3D animation of the corresponding
  hand shape (rock/paper/scissors) using Three.js or an equivalent WebGL layer.
- **R2.2** The system SHALL render the CPU's throw alongside the player's in the same scene.
- **R2.3** The 3D scene SHALL run at an interactive frame rate (target ≥ 30 fps) on a modern
  laptop browser without a discrete GPU.

### R3 — Round resolution (CPU opponent)
- **R3.1** WHEN both throws are known, the system SHALL compute win/lose/draw by standard RPS rules
  and display the outcome.
- **R3.2** The CPU SHALL pick its throw independently of (and unseen by) the player's gesture to
  avoid the appearance of cheating.
- **R3.3** The system SHALL allow the visitor to play another round without reloading.

### R4 — Zero-install browser delivery
- **R4.1** The system SHALL run in a current desktop browser (Chromium/Firefox) with no install,
  no login, and no server round-trip required for a round.

## Non-Functional / Constraints
- **NFR1 (scope discipline).** Keep it lean per the issue ("lazy, keep it simple"): the gesture
  feel and the 3D throw must feel good; everything else stays minimal.
- **NFR2 (no monetization).** No ads, IAP, accounts, analytics, or tracking in this deliverable.
- **NFR3 (accessibility floor).** Provide a non-gesture fallback input (e.g. three buttons) so the
  game is playable without a mouse-flick — the gesture is the hook, not the only path.

## Explicitly Out of Scope
Multiplayer, accounts, monetization implementation, leaderboards, persistence. (Revisit only if the
viability verdict changes — it will not for a showcase.)

## Open Questions → gate-spec
1. **Gesture UX:** press-and-hold-then-flick vs. free-flick detection? (affects R1 capture window
   and the classifier design — the design phase's central decision).
2. **Accessibility fallback (NFR3):** in-scope for v1, or parked to backlog? Recommend in-scope
   (cheap, and it de-risks the "gesture feels janky" failure mode).
3. **Confidence surfacing (R1.2):** re-throw prompt vs. "best guess with a low-confidence badge"?

## Effort Attribution
| id | feature | size | points |
|----|---------|------|--------|
| f1 | Gesture capture + classifier (R1) | L | 5 |
| f2 | 3D throw render (R2) | M | 3 |
| f3 | Round resolution + replay (R3) | S | 1 |
| f4 | Zero-install shell + accessibility fallback (R4/NFR3) | S | 1 |

- **effort.total = 10**
- **effort.scope[requirements] = 10** (this sets the baseline the design phase's scope-growth
  back-step compares against; GROWTH_FACTOR at depth=standard is 2.0 → design > 20 would trip it).

## Self-review (Step Review Contract)
- Artifact serves the card's INTENT: yes — centers the gesture-feel (the stated hard part) as the
  primary acceptance metric, keeps 3D supporting, and holds monetization out per the go/no-go.
- Unseen scope introduced? Only NFR3 (accessibility fallback), flagged as an open question for the
  gate rather than silently expanding scope.
- Consequential implicit technical fork? The gesture-capture model (R1) is the real fork, correctly
  **deferred to design** (open question 1), not decided here.
- Capability gap? None that warrants a new crew/tool at this step.
- **Decision Gate: NOT raised** — the step cleanly serves intent; the one real fork is a normal
  design-phase decision surfaced as a gate-spec question, not a scope/intent violation.
