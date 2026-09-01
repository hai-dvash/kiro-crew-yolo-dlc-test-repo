// T4 [F1] — kinematic feature extraction (R1.3 feature basis). PURE, DOM-free.
import type { Sample, Features } from './../types';

const EPS = 1e-6;

/** Extract interpretable kinematic features from a gesture window. */
export function extract(window: Sample[]): Features {
  if (window.length < 2) {
    return {
      peakSpeed: 0,
      dominantAxisRatio: 1,
      dominantAxis: 'horizontal',
      netDisplacement: 0,
      reversals: 0,
      durationMs: 0,
      onsetSharpness: 0,
      pathLength: 0,
    };
  }

  let peakSpeed = 0;
  let pathLength = 0;
  let prevSpeed = 0;
  let onsetSharpness = 0;
  let sumDx = 0;
  let sumDy = 0;
  // Reversal tracking along each axis.
  let prevSignX = 0;
  let prevSignY = 0;
  let reversalsX = 0;
  let reversalsY = 0;

  for (let i = 1; i < window.length; i++) {
    const a = window[i - 1];
    const b = window[i];
    const dt = Math.max(b.t - a.t, EPS);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const s = dist / dt;

    peakSpeed = Math.max(peakSpeed, s);
    pathLength += dist;
    sumDx += dx;
    sumDy += dy;

    const jerk = Math.abs(s - prevSpeed) / dt;
    onsetSharpness = Math.max(onsetSharpness, jerk);
    prevSpeed = s;

    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    if (sx !== 0) {
      if (prevSignX !== 0 && sx !== prevSignX) reversalsX++;
      prevSignX = sx;
    }
    if (sy !== 0) {
      if (prevSignY !== 0 && sy !== prevSignY) reversalsY++;
      prevSignY = sy;
    }
  }

  const absX = Math.abs(sumDx);
  const absY = Math.abs(sumDy);
  const dominantAxis: 'vertical' | 'horizontal' = absY >= absX ? 'vertical' : 'horizontal';
  const dominantAxisRatio = (Math.max(absX, absY) + EPS) / (Math.min(absX, absY) + EPS);
  // Count reversals on BOTH axes, not just the net-dominant one (issue #9): a
  // vertical-dominant or diagonal scissors snip alternates on the non-dominant
  // axis, which axis-gating silently dropped -> under-count -> misclassification.
  // Safe against regressing horizontal gestures because the classifier consumes
  // this only via a saturating term (min(reversals/3, 1)).
  const reversals = reversalsX + reversalsY;
  const netDisplacement = Math.hypot(sumDx, sumDy);
  const durationMs = window[window.length - 1].t - window[0].t;

  return {
    peakSpeed,
    dominantAxisRatio,
    dominantAxis,
    netDisplacement,
    reversals,
    durationMs,
    onsetSharpness,
    pathLength,
  };
}
