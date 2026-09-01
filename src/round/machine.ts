// T8 [F1/F5] — round state machine (R5.1, R1.2).
// idle -> capture -> classify -> resolve -> replay. Advances on GestureResult ALONE
// (layering invariant); on lowConfidence surfaces a badge + allows re-throw (no silent guess).
import type { Shape, GestureResult, RoundResult } from './../types';
import { resolve } from './../rules';

export type RoundPhase = 'idle' | 'capturing' | 'lowConfidence' | 'resolved';

export interface RoundState {
  phase: RoundPhase;
  playerShape: Shape | null;
  opponentShape: Shape | null;
  result: RoundResult | null;
  lastConfidence: number;
  score: { player: number; opponent: number; draws: number };
}

const SHAPES: Shape[] = ['rock', 'paper', 'scissors'];

export class RoundMachine {
  private state: RoundState = {
    phase: 'idle',
    playerShape: null,
    opponentShape: null,
    result: null,
    lastConfidence: 0,
    score: { player: 0, opponent: 0, draws: 0 },
  };

  private listeners = new Set<(s: RoundState) => void>();
  /** Injectable opponent picker (deterministic in tests). */
  private pickOpponent: () => Shape;

  constructor(pickOpponent: () => Shape = () => SHAPES[Math.floor(Math.random() * 3)]) {
    this.pickOpponent = pickOpponent;
  }

  getState(): Readonly<RoundState> {
    return this.state;
  }

  onChange(fn: (s: RoundState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  /** Begin a fresh round (clears the previous result). */
  begin(): void {
    this.state = {
      ...this.state,
      phase: 'capturing',
      playerShape: null,
      opponentShape: null,
      result: null,
    };
    this.emit();
  }

  /**
   * The ONE entry point from the gesture engine / a11y fallback.
   * A low-confidence result does NOT resolve — it flags a re-throw.
   */
  submit(r: GestureResult): void {
    if (this.state.phase === 'resolved') this.begin();
    if (this.state.phase === 'idle') this.state.phase = 'capturing';

    this.state.lastConfidence = r.confidence;

    if (r.lowConfidence) {
      this.state.phase = 'lowConfidence';
      this.emit();
      return; // no silent guess — allow re-throw
    }

    const opponent = this.pickOpponent();
    const result = resolve(r.shape, opponent);
    this.state.playerShape = r.shape;
    this.state.opponentShape = opponent;
    this.state.result = result;
    this.state.phase = 'resolved';

    if (result === 'a') this.state.score.player++;
    else if (result === 'b') this.state.score.opponent++;
    else this.state.score.draws++;

    this.emit();
  }
}
