// card-rps3d-visual (#29) · T0/T4 — single source of the deferred render constants (NFR-M1) plus the
// zero-asset procedural surface generator (REQ-B1 / NFR-Z1). Pure data + one generator; NO scene
// state, NO round import (G1 F1-first), NO texture/HDR import or fetch (G2 zero-dep — every map is
// generated at runtime). Consumed by scene.ts (T2/T3/T6), objects.ts (T1/T3/T5) and main.ts (T8/T9).
import * as THREE from 'three';
import { QualityTier } from '../config';

/**
 * Deliberate three-value palette (§art-direction). Rock and scissors sit ≥30% lightness apart so the
 * three shapes read as distinct VALUES, not just hues — the core "functional but ugly" fix.
 *   bg 0x11151c (deep cool)  ground 0x1b222c  rock 0x6b7480 (mid-dark)  paper 0xeef1f4 (near-white)
 *   scissors 0xb8c0cc (light-mid)  accent 0xffb454 (warm highlight)  rim 0xff9d5c (warm rim light)
 */
export const PALETTE = {
  bg: 0x11151c,
  ground: 0x1b222c,
  rock: 0x6b7480,
  paper: 0xeef1f4,
  scissors: 0xb8c0cc,
  accent: 0xffb454,
  rim: 0xff9d5c,
} as const;

/** Per-tier fidelity budget. Low drops all added cost to hold the ≥50fps NFR-P1 bar. */
export interface TierFidelity {
  castShadows: boolean;
  shadowMapSize: number;
  /** Procedural roughness/normal map resolution; 0 = no maps (plain material). */
  procMapRes: number;
  ssao: boolean;
}

export const TIER_FIDELITY: Record<QualityTier, TierFidelity> = {
  [QualityTier.High]: { castShadows: true, shadowMapSize: 2048, procMapRes: 512, ssao: true },
  [QualityTier.Mid]: { castShadows: true, shadowMapSize: 1024, procMapRes: 256, ssao: false },
  [QualityTier.Low]: { castShadows: false, shadowMapSize: 0, procMapRes: 0, ssao: false },
};

/** Retuned post base numbers (T3/REQ-A4). applyTier opacity-toggling in post.ts is unchanged. */
export const POST_TUNE = {
  bloom: { luminanceThreshold: 0.72, intensity: 0.7 },
  ssao: { radius: 0.08, intensity: 0.9 },
} as const;

/** Reveal camera punch-in choreography (T8/REQ-C2), all durations in ms; dollyIn is a fit fraction. */
export const PUNCH_IN = {
  dollyIn: 0.28,
  punchMs: 220,
  holdMs: 380,
  settleMs: 520,
} as const;

/** A generated roughness+normal map pair (or null when the tier disables procedural maps). */
export interface ProcSurface {
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
}

// Deterministic tileable value-noise: a fixed integer-hash lattice + smoothstep interpolation. No
// Math.random (G4 stability), no import/fetch (G2). Same output for the same (res) every run.
function hash2(ix: number, iy: number): number {
  // integer hash -> [0,1); deterministic, wraps for tileability by taking coords modulo the period.
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Tileable value-noise sampled in [0,1)^2 with an integer `period` lattice. */
function valueNoise(u: number, v: number, period: number): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  // wrap lattice corners by `period` so the field tiles seamlessly (RepeatWrapping-safe).
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const xm = ((x0 % period) + period) % period;
  const ym = ((y0 % period) + period) % period;
  const n00 = hash2(xm, ym);
  const n10 = hash2(x1, ym);
  const n01 = hash2(xm, y1);
  const n11 = hash2(x1, y1);
  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fy;
}

/** Fractal (2-octave) height field in [0,1]. Deterministic. */
function heightAt(u: number, v: number): number {
  const a = valueNoise(u, v, 8);
  const b = valueNoise(u, v, 16);
  return Math.min(1, a * 0.65 + b * 0.35);
}

/**
 * Runtime-generate a roughness map + a Sobel-derived normal map at `res`×`res`. Returns null when
 * res===0 (Low tier). DataTexture-based so it works headless (no DOM/canvas dependency) — the maps
 * are pure buffers. RepeatWrapping so materials tile. NO asset, NO fetch (G2 / REQ-B1).
 */
export function procSurface(res: number): ProcSurface | null {
  if (!res || res <= 0) return null;

  const n = res * res;
  const height = new Float32Array(n);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      height[y * res + x] = heightAt(x / res, y / res);
    }
  }

  // Roughness map (single-channel encoded into RGB grey): mid-rough with subtle variation.
  const rough = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const r = Math.round((0.55 + height[i] * 0.35) * 255); // 0.55..0.90 roughness
    rough[i * 4] = r;
    rough[i * 4 + 1] = r;
    rough[i * 4 + 2] = r;
    rough[i * 4 + 3] = 255;
  }
  const roughnessMap = new THREE.DataTexture(rough, res, res, THREE.RGBAFormat);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.needsUpdate = true;

  // Normal map via Sobel gradient of the height field (tangent-space RGB encoding).
  const normal = new Uint8Array(n * 4);
  const at = (x: number, y: number) => height[(((y % res) + res) % res) * res + (((x % res) + res) % res)];
  const STRENGTH = 2.0;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      // tangent-space normal (X,Y from gradient, Z up), normalized then packed to [0,255].
      let nx = dx * STRENGTH;
      let ny = dy * STRENGTH;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = y * res + x;
      normal[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[i * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normal[i * 4 + 3] = 255;
    }
  }
  const normalMap = new THREE.DataTexture(normal, res, res, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.needsUpdate = true;

  return { roughnessMap, normalMap };
}
