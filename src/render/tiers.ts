// T11 [F2] — quality tiers: boot detect + runtime degrade (R2.3, R2.4, NFR4).
import { QualityTier } from './../config';

/** Pure: pick a boot tier from a GPU renderer string + a short FPS probe. */
export function pickBootTier(rendererString: string, probeFps: number): QualityTier {
  const s = rendererString.toLowerCase();
  const integrated = /(intel|swiftshader|llvmpipe|apple gpu|mali|adreno|powervr)/.test(s);
  if (probeFps < 40 || integrated) {
    return probeFps < 25 ? QualityTier.Low : QualityTier.Mid;
  }
  return QualityTier.High;
}

/** Order for stepping down one level. */
const ORDER: QualityTier[] = [QualityTier.Low, QualityTier.Mid, QualityTier.High];

export function lowerTier(t: QualityTier): QualityTier {
  const i = ORDER.indexOf(t);
  return ORDER[Math.max(0, i - 1)];
}

/**
 * Rolling FPS monitor. Feeds `onDegrade(newTier)` BEFORE frame-drops become
 * visible (R2.4): if the rolling average sits under the tier's floor for a
 * sustained window, drop one tier.
 */
export class TierMonitor {
  private samples: number[] = [];
  private tier: QualityTier;
  private readonly onDegrade: (t: QualityTier) => void;
  private lowStreak = 0;

  // Per-tier fps floors: MID must hold >=50 (the NFR4 bar).
  private static FLOOR: Record<QualityTier, number> = {
    [QualityTier.High]: 55,
    [QualityTier.Mid]: 50,
    [QualityTier.Low]: 30,
  };

  constructor(startTier: QualityTier, onDegrade: (t: QualityTier) => void) {
    this.tier = startTier;
    this.onDegrade = onDegrade;
  }

  getTier(): QualityTier {
    return this.tier;
  }

  /** Feed a frame delta (ms). Returns true if a degrade fired this frame. */
  sample(deltaMs: number): boolean {
    const fps = deltaMs > 0 ? 1000 / deltaMs : 120;
    this.samples.push(fps);
    if (this.samples.length > 30) this.samples.shift();
    if (this.samples.length < 15) return false;

    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const floor = TierMonitor.FLOOR[this.tier];

    if (avg < floor && this.tier !== QualityTier.Low) {
      this.lowStreak++;
      if (this.lowStreak >= 3) {
        this.tier = lowerTier(this.tier);
        this.lowStreak = 0;
        this.samples = [];
        this.onDegrade(this.tier);
        return true;
      }
    } else {
      this.lowStreak = 0;
    }
    return false;
  }
}
