# Review — card-rps3d-fix

**Card:** Game visually broken: green-cylinder hand, no camera framing, dead gesture input
**Issue:** [#13](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/13) · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Under review:** `feat/card-rps3d-fix-implement` @ `1e10a95` (implement artifact) vs baseline `main` @ `719c6eb`
**Mode:** trust=autonomous · depth=deep (adversarial) · capability=dlcyolo-authoring
**Verdict: PASS — no Critical / High / Medium. One non-blocking LOW (informational, not parked).**

---

## Method (grounded + independently re-verified, not trusted)

Fresh read-only clone of the owned repo; checked out `feat/card-rps3d-fix-implement` (tip `1e10a95`).
Read the actual changed source (not the implement paraphrase) and **independently re-ran every gate**
in the sandbox rather than trusting the implement note:

- `npx tsc --noEmit` → **exit 0** (clean).
- `npx vite build` → **exit 0** (clean; only the benign Three.js large-chunk advisory).
- `npx vitest run` → **57 passed / 57** across 8 test files.
- **RED-on-baseline PROVEN:** overlaid the new/changed test files (`hands`, `framing`, `gesture`,
  `main`) + `framing.ts` onto a clean `main` @ `719c6eb` worktree (baseline source, no fixes) and ran
  vitest → **exactly 8 targeted assertions FAILED** (2×R6.1 hand-gate, 1×R6.3 confidence, 5×R6.4
  wireGame boot), while all invariance assertions (argmax, monotonicity, 5-finger no-false-negative)
  **passed on both** trees. So each guarding test genuinely locks its regression — none are no-op.

Diff scope (`git diff --name-status main..HEAD`) is exactly the tasks.md plan, no stray files:
`src/render/hands.ts` · `src/render/framing.ts` (new) · `src/render/scene.ts` · `src/gesture/classifier.ts`
· `src/gesture/capture.ts` · `src/main.ts` · `public/assets/hands/LICENSE.md` + 4 test files + the
`.dlc-yolo/card-rps3d-fix/` artifact mirror.

## Requirements traceability

| Req | Verdict | Evidence |
|-----|---------|----------|
| **R1** hand ≠ bar | ✅ | `isHandSkeleton` narrows the finger regex to DROP the generic `bone` token → requires a finger-named bone OR ≥`MIN_FINGER_BONES=3`. RiggedSimple's 2 generic joints (`Bone`/`Bone.001`) clear neither → `bones` rejected → ladder falls to `null` → `PrimitiveHandRig` ships. `findFingerBones`/ladder/interface untouched. RED-on-old: 2 assertions fail on baseline. |
| **R2 / NFR5** provenance | ✅ | `LICENSE.md` reconciled: RiggedSimple row status = *present but NOT active rig* (retained for a future real-hand card); CC-BY credit correctly inert. NFR5 G1 gate still satisfied (non-placeholder row). |
| **R3** camera fit / scale | ✅ | new `framing.ts`: pure `computeFraming` (dual-FOV — frames against the tighter of vertical/horizontal half-angle so portrait AND landscape fit) + `computeRigScale`. No per-asset constants, no WebGL. `Scene3D.frameObject` called on load + in `resize()`, **not** in the RAF loop (NFR4). |
| **R4** gesture confidence (behavior-preserving) | ✅ | Lever 1 (capture): `onsetSpeed 0.35→0.28`, `releaseMs 90→120` — capture-side only, no scoring change. Lever 2 (classifier): denominator `(top+runnerUp+EPS)→(top+EPS)` — a **monotonic rescale of the same (top−runnerUp) gap**, `Math.max(0,Math.min(1,…))` clamped, so it is `≥` the old value and **never reorders** which shape wins. `score()` + rules UNTOUCHED. Lever 3 (common-mass trim) correctly NOT applied (design hard-gate: empirically lowered paper confidence, helped nothing). |
| **R5** primitive + a11y + all tests green | ✅ | `PrimitiveHandRig` + `createFallback` intact; 57/57 green. |
| **R6** (mandatory, deep) close untested render/boot surface | ✅ | R6.1 asset-strategy guard, R6.2 framing math, R6.3 confidence regression, R6.4 boot/wiring smoke — all present, each RED-on-`719c6eb` / GREEN-on-fix (the R6.2 math is invariant; its RED is the missing `framing.ts` module on baseline). |
| **NFR1/3/4/6** | ✅ | Licensing gate holds; asset ~15 KB ≪ 2 MB; boot non-blocking (Box3 fit on load/resize only); single owned repo, behavior-preserving core. |

## Design fidelity

- **wireGame boot seam (R6.4, the meta fix):** `boot()`'s untestable load→scene-add→scale→frame +
  engine/fallback→machine wiring is extracted into a DOM/WebGL-free `wireGame(deps)` with injected
  collaborators; `boot()` is the thin real-DOM adapter. Single `submit` sink feeds BOTH `engine.onResult`
  and the a11y fallback (single source of truth). Auto-boot guarded on `typeof document !== 'undefined'`
  so the module is import-safe under test. Runtime browser behavior is identical — a genuine
  behavior-preserving refactor, and precisely the seam that makes the three defects catchable.
- **Confidence math** is the correct minimal correct lever: monotonic winner-preserving rescale, not a
  rules rewrite — matches design §5 exactly.
- **Framing** is asset-agnostic geometry with the caller (`Scene3D`) owning all THREE objects — matches
  design §4.

## Findings

**LOW-1 (informational, NOT parked, no action):** `findFingerBones` still gathers bone candidates with a
name-regex-OR-`isBone` heuristic and `setShapeBones` applies a flat `curl[i % curl.length]` cycle. Fine
and within R4 for the shipped path (RiggedSimple is now *rejected*, so `PrimitiveHandRig` ships and this
code is inert), but a future 5-finger real-hand asset would not map curl per-finger. This is already the
subject of the real-rigged-hand backlog item ([#14](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/14));
no new ticket needed.

## Scope / back-step

`effort.scope[review]=2` (read + independent gate re-run + RED-on-old proof) vs `scope[implement]=8`.
No growth; deep `GROWTH_FACTOR=3.0` back-step check (`review > 3×implement`?) → **no back-step**.

## Decision gate

**NOT raised.** Intent-fidelity OK (the fix repairs all three reported defects AND closes the meta
untested-surface root cause that let them ship green — the exact learned-lesson class); no unseen scope
(framing.ts + wireGame are design-mandated); no implicit technical fork left open; no capability-gap for a
review pass (read + independent build/test within authoring scope).

## Recommendation

**PROCEED to gate-review → pr.** Under trust=autonomous, gate-review auto-approves (no Critical/High);
a human may still interject. The `pr` step should open ONE PR (`Closes #13`) from the single card branch
`dlc/card-rps3d-fix`.
