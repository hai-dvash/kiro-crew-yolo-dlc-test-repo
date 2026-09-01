// f3 [#25] — reveal-sequencing controller (design §2.2, T2). The ACCEPTANCE-CRITICAL unit: a PURE,
// DOM/WebGL-free downstream subscriber to machine.onChange that drives the occluder. Structurally
// identical to render / juice today — it NEVER sits upstream of submit(), NEVER relocates
// pickOpponent, NEVER couples the committed result/opponentShape to reveal timing (F1-first / NFR1).
import type { RoundState } from '../round/machine';
import type { Occluder, OpponentObject } from './occluder';

export interface RevealDeps {
  occluder: Occluder;
  opponent: OpponentObject;
  /** reduced-motion / LOW-tier signal — reuse shouldTweenOnly({reducedMotion,tier,physicsReady}). */
  instant: () => boolean;
}

/**
 * Subscribes to machine.onChange. Beat order (grounded in the real RoundPhase union):
 *   'capturing' | 'idle' -> cover()  (opponent hidden; re-hide + re-arm on every fresh round — R5)
 *   'resolved'           -> setShape(opponentShape) then reveal(instant())  (result ALREADY committed)
 *   'lowConfidence'      -> no reveal (stays covered; player re-throws)
 * Idempotent per round via revealedThisRound so re-emits don't double-fire.
 */
export class RevealController {
  private revealedThisRound = false;

  constructor(private deps: RevealDeps) {}

  /** The onChange handler. Called AFTER submit() has committed the result. */
  onState(s: RoundState): void {
    if (s.phase === 'capturing' || s.phase === 'idle') {
      this.revealedThisRound = false;
      this.deps.occluder.cover(); // R1/R5 re-hide + re-arm
      return;
    }
    if (s.phase === 'resolved' && s.result && s.opponentShape && !this.revealedThisRound) {
      // F1-FIRST: opponentShape/result are ALREADY set by submit(); we only display + choreograph.
      this.deps.opponent.setShape(s.opponentShape);
      this.deps.occluder.reveal(this.deps.instant()); // R2/R3; instant path = NFR3 reduced-motion
      this.revealedThisRound = true;
    }
    // 'lowConfidence': intentionally no-op (stay covered).
  }

  /** Per-frame cosmetic advance on the existing RAF channel. */
  update(dt: number): void {
    this.deps.occluder.update(dt);
  }
}
