// T12/T13 [F3] — hand rigs (R3.3 primitive baseline + R3.1 GLTF upgrade behind one interface).
// FORK 3 (design §2): PrimitiveHandRig always ships (zero licensing risk); GltfHandRig is a
// strict upgrade. Any shipped GLTF MUST record provenance in public/assets/hands/LICENSE.md (NFR5).
//
// card-backlog-8 (F3 upgrade): GltfHandRig now closes the setShape stub with a capability-detect
// pose ladder — clips → morph → bones → null (design §3). Detection runs at load time and picks a
// `poseStrategy`; setShape dispatches on it so the code is ASSET-SHAPE-AGNOSTIC (works regardless of
// how the sourced .glb expresses the three poses). If none of the strategies are usable, tryLoad
// returns null so loadHands falls back to PrimitiveHandRig (R5). Interface + loadHands contract
// UNCHANGED — strict, non-breaking upgrade.
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

const SHAPES: Shape[] = ['rock', 'paper', 'scissors'];

// card-rps3d-fix (R1, design §2) — hand-plausibility gate. A real hand rig exposes at least this
// many finger chains; a 2-joint demo skeleton (Khronos RiggedSimple) does NOT clear it. Named so a
// future real-hand asset validates against it. See GltfHandRig.isHandSkeleton.
const MIN_FINGER_BONES = 3;

// Case-insensitive name aliases used to match clips / morph targets / (loosely) intent per shape.
const SHAPE_ALIASES: Record<Shape, string[]> = {
  rock: ['rock', 'fist', 'closed'],
  paper: ['paper', 'open', 'flat', 'hand'],
  scissors: ['scissors', 'peace', 'victory', 'two'],
};

