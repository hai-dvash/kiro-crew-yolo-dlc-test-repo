import { describe, it, expect } from 'vitest';
import { runAccuracy } from '../src/gesture/harness';

describe('accuracy harness — the R1.3 evaluability gate (>=85%)', () => {
  it('overall accuracy on the committed fixture suite is >= 85%', () => {
    const r = runAccuracy();
    // If this fails, trigger the FORK-1 learned-classifier seam (dlc-backlog),
    // do not proceed to render polish (Milestone M-A).
    expect(r.overall).toBeGreaterThanOrEqual(0.85);
  });

  it('every shape clears a minimum bar (no collapsed class)', () => {
    const r = runAccuracy();
    for (const s of ['rock', 'paper', 'scissors'] as const) {
      expect(r.perShape[s].accuracy).toBeGreaterThanOrEqual(0.75);
    }
  });
});
