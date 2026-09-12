// T9 [F2] — three scene + PBR + HDR/IBL (R2.1).
// card-rps3d-visual · #29 (T2/T3/T6/T8) — grounding soft shadows (REQ-A2), palette bg + warm rim
// light (REQ-A3), a gradient skydome backdrop keeping RoomEnvironment IBL intact (REQ-B2), runtime
// applyFidelity (NFR-P1), and a reveal camera punch-in (REQ-C2) that NEVER mutates the stored
// frameObject target. All added cost is tier-gated (G3). Zero new dependency (G2).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { computeFraming } from './framing';
import { QualityTier } from '../config';
import { PALETTE, TIER_FIDELITY, PUNCH_IN } from './config';

export interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render(): void;
  resize(w: number, h: number): void;
  /** card-rps3d-fix [R3] — fit the camera to an object's world AABB; stores + re-applies on resize. */
  frameObject(center: [number, number, number], radius: number): void;
  /** #29 T2/T9 — retarget shadows/lights to a quality tier at runtime (part of applyFidelity fan-out). */
  applyFidelity(tier: QualityTier): void;
  /** #29 T8 — reveal camera punch-in: transient dolly-in + settle, driven from the RAF loop. */
  punchIn(): void;
  /** #29 T8 — per-frame advance of an in-flight punch-in (cosmetic; no-op when idle). */
  updateCamera(dtMs: number): void;
  dispose(): void;
}

/** Vertical gradient CanvasTexture (bg → slightly lighter cool) for the skydome backdrop (REQ-B2). */
function makeGradientTexture(): THREE.Texture {
  const top = new THREE.Color(0x1c2634); // slightly lighter cool
  const bottom = new THREE.Color(PALETTE.bg);
  const h = 64;
  const data = new Uint8Array(h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const c = bottom.clone().lerp(top, t);
    data[y * 4] = Math.round(c.r * 255);
    data[y * 4 + 1] = Math.round(c.g * 255);
    data[y * 4 + 2] = Math.round(c.b * 255);
    data[y * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 1, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build a PBR scene lit by an image-based environment (RoomEnvironment -> PMREM), grounding soft
 * shadows, a deliberate palette, and a gradient backdrop.
 */
export function createScene(canvas: HTMLCanvasElement, tier: QualityTier = QualityTier.High): Scene3D {
  const fidelity = TIER_FIDELITY[tier];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  // REQ-A2 — tier-gated grounding shadows.
  renderer.shadowMap.enabled = fidelity.castShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);

  // Image-based lighting via a generated environment (no external HDR fetch => zero-install). KEPT.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  // REQ-B2 — gradient skydome backdrop (visible background only; IBL reflections unchanged).
  const gradTex = makeGradientTexture();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(40, 32, 16),
    new THREE.MeshBasicMaterial({ map: gradTex, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  scene.add(sky);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4.5);
  camera.lookAt(0, 0.6, 0);

  // Key light — casts the grounding shadow. Tight ortho frustum around the ~±3-unit play area.
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(3, 5, 4);
  key.castShadow = fidelity.castShadows;
  key.shadow.mapSize.set(fidelity.shadowMapSize || 1024, fidelity.shadowMapSize || 1024);
  key.shadow.camera.left = -3.5;
  key.shadow.camera.right = 3.5;
  key.shadow.camera.top = 3.5;
  key.shadow.camera.bottom = -3.5;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0005;
  scene.add(key);

  // REQ-A3 — warm rim light opposite the key (un-gated, no shadow) for shape separation.
  const rim = new THREE.DirectionalLight(PALETTE.rim, 0.6);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // Ground plane (PBR, receives the grounding shadow). Palette-tinted (REQ-A3).
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 0.9, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  function resize(w: number, h: number): void {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (framed) applyFraming(framed.center, framed.radius);
  }

  // card-rps3d-fix [R3] — camera-fit to a measured AABB. Runs on load + once per resize, NEVER in RAF.
  let framed: { center: [number, number, number]; radius: number } | null = null;

  function frameDistance(radius: number, center: [number, number, number]): number {
    return computeFraming({ fovDeg: camera.fov, aspect: camera.aspect, boundingRadius: radius, center }).distance;
  }

  function applyFraming(center: [number, number, number], radius: number): void {
    const c = new THREE.Vector3(center[0], center[1], center[2]);
    const dir = camera.position.clone().sub(c);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.normalize();
    const distance = frameDistance(radius, center);
    camera.position.copy(c).addScaledVector(dir, distance);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
    baseDistance = distance; // the settled distance the punch-in returns to
  }

  function frameObject(center: [number, number, number], radius: number): void {
    framed = { center, radius };
    applyFraming(center, radius);
  }

  // #29 T8 — reveal camera punch-in. A transient dolly toward the framed center along the current
  // view direction, then a settle back to the framed distance. NEVER mutates `framed` (resize still
  // re-fits from the stored target). Tier/reduced-motion gating is the caller's job (reveal.ts).
  let baseDistance = 0;
  let punchElapsed = -1; // <0 = idle

  function punchIn(): void {
    if (!framed || baseDistance <= 0) return;
    punchElapsed = 0;
  }

  function updateCamera(dtMs: number): void {
    if (punchElapsed < 0 || !framed) return;
    punchElapsed += dtMs;
    const { dollyIn, punchMs, holdMs, settleMs } = PUNCH_IN;
    const total = punchMs + holdMs + settleMs;
    let f: number; // 0 = base distance, 1 = fully dollied in
    if (punchElapsed < punchMs) {
      f = punchElapsed / punchMs; // ease in
    } else if (punchElapsed < punchMs + holdMs) {
      f = 1; // hold
    } else if (punchElapsed < total) {
      f = 1 - (punchElapsed - punchMs - holdMs) / settleMs; // ease back
    } else {
      f = 0;
      punchElapsed = -1; // done
    }
    const c = new THREE.Vector3(framed.center[0], framed.center[1], framed.center[2]);
    const dir = camera.position.clone().sub(c);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.normalize();
    const dist = baseDistance * (1 - dollyIn * f);
    camera.position.copy(c).addScaledVector(dir, dist);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
  }

  function applyFidelity(t: QualityTier): void {
    const fi = TIER_FIDELITY[t];
    renderer.shadowMap.enabled = fi.castShadows;
    key.castShadow = fi.castShadows;
    if (fi.shadowMapSize > 0) key.shadow.mapSize.set(fi.shadowMapSize, fi.shadowMapSize);
    key.shadow.map?.dispose();
    key.shadow.map = null as unknown as THREE.WebGLRenderTarget; // force a fresh shadow map at the new size
  }

  return {
    renderer,
    scene,
    camera,
    render: () => renderer.render(scene, camera),
    resize,
    frameObject,
    applyFidelity,
    punchIn,
    updateCamera,
    dispose: () => {
      envTex.dispose();
      gradTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
