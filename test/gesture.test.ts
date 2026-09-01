import { describe, it, expect } from 'vitest';
import { segment, DEFAULT_CAPTURE } from '../src/gesture/capture';
import { extract } from '../src/gesture/features';
import { classify, LOW_CONFIDENCE_THRESHOLD } from '../src/gesture/classifier';
import { FIXTURES } from '../src/gesture/fixtures';
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

// card-rps3d-fix [R6.3, design §5/§6] — mouse-flick confidence repair. The bug ("Low confidence
// 17% — throw again" on genuine flicks) was the conservative margin denominator (top+runnerUp)
// compressing real throws below LOW_CONFIDENCE_THRESHOLD. Lever 2 rescales the denominator to
// (top+EPS) — a MONOTONIC transform of the same (top-runnerUp) gap, so it lifts confidence without
// ever reordering shapes. These tests prove: (a) genuine scissors throws that WERE low-confidence
// under the old formula clear the threshold under the fix (RED-on-old crossover); (b) the rescale
// is monotonic (new >= old) on the whole corpus; (c) which shape wins is unchanged (scoring-intent
// invariance — the R4 behavior-preserving constraint).
describe('classifier confidence repair (card-rps3d-fix, R4/R6.3)', () => {
  // Faithful reconstruction of the OLD (719c6eb) confidence formula: (top-runnerUp)/(top+runnerUp+EPS).
  const EPS = 1e-6;
  function oldConfidence(scores: Record<string, number>): number {
    const e = (Object.entries(scores) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const top = e[0][1];
    const run = e[1][1];
    return Math.max(0, Math.min(1, (top - run) / (top + run + EPS)));
  }

  // Genuine scissors flicks with a moderate vertical lean (the committed `scissorsVertical`
  // fixtures): a real snip that the old denominator scored at ~0.14 (LOW) — the "throw again" case.
  const verticalSnip = (scale: number): Sample[] =>
    stream([
      [28 * scale, 9 * scale], [-16 * scale, 10 * scale], [27 * scale, 9 * scale],
      [-15 * scale, 10 * scale], [26 * scale, 9 * scale], [-14 * scale, 10 * scale],
    ]);

  it('genuine scissors flicks clear the threshold under the fix but were LOW under the old formula (RED-on-old)', () => {
    for (const scale of [0.8, 1, 1.25, 1.5]) {
      const c = classify(extract(verticalSnip(scale)));
      // Fix: correctly classified scissors, ABOVE the low-confidence threshold.
      expect(c.shape).toBe('scissors');
      expect(c.lowConfidence).toBe(false);
      expect(c.confidence).toBeGreaterThanOrEqual(LOW_CONFIDENCE_THRESHOLD);
      // Old formula on the SAME scores would have flagged it low → the repair is real, not a no-op.
      expect(oldConfidence(c.scores)).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    }
  });

  it('is a MONOTONIC rescale — new confidence >= old for every fixture (never lowers a throw)', () => {
    for (const fx of FIXTURES) {
      const c = classify(extract(fx.window));
      expect(c.confidence).toBeGreaterThanOrEqual(oldConfidence(c.scores) - 1e-9);
    }
  });

  it('preserves scoring intent — argmax (winning shape) unchanged across the whole corpus', () => {
    // The winner per fixture is determined by score() (untouched by the confidence-denominator
    // change) and must still equal the labeled shape — the mechanical "scoring intent preserved".
    for (const fx of FIXTURES) {
      const c = classify(extract(fx.window));
      expect(c.shape).toBe(fx.label);
    }
  });
});
