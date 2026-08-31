# Design — card-rps3d

**Card:** 3D Rock-Paper-Scissors with Wii-style mouse-gesture throws
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo (issue #4)
**Step:** design (crew: `dlcyolo-rps3d-design`, role: 3D + gesture-feel design)
**Depth:** standard → spec type `feature` · **Trust:** assisted
**Run:** escalated subagent, executed **INLINE**. This runtime (KiroCrew subagent) has
read/write/shell only — **no `select_crew`/`spawn_run`** — so crew routing to
`dlcyolo-rps3d-design` is flattened to inline design-agent reasoning (crew confirmed present in
the global registry via `kirocrew agent list`), the same tool-inheritance handling used on the
investigate and requirements steps of this card. Grounded in `requirements.md` + `investigation.md`.

## Framing (carried forward)

GO **as a showcase**, NO-GO as revenue. The **gesture feel (R1)** is the primary acceptance
driver and the real design fork; the **3D render (R2)** is supporting/table-stakes. **No
monetization** anywhere in this design.

---

## Resolutions to the gate-spec open questions

The requirements phase carried three open questions into gate-spec. The gate was approved by a
human (`gate_history`), so this design **resolves** them as the design-phase decisions:

1. **Gesture UX model → press-and-hold-then-flick (explicit gesture window).**
   Chosen over free-flick detection. Rationale: a held button gives a **deterministic capture
   window** (mousedown → mouseup = the gesture), which removes the hardest ambiguity of
   free-flick (segmenting "is this a throw or just cursor movement?"). It maps cleanly to the
   Wii "cock your arm then throw" feel and directly de-risks R1.3 (≥80% first-try accuracy) and
   R1.4 (≤150 ms resolution). Free-flick is noted as a **backlog polish item**, not v1.

2. **Accessibility fallback (NFR3) → IN SCOPE for v1.**
   Recommended in-scope by requirements; confirmed. Three always-visible buttons
   (rock/paper/scissors) share the exact same round-resolution path as a classified gesture.
   Cheap (f4, 1 pt) and it de-risks the "gesture feels janky" failure mode by guaranteeing the
   game is always playable.

3. **Confidence surfacing (R1.2) → best-guess with a low-confidence badge + optional re-throw.**
   On a below-threshold or ambiguous gesture, do **not** silently guess: show the top-guess
   shape with a visible low-confidence badge and a one-click "re-throw" affordance. This keeps
   flow (no hard blocking) while honoring R1.2's "SHALL NOT guess silently."

---

## Architecture (lean, zero-install, client-only)

```
index.html
  └─ main.ts            app bootstrap + round loop (state machine)
     ├─ gesture/
     │   ├─ capture.ts   pointerdown→pointermove→pointerup sampler (raw sample buffer)
     │   ├─ features.ts  derive features from the sample buffer
     │   └─ classify.ts  rule-based classifier → {shape, confidence}
     ├─ render/
     │   ├─ scene.ts      Three.js scene, camera, lights, two hand rigs
     │   └─ throwAnim.ts  play player + CPU throw, resolve pose
     ├─ game/
     │   ├─ rules.ts      RPS win/lose/draw + independent CPU pick
     │   └─ round.ts      round state machine (IDLE→CAPTURING→CLASSIFIED→RESOLVED→REPLAY)
     └─ ui/
         └─ fallback.ts   three a11y buttons + confidence badge + re-throw
```

No server, no build-time backend. Bundled with Vite (static output). Runs entirely in the
browser — satisfies R4.1.

### Round state machine (game/round.ts)

`IDLE → CAPTURING (pointerdown) → CLASSIFIED (pointerup + classify) → RESOLVED (reveal CPU +
outcome) → REPLAY (play again, no reload)`. The CPU pick is drawn at **RESOLVED** entry from a
source the player never observed (R3.2). Fallback buttons inject a `CLASSIFIED` event directly,
reusing the same downstream path (R3, NFR3).

---

## R1 — Gesture capture & classifier (the hard part, detailed)

**Capture (`gesture/capture.ts`).** On `pointerdown` inside the play area, start sampling
`{t, x, y}` on each `pointermove` (throttled to animation frames). On `pointerup`, close the
window and hand the buffer to feature extraction. A minimum motion threshold (total path length
+ peak velocity) gates R1.2 — below it, emit `confidence=low`.

**Features (`gesture/features.ts`)** — cheap, interpretable, no ML training needed for v1:
- **peak velocity** and **velocity profile** (single sharp spike vs. sustained).
- **dominant axis** of travel (vertical vs. horizontal) and **direction reversals**.
- **path shape**: net displacement vs. total path length (straightness), and count of
  direction changes.

**Classifier (`gesture/classify.ts`) — rule-based mapping (v1):**
- **Rock** = short, sharp, mostly-straight downward flick (a "pound"): high peak velocity,
  low direction-change count, vertical-dominant.
- **Paper** = a flat horizontal sweep / open swipe: sustained velocity, horizontal-dominant,
  low reversals.
- **Scissors** = a snip — **two quick direction reversals** (the defining feature): ≥2 reversals
  within the window.
Output `{shape, confidence}` where confidence is the margin between the top and runner-up rule
scores. This keeps v1 **trainless and debuggable**; a learned classifier is a **backlog item**
if the rule set proves too janky (front-loaded risk, called out honestly).

**Tuning/verification hook:** a dev-only overlay drawing the sample buffer + chosen features, so
the ≥80% accuracy target (R1.3) is measurable against a small manual test set rather than by feel.

---

## R2 — 3D render (supporting)

**`render/scene.ts`.** One Three.js scene, orthographic-ish perspective camera, two low-poly
hand rigs (player near, CPU far), soft lighting. Low-poly stylized hands (rock=fist,
paper=flat, scissors=two fingers) keep asset cost trivial and hit ≥30 fps without a discrete GPU
(R2.3) — no PBR, no shadows-heavy pipeline.

**`render/throwAnim.ts`.** On `CLASSIFIED`, both hands play a short "3-2-1-shoot" cock-and-throw
tween, snapping to the resolved shape pose. Animation is decoupled from classification latency:
classification result is ready ≤150 ms (R1.4); the throw animation is cosmetic and runs after.

---

## R3 / R4 — Rules & delivery

- **`game/rules.ts`.** Pure functions: `resolve(player, cpu)` and `cpuPick()` (uniform random,
  independent, unobserved — R3.2). Trivially unit-testable.
- **Replay** re-enters `IDLE` in place (R3.3); **zero-install** static bundle (R4.1).

---

## Testing strategy

- **Unit:** `rules.ts` (all 9 outcome combos), `features.ts` (feature math on canned buffers),
  `classify.ts` (labeled synthetic buffers per shape → assert classification + confidence sign).
- **Manual accuracy harness:** the dev overlay + a small recorded-gesture set to spot-check R1.3
  (≥80%). Not a formal study, per R1.3's own scoping.
- **A11y:** fallback buttons resolve a full round with the gesture path disabled.

---

## Effort Attribution (scope-growth back-step check)

| id | feature | design scope note | size | points |
|----|---------|-------------------|------|--------|
| f1 | Gesture capture + classifier | capture + features + rule classifier + dev overlay | L | 5 |
| f2 | 3D throw render | scene + two rigs + throw tween | M | 3 |
| f3 | Round resolution + replay | rules + state machine + CPU pick | S | 1 |
| f4 | Zero-install shell + a11y fallback | Vite static + 3 buttons + confidence badge | S | 1 |

- **effort.scope[design] = 10.** Design **held scope flat** vs. `effort.scope[requirements] = 10`
  — it made the gesture-model **fork decision** (press-and-hold-then-flick) and chose a
  **trainless rule-based** classifier rather than expanding into a learned pipeline, which would
  have inflated scope. No new features introduced; NFR3 was already surfaced at requirements.
- **Back-step heuristic:** GROWTH_FACTOR at depth=standard = 2.0 → trips if
  `scope[design] > 2.0 × scope[requirements]` i.e. > 20. **scope[design]=10 ≤ 20 → NO back-step.**

---

## Self-review (Step Review Contract)

- **Serves INTENT:** yes — the design front-loads the gesture-feel risk (explicit capture window,
  interpretable features, measurable accuracy hook) as the primary driver, keeps the 3D render
  deliberately cheap, and specs no monetization.
- **Unseen scope introduced?** No. Design chose the *simplest* option at the real fork
  (rule-based, not ML; press-and-hold, not free-flick) and parked both harder variants to backlog
  rather than expanding v1.
- **Consequential implicit technical fork?** The gesture-capture model was the fork — resolved
  explicitly and in the open (open question 1), not implicitly.
- **Capability gap?** None warranting a new crew/tool at this step.
- **Decision Gate: NOT raised** — design cleanly serves intent, scope is flat, and the one real
  fork was an expected, in-scope design decision (not a scope/intent violation). The next human
  gate is **gate-impl** after the tasks step.

## Backlog candidates (NOT parked as issues by this run — no gh clone in sandbox)

- Free-flick (no-button) gesture detection as a polish pass.
- Learned gesture classifier if the rule set proves janky against the manual test set.
The orchestrator/pr step (which has gh authority) can file these to `dlc-backlog` if desired;
this design run stays read/write within the spec dir per the sandbox.

## Repo-root `.dlc-yolo` mirror

`results_in_repo=true`, but the owned repo is **not cloned in this sandbox**, so the repo-root
`.dlc-yolo/` mirror + commit is **DEFERRED** to the orchestrator/pr step (same as investigate and
requirements). This design artifact lives in the spec dir and the app-data results area.
