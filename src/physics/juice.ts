// T15 [F4] — juice: impact / particles / shake / camera (R4.1).
// Triggered on a COMMITTED result only (fire-and-forget, AFTER the round resolves).
// Subscribes read-only; cannot delay or alter the result (layering invariant).
import * as THREE from 'three';
import type { RoundResult } from './../types';
import type { PhysicsWorld } from './../physics/world';

export interface JuiceOptions {
  /** reduced-motion or LOW tier => tween-only, no physics/shake (FORK-2 downgrade). */
  tweenOnly: boolean;
  physics: PhysicsWorld | null;
}

export class Juice {
  private shake = 0;
  private readonly camera: THREE.Camera;
  private baseCamPos: THREE.Vector3;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.baseCamPos = camera.position.clone();
  }

  /** Fire the reaction for a resolved round. Never called before commit. */
  onResult(result: RoundResult, opts: JuiceOptions): void {
    if (opts.tweenOnly) {
      this.shake = 0; // reduced-motion: no shake
      return;
    }
    // Physics debris burst + a short screen shake proportional to outcome.
    const intensity = result === 'draw' ? 0.15 : 0.35;
    this.shake = intensity;
    opts.physics?.burst(0, 0.6, 0, result === 'draw' ? 6 : 14);
  }

  /** Per-frame decay + camera offset. Cosmetic; safe to no-op. */
  update(dt: number): void {
    if (this.shake <= 0) {
      this.camera.position.copy(this.baseCamPos);
      return;
    }
    this.shake = Math.max(0, this.shake - dt * 2);
    this.camera.position.set(
      this.baseCamPos.x + (Math.random() - 0.5) * this.shake,
      this.baseCamPos.y + (Math.random() - 0.5) * this.shake,
      this.baseCamPos.z,
    );
  }
}
