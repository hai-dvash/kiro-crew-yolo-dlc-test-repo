// T6 [F1] — ?dev accuracy harness (R1.3). The evaluability surface + FORK-1 escape-hatch trigger.
import type { Shape } from './../types';
import { extract } from './features';
import { classify } from './classifier';
import { FIXTURES } from './fixtures';

export interface AccuracyReport {
  overall: number;
  perShape: Record<Shape, { correct: number; total: number; accuracy: number }>;
  total: number;
  correct: number;
}

/** Run the classifier over the committed fixture suite and report accuracy. */
export function runAccuracy(): AccuracyReport {
  const perShape: Record<Shape, { correct: number; total: number; accuracy: number }> = {
    rock: { correct: 0, total: 0, accuracy: 0 },
    paper: { correct: 0, total: 0, accuracy: 0 },
    scissors: { correct: 0, total: 0, accuracy: 0 },
  };
  let correct = 0;

  for (const fx of FIXTURES) {
    const predicted = classify(extract(fx.window)).shape;
    perShape[fx.label].total++;
    if (predicted === fx.label) {
      perShape[fx.label].correct++;
      correct++;
    }
  }

  (Object.keys(perShape) as Shape[]).forEach((s) => {
    const e = perShape[s];
    e.accuracy = e.total > 0 ? e.correct / e.total : 0;
  });

  return {
    overall: FIXTURES.length > 0 ? correct / FIXTURES.length : 0,
    perShape,
    total: FIXTURES.length,
    correct,
  };
}

/** Human-readable one-liner per shape (for the ?dev overlay / console). */
export function formatReport(r: AccuracyReport): string {
  const lines = [`overall ${(r.overall * 100).toFixed(1)}% (${r.correct}/${r.total})`];
  (Object.keys(r.perShape) as Shape[]).forEach((s) => {
    const e = r.perShape[s];
    lines.push(`  ${s}: ${(e.accuracy * 100).toFixed(0)}% (${e.correct}/${e.total})`);
  });
  return lines.join('\n');
}
