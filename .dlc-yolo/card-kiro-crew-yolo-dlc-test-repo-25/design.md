# Design — card-kiro-crew-yolo-dlc-test-repo-25 (f3)

**Card:** `card-kiro-crew-yolo-dlc-test-repo-25`
**Issue:** [#25](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/25) — "[card-rps3d-objects · f3] Hidden-CPU board/occluder + reveal sequencing + regression seam"
**Parent:** #22 (card `card-rps3d-objects`), feature **f3 (S/1)**. **Depends on f1 (#23).**
**Step:** design · **trust:** assisted (inherited) · **depth:** deep · **capability:** dlcyolo-coordinator
**Crew assigned:** `dlcyolo-rps3d-design` (dlcyolo-authoring)
**Upstream:** requirements.md (this dir, R1–R5 / NFR1–NFR5 / 8 AC), investigation.md (`dec-25-viability` = GO).

---

## 0. Dispatch grounding (no faked crew run)

This step is crew-assigned to `dlcyolo-rps3d-design` (dlcyolo-authoring). This coordinator runtime's
tool surface is **read / write / shell only** — it does **not** hold `select_crew`/`spawn_run` (the
same empirically-confirmed finding as every prior step on `pl-rps3d`: card-backlog-14,
card-rps3d-headline, parent card-rps3d-objects, and this card's own investigate + requirements runs).
Per **PRODUCE-OR-BLOCK**, a run lacking the crew-routing *mechanism* PERFORMS the step inline rather
than faking a crew or silently downgrading. Design authoring is a read → analyze → write pass =
exactly `dlcyolo-rps3d-design`'s dlcyolo-authoring scope (a subset of the coordinator's scope), done
inline honestly. **NOT a hard capability-gap:** the absent tool is only dispatch, not one the design
work itself needs.

## 1. Design intent & the load-bearing invariant

f3 adds the **theatrical reveal**: a board/occluder that hides the CPU's rendered pick until a reveal
beat, and the controller that sequences hide → (throw resolves) → reveal → show. The single
non-negotiable is **F1-FIRST (NFR1)**: the result is already committed by `RoundMachine.submit()`
before any render or animation. Verified live:

```
submit(r): pickOpponent() → resolve() → set playerShape/opponentShape/result → phase='resolved' → emit()
main.ts:   machine.onChange(s => { render(s); if (resolved) juice.onResult(...) })
```

So the reveal controller is a **pure downstream `onChange` subscriber**, structurally identical to
`render` and `juice` today. It NEVER sits upstream of `submit()`, NEVER relocates `pickOpponent`, and
NEVER couples the committed `result`/`opponentShape` to reveal timing. Occlusion is *visual only*.

## 2. Component design

Two new render-layer units + a thin wire-in at the boot/`onChange` seam. Both are injectable and
DOM/WebGL-free at their logic boundary (mirrors the `wireGame` discipline that made
`test/main.test.ts` possible), so NFR5's headless assertion needs no WebGL.

### 2.1 `Occluder` interface (the "board") — `src/render/occluder.ts` (NEW)

The occluder is defined behind a **minimal capability interface** so the reveal controller and the
regression test depend on the *contract*, not on THREE. This is the same pattern as `HandRig`
(`hands.ts`) and `WireRig`/`WireScene` (`main.ts`).

```ts
// src/render/occluder.ts
import type { Shape } from '../types';

/** The opponent's rendered object, as the reveal controller sees it (f1/#23 supplies the real one). */
export interface OpponentObject {
  /** Show/hide the committed opponent pick. Visual only — never touches game state. */
  setVisible(visible: boolean): void;
  /** Set which shape is displayed (called with the ALREADY-committed opponentShape). */
  setShape(shape: Shape): void;
}

/** The board/barrier/screen that visually hides the opponent object until the reveal beat. */
export interface Occluder {
  /** Cover the opponent (round begin / re-hide). */
  cover(): void;
  /**
   * Play the reveal transition, then leave the opponent shown. `instant=true` (reduced-motion /
   * LOW tier) collapses to an immediate show with NO timing dependency.
   * Returns void — the controller drives timing via update(dt); no promise gates the result.
   */
  reveal(instant: boolean): void;
  /** Per-frame animation advance (same RAF channel as poseT / juice.update). Cosmetic; safe no-op. */
  update(dt: number): void;
  /** True once the reveal transition has fully played (for the render loop / tests). */
  isRevealed(): boolean;
}

/**
 * Three.js implementation: a plane/panel mesh in front of the opponent object that slides/fades
 * out on reveal. ART DIRECTION (mesh form, material, slide-vs-fade, easing) is an implement-time
 * detail bounded by this contract — the controller + tests only see cover()/reveal()/update().
 */
export class BoardOccluder implements Occluder { /* impl at build time (f1-dependent for placement) */ }

/** Always-ships fallback if no board mesh is available yet (f1 unbuilt): a no-op occluder that
 *  keeps the opponent simply shown — the game never wedges on a missing board (NFR4 reversible). */
export class NullOccluder implements Occluder {
  cover() {}
  reveal(_instant: boolean) { this._revealed = true; }
  update(_dt: number) {}
  isRevealed() { return this._revealed; }
  private _revealed = true;
}
```

### 2.2 `RevealController` (the sequencer) — `src/render/reveal.ts` (NEW, pure/DOM-free)

The controller is the **acceptance-critical unit**: pure logic subscribing to committed state,
driving the occluder. It holds the beat state machine and is fully headless-testable.

```ts
// src/render/reveal.ts
import type { RoundState } from '../round/machine';
import type { Occluder, OpponentObject } from './occluder';

export interface RevealDeps {
  occluder: Occluder;
  opponent: OpponentObject;
  /** reduced-motion / LOW-tier signal — reuse shouldTweenOnly({reducedMotion,tier,physicsReady}). */
  instant: () => boolean;
}

/**
 * Subscribes to machine.onChange. Beat order:
 *   phase 'capturing'|'idle'  -> cover()  (opponent hidden; re-hide on every fresh round — R5)
 *   phase 'resolved'          -> setShape(opponentShape) then reveal(instant())  (result ALREADY committed)
 *   phase 'lowConfidence'     -> no reveal (stays covered; player re-throws)
 * Idempotent per round via a revealedForRound guard so re-emits don't double-fire.
 */
export class RevealController {
  private revealedThisRound = false;
  constructor(private deps: RevealDeps) {}

  /** The onChange handler. Called AFTER submit() has committed the result. */
  onState(s: RoundState): void {
    if (s.phase === 'capturing' || s.phase === 'idle') {
      this.revealedThisRound = false;
      this.deps.occluder.cover();               // R1/R5 re-hide
      return;
    }
    if (s.phase === 'resolved' && s.result && s.opponentShape && !this.revealedThisRound) {
      // F1-FIRST: opponentShape/result are ALREADY set by submit(); we only display + choreograph.
      this.deps.opponent.setShape(s.opponentShape);
      this.deps.occluder.reveal(this.deps.instant());  // R2/R3; instant path = NFR3 reduced-motion
      this.revealedThisRound = true;
    }
    // lowConfidence: intentionally no-op (stay covered).
  }

  update(dt: number): void { this.deps.occluder.update(dt); }
}
```

### 2.3 Wire-in — `src/main.ts` (additive, minimal)

Additive changes only — the existing `render(s)` (status/badge) branch is **byte-for-byte
unchanged** so the committed outcome is still announced with the board present (NFR3):

1. Construct the occluder + a `RevealController` in `boot()` next to `juice`.
2. In the existing `machine.onChange` handler, **append** `reveal.onState(s)` AFTER `render(s)` —
   render (a11y-authoritative status) fires first, then the cosmetic reveal choreography. This
   preserves the render-first ordering that already governs `juice`.
3. In the RAF `frame()` loop, add `reveal.update(dt / 1000)` alongside `juice.update(...)` — same
   cosmetic timing channel, no new loop, no new dep (NFR4).
4. Opponent object handle: **f1 (#23) supplies the real `OpponentObject`.** Until f1 merges, `boot()`
   wires a `NullOccluder` + a stub opponent (opponent stays text-only via the unchanged
   `render(s)` — the board simply no-ops), so f3 lands non-regressively and the visible board
   activates once f1's opponent-object render path exists. This honors the **f1-first sequencing
   dependency** without blocking f3's own PR.

The `onChange`-append + RAF-append are inside `boot()`, which is the real-DOM adapter; the
**testable logic is entirely in `reveal.ts` + `occluder.ts`**, exactly as `wireGame` extracted the
testable wiring out of `boot()`.

## 3. Beat sequence (the reveal timeline)

```
begin()/capturing  ── controller.onState ─▶ occluder.cover()        [opponent hidden]
player flick ─▶ engine/fallback ─▶ machine.submit(r)
   └─ submit() SYNCHRONOUSLY: pickOpponent + resolve + set shapes/result + phase='resolved' + emit()
resolved  ── controller.onState ─▶ opponent.setShape(committed) ─▶ occluder.reveal(instant?)
                                    (result already committed — reveal is choreography only)
RAF frame ─▶ occluder.update(dt)  [slide/fade transition plays]  ─▶ isRevealed() true
next round ─▶ begin() ─▶ capturing ─▶ occluder.cover()  [R5 re-hide, replay]
```

Reduced-motion / LOW tier: `instant()` (from `shouldTweenOnly`) returns true → `reveal(true)` shows
the opponent immediately, no timing dependency (NFR3).

## 4. Requirement → design trace

| Req | Where satisfied |
|-----|-----------------|
| R1 occluder hides opponent | `Occluder.cover()` on capturing; `BoardOccluder` mesh in front of opponent |
| R2 reveal sequencing over committed state | `RevealController.onState` subscribes `machine.onChange`, reveals on `phase==='resolved'` |
| R3 reveal reads as a beat | `occluder.reveal()` + `update(dt)` transition (art direction = implement detail) |
| R4 injectable DOM/WebGL-free controller | `RevealController(RevealDeps)` consumes `Occluder`/`OpponentObject` handles + `RoundState`, no `document`/WebGL |
| R5 fresh-round re-hide | `onState` calls `cover()` on `capturing`/`idle` + resets `revealedThisRound` |
| NFR1 F1-first / render-as-consumer | controller is a pure `onChange` subscriber; `pickOpponent` stays in `submit()`; result/shape read-only |
| NFR2 additive-to-core | NEW `occluder.ts`/`reveal.ts` + additive `main.ts` wire-in; NO `src/round/**`, `rules.ts`, `types.ts` (import only) edits |
| NFR3 a11y | `render(s)` status/badge unchanged (outcome always announced); `instant()` via `shouldTweenOnly` = reduced-motion instant show |
| NFR4 zero-dep / reversible | Three.js mesh + existing RAF channel; `NullOccluder` fallback; removable behind render layer |
| NFR5 headless regression seam | `test/reveal.test.ts` (§5) — node-env, injected fakes, hidden-until-reveal + result-committed-before-reveal |

## 5. Test design (NFR5 — the acceptance-defining artifact)

`test/reveal.test.ts`, `environment: 'node'` (matches `vite.config.ts`), reusing the
`test/main.test.ts` fake-collaborator discipline. Fakes record interactions; **no THREE, no DOM**.

```ts
// test/reveal.test.ts  (design sketch — implement in the implement step)
import { describe, it, expect } from 'vitest';
import { RevealController } from '../src/render/reveal';
import type { Occluder, OpponentObject } from '../src/render/occluder';
import { RoundMachine } from '../src/round/machine';
import type { GestureResult } from '../src/types';

function fakes(instant = false) {
  const calls: string[] = [];
  let shownShape: string | null = null;
  const occluder: Occluder = {
    cover: () => calls.push('cover'),
    reveal: (i) => calls.push(i ? 'reveal:instant' : 'reveal'),
    update: () => {},
    isRevealed: () => calls.includes('reveal') || calls.includes('reveal:instant'),
  };
  const opponent: OpponentObject = { setVisible: () => {}, setShape: (s) => (shownShape = s) };
  const ctrl = new RevealController({ occluder, opponent, instant: () => instant });
  return { ctrl, calls, get shownShape() { return shownShape; } };
}
const R = (): GestureResult => ({ shape: 'scissors', confidence: 0.9, lowConfidence: false, latencyMs: 5 });

describe('reveal controller (f3, NFR5)', () => {
  it('opponent is HIDDEN from round-begin, then SHOWN on the reveal beat', () => {
    const f = fakes();
    const m = new RoundMachine(() => 'rock');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin();                                  // capturing -> cover
    expect(f.calls).toContain('cover');
    expect(f.calls).not.toContain('reveal');
    m.submit(R());                              // resolved -> reveal
    expect(f.calls).toContain('reveal');
  });

  it('result is COMMITTED before the reveal fires (F1-first)', () => {
    const f = fakes();
    let stateAtReveal: { phase: string; result: unknown; opponentShape: unknown } | null = null;
    const m = new RoundMachine(() => 'rock');
    // Wrap so we snapshot machine state at the exact moment the controller reveals.
    m.onChange((s) => {
      const before = f.calls.length;
      f.ctrl.onState(s);
      if (f.calls.length > before && f.calls[f.calls.length - 1].startsWith('reveal'))
        stateAtReveal = { phase: s.phase, result: s.result, opponentShape: s.opponentShape };
    });
    m.submit(R());
    expect(stateAtReveal).toEqual({ phase: 'resolved', result: 'a', opponentShape: 'rock' }); // scissors beats rock => 'a'
    expect(f.shownShape).toBe('rock');          // controller displays the ALREADY-committed pick
  });

  it('reduced-motion / LOW collapses the reveal to an instant show', () => {
    const f = fakes(true);
    const m = new RoundMachine(() => 'paper');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin(); m.submit(R());
    expect(f.calls).toContain('reveal:instant');
  });

  it('low-confidence stays covered (no reveal)', () => {
    const f = fakes();
    const m = new RoundMachine(() => 'rock');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin();
    m.submit({ shape: 'rock', confidence: 0.2, lowConfidence: true, latencyMs: 5 });
    expect(f.calls).not.toContain('reveal');
  });

  it('fresh round RE-HIDES (R5): cover fires again on the next round', () => {
    const f = fakes();
    const m = new RoundMachine(() => 'rock');
    m.onChange((s) => f.ctrl.onState(s));
    m.begin(); m.submit(R());                   // reveal
    m.submit(R());                              // resolved->begin() re-entry: capturing -> cover
    expect(f.calls.filter((c) => c === 'cover').length).toBeGreaterThanOrEqual(2);
  });
});
```

**Guard bites:** relocating `pickOpponent` out of `submit()` (or gating the result on the reveal)
makes the "committed before reveal" test red; dropping the fresh-round `cover()` makes the re-hide
test red — the exact broken-green gap class card-rps3d-fix taught us to lock.

## 6. Implement-step targets (bounded, for the tasks step)

- T1 `src/render/occluder.ts` — `Occluder`/`OpponentObject` interfaces + `NullOccluder` (always-ships) + `BoardOccluder` skeleton.
- T2 `src/render/reveal.ts` — `RevealController` (pure, DOM-free).
- T3 `src/main.ts` — additive wire-in (construct, `onState` append after `render`, `update` in RAF; `NullOccluder` + stub opponent until f1).
- T4 `test/reveal.test.ts` — the 5 node-env assertions above.
- T5 build/gate — `tsc --noEmit && vite build` clean; full suite green + additive-only diff (NFR2 protected-surface guard: `src/round/**`, `rules.ts`, `types.ts` = zero edits).
- **Sequencing:** T3's *visible* board activation depends on f1 (#23)'s `OpponentObject`; T1/T2/T4 are f1-independent and can land now against the interface + `NullOccluder`.

## 7. Decision-gate self-check (ASK-BEFORE-DONE, run against inputs)

- **Serves intent?** Yes — the board + reveal beat directly deliver the parent "hide the CPU pick,
  big reveal" intent, over an already-committed result.
- **Unseen scope?** No — design maps 1:1 onto R1–R5/NFR1–NFR5; introduces no entity the requirements
  didn't sanction (occluder + controller + one test).
- **Consequential implicit technical choice?** The one real design fork — *how* to express the reveal
  so it's headless-testable — is resolved IN-DESIGN by the injectable `Occluder`/`OpponentObject`
  interface + pure `RevealController` (matching the codebase's existing `wireGame`/`HandRig`
  discipline, zero new dep). Art direction (mesh form, slide-vs-fade, easing) is deliberately left to
  implement, bounded by the contract — not a blocking pipeline fork.
- **Capability-gap?** No — design authoring needs read/write/shell only; the absent `select_crew`/
  `spawn_run` is only the dispatch mechanism, not a design tool. Performed inline per PRODUCE-OR-BLOCK.
- **Human-only fork changing WHAT/routing?** None — the single structural fork (single-card vs
  fan-out) was already answered by the human interjection at the parent; f3 exists because of it.

→ **No blocking `ask_question`; no new decision-gate entry required.** Proceed to `done`.

## 8. Effort & next

`effort.scope[design]=1` (leaf slice detailed, not grown vs requirements=1). deep GROWTH_FACTOR=3.0
back-step `1 > 3×1(requirements)=3`? **NO.** No feature parked, no children created (leaf).

**NEXT = tasks** (no gate between design and tasks in this ladder). Under trust=assisted the advance
cron consumes `design=done`, relabels `dlc:design → dlc:tasks`, and escalates the tasks step; the
downstream human `gate-impl` still parks for a human. **f3's implement must sequence after f1 (#23)**
lands the opponent object the board hides/reveals — T1/T2/T4 are f1-independent and land now.
