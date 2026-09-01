// card-backlog-14 [f3 / #18] — asset budget + provenance CI guardrail (T9/T10/T11, design §5, R6).
// Turns two shipping-hygiene rules into BUILD FAILURES rather than an honor system:
//   G-budget    (NFR3): any shipped hand .glb must be ≤ 2 MB (soft-warn above 500 KB).
//   G-provenance(NFR5): every shipped .glb under public/assets/hands/ must have a LICENSE.md row.
// Asset-INDEPENDENT: it reads whatever .glb + LICENSE.md actually ship (today RiggedSimple 15 KB,
// tomorrow the sourced real-hand asset from child #16), so it lands NOW and immediately gates T2/T3.
// Auto-discovered by `vitest run` (npm test) — no new script needed (T11).
//
// NFR1 split (design §5): license *legality* (the SPDX allowlist CC0/CC-BY, reject -SA/-NC/-ND) is
// NOT machine-checkable from the .glb — it stays a human-at-download call recorded in the row. This
// suite asserts row *presence* + *byte budget* only; it does not attempt to parse license text.
import { describe, it, expect } from 'vitest';

const HARD_BUDGET = 2 * 1024 * 1024; // 2 MB (NFR3 hard gate)
const SOFT_BUDGET = 500 * 1024; // 500 KB (recommended; warn-only)
const PLACEHOLDER = /_\(none in v1\)_/;

// Dependency-free file access via Vite's glob (no @types/node needed) — same pattern as hands.test.ts.
// `?url` resolves the asset path (existence); we stat it via fetch-free fs through import.meta later.
const glbUrls = import.meta.glob('../public/assets/hands/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
// Raw bytes of each shipped .glb so we can measure size without node fs typings.
const glbRaw = import.meta.glob('../public/assets/hands/*.glb', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const licenseRaw = import.meta.glob('../public/assets/hands/LICENSE.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// Map an import.meta.glob key ("../public/assets/hands/hand.glb") → its bare filename.
const fileNameOf = (key: string) => key.split('/').pop() as string;

const shippedGlbs = Object.keys(glbUrls);
const licenseText = (Object.values(licenseRaw)[0] as string | undefined) ?? '';

describe('G-budget — shipped hand .glb ≤ 2 MB (card-backlog-14 #18, NFR3)', () => {
  it('has zero or more shipped .glb assets (a no-asset build is legal — primitive floor)', () => {
    // No assertion beyond existence-is-optional; documents that an empty set passes trivially.
    expect(Array.isArray(shippedGlbs)).toBe(true);
  });

  for (const key of shippedGlbs) {
    const name = fileNameOf(key);
    it(`${name} is within the 2 MB hard budget`, () => {
      // `?raw` yields the file text; byte length is measured via a UTF-8 encoder (browser-safe).
      const raw = glbRaw[key] ?? '';
      const bytes = new TextEncoder().encode(raw).length;
      if (bytes > SOFT_BUDGET) {
        // Non-failing signal: over the recommended budget but under the hard cap.
        // eslint-disable-next-line no-console
        console.warn(`[asset-budget] ${name} is ${(bytes / 1024).toFixed(0)} KB (> 500 KB soft budget)`);
      }
      expect(bytes).toBeLessThanOrEqual(HARD_BUDGET);
    });
  }
});

describe('G-provenance — every shipped .glb has a LICENSE.md row (card-backlog-14 #18, NFR5)', () => {
  it('if any .glb ships, LICENSE.md must exist and carry no lingering placeholder', () => {
    if (shippedGlbs.length === 0) {
      expect(true).toBe(true); // no asset → nothing to license
      return;
    }
    expect(licenseText.length).toBeGreaterThan(0);
    expect(PLACEHOLDER.test(licenseText)).toBe(false);
  });

  for (const key of shippedGlbs) {
    const name = fileNameOf(key);
    it(`LICENSE.md references ${name} (row presence — NOT legality)`, () => {
      // Row presence only: the filename must appear in the provenance file. The SPDX allowlist
      // (NFR1) is a human-at-download decision recorded in the row, not parsed here.
      expect(licenseText.includes(name)).toBe(true);
    });
  }
});
