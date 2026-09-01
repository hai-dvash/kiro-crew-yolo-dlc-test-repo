// T9 [F2] — three scene + PBR + HDR/IBL (R2.1).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render(): void;
  resize(w: number, h: number): void;
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
  }

  return {
    renderer,
    scene,
    camera,
    render: () => renderer.render(scene, camera),
    resize,
    dispose: () => {
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
