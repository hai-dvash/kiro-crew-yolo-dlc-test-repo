import type { Shape, Outcome, Confidence } from '../types';
import { resolve, cpuPick } from './rules';

export type RoundState = 'IDLE' | 'CAPTURING' | 'CLASSIFIED' | 'RESOLVED';

export interface RoundResult {
  player: Shape;
  cpu: Shape;
  outcome: Outcome;
}

export interface RoundListeners {
  onState?: (state: RoundState) => void;
  onResolved?: (result: RoundResult) => void;
}

/**
 * Round state machine (R3.1, R3.2, R3.3):
 * IDLE -> CAPTURING -> CLASSIFIED -> RESOLVED -> (replay) -> IDLE.
 * The CPU pick is drawn at RESOLVED entry, from a source the player never observed.
 * `rng` is injectable purely for deterministic tests.
 */
export class Round {
  private state: RoundState = 'IDLE';
  private player: Shape | null = null;
  private lastResult: RoundResult | null = null;

  constructor(
    private readonly listeners: RoundListeners = {},
    private readonly rng: () => number = Math.random,
  ) {}

  getState(): RoundState {
    return this.state;
  }

  getResult(): RoundResult | null {
    return this.lastResult;
  }

  /** pointerdown / start of a fallback selection. */
  beginCapture(): void {
    if (this.state !== 'IDLE') return;
    this.setState('CAPTURING');
  }

  /**
   * A shape was classified (from a gesture or a fallback button, R3 + NFR3 share this path).
   * Low confidence does not block resolution — the caller surfaces the badge.
   */
  classified(shape: Shape, _confidence: Confidence = 'high'): void {
    // Allow direct classification from IDLE too (fallback buttons skip CAPTURING).
    if (this.state !== 'CAPTURING' && this.state !== 'IDLE') return;
    this.player = shape;
    this.setState('CLASSIFIED');
    this.resolveRound();
  }

  private resolveRound(): void {
    if (this.player == null) return;
    const cpu = cpuPick(this.rng);
    const outcome = resolve(this.player, cpu);
    this.lastResult = { player: this.player, cpu, outcome };
    this.setState('RESOLVED');
    this.listeners.onResolved?.(this.lastResult);
  }

  /** REPLAY: re-enter IDLE in place, no reload (R3.3). */
  replay(): void {
    this.player = null;
    this.setState('IDLE');
  }

  private setState(s: RoundState): void {
    this.state = s;
    this.listeners.onState?.(s);
  }
}
