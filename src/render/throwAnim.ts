import type { Rig } from './scene';
import type { Shape } from '../types';

/**
 * Short "3-2-1-shoot" cock-and-throw tween for both hands, snapping to the
 * resolved poses (R1.4, R2.1, R2.2). Purely cosmetic and decoupled from the
 * classification result — the outcome is already resolved (<=150 ms) before
 * this runs.
 */
export function playThrow(
  player: Rig,
  cpu: Rig,
  playerShape: Shape,
  cpuShape: Shape,
  durationMs = 700,
): Promise<void> {
  return new Promise((done) => {
    const start = performance.now();
    const baseY = { player: player.group.position.y, cpu: cpu.group.position.y };

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Three cocks (up) then a shoot (down) — a simple oscillation that settles.
      const bob = Math.sin(t * Math.PI * 3) * (1 - t) * 0.35;
      player.group.position.y = baseY.player + bob;
      cpu.group.position.y = baseY.cpu + bob;

      if (t >= 0.85) {
        player.setPose(playerShape);
        cpu.setPose(cpuShape);
      }

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        player.group.position.y = baseY.player;
        cpu.group.position.y = baseY.cpu;
        done();
      }
    };
    requestAnimationFrame(step);
  });
}
