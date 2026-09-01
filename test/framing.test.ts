// card-rps3d-fix [R6.2, design §6] — framing math (pure, no WebGL). RED on 719c6eb: no framing
// module/logic existed (camera hard-coded, resize aspect-only), so "the full object is visible at
// aspect X" was unprovable. GREEN after T4: computeFraming derives a distance keeping the bounding
// sphere within BOTH the vertical and horizontal FOV for landscape AND portrait aspects.
import { describe, it, expect } from 'vitest';
import { computeFraming, computeRigScale } from '../src/render/framing';

const DEG2RAD = Math.PI / 180;

// At `distance`, a sphere of `radius` subtends a half-angle asin(radius/distance). It fits within a
// half-FOV `half` iff asin(radius/distance) <= half. Assert that for the LIMITING (tighter) axis.
function fitsWithinFrustum(distance: number, radius: number, fovDeg: number, aspect: number): boolean {
  const vHalf = (fovDeg * DEG2RAD) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(aspect, 1e-6));
  const limitingHalf = Math.min(vHalf, hHalf);
  const subtended = Math.asin(Math.min(1, radius / distance));
  return subtended <= limitingHalf + 1e-9;
}

describe('computeFraming — camera fit at any aspect (card-rps3d-fix, R6.2)', () => {
  const fovDeg = 45;
  const radius = 1.5;
  const center: [number, number, number] = [0, 0.6, 0];

  it('landscape aspect: bounding sphere stays within the frustum with margin', () => {
    const aspect = 16 / 9;
    const { distance, lookAt } = computeFraming({ fovDeg, aspect, boundingRadius: radius, center });
    // Frame against the marginful radius (default 1.25) — the object itself sits well inside.
    expect(fitsWithinFrustum(distance, radius * 1.25, fovDeg, aspect)).toBe(true);
    // The bare object clears the frustum comfortably (the margin is real headroom).
    expect(fitsWithinFrustum(distance, radius, fovDeg, aspect)).toBe(true);
    expect(lookAt).toEqual(center);
  });

  it('portrait aspect (horizontal FOV tighter): still frames the full object', () => {
    const aspect = 9 / 16; // portrait — horizontal is the limiting axis
    const { distance } = computeFraming({ fovDeg, aspect, boundingRadius: radius, center });
    expect(fitsWithinFrustum(distance, radius * 1.25, fovDeg, aspect)).toBe(true);
    expect(fitsWithinFrustum(distance, radius, fovDeg, aspect)).toBe(true);
  });

  it('portrait pushes the camera farther than landscape for the same object (tighter axis)', () => {
    const land = computeFraming({ fovDeg, aspect: 16 / 9, boundingRadius: radius, center }).distance;
    const port = computeFraming({ fovDeg, aspect: 9 / 16, boundingRadius: radius, center }).distance;
    expect(port).toBeGreaterThan(land);
  });
});

describe('computeRigScale — normalize any rig to a target size (card-rps3d-fix, R6.2)', () => {
  it('maps a large diagonal down and a small diagonal up toward the target', () => {
    const target = 2;
    const big = computeRigScale(10, target);
    const small = computeRigScale(0.5, target);
    expect(big * 10).toBeCloseTo(target, 6); // scaled diagonal hits the target
    expect(small * 0.5).toBeCloseTo(target, 6);
    expect(big).toBeLessThan(1); // large rig shrinks
    expect(small).toBeGreaterThan(1); // small rig grows
  });

  it('is safe for a degenerate (zero) diagonal', () => {
    expect(computeRigScale(0)).toBe(1);
  });
});
