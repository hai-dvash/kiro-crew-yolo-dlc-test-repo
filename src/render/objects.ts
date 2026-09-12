// card-rps3d-objects · f1 (#23) — throwable RPS object-rig + opponent-object render path.
// card-rps3d-visual · #29 (T1/T3/T5) — visual-quality lift: distinct legible geometry (REQ-A1),
// deliberate three-value palette (REQ-A3), grounding shadows (REQ-A2, castShadow set here), and
// tier-gated procedural roughness/normal maps (REQ-B1/B3). All zero-new-dependency (Three built-ins
// + runtime-generated maps). Deterministic — NO Math.random — so test/objects.test.ts's index map
// (rock=0/paper=1/scissors=2) and no-random guard (G4) hold.
//
// F1-FIRST (NFR1 / NFR-I1): this rig is a committed-result CONSUMER — it renders already-committed
// state and NEVER references RoundMachine/submit/pickOpponent. There is no import of the round layer.
import * as THREE from 'three';
import type { Shape } from '../types';
import { QualityTier } from '../config';
import type { HandRig } from './hands'; // reuse the SAME interface (object/setShape/dispose)
import { PALETTE, TIER_FIDELITY, procSurface, type ProcSurface } from './config';

const SHAPES: Shape[] = ['rock', 'paper', 'scissors'];

// Shared PBR material factory. Reads the deliberate palette (REQ-A3). Procedural maps (REQ-B1) are
// attached later by applyMaps() so a map-less (Low tier / test) material is a valid plain material.
function objectMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
}

// Deterministic per-vertex displacement (G4: seeded hash on the vertex index, NOT Math.random) so
// the rock reads as a chunky faceted stone with a stable silhouette across runs/tests.
function jitterVertices(geo: THREE.BufferGeometry, amp: number): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let h = (i * 2654435761) | 0;
    h = (h ^ (h >>> 15)) * 1274126177;
    const f = ((h >>> 0) % 1000) / 1000 - 0.5; // deterministic [-0.5,0.5)
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const s = 1 + f * amp;
    pos.setXYZ(i, x * s, y * s, z * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

// T1 geometry builders — three DISTINCT silhouettes, Three built-ins only, no asset/async/new dep.

/** rock — a chunky faceted stone: subdivided icosahedron + deterministic displacement (REQ-A1). */
function makeRock(): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(0.9, 1); // detail 1 (~80 faces) — reads as a rough stone
  jitterVertices(geo, 0.22);
  const m = new THREE.Mesh(geo, objectMaterial(PALETTE.rock));
  m.material.roughness = 0.95;
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/** paper — a curled sheet with body: a segmented plane bent by a shallow sine (REQ-A1). */
function makePaper(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1.3, 1.7, 6, 8);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // shallow double curl → paper body (deterministic, no random)
    const z = Math.sin(x * 2.4) * 0.06 + Math.sin(y * 1.6) * 0.04;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mat = objectMaterial(PALETTE.paper);
  mat.roughness = 0.75;
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/** scissors — a THREE.Group: two blades + a hinge pivot + two finger loops (REQ-A1). */
function makeScissors(): THREE.Group {
  const group = new THREE.Group();
  const mat = objectMaterial(PALETTE.scissors);
  mat.metalness = 0.35;
  mat.roughness = 0.35;

  const bladeGeom = new THREE.BoxGeometry(0.14, 1.5, 0.06);
  const a = new THREE.Mesh(bladeGeom, mat);
  a.position.y = 0.35;
  a.rotation.z = Math.PI / 9; // +20°
  const b = new THREE.Mesh(bladeGeom, mat);
  b.position.y = 0.35;
  b.rotation.z = -Math.PI / 9; // -20°

  // hinge pivot at the crossing
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16), mat);
  hinge.rotation.x = Math.PI / 2;

  // two finger loops at the handle ends
  const loopGeom = new THREE.TorusGeometry(0.22, 0.05, 12, 24);
  const l1 = new THREE.Mesh(loopGeom, mat);
  l1.position.set(-0.28, -0.55, 0);
  const l2 = new THREE.Mesh(loopGeom, mat);
  l2.position.set(0.28, -0.55, 0);

  for (const part of [a, b, hinge, l1, l2]) {
    part.castShadow = true;
    part.receiveShadow = false;
    group.add(part);
  }
  return group;
}

