import * as THREE from 'three';
import type { Shape } from '../types';

export interface Rig {
  group: THREE.Group;
  setPose: (shape: Shape) => void;
}

export interface SceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player: Rig;
  cpu: Rig;
  start: () => void;
  resize: () => void;
  dispose: () => void;
}

/**
 * One scene, perspective camera, soft lighting, two low-poly hand rigs
 * (player near, CPU far). Deliberately cheap to hit >=30 fps without a
 * discrete GPU (R2.1, R2.2, R2.3).
 */
export function createScene(canvas: HTMLCanvasElement): SceneHandles {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 1.2, 6);
  camera.lookAt(0, 0.5, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(3, 5, 4);
  scene.add(key);

  const player = makeRig(0x6ea8ff);
  player.group.position.set(0, 0, 1.5);
  scene.add(player.group);

  const cpu = makeRig(0xff8a6e);
  cpu.group.position.set(0, 0.6, -1.5);
  cpu.group.rotation.y = Math.PI; // face the player
  scene.add(cpu.group);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    renderer.render(scene, camera);
  };

  return {
    scene,
    camera,
    renderer,
    player,
    cpu,
    start: () => {
      resize();
      loop();
    },
    resize,
    dispose: () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}

/**
 * A minimal low-poly "hand": a palm box plus three finger boxes whose
 * visibility encodes the pose (fist / flat / two-fingers).
 */
function makeRig(color: number): Rig {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

  const palm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.4), mat);
  group.add(palm);

  const fingers: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), mat);
    f.position.set((i - 1) * 0.32, 0.9, 0);
    group.add(f);
    fingers.push(f);
  }

  const setPose = (shape: Shape) => {
    switch (shape) {
      case 'rock': // fist — fingers folded down
        fingers.forEach((f) => (f.visible = false));
        palm.scale.set(1, 1, 1);
        break;
      case 'paper': // flat — all fingers extended
        fingers.forEach((f) => (f.visible = true));
        palm.scale.set(1, 1, 1);
        break;
      case 'scissors': // two fingers
        fingers.forEach((f, i) => (f.visible = i < 2));
        palm.scale.set(1, 1, 1);
        break;
    }
  };

  setPose('rock');
  return { group, setPose };
}
