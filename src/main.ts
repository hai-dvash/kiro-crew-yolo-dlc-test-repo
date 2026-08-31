import type { Shape } from './types';
import { Round } from './game/round';
import { createScene } from './render/scene';
import { playThrow } from './render/throwAnim';
import { attachCapture } from './gesture/capture';
import { attachFallback, showBadge } from './ui/fallback';
import { isDevMode, createDevOverlay } from './dev/overlay';

const OUTCOME_TEXT = {
  win: 'You win! 🎉',
  lose: 'CPU wins 🤖',
  draw: "Draw — go again",
} as const;

function main(): void {
  const canvas = document.getElementById('play') as HTMLCanvasElement;
  const hud = document.getElementById('hud') as HTMLElement;
  const badge = document.getElementById('badge') as HTMLElement;
  const fallbackEl = document.getElementById('fallback') as HTMLElement;

  const scene = createScene(canvas);
  scene.start();
  window.addEventListener('resize', scene.resize);

  const dev = isDevMode() ? createDevOverlay() : null;

  const round = new Round({
    onResolved: (r) => {
      // Result is ready immediately (<=150 ms, R1.4); the throw animation is cosmetic.
      void playThrow(scene.player, scene.cpu, r.player, r.cpu).then(() => {
        hud.textContent = `${OUTCOME_TEXT[r.outcome]}  (you: ${r.player} · cpu: ${r.cpu}) — press & flick to replay`;
      });
    },
  });

  const resolveShape = (shape: Shape, lowConfidence: boolean) => {
    if (round.getState() === 'RESOLVED') round.replay();
    showBadge(badge, lowConfidence);
    round.beginCapture();
    round.classified(shape, lowConfidence ? 'low' : 'high');
  };

  attachCapture(canvas, {
    onStart: () => {
      if (round.getState() === 'RESOLVED') round.replay();
      showBadge(badge, false);
      hud.textContent = 'Throwing…';
    },
    onClassified: (result, buffer) => {
      dev?.render(buffer, extractForOverlay(buffer), result);
      resolveShape(result.shape, result.confidence === 'low');
    },
  });

  attachFallback(fallbackEl, badge, {
    onPick: (shape) => resolveShape(shape, false),
    onRethrow: () => {
      round.replay();
      showBadge(badge, false);
      hud.textContent = 'Press & flick to throw';
    },
  });
}

// Small indirection so the overlay import stays tree-shakeable in prod builds.
import { extractFeatures } from './gesture/features';
import type { Sample } from './types';
function extractForOverlay(buf: Sample[]) {
  return extractFeatures(buf);
}

main();
