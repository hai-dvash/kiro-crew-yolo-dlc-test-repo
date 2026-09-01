// card-rps3d-fix [R3, design §4] — pure camera-framing + rig-scale math (NO WebGL, unit-testable).
//
// Defect 2 root cause: createScene hard-codes camera.position/lookAt for a ~1-unit primitive and
// resize() updates only camera.aspect — nothing fits the camera to the loaded object or normalizes
// its size, so a rig with different extents clips. This module computes, from the measured AABB +
// FOV + aspect, the camera distance and look-at that keep the object framed with a margin — for BOTH
// portrait and landscape aspects. Asset-agnostic: no per-asset constants. The caller (Scene3D) owns
// all THREE objects; this module is deterministic geometry only.

/** Inputs to frame a perspective camera onto an object's world-space AABB. */
export interface FramingInput {
  /** Vertical field of view, degrees (camera.fov). */
  fovDeg: number;
  /** Viewport aspect ratio, width / height (camera.aspect). */
  aspect: number;
  /** Half the AABB diagonal of the target (its bounding-sphere radius). */
  boundingRadius: number;
  /** World-space center of the target's AABB. */
  center: [number, number, number];
  /** Headroom multiplier so nothing clips at the frame edge. Default 1.25. */
  marginFactor?: number;
}

export interface FramingResult {
  /** Camera distance from the center, along the current view direction. */
  distance: number;
  /** Recentred look-at point (the object's center). */
  lookAt: [number, number, number];
}

const DEG2RAD = Math.PI / 180;

/**
 * Distance at which a bounding sphere of `boundingRadius` fits within BOTH the vertical and the
 * horizontal FOV. The horizontal FOV is derived from the vertical FOV and the aspect
 * (hFov = 2·atan(tan(vFov/2)·aspect)); we frame against the TIGHTER half-angle so a portrait aspect
 * (where horizontal is tighter) frames the full object just as a landscape aspect does. This is the
 * piece the original resize() (aspect-only) misses.
 */
export function computeFraming(inp: FramingInput): FramingResult {
  const margin = inp.marginFactor ?? 1.25;
  const r = inp.boundingRadius * margin;

  const vHalf = (inp.fovDeg * DEG2RAD) / 2;
  // Horizontal half-angle for this aspect.
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(inp.aspect, 1e-6));
  // Frame against the tighter of the two so the object fits on both axes.
  const limitingHalf = Math.min(vHalf, hHalf);

  const distance = r / Math.sin(limitingHalf);
  return { distance, lookAt: [...inp.center] as [number, number, number] };
}

/**
 * Uniform scale mapping a rig's current AABB diagonal to a target on-screen size, so any loaded rig
 * (whatever its authored extents) reads at a consistent size. Asset-agnostic; targetDiagonal is a
 * tuning constant, not a per-asset value.
 */
export function computeRigScale(diagonal: number, targetDiagonal = 2): number {
  if (diagonal <= 1e-6) return 1;
  return targetDiagonal / diagonal;
}
