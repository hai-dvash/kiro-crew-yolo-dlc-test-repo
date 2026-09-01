// T18 [F5] — bootstrap wiring / DI (R5.2, design §1).
// Enforces the layering invariant: the round-machine advances on GestureResult
// alone; render + physics/juice subscribe AFTER the machine commits the result.
import * as THREE from 'three';
import { parseConfig } from './config';
import type { GestureResult } from './types';
import { GestureEngine } from './gesture/engine';
import { runAccuracy, formatReport } from './gesture/harness';
import { RoundMachine, type RoundState } from './round/machine';
import { createScene } from './render/scene';
import { createPost } from './render/post';
import { pickBootTier, TierMonitor } from './render/tiers';
import { GltfHandRig, type HandRig } from './render/hands';
import { loadObjects, makeRpsObjectRig } from './render/objects';
import { computeRigScale } from './render/framing';
import { NullOccluder, type OpponentObject } from './render/occluder';
import { RevealController } from './render/reveal';
import { createPhysics, type PhysicsWorld } from './physics/world';
import { Juice } from './physics/juice';
import { RevealPop } from './render/reveal-pop';
import { prefersReducedMotion, shouldTweenOnly } from './a11y/motion';
import { createFallback } from './a11y/fallback';

function detectRendererString(gl: WebGLRenderingContext | null): string {
  if (!gl) return 'unknown';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
}

// card-rps3d-fix [R6.4, design §6] — the boot/wiring seam (the META fix). boot() used to be one
// closure touching document + WebGL, so the load->scene-add, rig scale/frame, and engine/fallback
// ->machine wiring were UNTESTABLE — which is exactly why the three defects shipped green. wireGame
// pulls that wiring into a DOM/WebGL-free function whose collaborators are INJECTED, so a headless
// test can assert (a) the rig is added to the scene, (b) engine.onResult->machine.submit is wired,
// (c) the fallback feeds the same submit, (d) frameObject is invoked with the rig's measured
// center/radius on load. boot() below is the thin real-DOM adapter that calls wireGame with real
// deps — observable runtime behavior is identical.

/** The minimal structural view of a Scene3D wireGame needs (add + frameObject). */
export interface WireScene {
  scene: { add(o: unknown): void };
  frameObject(center: [number, number, number], radius: number): void;
}

/** A loaded rig's measurable object. Kept loose so a test can supply a stub without THREE/WebGL. */
export interface WireRig {
  object: unknown;
}

/** Emits classified gesture results. */
export interface WireEngine {
  onResult(cb: (r: GestureResult) => void): void;
}

/** Consumes results (the round machine). */
export interface WireMachine {
  submit(r: GestureResult): void;
}

/** Measures a rig object's world AABB (center + bounding radius). Injected so tests avoid THREE. */
export type MeasureRig = (object: unknown) => { center: [number, number, number]; radius: number };

export interface WireDeps {
  scene: WireScene;
  loadHands: () => Promise<WireRig>;
  engine: WireEngine;
  /**
   * Register the a11y fallback against the SAME submit sink as the engine. Receives the shared
   * submit callback; the impl constructs/mounts the fallback wired to it (single source of truth).
   */
  fallbackOnResult: (submit: (r: GestureResult) => void) => void;
  machine: WireMachine;
  measureRig: MeasureRig;
  /** Applied to the rig object once its scale is known (real impl sets object.scale). */
  applyScale?: (object: unknown, scale: number) => void;
  /** Called after the rig is loaded + framed (real impl wires the CC-BY credit, etc.). */
  onRigLoaded?: (rig: WireRig) => void;
}

/**
 * Wire the game's load + input paths (behavior-preserving extraction of boot()'s wiring).
 * Returns the rig-load promise so the caller/tests can await the async load+frame completing.
 */
export function wireGame(deps: WireDeps): { loaded: Promise<WireRig> } {
  // Input paths: the gesture engine AND the a11y fallback both feed the SAME machine.submit.
  const submit = (r: GestureResult) => deps.machine.submit(r);
  deps.engine.onResult(submit);
  deps.fallbackOnResult(submit);

  const loaded = deps.loadHands().then((rig) => {
    deps.scene.scene.add(rig.object);
    // Scale the rig to a consistent on-screen size, then fit the camera to its measured AABB.
    let m = deps.measureRig(rig.object);
    const scale = computeRigScale(m.radius * 2);
    deps.applyScale?.(rig.object, scale);
    m = deps.measureRig(rig.object); // remeasure after scaling
    deps.scene.frameObject(m.center, m.radius);
    deps.onRigLoaded?.(rig);
    return rig;
  });

  return { loaded };
}

