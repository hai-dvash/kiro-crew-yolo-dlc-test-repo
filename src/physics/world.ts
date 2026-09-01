// T14 [F4] — fixed-timestep physics world (R4.2).
// FORK 2 (design §2): @dimforge/rapier3d-compat (WASM inline). Cosmetic-only,
// NEVER gameplay authority. Fixed 60Hz accumulator loop decoupled from render.
import type RAPIER from '@dimforge/rapier3d-compat';

const FIXED_DT = 1 / 60;

export interface PhysicsWorld {
  ready: boolean;
  /** Advance by real elapsed time using a fixed-dt accumulator. */
  step(elapsedMs: number): void;
  /** Spawn N cosmetic debris bodies at a point (impact burst). */
  burst(x: number, y: number, z: number, n: number): void;
  bodyCount(): number;
  dispose(): void;
}

/**
 * Pure accumulator math (unit-testable without WASM): given elapsed ms and a
 * carried remainder, return how many fixed steps to run and the new remainder.
 */
export function accumulate(elapsedMs: number, remainderS: number, dt = FIXED_DT): { steps: number; remainder: number } {
  let acc = remainderS + Math.max(0, elapsedMs) / 1000;
  let steps = 0;
  // Clamp to avoid spiral-of-death on long stalls.
  const MAX_STEPS = 5;
  while (acc >= dt && steps < MAX_STEPS) {
    acc -= dt;
    steps++;
  }
  return { steps, remainder: acc };
}

/** Async factory: loads Rapier WASM, builds a gravity world. Never blocks gameplay. */
export async function createPhysics(): Promise<PhysicsWorld> {
  const RAPIER_MOD = (await import('@dimforge/rapier3d-compat')) as typeof RAPIER;
  await RAPIER_MOD.init();
  const world = new RAPIER_MOD.World({ x: 0, y: -9.81, z: 0 });
  let remainder = 0;
  const bodies: RAPIER.RigidBody[] = [];

  return {
    ready: true,
    step(elapsedMs: number) {
      const { steps, remainder: rem } = accumulate(elapsedMs, remainder);
      remainder = rem;
      for (let i = 0; i < steps; i++) world.step();
    },
    burst(x, y, z, n) {
      for (let i = 0; i < n; i++) {
        const rbDesc = RAPIER_MOD.RigidBodyDesc.dynamic().setTranslation(x, y, z);
        const rb = world.createRigidBody(rbDesc);
        rb.applyImpulse(
          { x: (Math.random() - 0.5) * 2, y: Math.random() * 3, z: (Math.random() - 0.5) * 2 },
          true,
        );
        world.createCollider(RAPIER_MOD.ColliderDesc.ball(0.08), rb);
        bodies.push(rb);
        if (bodies.length > 200) {
          const old = bodies.shift();
          if (old) world.removeRigidBody(old);
        }
      }
    },
    bodyCount: () => bodies.length,
    dispose: () => world.free(),
  };
}
