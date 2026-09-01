// T16 [F4/a11y] — reduced-motion gating + tween fallback (R4.3, R2.4).
import { QualityTier } from './../config';

/** True if the user asked for reduced motion. Safe in non-DOM (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pure decision: should juice run tween-only (no physics/shake)?
 * True when reduced-motion is requested OR the tier is LOW OR physics is unavailable.
 */
export function shouldTweenOnly(opts: {
  reducedMotion: boolean;
  tier: QualityTier;
  physicsReady: boolean;
}): boolean {
  return opts.reducedMotion || opts.tier === QualityTier.Low || !opts.physicsReady;
}
