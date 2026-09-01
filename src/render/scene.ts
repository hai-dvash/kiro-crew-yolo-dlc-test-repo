// T9 [F2] — three scene + PBR + HDR/IBL (R2.1).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { computeFraming } from './framing';

export interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render(): void;
  resize(w: number, h: number): void;
  /**
   * card-rps3d-fix [R3] — fit the camera to an object's world AABB (center + bounding radius) so it
   * is framed with a margin at the current aspect. Stores the last framed target and re-applies on
   * resize. Additive: existing callers unaffected; the hard-coded camera is the pre-load default.
   */
  frameObject(center: [number, number, number], radius: number): void;
  dispose(): void;
}

/**
 * Build a PBR scene lit by an image-based environment (RoomEnvironment ->
 * PMREM), a clear step up from flat shading. Physically-correct lighting.
 */
export function createScene(canvas: HTMLCanvasElement): Scene3D {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1116);

  // Image-based lighting via a generated environment (no external HDR fetch => zero-install).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4.5);
  camera.lookAt(0, 0.6, 0);

  // A key rim light for specular highlights on PBR metal/rough surfaces.
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(3, 5, 4);
  scene.add(key);

  // Ground plane (PBR, receives IBL).
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 0.9, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  function resize(w: number, h: number): void {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // card-rps3d-fix [R3] — re-frame the last-framed target for the new aspect (dual-FOV), so a
    // portrait<->landscape change keeps the rig fully in frame instead of only rescaling the FOV.
    if (framed) applyFraming(framed.center, framed.radius);
  }

  // card-rps3d-fix [R3] — camera-fit to a measured AABB. Runs on load + once per resize, NEVER in
  // the RAF loop (NFR4). Keeps the current view direction; moves the camera to the fit distance.
  let framed: { center: [number, number, number]; radius: number } | null = null;

  function applyFraming(center: [number, number, number], radius: number): void {
    const c = new THREE.Vector3(center[0], center[1], center[2]);
    // Preserve the current view direction (from center toward the camera).
    const dir = camera.position.clone().sub(c);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.normalize();
    const { distance } = computeFraming({
      fovDeg: camera.fov,
      aspect: camera.aspect,
      boundingRadius: radius,
      center,
    });
    camera.position.copy(c).addScaledVector(dir, distance);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
  }

  function frameObject(center: [number, number, number], radius: number): void {
    framed = { center, radius };
    applyFraming(center, radius);
  }

  return {
    renderer,
    scene,
    camera,
    render: () => renderer.render(scene, camera),
    resize,
    frameObject,
    dispose: () => {
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
