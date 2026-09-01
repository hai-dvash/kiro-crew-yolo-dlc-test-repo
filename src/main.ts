// T18 [F5] — bootstrap wiring / DI (R5.2, design §1).
// Enforces the layering invariant: the round-machine advances on GestureResult
// alone; render + physics/juice subscribe AFTER the machine commits the result.
import * as THREE from 'three';
import { parseConfig } from './config';
import { GestureEngine } from './gesture/engine';
import { runAccuracy, formatReport } from './gesture/harness';
import { RoundMachine, type RoundState } from './round/machine';
import { createScene } from './render/scene';
import { createPost } from './render/post';
import { pickBootTier, TierMonitor } from './render/tiers';
import { loadHands, type HandRig } from './render/hands';
import { createPhysics, type PhysicsWorld } from './physics/world';
import { Juice } from './physics/juice';
import { prefersReducedMotion, shouldTweenOnly } from './a11y/motion';
import { createFallback } from './a11y/fallback';

function detectRendererString(gl: WebGLRenderingContext | null): string {
  if (!gl) return 'unknown';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
}

async function boot(): Promise<void> {
  const cfg = parseConfig();
  const app = document.getElementById('app')!;
  const statusEl = document.getElementById('status')!;
  const badgeEl = document.getElementById('badge')!;

  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  app.prepend(canvas);

  const scene3d = createScene(canvas);
  const post = createPost(scene3d.renderer, scene3d.scene, scene3d.camera);

  // Tier selection (boot detect or forced via ?tier=).
  const probeGl = scene3d.renderer.getContext();
  const bootTier =
    cfg.forcedTier ?? pickBootTier(detectRendererString(probeGl as WebGLRenderingContext), 60);
  post.applyTier(bootTier);

  // Physics is optional/async — gameplay never waits on it.
  let physics: PhysicsWorld | null = null;
  createPhysics()
    .then((p) => (physics = p))
    .catch(() => (physics = null));

  const reduced = prefersReducedMotion();
  const juice = new Juice(scene3d.camera);

  // Hands (primitive baseline; GLTF upgrade if a licensed asset is present).
  let hands: HandRig | null = null;
  loadHands(bootTier).then((h) => {
    hands = h;
    scene3d.scene.add(h.object);
  });

  // --- The authoritative core: round machine + its ONE input event ---
  const machine = new RoundMachine();
  let poseT = 0;

  machine.onChange((s: RoundState) => {
    render(s);
    if (s.phase === 'resolved' && s.result) {
      poseT = 0;
      const tweenOnly = shouldTweenOnly({
        reducedMotion: reduced,
        tier: monitor.getTier(),
        physicsReady: !!physics,
      });
      // Cosmetic, fire-and-forget — cannot alter the committed result.
      juice.onResult(s.result, { tweenOnly, physics });
    }
  });

  function render(s: RoundState): void {
    if (s.phase === 'lowConfidence') {
      badgeEl.textContent = `Low confidence (${(s.lastConfidence * 100).toFixed(0)}%) — throw again`;
      badgeEl.hidden = false;
    } else {
      badgeEl.hidden = true;
    }
    if (s.phase === 'resolved') {
      const verdict = s.result === 'a' ? 'You win!' : s.result === 'b' ? 'You lose' : 'Draw';
      statusEl.textContent = `You: ${s.playerShape}  ·  CPU: ${s.opponentShape}  →  ${verdict}   (W ${s.score.player} / L ${s.score.opponent} / D ${s.score.draws})`;
    } else if (s.phase === 'capturing' || s.phase === 'idle') {
      statusEl.textContent = 'Flick the mouse: chop = rock · sweep = paper · snip = scissors';
    }
  }

  // --- Input paths: gesture engine AND a11y fallback both feed the SAME machine ---
  const engine = new GestureEngine(cfg.confidenceThreshold);
  engine.attach(canvas);
  engine.onResult((r) => machine.submit(r));

  const fallback = createFallback((r) => machine.submit(r));
  app.appendChild(fallback.element);

  machine.begin();
  render(machine.getState());

  // --- Render loop with runtime tier degrade (R2.4) ---
  const monitor = new TierMonitor(bootTier, (t) => post.applyTier(t));
  let last = performance.now();
  function frame(now: number): void {
    const dt = now - last;
    last = now;
    monitor.sample(dt);
    poseT = Math.min(1, poseT + dt / 250);
    const st = machine.getState();
    if (hands && st.playerShape) hands.setShape(st.playerShape, poseT * 0.2);
    if (physics) physics.step(dt);
    juice.update(dt / 1000);
    post.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function resize(): void {
    scene3d.resize(window.innerWidth, window.innerHeight);
    post.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  // ?dev: run + print the accuracy harness (R1.3 evaluability surface).
  if (cfg.dev) {
    const report = runAccuracy();
    // eslint-disable-next-line no-console
    console.log('[gesture accuracy harness]\n' + formatReport(report));
    const dev = document.createElement('pre');
    dev.className = 'dev-overlay';
    dev.textContent = formatReport(report);
    app.appendChild(dev);
  }
}

boot().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('boot failed', e);
});

// Keep THREE import referenced for side-effect-free tree-shaking clarity.
void THREE;
