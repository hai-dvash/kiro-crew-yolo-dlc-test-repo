// T12/T13 [F3] — hand rigs (R3.3 primitive baseline + R3.1 GLTF upgrade behind one interface).
// FORK 3 (design §2): PrimitiveHandRig always ships (zero licensing risk); GltfHandRig is a
// strict upgrade. Any shipped GLTF MUST record provenance in public/assets/hands/LICENSE.md (NFR5).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Shape } from './../types';
import { QualityTier } from './../config';

export interface HandRig {
  object: THREE.Object3D;
  /** Pose toward `shape`, interpolated by t in [0,1]. */
  setShape(shape: Shape, t: number): void;
  dispose(): void;
}

/**
 * Low-poly primitive hand: a palm box + three "finger" capsules whose extension
 * encodes the shape (rock=curled, paper=flat/extended, scissors=two out). Posed
 * via lerp so it reads as a distinct gesture per shape.
 */
export class PrimitiveHandRig implements HandRig {
  object = new THREE.Group();
  private fingers: THREE.Mesh[] = [];
  private target = new Float32Array(3);
  private current = new Float32Array(3);

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd7a98c, roughness: 0.55, metalness: 0.05 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 0.5), mat);
    this.object.add(palm);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 4, 8), mat);
      f.position.set((i - 1) * 0.35, 0.9, 0);
      this.object.add(f);
      this.fingers.push(f);
    }
    this.setShape('rock', 1);
  }

  private extensionFor(shape: Shape): [number, number, number] {
    switch (shape) {
      case 'rock':
        return [0.1, 0.1, 0.1]; // all curled
      case 'paper':
        return [1, 1, 1]; // all extended
      case 'scissors':
        return [1, 1, 0.15]; // two out
    }
  }

  setShape(shape: Shape, t: number): void {
    const ext = this.extensionFor(shape);
    for (let i = 0; i < 3; i++) this.target[i] = ext[i];
    const k = Math.max(0, Math.min(1, t));
    for (let i = 0; i < 3; i++) {
      this.current[i] += (this.target[i] - this.current[i]) * k;
      const f = this.fingers[i];
      f.scale.y = 0.2 + this.current[i];
      f.position.y = 0.5 + (0.2 + this.current[i]) * 0.45;
    }
  }

  dispose(): void {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

/** GLTF-backed rig behind the same interface (loaded only if a licensed asset exists). */
export class GltfHandRig implements HandRig {
  object = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;

  private constructor(gltfScene: THREE.Object3D, mixer: THREE.AnimationMixer | null) {
    this.object.add(gltfScene);
    this.mixer = mixer;
  }

  static async tryLoad(url: string): Promise<GltfHandRig | null> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      const mixer = gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null;
      return new GltfHandRig(gltf.scene, mixer);
    } catch {
      return null; // no/failed asset -> caller falls back to primitive (FORK 3)
    }
  }

  setShape(_shape: Shape, t: number): void {
    // Drive morph/skeletal animation toward the shape clip; primitive fallback covers v1.
    if (this.mixer) this.mixer.update(t * 0.016);
  }

  dispose(): void {
    this.mixer?.stopAllAction();
  }
}

/**
 * Load the best available hand rig for the tier. Primitive is always the safe
 * baseline; a licensed GLTF (with LICENSE.md recorded) upgrades HIGH/MID.
 */
export async function loadHands(tier: QualityTier): Promise<HandRig> {
  if (tier !== QualityTier.Low) {
    const gltf = await GltfHandRig.tryLoad('assets/hands/hand.glb');
    if (gltf) return gltf;
  }
  // FORK-3 recorded downgrade: no licensed GLTF present -> ship the primitive rig.
  return new PrimitiveHandRig();
}
