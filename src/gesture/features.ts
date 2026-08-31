import type { Sample, Features } from '../types';

/**
 * Derive interpretable features from a raw pointer sample buffer (R1.1).
 * All math is cheap and training-free (v1 is deliberately trainless).
 */
export function extractFeatures(buf: Sample[]): Features {
  if (buf.length < 2) {
    return {
      peakVelocity: 0,
      spikeProfile: false,
      dominantAxis: 'horizontal',
      reversals: 0,
      straightness: 0,
      pathLength: 0,
    };
  }

  let pathLength = 0;
  let peakVelocity = 0;
  const speeds: number[] = [];
  let netX = 0;
  let netY = 0;

  for (let i = 1; i < buf.length; i++) {
    const dx = buf[i].x - buf[i - 1].x;
    const dy = buf[i].y - buf[i - 1].y;
    const dt = Math.max(1, buf[i].t - buf[i - 1].t); // guard divide-by-zero
    const dist = Math.hypot(dx, dy);
    const speed = dist / dt;
    pathLength += dist;
    speeds.push(speed);
    if (speed > peakVelocity) peakVelocity = speed;
    netX += dx;
    netY += dy;
  }

  const dominantAxis: Features['dominantAxis'] =
    Math.abs(netY) >= Math.abs(netX) ? 'vertical' : 'horizontal';

  // Reversals: sign changes of the per-step delta along the dominant axis.
  const reversals = countReversals(buf, dominantAxis);

  // Spike profile: peak >> mean => a single sharp burst rather than sustained motion.
  const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const spikeProfile = peakVelocity > meanSpeed * 2.2;

  const netDisplacement = Math.hypot(netX, netY);
  const straightness = pathLength > 0 ? netDisplacement / pathLength : 0;

  return { peakVelocity, spikeProfile, dominantAxis, reversals, straightness, pathLength };
}

function countReversals(buf: Sample[], axis: 'vertical' | 'horizontal'): number {
  const pick = (s: Sample) => (axis === 'vertical' ? s.y : s.x);
  let reversals = 0;
  let prevSign = 0;
  const EPS = 1.5; // px — ignore jitter below this per-step delta
  for (let i = 1; i < buf.length; i++) {
    const delta = pick(buf[i]) - pick(buf[i - 1]);
    if (Math.abs(delta) < EPS) continue;
    const sign = Math.sign(delta);
    if (prevSign !== 0 && sign !== prevSign) reversals++;
    prevSign = sign;
  }
  return reversals;
}
