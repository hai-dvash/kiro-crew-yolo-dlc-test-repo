import { describe, it, expect } from 'vitest';
import { extractFeatures } from '../src/gesture/features';
import { rockFlick, paperSweep, scissorsSnip } from './fixtures';

describe('extractFeatures — feature math on canned buffers (R1.1)', () => {
  it('a downward flick is vertical, straight, low reversals', () => {
    const f = extractFeatures(rockFlick());
    expect(f.dominantAxis).toBe('vertical');
    expect(f.reversals).toBe(0);
    expect(f.straightness).toBeGreaterThan(0.9);
    expect(f.pathLength).toBeGreaterThan(40);
  });

  it('a flat sweep is horizontal with low reversals', () => {
    const f = extractFeatures(paperSweep());
    expect(f.dominantAxis).toBe('horizontal');
    expect(f.reversals).toBe(0);
    expect(f.straightness).toBeGreaterThan(0.9);
  });

  it('a snip has >=2 reversals on the horizontal axis', () => {
    const f = extractFeatures(scissorsSnip());
    expect(f.dominantAxis).toBe('horizontal');
    expect(f.reversals).toBeGreaterThanOrEqual(2);
  });

  it('degenerate buffers do not throw', () => {
    expect(() => extractFeatures([])).not.toThrow();
    expect(extractFeatures([]).pathLength).toBe(0);
  });
});
