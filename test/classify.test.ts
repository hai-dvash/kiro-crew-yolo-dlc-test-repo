import { describe, it, expect } from 'vitest';
import { extractFeatures } from '../src/gesture/features';
import { classify } from '../src/gesture/classify';
import type { Shape } from '../src/types';
import { rockFlick, paperSweep, scissorsSnip, jiggle } from './fixtures';

describe('classify — labeled synthetic buffers (R1.1, R1.2)', () => {
  it('rock flick → rock, high confidence', () => {
    const c = classify(extractFeatures(rockFlick()));
    expect(c.shape).toBe('rock');
    expect(c.confidence).toBe('high');
  });

  it('paper sweep → paper, high confidence', () => {
    const c = classify(extractFeatures(paperSweep()));
    expect(c.shape).toBe('paper');
    expect(c.confidence).toBe('high');
  });

  it('scissors snip → scissors', () => {
    const c = classify(extractFeatures(scissorsSnip()));
    expect(c.shape).toBe('scissors');
  });

  it('sub-threshold jiggle → low confidence, does not silently guess', () => {
    const c = classify(extractFeatures(jiggle()));
    expect(c.confidence).toBe('low');
  });
});

describe('T10 accuracy harness — >=80% first-try on the labeled set (R1.3)', () => {
  it('classifies the labeled gesture set with >=80% accuracy', () => {
    const set: Array<{ buf: ReturnType<typeof rockFlick>; label: Shape }> = [
      { buf: rockFlick(), label: 'rock' },
      { buf: paperSweep(), label: 'paper' },
      { buf: scissorsSnip(), label: 'scissors' },
      { buf: rockFlick(), label: 'rock' },
      { buf: paperSweep(), label: 'paper' },
    ];
    const correct = set.filter((c) => classify(extractFeatures(c.buf)).shape === c.label).length;
    expect(correct / set.length).toBeGreaterThanOrEqual(0.8);
  });
});
