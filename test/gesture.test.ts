import { describe, it, expect } from 'vitest';
import { segment, DEFAULT_CAPTURE } from '../src/gesture/capture';
import { extract } from '../src/gesture/features';
import { classify } from '../src/gesture/classifier';
import type { Sample } from '../src/types';

// Build a stream from (dx,dy) steps at fixed dt.
function stream(steps: Array<[number, number]>, dt = 8, x0 = 0, y0 = 0): Sample[] {
  const out: Sample[] = [{ t: 0, x: x0, y: y0 }];
  let x = x0;
  let y = y0;
  let t = 0;
  for (const [dx, dy] of steps) {
    x += dx;
    y += dy;
    t += dt;
    out.push({ t, x, y });
  }
  return out;
}

describe('capture.segment — motion-onset segmentation (T3, R1.1)', () => {
  it('extracts a single fast flick as one window', () => {
    const s = stream([[30, 5], [40, 4], [35, 3], [2, 0], [1, 0], [0, 0], [0, 0]]);
    const w = segment(s);
    expect(w.length).toBe(1);
  });

  it('ignores slow drift below the onset threshold', () => {
    const s = stream([[1, 0], [1, 1], [0, 1], [1, 0]], 40); // ~0.03 px/ms << onset 0.35
    expect(segment(s).length).toBe(0);
  });

  it('caps a run-on gesture at max duration', () => {
    const many: Array<[number, number]> = Array.from({ length: 400 }, () => [20, 1]);
    const s = stream(many, 8);
    const w = segment(s, { ...DEFAULT_CAPTURE, maxDurationMs: 200 });
    expect(w.length).toBeGreaterThanOrEqual(1);
    for (const win of w) {
      expect(win[win.length - 1].t - win[0].t).toBeLessThanOrEqual(DEFAULT_CAPTURE.maxDurationMs);
    }
  });
});

describe('features.extract — kinematics (T4, R1.3)', () => {
  it('is pure and stable for a degenerate window', () => {
    const f = extract([{ t: 0, x: 0, y: 0 }]);
    expect(f.pathLength).toBe(0);
    expect(f.reversals).toBe(0);
  });

  it('detects vertical dominance for a downward chop', () => {
    const f = extract(stream([[2, 30], [3, 55], [1, 40]]));
    expect(f.dominantAxis).toBe('vertical');
    expect(f.dominantAxisRatio).toBeGreaterThan(1);
  });

  it('counts reversals for a back-and-forth motion', () => {
    const f = extract(stream([[26, 4], [-24, -3], [25, 2], [-23, -2]]));
    expect(f.reversals).toBeGreaterThanOrEqual(2);
  });

  it('counts reversals on BOTH axes, not just the dominant one (issue #9)', () => {
    // Net displacement is vertical-dominant (sum dy >> sum dx) so the OLD code
    // read reversalsY only; but dy is monotone (single sign -> reversalsY = 0)
    // while the snip alternation lives on X (dx sign flips every step). The
    // both-axes sum must capture the X alternation the old logic discarded.
    const f = extract(stream([[24, 22], [-22, 24], [23, 21], [-21, 23], [22, 20]]));
    expect(f.dominantAxis).toBe('vertical'); // old code would read reversalsY (= 0 here)
    expect(f.reversals).toBeGreaterThanOrEqual(3); // sum captures the X reversals
  });
});

describe('classifier.classify — margin confidence (T5, R1.2)', () => {
  it('returns a valid shape + confidence in [0,1]', () => {
    const c = classify(extract(stream([[26, 4], [-24, -3], [25, 2], [-23, -2]])));
    expect(['rock', 'paper', 'scissors']).toContain(c.shape);
    expect(c.confidence).toBeGreaterThanOrEqual(0);
    expect(c.confidence).toBeLessThanOrEqual(1);
  });

  it('classifies a reversing motion as scissors', () => {
    const c = classify(extract(stream([[26, 4], [-24, -3], [25, 2], [-23, -2], [22, 3]])));
    expect(c.shape).toBe('scissors');
  });

  it('flags low confidence on an ambiguous near-diagonal window (small margin)', () => {
    // near-45° single motion: no clear axis dominance, no reversals -> top1-top2 margin tiny.
    const c = classify(extract(stream([[15, 12]])));
    expect(c.lowConfidence).toBe(true);
  });
});
