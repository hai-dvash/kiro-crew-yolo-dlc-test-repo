// card-rps3d-headline [issue #19, design §4] — headless HUD regression test (node-env, DOM-free).
// Mirrors test/main.test.ts's discipline: assert the pure extracted copy module + a static string
// read of index.html — never a rendered DOM (vitest environment is 'node', vite.config.ts). This is
// the regression net on the exact untested presentation surface that let the card-rps3d-fix defects
// ship green.
import { describe, it, expect } from 'vitest';
import { HEADLINE, RPS_LEGEND } from '../src/hud/copy';
import type { Shape } from '../src/types';

// Dependency-free file access via Vite's glob (no @types/node needed) — the same discipline
// test/hands.test.ts uses. Reads the committed index.html as a raw string for the a11y regression net.
const htmlModules = import.meta.glob('../index.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const indexHtml = Object.values(htmlModules)[0];

// Ground-truth mapping derived from the real modules: src/gesture (chop=rock/sweep=paper/snip=
// scissors) and src/a11y/fallback KEY_MAP (r=rock/p=paper/s=scissors).
const GROUND_TRUTH: Array<{ gesture: string; key: string; shape: Shape }> = [
  { gesture: 'chop', key: 'R', shape: 'rock' },
  { gesture: 'sweep', key: 'P', shape: 'paper' },
  { gesture: 'snip', key: 'S', shape: 'scissors' },
];
const ALL_SHAPES: Shape[] = ['rock', 'paper', 'scissors'];

describe('HUD comedic headline (card-rps3d-headline, R1/AC-1)', () => {
  it('(a) headline is present and is the RPS name', () => {
    expect(HEADLINE.h1.trim().length).toBeGreaterThan(0);
    expect(HEADLINE.h1.toLowerCase().replace(/[^a-z]/g, '')).toContain('rockpaperscissors');
  });

  it('(a) certainty copy is over-the-top: 10,000% confidence claim + all three shape names', () => {
    const certainty = HEADLINE.certainty.toLowerCase();
    expect(certainty).toMatch(/10[.,]?000\s*%|10000\s*%/); // "10,000%" or "10000%"
    expect(certainty).toContain('confidence');
    for (const shape of ALL_SHAPES) expect(certainty).toContain(shape);
  });

  it('(a) reassurance + legendTitle copy are present (comedic layer not a stub)', () => {
    expect(HEADLINE.reassurance.trim().length).toBeGreaterThan(0);
    expect(HEADLINE.legendTitle.trim().length).toBeGreaterThan(0);
  });
});

describe('HUD truthful RPS legend (card-rps3d-headline, R2.1/AC-2)', () => {
  it('(b) has exactly 3 rows matching the ground-truth gesture/key/shape triples', () => {
    expect(RPS_LEGEND).toHaveLength(3);
    for (const truth of GROUND_TRUTH) {
      const row = RPS_LEGEND.find((r) => r.gesture === truth.gesture);
      expect(row, `missing legend row for gesture "${truth.gesture}"`).toBeDefined();
      expect(row!.key).toBe(truth.key);
      expect(row!.shape).toBe(truth.shape);
    }
  });

  it('(b) key set === {R,P,S} and shape set === the full Shape union', () => {
    expect(new Set(RPS_LEGEND.map((r) => r.key))).toEqual(new Set(['R', 'P', 'S']));
    expect(new Set(RPS_LEGEND.map((r) => r.shape))).toEqual(new Set(ALL_SHAPES));
  });

  it('(b) every row carries a non-empty human label + a decorative icon', () => {
    for (const row of RPS_LEGEND) {
      expect(row.label.trim().length).toBeGreaterThan(0);
      expect(row.icon.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('HUD does not regress the functional a11y surface (card-rps3d-headline, R3.1/NFR1/AC-3)', () => {
  it('(c) index.html keeps #status as an aria-live=polite status region', () => {
    const statusTag = indexHtml.match(/<p\b[^>]*id="status"[^>]*>/);
    expect(statusTag, '#status element missing').not.toBeNull();
    expect(statusTag![0]).toContain('role="status"');
    expect(statusTag![0]).toContain('aria-live="polite"');
  });

  it('(c) index.html keeps #badge as an alert region', () => {
    const badgeTag = indexHtml.match(/<p\b[^>]*id="badge"[^>]*>/);
    expect(badgeTag, '#badge element missing').not.toBeNull();
    expect(badgeTag![0]).toContain('role="alert"');
  });

  it('(c) index.html has EXACTLY one <h1> (no second heading crept in — NFR1)', () => {
    const h1Count = (indexHtml.match(/<h1\b/g) ?? []).length;
    expect(h1Count).toBe(1);
  });

  it('(c) the single <h1> is the headline host (filled from copy.ts, one source — NFR4)', () => {
    expect(indexHtml).toMatch(/<h1\b[^>]*id="headline"/);
  });
});