/** Measure a THREE.Object3D's world AABB → center + bounding-sphere radius (the real MeasureRig). */
function measureThreeRig(object: unknown): { center: [number, number, number]; radius: number } {
  const box = new THREE.Box3().setFromObject(object as THREE.Object3D);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const radius = size.length() / 2;
  return { center: [center.x, center.y, center.z], radius };
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
  // [f2] #24 — poppy reveal pop. Cosmetic consumer of the committed result; target set in
  // onRigLoaded once f1 (#23) provides the throwable/opponent object (null-safe until then).
  const revealPop = new RevealPop(null);

  // f3 [#25] — hidden-CPU board/reveal sequencing. The RevealController is a pure downstream
  // consumer of machine.onChange (like render + juice); it hides the opponent object until the
  // reveal beat, then shows the ALREADY-committed pick (F1-first — never gates the result).
  // Until f1 (#23) lands the real OpponentObject render path, wire a NullOccluder (always-shown,
  // no-op) + a stub opponent — the opponent stays text-only via the unchanged render(s), so f3 is
  // non-regressive. The ONLY f1-gated line is the T7 swap in onRigLoaded below.
  const opponentStub: OpponentObject = { setVisible: () => {}, setShape: () => {} };
  const occluder = new NullOccluder();
  const reveal = new RevealController({
    occluder,
    opponent: opponentStub,
    instant: () =>
      shouldTweenOnly({
        reducedMotion: reduced,
        tier: monitor.getTier(),
        physicsReady: !!physics,
      }),
  });

  // Hands (primitive baseline; GLTF upgrade if a licensed asset is present).
  // card-rps3d-fix [R6.4] — the load->add->scale->frame + input wiring is delegated to wireGame so
  // it is testable headlessly; boot() supplies the real deps.
  let hands: HandRig | null = null;
  const machine = new RoundMachine();
  const engine = new GestureEngine(cfg.confidenceThreshold);
  engine.attach(canvas);

  wireGame({
    scene: scene3d as unknown as WireScene,
    loadHands: () => loadObjects(bootTier) as Promise<WireRig>,
    engine,
    // wireGame owns the ONE submit sink; construct + mount the a11y fallback against it so both
    // input paths (gesture engine + keyboard/buttons) feed the same machine.submit — single source
    // of truth, and the wiring is asserted by the boot smoke test.
    fallbackOnResult: (submit) => {
      const fallback = createFallback(submit);
      app.appendChild(fallback.element);
    },
    machine,
    measureRig: measureThreeRig,
    applyScale: (object, scale) => (object as THREE.Object3D).scale.setScalar(scale),
    onRigLoaded: (rig) => {
      hands = rig as unknown as HandRig;
      // f3 [#25] T7 (f1-gated, SEQUENCED after #23): once f1 lands its OpponentObject render path
      // + throwable-object rig, swap the NullOccluder + opponentStub above for a BoardOccluder
      // (positioned in front of the opponent object) + f1's real OpponentObject, passing both into
      // the RevealController. No logic change to reveal.ts — only this boot-time handle swap. Until
      // then NullOccluder + stub keep f3 non-regressive (opponent stays text-only via render(s)).
      // CC-BY-4.0 attribution (only when a licensed GLTF is actually in use; provenance in
      // public/assets/hands/LICENSE.md). With the R1 hand-plausibility gate, RiggedSimple is
      // rejected and the primitive ships, so this credit correctly does not render.
      if (hands instanceof GltfHandRig) {
        const credit = document.createElement('div');
        credit.className = 'asset-credit';
        credit.innerHTML =
          'Hand model: <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/RiggedSimple" target="_blank" rel="noopener">RiggedSimple</a> ' +
          '(Khronos glTF-Sample-Assets), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC-BY-4.0</a>';
        app.appendChild(credit);
      }
    },
  });

  // card-rps3d-objects · f1 (#23) [R2, FORK D3] — NEW opponent-object render path. The opponent was
  // text-only in render(); now its committed shape renders as its own object entity, distinct from
  // the player object and set back across the "table". Built by the SAME factory (shared visual
  // language, R3). It does NOT participate in wireGame's computeRigScale/frameObject (keeps the
  // single-object framing intact, R4/NFR2). Its meshes start invisible until a shape is set — the
  // same seam f3's board later hides.
  const opponent = makeRpsObjectRig();
  opponent.object.position.set(0, 0, -3);
  scene3d.scene.add(opponent.object);

  // --- The authoritative core: round machine + its ONE input event ---
  let poseT = 0;

  machine.onChange((s: RoundState) => {
    render(s);
    // f3 [#25] — cosmetic reveal choreography AFTER render (a11y-authoritative status fires first).
    // Downstream consumer only: reads committed state, never gates the result (F1-first).
    reveal.onState(s);
    if (s.phase === 'resolved' && s.result) {
      poseT = 0;
      // card-rps3d-objects · f1 (#23) [R2, FORK D4, NFR1] — drive the opponent object off the
      // ALREADY-COMMITTED opponentShape, inside this committed-result consumer (never at pick time;
      // pickOpponent() stays solely in RoundMachine.submit()).
      if (s.opponentShape) opponent.setShape(s.opponentShape, 1);
      const tweenOnly = shouldTweenOnly({
        reducedMotion: reduced,
        tier: monitor.getTier(),
        physicsReady: !!physics,
      });
      // Cosmetic, fire-and-forget — cannot alter the committed result.
      juice.onResult(s.result, { tweenOnly, physics });
      // [f2] #24 — pop the thrown object on the SAME resolved beat (fire-and-forget, F1-first).
      revealPop.onResult({ tweenOnly });
    } else if (s.phase === 'capturing') {
      // [f2] #24 — re-arm the reveal pop for a fresh round (mirrors machine.begin()).
      revealPop.reset();
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

  // --- Input paths: gesture engine + a11y fallback are wired to machine.submit by wireGame above ---

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
    reveal.update(dt / 1000); // f3 [#25] — same cosmetic timing channel as juice (seconds d
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

// Auto-boot only in a real browser document (guards against importing this module for its exported
// seam — e.g. the R6.4 boot smoke test — in a non-DOM/test environment). Behavior in the browser is
// unchanged: #app exists, so boot() runs exactly as before.
if (typeof document !== 'undefined' && document.getElementById('app')) {
  boot().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('boot failed', e);
  });
}

// Keep THREE import referenced for side-effect-free tree-shaking clarity.
void THREE;
