# Requirements — card-rps3d-objects (issue #22)

**Title:** Redesign: throw the actual rock/paper/scissors objects (not a hand), with a poppy reveal animation and a board that hides the CPU pick

**Step:** requirements · **Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Effective modes:** trust=assisted · depth=**deep** · capability=dlcyolo-coordinator
**Crew (assigned):** dlcyolo-rps3d-spec (dlcyolo-authoring)
**Grounded in live source @ branch dlc/card-rps3d-objects fd0b227** (based off origin/main dcdb2e4) + live GitHub (issue #22 OPEN, author hai-dvash == gh-auth, ownership guard PASS).

---

## 0. Posture — DEEP DECOMPOSITION (human rescope, not the investigate default)

The investigate step recommended "GO, single card, standard." A **human rescope interjection**
(card.interjection[0], 2026-09-01T13:04, by hai-dvash) OVERRIDES that:

> This is the fresh Order-4 DEEP decomposition proof, not a standard single-card redesign.
> Decompose the three investigated features (f1 actual RPS objects/opponent render path,
> f2 poppy reveal animation, f3 hidden-CPU board/reveal sequencing) into driven child
> tickets/cards under the unlimited budget. Preserve F1-first and the single parent
> branch/PR invariant; the orchestrator owns child-ticket creation and parent
> handoff/retirement.

So under **depth=deep** + **budget unlimited** (max_child_cards=unlimited, effort_ceiling=unlimited —
never gate/wedge on budget), this requirements step FANS OUT the three features into **three driven
child cards** (one GH issue each, `dlc:investigate` + `enhancement`, `parent_ticket`→#22, recorded in
this parent's `child_tickets[]`). The parent card becomes `handed-off`; it retires ONLY when all three
children are `consumed` (no-retire-until-consumed hard guard). Each child runs its OWN full ladder.

ASK-BEFORE-DONE: the single-card-vs-fan-out fork is the one consequential choice here, and it is
already ANSWERED by the human's durable interjection — no un-asked blocking question remains, so this
step proceeds to fan out per that instruction (recorded in card.decisions[] as dec-objects-decompose).

## 1. Requirements

**R1 — Throw the ACTUAL RPS objects (not a hand).** The player visual must be the thrown object
itself (a rock, a sheet of paper, or scissors), replacing the current `HandRig` morphing hand as the
player-visual. [→ child f1]

**R2 — Opponent shown as an object too.** Today the opponent is TEXT-ONLY (`statusEl` "CPU: scissors").
The redesign must render the opponent's committed shape as an object on its own render path. [→ child f1]

**R3 — Poppy reveal animation.** Whichever object is thrown "pops" in with a smooth, springy
overshoot (scale/pop feel), via the EXISTING Rapier `juice` cosmetic layer — **zero new dependency**.
The pop is cosmetic and fire-and-forget; it cannot alter the committed result. [→ child f2]

**R4 — Hidden-CPU board / occluder + reveal sequencing.** Something (a board / barrier / screen)
HIDES the opponent object until a reveal beat, then clears/opens to reveal the committed opponent
shape. This is PURE render-layer sequencing over an already-committed result. [→ child f3]

**R5 — Comedy/clarity of the reveal reads instantly as RPS** — the redesign must make the current
"terrible" hand-morph read clearly as "you threw X, CPU threw Y, you win/lose." Usability first.

### Non-functional

**NFR1 — F1-FIRST / render-as-consumer (LOAD-BEARING invariant).** `RoundMachine.submit()` commits
BOTH `playerShape` and `opponentShape` + `result` SYNCHRONOUSLY the instant a confident gesture
arrives (verified live in `src/round/machine.ts`: `pickOpponent()` → `resolve()` → phase=`resolved`
→ `emit()`). The opponent is NOT chosen lazily at reveal time. Therefore:
- The "board that hides the CPU pick" is a render sequencing/occlusion concern, NOT a rules change.
- Design/implement MUST NOT relocate `pickOpponent()` out of `submit()`, and MUST NOT couple the
  result to animation timing. `round.test.ts`, `render-physics.test.ts`, and `main.ts`'s comment all
  lock this. The reveal is choreography over an already-committed result.

**NFR2 — Zero new dependency.** Three.js meshes (already in the stack) for the objects + the existing
Rapier `juice` layer for the pop. No new npm dependency.

**NFR3 — Additive-to-core.** The gameplay authority (`RoundMachine` + `rules.ts` + `types.ts`) is
UNTOUCHED. All new work is confined to the render/animation layer (a committed-result consumer).

**NFR4 — a11y preserved.** `#status`/`#badge` stay truthful + first in reading order; the reveal must
NOT spam the aria-live region; the outcome must remain announced (a SR user who can't see the pop
still hears "You: rock · CPU: scissors → You win"). No live-region spam from the reveal beat.

**NFR5 — Regression coverage on the untested render/reveal surface.** The same gap class that let
card-rps3d-fix ship broken-green (a green build with no render/boot test). Design must specify a
headless/DOM-free test seam for the reveal sequencing (assert: opponent object HIDDEN until the reveal
beat, then SHOWN; result committed BEFORE the animation starts; F1-first not violated). Reuse the
existing DOM-free `wireGame` seam discipline (node-env vitest, `import.meta.glob '?raw'` for markup).

## 2. Decomposition → child cards (depth=deep, budget unlimited)

Three independently-shippable features, fanned out to child GH issues on the OWNED repo. Ordering
respects a **dependency chain** (F1-first at the feature level too): f1 introduces the objects +
opponent render path that f2 (pop) and f3 (board/reveal) both depend on.

| Child | Feature | Size | Depends on | GH issue |
|---|---|---|---|---|
| f1 | Throwable RPS object-rig + NEW opponent-object render path (replaces `HandRig` as the player visual; opponent no longer text-only) | M (3) | — (foundation; must land first) | filed below |
| f2 | Poppy reveal animation on the thrown object via the existing Rapier `juice` cosmetic layer (zero new dep) | S (1) | f1 (needs the objects to pop) | filed below |
| f3 | Hidden-CPU board/occluder + reveal sequencing + headless regression seam (opponent hidden until reveal beat; result committed before animation) | S (1) | f1 (needs the opponent object to hide/reveal) | filed below |

`effort.features` = [f1 M/3, f2 S/1, f3 S/1]; `effort.total` = 5.
`effort.scope[requirements]` = 5 (the fanned-out feature set, detailed not grown vs investigate's 5).
deep GROWTH_FACTOR=3.0; back-step check: scope[requirements]=5 > 3.0 × scope[investigate](=3) = 9? **NO.**

**Single parent branch/PR invariant (preserved).** All parent-level results_in_repo output for
card-rps3d-objects stays on the ONE card branch `dlc/card-rps3d-objects` → ONE parent PR. Each CHILD
card gets its OWN branch `dlc/<child-card-id>` → its own PR, running its own ladder. The parent PR
carries the spec/decomposition artifacts + any thin asset-independent shared scaffolding; the feature
bulk lands via the children. Parent retires only when f1/f2/f3 children are all consumed.

## 3. Acceptance criteria (parent exit)

1. requirements.md produced + committed on `dlc/card-rps3d-objects` (this file). ✅
2. Three child issues filed on the owned repo, each `dlc:investigate` + `enhancement`, titled
   `[card-rps3d-objects · fN] …`, body carrying parent #22 + F1-first guardrail + dependency note.
3. Each child recorded in parent `child_tickets[]` with `parent_ticket`→#22; parent `lifecycle=handed-off`.
4. F1-first / NFR1 explicitly handed to every child (in the issue body) so no child relocates
   `pickOpponent()` or couples result to animation timing.
5. `step_status['requirements'] = done`; the interjection marked `consumed`.

## 4. Handoff

NEXT = gate-spec (a human gate on this assisted card) — the advance cron does NOT auto-approve under
assisted; it parks the gate for a human. Meanwhile the three children enter at `dlc:investigate` and
the advance cron escalates each child's investigate step on its next ticks. Design (parent + children)
owns art direction / animation technique / reveal mechanism per the STOP-RULE (this step captures
WHAT + the decomposition, not HOW).
