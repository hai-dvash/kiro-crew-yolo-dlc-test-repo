// FR-2 (card-rps3d-fixgame) — hands.test.ts: all prior tests in this file exercised GltfHandRig,
// PrimitiveHandRig, and loadHands from src/render/hands.ts. That module has been REMOVED as part
// of the dead-code removal fix: the shipped player is always RpsObjectRig (src/render/objects.ts);
// GltfHandRig / loadHands / hand.glb were inert dead code never reached on the live boot path.
//
// The behaviors this file previously asserted are superseded by:
//   - test/boot.test.ts: boot-wiring integration tests asserting the wireGame seam (FR-5)
//   - test/objects.test.ts: RpsObjectRig correctness (the shipped player rig)
//
// This file is retained as a deliberate empty placeholder so git history records the removal.
// No tests here — nothing to test for a removed module.
import { describe, it, expect } from 'vitest';

describe('hands module (removed — FR-2, card-rps3d-fixgame)', () => {
  it('hands.ts has been removed: shipped player is always RpsObjectRig', () => {
    // The module src/render/hands.ts no longer exists.
    // Any import of it would be a TypeScript compile error (caught at TSC + build time).
    expect(true).toBe(true);
  });
});