function matchShape(name: string): Shape | null {
  const n = name.toLowerCase();
  for (const shape of SHAPES) {
    if (SHAPE_ALIASES[shape].some((a) => n.includes(a))) return shape;
  }
  return null;
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

/** How the loaded rig expresses the three poses. Chosen at load time by capability detection. */
export type PoseStrategy = 'clips' | 'morph' | 'bones';

/** Minimal structural view of a loaded GLTF — the subset tryLoad/detection needs. Kept loose so a
 *  headless test can hand-build a synthetic object without a real GLTFLoader / WebGL. */
export interface LoadedGltf {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

/** Injectable loader seam (defaults to the real GLTFLoader). Lets unit tests feed synthetic gltf
 *  objects to exercise detection + dispatch without a browser GLTF/WebGL pipeline (design §6). */
export type GltfLoadFn = (url: string) => Promise<LoadedGltf>;

const defaultLoad: GltfLoadFn = async (url) => {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return { scene: gltf.scene, animations: gltf.animations };
};

interface MorphState {
  mesh: THREE.Mesh;
  indexForShape: Partial<Record<Shape, number>>;
}

interface BoneState {
  bones: THREE.Object3D[];
  rest: THREE.Euler[];
}

/** GLTF-backed rig behind the same interface (loaded only if a licensed asset exists). */
export class GltfHandRig implements HandRig {
  object = new THREE.Group();
  readonly poseStrategy: PoseStrategy;

  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<Shape, THREE.AnimationAction>> = {};
  private activeShape: Shape | null = null;
  private morph: MorphState | null = null;
  private bone: BoneState | null = null;

  private constructor(gltf: LoadedGltf, strategy: PoseStrategy) {
    this.object.add(gltf.scene);
    this.poseStrategy = strategy;

    if (strategy === 'clips') {
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) {
        const shape = matchShape(clip.name);
        if (shape && !this.actions[shape]) this.actions[shape] = this.mixer.clipAction(clip);
      }
    } else if (strategy === 'morph') {
      const mesh = GltfHandRig.findMorphMesh(gltf.scene);
      if (mesh && mesh.morphTargetDictionary) {
        const indexForShape: Partial<Record<Shape, number>> = {};
        for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
          const shape = matchShape(name);
          if (shape && indexForShape[shape] === undefined) indexForShape[shape] = idx;
        }
        this.morph = { mesh, indexForShape };
      }
    } else {
      // bones
      const bones = GltfHandRig.findFingerBones(gltf.scene);
      this.bone = { bones, rest: bones.map((b) => b.rotation.clone()) };
    }
  }

  // ---- capability detection (design §3) ----

  private static hasNamedClips(gltf: LoadedGltf): boolean {
    return gltf.animations.some((c) => matchShape(c.name) !== null);
  }

  private static findMorphMesh(root: THREE.Object3D): THREE.Mesh | null {
    let found: THREE.Mesh | null = null;
    root.traverse((o) => {
      if (found) return;
      const m = o as THREE.Mesh;
      const dict = m.morphTargetDictionary;
      if (dict && Object.keys(dict).some((k) => matchShape(k) !== null)) found = m;
    });
    return found;
  }

  private static findFingerBones(root: THREE.Object3D): THREE.Object3D[] {
    const bones: THREE.Object3D[] = [];
    root.traverse((o) => {
      const n = (o.name || '').toLowerCase();
      const isBone = (o as unknown as { isBone?: boolean }).isBone === true;
      if (isBone || /finger|index|middle|thumb|ring|pinky|bone/.test(n)) bones.push(o);
    });
    return bones;
  }

  // card-rps3d-fix (R1, design §2) — reject a non-hand skeleton so the `bones` branch does not
  // accept ANY rig. findFingerBones (above) still GATHERS candidates loosely (incl. the generic
  // `bone` token); this gate decides whether those candidates are plausibly a HAND. A skeleton is
  // hand-plausible only when EITHER a bone is named for an actual finger (the narrowed regex DROPS
  // the generic `bone` token, so RiggedSimple's `Bone`/`Bone.001` do NOT qualify) OR there are at
  // least MIN_FINGER_BONES bones (a real hand exposes >=3 finger chains). RiggedSimple's 2 generic
  // joints clear neither rule -> `bones` rejected -> tryLoad returns null -> PrimitiveHandRig ships.
  private static isHandSkeleton(bones: THREE.Object3D[]): boolean {
    const hasFingerName = bones.some((b) => /finger|index|middle|thumb|ring|pinky/.test((b.name || '').toLowerCase()));
    return hasFingerName || bones.length >= MIN_FINGER_BONES;
  }

  static async tryLoad(url: string, load: GltfLoadFn = defaultLoad): Promise<GltfHandRig | null> {
    try {
      const gltf = await load(url);
      // Capability ladder: clips → morph → bones → null (fall back to primitive).
      if (GltfHandRig.hasNamedClips(gltf)) return new GltfHandRig(gltf, 'clips');
      if (GltfHandRig.findMorphMesh(gltf.scene)) return new GltfHandRig(gltf, 'morph');
      // card-rps3d-fix (R1): accept `bones` ONLY for a plausibly-hand skeleton. A non-hand rig
      // (RiggedSimple's 2 generic joints) falls through to null -> PrimitiveHandRig floor.
      const fb = GltfHandRig.findFingerBones(gltf.scene);
      if (fb.length > 0 && GltfHandRig.isHandSkeleton(fb)) return new GltfHandRig(gltf, 'bones');
      return null; // rig present but not a usable hand rig → primitive floor (R5, design §3.4)
    } catch {
      return null; // no/failed asset -> caller falls back to primitive (FORK 3)
    }
  }

  // ---- posing dispatch (design §3; closes the old stub) ----

  setShape(shape: Shape, t: number): void {
    const k = Math.max(0, Math.min(1, t));
    switch (this.poseStrategy) {
      case 'clips':
        this.setShapeClips(shape, k);
        break;
      case 'morph':
        this.setShapeMorph(shape, k);
        break;
      case 'bones':
        this.setShapeBones(shape, k);
        break;
    }
  }

  private setShapeClips(shape: Shape, k: number): void {
    const action = this.actions[shape];
    if (!action || !this.mixer) return;
    if (this.activeShape !== shape) {
      // Cross-fade from the prior shape's action to this one.
      for (const s of SHAPES) {
        const a = this.actions[s];
        if (a && s !== shape) a.fadeOut(0.15);
      }
      action.reset().fadeIn(0.15).play();
      this.activeShape = shape;
    }
    // Drive the clip toward a normalized pose time of k (no per-frame real-time coupling).
    const clipDuration = action.getClip().duration || 1;
    action.time = k * clipDuration;
    this.mixer.update(0);
  }

  private setShapeMorph(shape: Shape, k: number): void {
    if (!this.morph) return;
    const { mesh, indexForShape } = this.morph;
    const influences = mesh.morphTargetInfluences;
    if (!influences) return;
    for (const s of SHAPES) {
      const idx = indexForShape[s];
      if (idx === undefined) continue;
      const targetVal = s === shape ? 1 : 0;
      influences[idx] += (targetVal - influences[idx]) * k;
    }
  }

  private setShapeBones(shape: Shape, k: number): void {
    if (!this.bone) return;
    // Map shape → per-bone curl (x-rotation). rock=curled, paper=extended, scissors=two extended.
    const curl = this.curlFor(shape);
    const { bones, rest } = this.bone;
    for (let i = 0; i < bones.length; i++) {
      const restX = rest[i].x;
      const targetX = restX + curl[i % curl.length];
      bones[i].rotation.x += (targetX - bones[i].rotation.x) * k;
    }
  }

  private curlFor(shape: Shape): number[] {
    // Curl in radians; larger = more curled (GLTF analogue of PrimitiveHandRig.extensionFor).
    switch (shape) {
      case 'rock':
        return [1.4, 1.4, 1.4]; // all curled
      case 'paper':
        return [0, 0, 0]; // all extended
      case 'scissors':
        return [0, 0, 1.4]; // two extended, one curled
    }
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