// Attach procedural roughness/normal maps to every MeshStandardMaterial under an object (REQ-B1/B3).
function applyMaps(obj: THREE.Object3D, surf: ProcSurface | null): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.isMeshStandardMaterial) {
      mat.roughnessMap = surf ? surf.roughnessMap : null;
      mat.normalMap = surf ? surf.normalMap : null;
      mat.needsUpdate = true;
    }
  });
}

/**
 * Parametric RPS object-rig. Holds three child meshes parented under `object`; setShape selects +
 * emphasizes the active one. Always-ships baseline (NFR5) — no asset, no new dep. Satisfies the live
 * HandRig contract so wireGame consumes it with NO structural change.
 *
 * Tier is OPTIONAL (default undefined = no procedural maps) so `new RpsObjectRig()` in tests stays a
 * plain-material rig with the exact child index order + emphasis-scale semantics the tests assert.
 */
export class RpsObjectRig implements HandRig {
  object = new THREE.Group();
  private meshes: Record<Shape, THREE.Object3D>;
  private current: Record<Shape, number> = { rock: 0, paper: 0, scissors: 0 };
  private surf: ProcSurface | null = null;

  constructor(tier?: QualityTier) {
    this.meshes = {
      rock: makeRock(),
      paper: makePaper(),
      scissors: makeScissors(),
    };
    // child add-order MUST stay rock, paper, scissors (G4 / test index map).
    for (const s of SHAPES) {
      this.meshes[s].visible = false;
      this.object.add(this.meshes[s]);
    }
    if (tier !== undefined) this.setTier(tier);
    this.setShape('rock', 1);
  }

  /** Attach/detach tier-gated procedural maps at construction or on a runtime tier change. */
  setTier(tier: QualityTier): void {
    const res = TIER_FIDELITY[tier].procMapRes;
    const next = res > 0 ? procSurface(res) : null;
    // dispose the maps we are replacing (no GPU leak on a runtime tier drop).
    if (this.surf) {
      this.surf.roughnessMap.dispose();
      this.surf.normalMap.dispose();
    }
    this.surf = next;
    for (const s of SHAPES) applyMaps(this.meshes[s], this.surf);
  }

  /**
   * Active-object select + emphasis tween (behavior-preserving). Shows `shape`, decays the others,
   * scales each mesh's emphasis by clamped t∈[0,1]. Render-only — no machine reference.
   */
  setShape(shape: Shape, t: number): void {
    const k = Math.max(0, Math.min(1, t));
    for (const s of SHAPES) {
      const target = s === shape ? 1 : 0;
      this.current[s] += (target - this.current[s]) * k;
      const mesh = this.meshes[s];
      mesh.scale.setScalar(0.2 + this.current[s] * 0.8);
      mesh.visible = this.current[s] > 0.01;
    }
  }

  dispose(): void {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    if (this.surf) {
      this.surf.roughnessMap.dispose();
      this.surf.normalMap.dispose();
      this.surf = null;
    }
  }
}

/** Factory used by BOTH the player rig and the opponent object (same visual language, R3). */
export function makeRpsObjectRig(tier?: QualityTier): RpsObjectRig {
  return new RpsObjectRig(tier);
}

/** T5 — runtime fidelity swap: re-attach or drop procedural maps on a tier change (G3). */
export function objectsApplyFidelity(rig: HandRig, tier: QualityTier): void {
  if (rig instanceof RpsObjectRig) rig.setTier(tier);
}

/**
 * loadHands-shaped async seam so `wireGame({ loadHands })` consumes it with NO structural change.
 * Threads the boot tier into the procedural-map resolution (T5).
 */
export async function loadObjects(tier: QualityTier): Promise<HandRig> {
  return new RpsObjectRig(tier);
}
