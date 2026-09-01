# Tasks — card-kiro-crew-yolo-dlc-test-repo-23 (f1, child of #22)

**Issue:** [#23](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/23) —
`[card-rps3d-objects · f1] Throwable RPS object-rig + opponent-object render path`
**Parent:** #22 (card-rps3d-objects), the DEEP-decomposed RPS-object visual redesign (Order-4 proof).
**Step:** tasks · **Pipeline:** pl-rps3d · **Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Effective modes:** trust=assisted (inherited: card.trust=null → pipeline assisted) · depth=**deep** · capability=dlcyolo-authoring
**Grounded in live source @ branch `dlc/card-kiro-crew-yolo-dlc-test-repo-23` @ 374ee17** (based off origin/main dcdb2e4) + live GitHub (issue #23 OPEN, author hai-dvash == gh-auth, ownership guard PASS).

---

## 0. Dispatch grounding (no faked crew run)

Spawned under capability `dlcyolo-authoring` (step assigned to impl-agent "break design into atomic
tasks"). This runtime's tool surface is **read/write/shell only** — no `select_crew`/`spawn_run`
(consistent with every prior step on this pipeline). The tasks step is a
read-design → analyze → write-task-list pass = exactly `dlcyolo-authoring` scope, so it is **performed
inline** per the PRODUCE-OR-BLOCK contract, grounded in live design + source. NOT a capability-gap: the
missing tool is only the crew-dispatch mechanism, not one task-breakdown needs.

## 1. Objective

Turn design.md (§3 concrete design, FORK D1-D4 resolved) into an ordered set of **atomic, verifiable
implementation tasks** for the implement step. f1 delivers two render entities — a **throwable RPS
object-rig** (player visual, replaces the hand) and a **new opponent-object render path** — plugged into
the existing `wireGame` seam with **zero structural change** and the **F1-FIRST** invariant intact.

**LOAD-BEARING invariant carried to every task (NFR1):** `RoundMachine.submit()` synchronously
`pickOpponent()`→`resolve()`→commits `playerShape`/`opponentShape`/`result`→`phase='resolved'`→`emit()`
(verified live `src/round/machine.ts:82-99`). The player object-rig AND the opponent object are
**committed-result CONSUMERS** — they subscribe AFTER commit, like `HandRig`/`juice` today. No task may
(1) relocate `pickOpponent()` out of `submit()`, or (2) couple the committed result/`opponentShape` to
render or animation timing.

**Additive touch set (NFR2), enforced by every task's Verify:**
- **NEW** `src/render/objects.ts`
- **NEW** `test/objects.test.ts`
- **EDIT** `src/main.ts` (swap the `loadHands` dep → `loadObjects`; add opponent object build + `onChange`
  drive) — additive within the render/wiring layer
- **ZERO edits** under `src/round/**`, `src/rules.ts`, `src/types.ts` (import-only), `src/a11y/**`,
  and `src/render/hands.ts` (interface imported, not modified).

---

## 2. Atomic tasks (T1–T7)

### T1 — Create `src/render/objects.ts`: parametric geometry builders (FORK D1)
**Do:** New module. Add three private geometry-builder functions using primitive Three.js geometry +
`MeshStandardMaterial` (matches the existing PBR scene, per `createScene`):
- `makeRock()` → `THREE.IcosahedronGeometry` (detail 0), high roughness → faceted stone.
- `makePaper()` → thin flat `THREE.BoxGeometry(w, h, ~0.02)` → a sheet.
- `makeScissors()` → two elongated boxes rotated into an X, grouped → the scissors "V".
Each returns a `THREE.Object3D` (Mesh or Group).
**Verify:** `tsc --noEmit` clean; no import of any asset/loader; no new npm dependency (R5).
**Traces:** R5 (zero new dep), R3 (reads as RPS), design §3.1 / FORK D1.
**Accept:** three distinct primitive silhouettes, `MeshStandardMaterial`, no async, no asset.

### T2 — `RpsObjectRig implements HandRig` (FORK D2)
**Do:** In `src/render/objects.ts`, add `class RpsObjectRig implements HandRig` (import the interface
from `./hands` — import only, no edit to hands.ts). Hold the three child meshes from T1 parented under a
`THREE.Group object`. Implement:
- `object: THREE.Object3D` (the group);
- `setShape(shape: Shape, t: number): void` — **active-object select + emphasis tween**: show the
  `shape` mesh, decay the other two toward hidden; interpolate the active mesh's emphasis scale by
  clamped `t∈[0,1]` (same normalized `poseT` the hand used — behavior-preserving of the RAF call site
  `hands.setShape(st.playerShape, poseT*0.2)`). No per-frame coupling to the machine/result.
- `dispose(): void` — traverse + dispose geometries (mirror `PrimitiveHandRig.dispose`).
Constructor initializes to `setShape('rock', 1)` (mirrors the primitive baseline). Add
`export function makeRpsObjectRig(): RpsObjectRig`.
**Verify:** `tsc --noEmit` clean; type-checks against the LIVE `HandRig` interface
(`object`/`setShape(shape,t)`/`dispose`) so it drops into `wireGame` unchanged.
**Traces:** R1 (object-rig satisfies HandRig contract), R4 (same seams), NFR5 (always-ships baseline),
design §3.1 / FORK D2.
**Accept:** `new RpsObjectRig()` exposes `object`/`setShape`/`dispose`; `setShape('paper',1)` selects
paper and decays rock/scissors; no `submit`/machine reference anywhere in the module.

### T3 — `loadObjects(tier)` async seam (drop-in for `loadHands`)
**Do:** In `src/render/objects.ts`, add
`export async function loadObjects(_tier: QualityTier): Promise<HandRig> { return new RpsObjectRig(); }`
(import `QualityTier` from `../config`). Signature IDENTICAL to `loadHands(tier): Promise<HandRig>` so
`wireGame({ loadHands })` consumes it with no structural change. Parametric rig always constructs — never
returns null (it IS the always-ships floor; a future sourced-mesh upgrade slots behind this same seam).
**Verify:** `tsc --noEmit` clean; return type is `Promise<HandRig>` matching `loadHands`.
**Traces:** R1 (wireGame consumes with no structural change), NFR5 (never-null floor), design §3.1.
**Accept:** `loadObjects` and `loadHands` are signature-interchangeable.

### T4 — Wire the PLAYER rig in `src/main.ts` (swap `loadHands` → `loadObjects`)
**Do:** In `boot()`, change the `wireGame` dep from
`loadHands: () => loadHands(bootTier) as Promise<WireRig>` to
`loadHands: () => loadObjects(bootTier) as Promise<WireRig>` (import `loadObjects` from
`./render/objects`). The RAF loop line `if (hands && st.playerShape) hands.setShape(st.playerShape, poseT*0.2)`
is UNCHANGED — it now poses the object rig (behavior-preserving). Leave the `GltfHandRig` credit block as
is (dead for the object rig, harmless; do not delete hands.ts).
**Verify:** `tsc --noEmit && vite build` clean; git diff of `main.ts` shows only the dep swap + the T5
opponent additions (no other logic touched); `render(s)` byte-for-byte unchanged.
**Traces:** R1 (player object is the visual), R4/NFR2 (no wireGame structural change), design §3.2.
**Accept:** the player's committed `playerShape` renders as the object; framing/scale path unchanged.

### T5 — NEW opponent-object render path in `src/main.ts` (FORK D3 + D4, committed-result consumer)
**Do:** In `boot()`: build `const opponent = makeRpsObjectRig();`, add `opponent.object` to the scene
(`scene3d.scene.add(opponent.object)`) at a fixed offset transform (e.g.
`opponent.object.position.set(0, 0, -3)` — set back from the player; final offset is a tuning knob).
Inside the EXISTING `machine.onChange((s) => …)` block, in the `s.phase === 'resolved' && s.result`
branch, add `if (s.opponentShape) opponent.setShape(s.opponentShape, 1);` — a committed-result consumer,
alongside the existing `render(s)` + `juice.onResult(...)`. The opponent object starts hidden (meshes
invisible until `setShape` shows one) — also the seam f3's board later hides. Do NOT add the opponent to
`computeRigScale`/`frameObject` (keeps `wireGame`'s single-object framing intact).
**Verify:** `tsc --noEmit && vite build` clean; diff shows the opponent lines only in `boot()`/`onChange`,
NOT in `submit()`; `pickOpponent()` still lives solely in `machine.ts` (grep confirms).
**Traces:** R2 (opponent-object path), NFR1 (F1-first: driven off committed `opponentShape` in the
subscriber, never at pick time), design §3.2 / FORK D3+D4.
**Accept:** opponent object reflects committed `opponentShape` on resolve; hidden before resolve; no
result↔render timing coupling.

### T6 — NEW `test/objects.test.ts`: headless NFR4 regression (closes the broken-green gap)
**Do:** New node-env, DOM/WebGL-free test file reusing the `wireGame` injected-fake seam + the
`makeHarness` pattern from `test/main.test.ts`. Three assertions (design §4):
1. **Contract + wiring:** `new RpsObjectRig()` exposes `object`/`setShape`/`dispose`; feed
   `loadHands: async () => rig` into a harness `WireDeps`; `await wireGame(deps).loaded`; assert the rig
   object is **added** to the scene, **scaled** (`scaleApplied` non-empty), and **framed** (`framed` gets
   the measured center/radius) — mirrors `main.test.ts` (a)/(d)/scale. No THREE/WebGL required for the
   rig-state assertions; if constructing `RpsObjectRig` pulls THREE, that's fine (three is a dep) but keep
   assertions on structure, not WebGL.
2. **`setShape` selects active object, no machine touch:** `rig.setShape('paper',1)` then
   `rig.setShape('scissors',1)`; assert the active mesh is emphasized/visible and the others decay toward
   hidden — pure rig-state assertion, no `submit`/machine call.
3. **Opponent path off committed `opponentShape`, `submit()` untouched:** drive a `RoundMachine` with an
   injected deterministic `pickOpponent`; subscribe a test-double opponent rig via `onChange`; `submit` a
   confident `GestureResult`; assert the double's `setShape` is called with `machine.getState().opponentShape`
   FROM the subscriber, and that `opponentShape` is committed BEFORE the subscriber observes it (proves
   committed-result consumer; `submit`/`pickOpponent` unchanged).
**Guard-bites (implement acceptance):** breaking F1-first (deriving opponent shape at render time) or
breaking the `HandRig` contract MUST turn a test RED — verify by a temporary break, then restore green.
**Verify:** `npm test` — the new suite passes and the FULL suite stays green (baseline + new file); a
deliberate F1-first break flips a case RED (guard bites), then reverts.
**Traces:** NFR4 (regression on the untested render surface), R1/R2/NFR1, design §4.
**Accept:** 3 cases green; guard-bites demonstrated; no reliance on a real DOM/WebGL/document.

### T7 — Global gate: build + full suite + additive-only diff
**Do:** Run the project gate on the branch: `npm run build` (tsc --noEmit && vite build) and `npm test`.
Confirm the NFR2 additive-only diff: `git diff --name-only origin/main..HEAD` (code/test) = EXACTLY
`src/render/objects.ts` (new) + `test/objects.test.ts` (new) + `src/main.ts` (edit); a protected-surface
guard over `src/round/**`, `src/rules.ts`, `src/types.ts`, `src/a11y/**`, `src/render/hands.ts` returns
EMPTY. `render(s)` and `submit()` diffs confirm no behavioral coupling.
**Verify:** build clean (pre-existing rapier chunk-size warning is acceptable); full vitest suite green
(baseline 64 + new cases); protected-surface guard empty.
**Traces:** NFR2 (additive-only), NFR1 (no core edits), all acceptance criteria.
**Accept:** green build + green suite + diff-confirmed additive-only single-card change on
`dlc/card-kiro-crew-yolo-dlc-test-repo-23`.

---

## 3. Dependency graph

```
T1 (geometry builders)
  └─> T2 (RpsObjectRig implements HandRig)
        ├─> T3 (loadObjects async seam)
        │     └─> T4 (main.ts: swap player dep)
        └─> T5 (main.ts: opponent object path)  [needs makeRpsObjectRig from T2]
T4, T5 ──> T6 (objects.test.ts NFR4 regression)
T1..T6 ──> T7 (global gate: build + suite + additive diff)
```
T4 and T5 both edit `main.ts` and should land together (one cohesive render swap). T6 depends on the
rig (T2) and the wiring (T4/T5); T7 is the final gate.

## 4. Global acceptance (f1 exit — maps 1:1 to requirements §4 / design §7)

1. tasks.md produced + committed on `dlc/card-kiro-crew-yolo-dlc-test-repo-23` (this file). ✔ this step.
2. R1: `RpsObjectRig` satisfies the live `HandRig` contract; `wireGame` consumes `loadObjects` with NO
   structural change (T2/T3/T4).
3. R2: opponent's committed `opponentShape` renders as a distinct object entity (T5).
4. NFR1: `pickOpponent()` stays in `submit()`; opponent driven from the `onChange` consumer; no
   result↔render/animation timing coupling; `round.test.ts`/`render-physics.test.ts` still green (T5/T6/T7).
5. NFR2: additive-only diff — zero edits under `src/round/**`, `rules.ts`, `types.ts` (import-only),
   `src/a11y/**`, `src/render/hands.ts` (T4/T5/T7).
6. NFR4: headless `wireGame`-seam regression asserts the object-rig contract + opponent path, guard-bites
   verified, added to a green suite (T6).
7. `step_status['tasks'] = done`.

## 5. Decision-gate self-check (§3a/§3b)

- **Intent-fidelity:** tasks serve both the literal ask (throw the actual objects; opponent as an object)
  and the underlying intent (the redesign reads instantly as RPS). ✔
- **Scope-drift / unseen scope:** every task lands inside the sanctioned additive touch set (objects.ts +
  objects.test.ts + main.ts). No new entity beyond design §3. ✔
- **Technical fork:** the four real forks (D1-D4) were resolved at design; tasks only sequences them —
  the offset transform / geometry dimensions / emphasis-scale magnitude are implement TUNING knobs guarded
  by the NFR4 test, not human-only pipeline forks. ✔
- **Capability-gap:** the missing crew-dispatch tool is not a task-breakdown capability need. ✔
- **Ask-before-done:** the one consequential structural fork (single-card vs fan-out) was answered by the
  human interjection at the parent #22; f1 exists because of it. No un-asked, human-only blocking question
  remains → no `ask_question`, no new decision-gate entry.

## 6. Effort & back-step

`effort.features = [f1 M/3]`; `effort.total = 3`; `effort.scope[tasks] = 3` (foundation slice broken into
atomic tasks, NOT grown vs investigate=3 / requirements=3 / design=3). depth=deep GROWTH_FACTOR=3.0;
back-step check: scope[tasks]=3 > 3.0 × scope[design](=3) = 9? **NO.** No feature parked. No new child
fan-out (f1 is a cohesive foundation slice; the single-card decision is inherited from the parent).

## 7. Handoff

NEXT = **gate-impl** — a human gate on this assisted card. The advance cron does NOT auto-approve under
trust=assisted; it PARKS the gate for a human to approve the task list before implement runs. On approval,
implement lands T1–T7 on the SAME branch `dlc/card-kiro-crew-yolo-dlc-test-repo-23` → ONE parent-child PR.
f1 must LAND FIRST — it is the foundation f2 (#24, pop) and f3 (#25, board/reveal) both depend on; parent
#22 retires only when f1/f2/f3 are all consumed.
