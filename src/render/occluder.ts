// f3 [#25] — hidden-CPU board/occluder (design §2.1, T1). The occluder is defined behind a MINIMAL
// capability interface so the reveal controller (reveal.ts) and the NFR5 regression test depend on
// the CONTRACT, not on THREE — the same DI discipline as HandRig (hands.ts) / WireRig (main.ts) that
// makes headless testing possible. F1-first (NFR1): occlusion is visual only; it never touches game
// state, never gates the committed result.
import * as THREE from 'three';
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
   * LOW tier) collapses to an immediate show with NO timing dependency. Returns void — the
   * controller drives the transition via update(dt); no promise gates the committed result.
   */
  reveal(instant: boolean): void;
  /** Per-frame animation advance (same RAF channel as poseT / juice.update). Cosmetic; safe no-op. */
  update(dt: number): void;
  /** True once the reveal transition has fully played (for the render loop / tests). */
  isRevealed(): boolean;
}

/**
 * Always-ships fallback when no board mesh is available yet (f1 unbuilt): a no-op occluder that
 * keeps the opponent simply shown — the game never wedges on a missing board (NFR4 reversible).
 * THREE-free so f3 lands non-regressively before f1 (#23) supplies the real OpponentObject.
 */
export class NullOccluder implements Occluder {
  private _revealed = true;
  cover(): void {
    /* no board mesh: opponent stays shown; nothing to cover */
  }
  reveal(_instant: boolean): void {
    this._revealed = true;
  }
  update(_dt: number): void {
    /* no transition to advance */
  }
  isRevealed(): boolean {
    return this._revealed;
  }
}

/** Reveal transition tuning (art direction bounded by the Occluder contract). */
const REVEAL_MS = 320;

/**
 * Three.js implementation: an opaque panel mesh placed in front of the opponent object that fades
 * out (opacity 1 → 0) on `reveal`, then lets the opponent show. Art direction (mesh form, material,
 * slide-vs-fade, easing) is an implement-time detail bounded by the Occluder contract — the
 * controller + tests only ever see cover()/reveal()/update()/isRevealed().
 *
 * The board's visible PLACEMENT (transform in front of f1's opponent object) completes at f1
 * integration (T7): boot() constructs the BoardOccluder with the opponent's world position once
 * f1 (#23) lands. Until then main.ts wires NullOccluder + a stub opponent, so this class is
 * inert on the current render path.
 */
export class BoardOccluder implements Occluder {
  readonly object: THREE.Object3D;
  private readonly material: THREE.MeshStandardMaterial;
  private elapsed = 0;
  private animating = false;
  private _revealed = false;

  constructor(width = 2.4, height = 2.4) {
    this.material = new THREE.MeshStandardMaterial({
      color: 0x1a1a24,
      transparent: true,
      opacity: 1,
      roughness: 0.9,
      metalness: 0.0,
    });
    const geo = new THREE.PlaneGeometry(width, height);
    this.object = new THREE.Mesh(geo, this.material);
    this.object.visible = true;
  }

  cover(): void {
    this._revealed = false;
    this.animating = false;
    this.elapsed = 0;
    this.material.opacity = 1;
    this.object.visible = true;
  }

  reveal(instant: boolean): void {
    if (instant) {
      this.animating = false;
      this.elapsed = REVEAL_MS;
      this.material.opacity = 0;
      this.object.visible = false;
      this._revealed = true;
      return;
    }
    this.animating = true;
    this.elapsed = 0;
    this.material.opacity = 1;
    this.object.visible = true;
  }

  update(dt: number): void {
    if (!this.animating) return;
    // dt is seconds (matches juice.update); convert to ms for the transition clock.
    this.elapsed += dt * 1000;
    const k = Math.min(1, this.elapsed / REVEAL_MS);
    this.material.opacity = 1 - k;
    if (k >= 1) {
      this.animating = false;
      this.object.visible = false;
      this._revealed = true;
    }
  }

  isRevealed(): boolean {
    return this._revealed;
  }
}
