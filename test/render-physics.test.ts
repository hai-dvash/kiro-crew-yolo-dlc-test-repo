import { describe, it, expect } from 'vitest';
import { pickBootTier, lowerTier, TierMonitor } from '../src/render/tiers';
import { accumulate } from '../src/physics/world';
import { shouldTweenOnly } from '../src/a11y/motion';
import { QualityTier } from '../src/config';

describe('tiers.pickBootTier (T11, R2.3)', () => {
  it('picks HIGH for a discrete GPU with good FPS', () => {
    expect(pickBootTier('NVIDIA GeForce RTX 4080', 60)).toBe(QualityTier.High);
  });
  it('picks MID/LOW for integrated GPUs', () => {
    expect(pickBootTier('Intel(R) Iris(R) Xe Graphics', 60)).toBe(QualityTier.Mid);
    expect(pickBootTier('SwiftShader', 20)).toBe(QualityTier.Low);
  });
  it('lowerTier steps down one level and floors at Low', () => {
    expect(lowerTier(QualityTier.High)).toBe(QualityTier.Mid);
    expect(lowerTier(QualityTier.Mid)).toBe(QualityTier.Low);
    expect(lowerTier(QualityTier.Low)).toBe(QualityTier.Low);
  });
});

describe('TierMonitor degrade under simulated low FPS (T11, R2.4)', () => {
  it('drops a tier after a sustained sub-floor FPS feed', () => {
    let degraded: QualityTier | null = null;
    const m = new TierMonitor(QualityTier.High, (t) => (degraded = t));
    // Feed ~30fps (33ms) frames — well under the HIGH floor (55).
    for (let i = 0; i < 120; i++) m.sample(33);
    expect(degraded).not.toBeNull();
    expect(m.getTier()).not.toBe(QualityTier.High);
  });

  it('does NOT degrade when FPS is comfortably above the floor', () => {
    let degraded = false;
    const m = new TierMonitor(QualityTier.Mid, () => (degraded = true));
    for (let i = 0; i < 60; i++) m.sample(10); // 100fps
    expect(degraded).toBe(false);
    expect(m.getTier()).toBe(QualityTier.Mid);
  });
});

describe('physics.accumulate — fixed-timestep math (T14, R4.2)', () => {
  it('runs a bounded number of fixed steps and carries the remainder', () => {
    const r = accumulate(50, 0); // 50ms ~ 3 steps at 1/60 (16.6ms)
    expect(r.steps).toBe(3);
    expect(r.remainder).toBeGreaterThanOrEqual(0);
    expect(r.remainder).toBeLessThan(1 / 60);
  });
  it('clamps steps to avoid spiral-of-death on a long stall', () => {
    const r = accumulate(5000, 0);
    expect(r.steps).toBeLessThanOrEqual(5);
  });
});

describe('a11y.shouldTweenOnly — reduced-motion / low-tier gating (T16, R4.3)', () => {
  it('forces tween-only under reduced motion', () => {
    expect(shouldTweenOnly({ reducedMotion: true, tier: QualityTier.High, physicsReady: true })).toBe(true);
  });
  it('forces tween-only on LOW tier or when physics is unavailable', () => {
    expect(shouldTweenOnly({ reducedMotion: false, tier: QualityTier.Low, physicsReady: true })).toBe(true);
    expect(shouldTweenOnly({ reducedMotion: false, tier: QualityTier.Mid, physicsReady: false })).toBe(true);
  });
  it('allows full juice on MID/HIGH with physics ready', () => {
    expect(shouldTweenOnly({ reducedMotion: false, tier: QualityTier.Mid, physicsReady: true })).toBe(false);
  });
});
