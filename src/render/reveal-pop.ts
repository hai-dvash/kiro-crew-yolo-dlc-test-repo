// [f2] #24 (child of #22) — poppy reveal animation.
// A COSMETIC consumer of the already-committed round result: it introduces no state, never touches
// the round machine, and reuses the existing RAF frame() cadence + the resolved-beat hook in main.ts.
// F1-FIRST (NFR1): pickOpponent() stays in RoundMachine.submit(); this controller reads NOTHING from
// animation state — it only reveals a result the machine already decided synchronously at throw time.
// The PopTarget seam lets f2 ship + test GREEN before f1 (#23) lands the real throwable/opponent
// object; a null target makes every method a safe no-op (NFR4).
//
// DOM/WebGL-free by construction (no `three` import, no Math.random, no performance.now) so the whole
// controller is deterministically unit-testable in a node-env vitest suite (NFR5).

/**
 * The minimal structural view RevealPop needs of a poppable object: a settable uniform scale.
 * f1's player throwable-object and opponent object satisfy this directly, or via a 1-line adapter
 * (e.g. `{ setPopScale: (s) => obj.scale.setScalar(s) }`). Cosmetic only.
 */
export interface PopTarget {
  /** Set the object's uniform display scale (1 = rest). */
  setPopScale(scale: number): void;
}

export interface RevealPopOptions {
  /** reduced-motion OR LOW tier OR physics-missing => instant settle, no overshoot (FORK-2). */
  tweenOnly: boolean;
}

/** Reveal-beat window in ms (distinct from the 250ms pose ease in main.ts). */
const POP_MS = 260;
/** Peak scale on the pop (full-motion only). */
const OVERSHOOT = 1.18;
/** Fraction of the window spent rising to the peak before relaxing back to rest. */
const RISE_FRACTION = 0.6;

export class RevealPop {
  /** -1 = idle/armed; 0..POP_MS = animating. */
  private t = -1;
  private tweenOnly = false;
  private target: PopTarget | null;

  constructor(target: PopTarget | null) {
    this.target = target;
  }

  /** Point RevealPop at f1's object once it exists (or swap targets per round). */
  setTarget(target: PopTarget | null): void {
    this.target = target;
  }

  /**
   * Fire the reveal pop for a COMMITTED result. Caller drives this ONLY from the existing
   * `phase==='resolved' && result` branch, so it is never invoked before commit.
   */
  onResult(opts: RevealPopOptions): void {
    this.tweenOnly = opts.tweenOnly;
    if (this.tweenOnly) {
      // Reduced-motion / LOW tier: no overshoot bounce — the object simply arrives at rest scale.
      this.target?.setPopScale(1);
      this.t = -1;
      return;
    }
    this.t = 0; // arm the overshoot animation
    this.target?.setPopScale(0.0001); // start collapsed so it "pops" in
  }

  /** Per-frame advance (ms deltas — matches main.ts frame()). Cosmetic; no-ops when idle/target-absent. */
  update(dtMs: number): void {
    if (this.t < 0 || !this.target) return;
    this.t = Math.min(POP_MS, this.t + dtMs);
    const k = this.t / POP_MS; // 0..1
    // Overshoot-settle: rise past 1.0 to OVERSHOOT, then relax back to exactly 1.0 (back-ease-out feel).
    const s =
      k < RISE_FRACTION
        ? (k / RISE_FRACTION) * OVERSHOOT // rise to peak
        : OVERSHOOT + (1 - OVERSHOOT) * ((k - RISE_FRACTION) / (1 - RISE_FRACTION)); // settle to 1
    this.target.setPopScale(s);
    if (this.t >= POP_MS) {
      this.target.setPopScale(1); // land exactly at rest
      this.t = -1;
    }
  }

  /** Re-arm for a fresh round (mirrors machine.begin()). */
  reset(): void {
    this.t = -1;
    this.target?.setPopScale(1);
  }
}
