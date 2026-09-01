// card-rps3d-objects · f1 (#23) — throwable RPS object-rig + opponent-object render path.
//
// Replaces the morphing HandRig as the PLAYER visual with the ACTUAL rock/paper/scissors objects,
// and provides the same rig entity for a NEW opponent-object render path (opponent was text-only).
//
// DESIGN (design.md §3, FORK D1-D4):
//   - FORK D1 geometry = PARAMETRIC primitive Three.js (icosahedron rock / thin box paper / crossed
//     boxes scissors) — satisfies R5 zero-new-dep OUTRIGHT (no asset sourcing), mirrors the proven
//     PrimitiveHandRig always-ships pattern (NFR5 baseline), reads instantly as RPS (R3).
//   - FORK D2 setShape(shape,t) = ACTIVE-OBJECT SELECT + emphasis scale tween: hold three pre-built
//     child meshes, show the active shape + decay the others toward hidden, interpolate the active
//     mesh's emphasis by the SAME normalized poseT the hand used — behavior-preserving of the RAF
//     call site `hands.setShape(st.playerShape, poseT*0.2)`. No per-frame coupling to the result.
//
// F1-FIRST (NFR1): this rig is a committed-result CONSUMER — it renders already-committed state and
// NEVER references RoundMachine/submit/pickOpponent. There is no import of the round layer here.
import * as THREE from 'three';
import type { Shape } from '../types';
import { QualityTier } from '../config';
import type { HandRig } from './hands'; // reuse the SAME interface (object/setShape/dispose)

const SHAPES: Shape[] = ['rock', 'paper', 'scissors'];

// Shared PBR material factory (matches the existing scene's MeshStandardMaterial usage).
function objectMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 });
}

// FORK D1 geometry builders — three distinct primitive silhouettes, no asset, no async, no new dep.

/** rock — a chunky faceted stone (icosahedron, detail 0), high roughness. */
function makeRock(): THREE.Object3D {
  const mat = objectMaterial(0x8a8f98);
  mat.roughness = 0.9;
  return new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), mat);
}

/** paper — a thin flat sheet (a shallow box). */
function makePaper(): THREE.Object3D {
  const mat = objectMaterial(0xf2efe6);
  return new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.02), mat);
}

/** scissors — two elongated blades rotated into an X (the scissors "V"), grouped. */
function makeScissors(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = objectMaterial(0xc0c4cc);
  const bladeGeom = new THREE.BoxGeometry(0.16, 1.8, 0.16);
  const a = new THREE.Mesh(bladeGeom, mat);
  a.rotation.z = Math.PI / 9; // +20°
  const b = new THREE.Mesh(bladeGeom, mat);
  b.rotation.z = -Math.PI / 9; // -20°
  group.add(a);
  group.add(b);
  return group;
}

/**
 * Parametric RPS object-rig. Holds three child meshes parented under `object`; setShape selects +
 * emphasizes the active one. Always-ships baseline (NFR5) — mirrors PrimitiveHandRig; no asset, no
 * new dep (R5). Satisfies the live HandRig contract so wireGame consumes it with NO structural change.
 */
export class RpsObjectRig implements HandRig {
  object = new THREE.Group();
  private meshes: Record<Shape, THREE.Object3D>;
  // Per-shape emphasis in [0,1]: 1 = the active/shown object, decays toward 0 for the others.
  private current: Record<Shape, number> = { rock: 0, paper: 0, scissors: 0 };

  constructor() {
    this.meshes = {
      rock: makeRock(),
      paper: makePaper(),
      scissors: makeScissors(),
    };
    for (const s of SHAPES) {
      this.meshes[s].visible = false;
      this.object.add(this.meshes[s]);
    }
    // Initialize to a settled 'rock' (mirrors the primitive baseline's constructor pose).
    this.setShape('rock', 1);
  }

  /**
   * Active-object select + emphasis tween (FORK D2). Shows `shape`, decays the others toward hidden,
   * interpolates each mesh's emphasis scale by clamped t∈[0,1]. Render-only — no machine reference.
   */
  setShape(shape: Shape, t: number): void {
    const k = Math.max(0, Math.min(1, t));
    for (const s of SHAPES) {
      const target = s === shape ? 1 : 0;
      this.current[s] += (target - this.current[s]) * k;
      const mesh = this.meshes[s];
      // Emphasis scale: a settled shown object approaches ~1.0; a decayed one shrinks toward 0.2.
      mesh.scale.setScalar(0.2 + this.current[s] * 0.8);
      // Only render a mesh that carries meaningful emphasis (avoids ghost objects at rest).
      mesh.visible = this.current[s] > 0.01;
    }
  }

  dispose(): void {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

/** Factory used by BOTH the player rig and the opponent object (same visual language, R3). */
export function makeRpsObjectRig(): RpsObjectRig {
  return new RpsObjectRig();
}

/**
 * loadHands-shaped async seam so `wireGame({ loadHands })` consumes it with NO structural change (R1).
 * The parametric rig always constructs — never returns null (it IS the always-ships floor; a future
 * sourced-mesh upgrade slots behind this same seam, like GltfHandRig did for hands).
 */
export async function loadObjects(_tier: QualityTier): Promise<HandRig> {
  return new RpsObjectRig();
}
