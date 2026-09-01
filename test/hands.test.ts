// card-backlog-8 [F3] — unit tests for the GltfHandRig capability-detect pose ladder + the R5
// primitive fallback (design §6: U1–U4), plus the NFR5 provenance CI gate (G1). Runs headless:
// synthetic LoadedGltf objects are fed through GltfHandRig.tryLoad's injectable loader seam, so no
// WebGL / real GLTFLoader is needed. G1 reads files via node fs.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GltfHandRig, PrimitiveHandRig, loadHands, type LoadedGltf, type GltfLoadFn } from '../src/render/hands';
import { QualityTier } from '../src/config';

// ---- synthetic gltf fixtures (T4) ----

function clipGltf(): LoadedGltf {
  // A bare scene + three named animation clips matching the RPS shapes.
  const scene = new THREE.Object3D();
  const mk = (name: string) =>
    new THREE.AnimationClip(name, 1, [
      new THREE.NumberKeyframeTrack('.morphTargetInfluences[0]', [0, 1], [0, 1]),
    ]);
  return { scene, animations: [mk('rock'), mk('paper'), mk('scissors')] };
}

function morphGltf(): LoadedGltf {
  const geo = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geo);
  mesh.morphTargetDictionary = { rock: 0, paper: 1, scissors: 2 };
  mesh.morphTargetInfluences = [0, 0, 0];
  const scene = new THREE.Object3D();
  scene.add(mesh);
  return { scene, animations: [] };
}

function bareGltf(): LoadedGltf {
  // A mesh with no clips, no morph targets, no bones — nothing to distinguish shapes.
  const scene = new THREE.Object3D();
  scene.add(new THREE.Mesh(new THREE.BufferGeometry()));
  return { scene, animations: [] };
}

const loaderFor = (g: LoadedGltf): GltfLoadFn => async () => g;

describe('GltfHandRig.tryLoad capability detection (card-backlog-8, design §3)', () => {
  it('U1 — named RPS clips ⇒ poseStrategy "clips" and setShape selects the shape', async () => {
    const rig = await GltfHandRig.tryLoad('x.glb', loaderFor(clipGltf()));
    expect(rig).not.toBeNull();
    expect(rig!.poseStrategy).toBe('clips');
    // Should not throw and should have registered a scissors action to drive.
    expect(() => rig!.setShape('scissors', 1)).not.toThrow();
  });

  it('U2 — morph targets ⇒ poseStrategy "morph"; influence moves toward the requested shape as t→1', async () => {
    const g = morphGltf();
    const rig = await GltfHandRig.tryLoad('x.glb', loaderFor(g));
    expect(rig).not.toBeNull();
    expect(rig!.poseStrategy).toBe('morph');

    const mesh = g.scene.children[0] as THREE.Mesh;
    const influences = mesh.morphTargetInfluences!;
    // scissors is index 2 — after a full-strength step it should dominate.
    rig!.setShape('scissors', 1);
    expect(influences[2]).toBeCloseTo(1, 5);
    expect(influences[0]).toBeCloseTo(0, 5);
    expect(influences[1]).toBeCloseTo(0, 5);
  });

  it('U3 — mesh with no clips/morphs/bones ⇒ tryLoad returns null (⇒ primitive floor, R5)', async () => {
    const rig = await GltfHandRig.tryLoad('x.glb', loaderFor(bareGltf()));
    expect(rig).toBeNull();
  });

  it('U4 — missing/failed asset ⇒ loadHands(MID) returns a PrimitiveHandRig, no throw (R5)', async () => {
    // Default loader will attempt the real GLTFLoader against a nonexistent path → throws → null.
    const rig = await loadHands(QualityTier.Mid);
    expect(rig).toBeInstanceOf(PrimitiveHandRig);
  });

  it('LOW tier always ships the primitive rig (R5)', async () => {
    const rig = await loadHands(QualityTier.Low);
    expect(rig).toBeInstanceOf(PrimitiveHandRig);
  });
});

describe('NFR5 provenance CI gate G1 (card-backlog-8, design §6)', () => {
  const PLACEHOLDER = /_\(none in v1\)_/;
  // Dependency-free file access via Vite's glob (no @types/node needed):
  // presence of the asset + raw text of the provenance file, both resolved at build time.
  const glb = import.meta.glob('../public/assets/hands/hand.glb', { eager: true, query: '?url', import: 'default' });
  const license = import.meta.glob('../public/assets/hands/LICENSE.md', { eager: true, query: '?raw', import: 'default' });

  it('if hand.glb exists, LICENSE.md MUST carry a non-placeholder provenance row', () => {
    const hasGlb = Object.keys(glb).length > 0;
    if (!hasGlb) {
      // Fallback build is legal — no asset, nothing to license. Gate passes trivially.
      expect(true).toBe(true);
      return;
    }
    const text = Object.values(license)[0] as string;
    // A real provenance row must exist: a hand.glb table row, and no lingering placeholder.
    const hasRealRow = /\|\s*hand\.glb\s*\|/.test(text) && !PLACEHOLDER.test(text);
    expect(hasRealRow).toBe(true);
  });
});
