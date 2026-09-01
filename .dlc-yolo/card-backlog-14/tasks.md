# Tasks — card-backlog-14

**Source a licensed real rigged-hand `.glb` (RPS clips/morphs) to replace the primitive rig**

- **Card:** `card-backlog-14`  ·  **Pipeline:** `pl-rps3d`
- **Repo (owned):** `hai-dvash/kiro-crew-yolo-dlc-test-repo`
- **Issue:** [#14](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/14) — OPEN
- **Effective modes:** trust=`autonomous`, depth=`deep`, capability spawned=`dlcyolo-authoring`
- **Step crew (assigned):** `impl-agent` (break design into atomic tasks)
- **Tasks at:** 2026-09-01T10:52:00+03:00 · session/cron `2013b69a` (`dlcyolo-authoring` profile)
- **Branch:** `dlc/card-backlog-14` (single card branch — one PR per card)
- **Derives from:** `design.md` @ `494d619`, `requirements.md` (R1–R6, NFR1–NFR5) @ `5a7d0f2`;
  live source `src/render/hands.ts`, `public/assets/hands/LICENSE.md`, `test/hands.test.ts`,
  `src/main.ts`, `package.json` @ HEAD `494d619` (all re-verified present this run).

## Dispatch note (capability grounding — no faked crew run)

The step is assigned to `impl-agent` and this session was spawned as `dlcyolo-authoring`. This
runtime's tool surface is `read` / `write` / `shell` only — it does **not** hold `select_crew` /
`spawn_run` (the same empirically-confirmed finding recorded at this card's intake, investigate,
requirements, and design runs). The **tasks** step is a read-design → analyze → write-task-list
pass — exactly `dlcyolo-authoring` scope — so it is performed **inline**, grounded in the live
design + source, and recorded honestly. Per PRODUCE-OR-BLOCK this is a genuine artifact, not a
stub; the missing tool is only the crew-*dispatch* mechanism, not a tool the task-breakdown work
needs. No hard capability-gap.

## §0 — Task posture: this parent card decomposed at requirements

This is a **parent** card whose three features were already fanned out into independently-shippable
child cards at requirements (#16/#17/#18), and the design (§7) pinned a concrete build target for
each. Therefore the tasks step does **not** create new children and does **not** re-decompose. It
produces the **atomic, ordered, checkable task list** each child's `implement` step executes,
converting the design's build targets into discrete units of work with requirement traceability and
per-task acceptance. The parent's own PR carries the LICENSE/provenance + test scaffolding that isn't
child-specific; the children carry their feature slices. (All commits land on the single card branch
`dlc/card-backlog-14` — one PR per card.)

**Non-regression restated (drives task acceptance):** the engine is frozen (NFR2); every task below is
strictly additive (asset bytes + LICENSE row + tests). Any unclearable asset → `tryLoad` returns
`null` → `PrimitiveHandRig` floor. No task may edit the `HandRig` interface or `loadHands` happy path.

## §1 — Task dependency graph

```
  ┌─────────────────── Child A / #16 (f1) — source + integrate ───────────────────┐
  T1 vet+select ──► T2 place at exact path ──► T3 LICENSE row ──► T4 attribution verify
                                          │
  ┌───────────────── Child B / #17 (f2) — test harness ──────────┘ (needs T2's strategy known)
  T5 T-a non-null+strategy ─ T6 T-b isHandSkeleton (+neg fixture) ─ T7 T-c distinct poses ─ T8 T-d floor
  ┌───────────────── Child C / #18 (f3) — CI guardrail ──────────────────────────────┐
  T9 G-budget ──► T10 G-provenance ──► T11 wire into test script / CI
```

- **T5–T8 (tests)** can be authored in parallel with T1–T4 against *synthetic* gltf fixtures (the
  `GltfLoadFn` seam needs no real asset); only the *strategy-lane* assertion in T5 is finalized once
  T1 fixes which lane the sourced asset lands on.
- **T9–T11 (CI guardrail)** are asset-independent (they read whatever `.glb` + LICENSE.md ship), so
  they can land first and immediately gate T2/T3.
- Ordering coupling is minimal: **T9–T11 first (gates the rest), then T1–T4, then finalize T5**.
  T6/T7/T8 are independent of the asset entirely (synthetic fixtures).

---

## Child A / issue #16 (f1) — source + license-vet + integrate the `.glb`

### T1 — Vet + select a licensed real-hand asset (time-boxed external, C4 fallback)
- **Do:** Following `dec-cb14-viability` (CONDITIONAL-GO, time-boxed external → C4 fallback), source a
  rigged hand `.glb` from a lane: **C1** Quaternius (CC0) · **C2** Poly Pizza · **C3** Sketchfab
  (license-filtered) · **C4** author-our-own minimal finger-skeleton `.glb` (fallback if the time-box
  expires). Prefer an asset that lands as **`clips`** (three baked anims named per `SHAPE_ALIASES`)
  or **`morph`** over the coarse `bones` lane (design §2/§3).
- **Verify at download (never assert):** SPDX license ∈ {`CC0-1.0`, `CC-BY-4.0`}; **reject**
  `-SA`/`-NC`/`-ND`; redistributable; file ≤ 2 MB (prefer ≤ 500 KB, decimate if needed).
- **Traces:** R1, NFR1, NFR3 · **Size:** the bulk of f1 (M).
- **Accept:** a candidate `.glb` in hand with a confirmed permissive license and recorded source URL +
  author + attribution string; passes the four investigate gates on manual inspection.

### T2 — Place the asset at the exact drop-in path
- **Do:** Put the selected asset at **`public/assets/hands/hand.glb`** — the *exact* filename/path the
  relative loader `GltfHandRig.tryLoad('assets/hands/hand.glb')` resolves (design §3 flagged: a rename
  breaks loading; **no code change** — keep the path). Supersede the RiggedSimple placeholder as the
  active asset.
- **Traces:** R1, NFR2 (no code touched — asset bytes only).
- **Accept:** `public/assets/hands/hand.glb` is the new asset; `loadHands` on a non-Low tier resolves it;
  `npm run build` (`tsc --noEmit && vite build`) stays green; run the app and confirm a real
  `GltfHandRig` activates (not the primitive floor) — or, if the sourced asset can't clear the gate,
  confirm the primitive floor still ships with no crash (R6 regression).

### T3 — Record the provenance row in LICENSE.md
- **Do:** Append (or supersede) a row in `public/assets/hands/LICENSE.md` for the active asset:
  **asset filename, source URL, author, SPDX license, redistributable Y/N, attribution string.**
  Keep or supersede the existing RiggedSimple row accurately (it may stay as retained-not-active).
- **Traces:** R3, NFR5 (provenance-before-commit).
- **Accept:** LICENSE.md contains a row whose asset field references `hand.glb`; the G-provenance CI
  check (T10) passes against it.

### T4 — Verify attribution rendering (CC-BY only; verify-only, NO code change)
- **Do:** If the shipped asset is **CC-BY-4.0**, run the app with the real `GltfHandRig` active and
  confirm the `src/main.ts` credit line (gated on `h instanceof GltfHandRig`) renders. If **CC0**,
  confirm no credit is required and the line stays hidden. **Do not edit `src/main.ts`** — the wiring
  already exists (design §6).
- **Traces:** R4 (verification acceptance, not a code task).
- **Accept:** credit line renders iff CC-BY + real rig active; hidden for CC0 / primitive floor.

---

## Child B / issue #17 (f2) — asset-validation test harness (headless, via `GltfLoadFn` seam)

> All tests inject a synthetic `LoadedGltf` (`{ scene: THREE.Object3D, animations: AnimationClip[] }`)
> into `GltfHandRig.tryLoad(url, syntheticLoad)` — **no GLTFLoader / WebGL** (NFR4). Mirror the existing
> proven pattern in `test/hands.test.ts`. New file: `test/hand-asset.test.ts` (or extend `hands.test.ts`).

### T5 — T-a: sourced asset loads to a non-null real strategy
- **Do:** Build a synthetic `LoadedGltf` representing the sourced rig's shape; assert
  `GltfHandRig.tryLoad(url, syntheticLoad)` returns **non-null** and `.poseStrategy` equals the expected
  lane for the chosen asset (`clips` if it ships named clips, `morph`, or `bones`). Finalize the
  expected-lane assertion once T1/T2 fix the asset's lane.
- **Traces:** R5(a), Acceptance gate 2 (Plausibility) · depends on T1's lane outcome.
- **Accept:** test asserts non-null + correct `poseStrategy`; fails if detection breaks.

### T6 — T-b: `isHandSkeleton` accepts (bones lane) + negative RiggedSimple fixture
- **Do:** If the asset lands on the **`bones`** lane, build a synthetic scene of finger-named (or ≥3)
  bones and assert `tryLoad` → `'bones'` (not `null`). **Always** keep a **negative** fixture: 2 generic
  `Bone`/`Bone.001` joints (RiggedSimple-shaped) asserting `tryLoad` → `null` → primitive floor — this
  locks the regression that `card-rps3d-fix` closed so it cannot silently reopen.
- **Traces:** R5(b), NFR4, Acceptance gate 2/6 · independent of the real asset (synthetic).
- **Accept:** positive bones fixture → `'bones'`; negative 2-joint fixture → `null`.

### T7 — T-c: three poses render distinctly
- **Do:** Call `setShape('rock'|'paper'|'scissors', 1)` and assert observable per-shape state differs,
  by strategy (design §4):
  - `bones`: capture each bone's `rotation.x` after each shape → assert the three vectors are pairwise
    distinct (deterministic from `curlFor`: rock=1.4 all, paper=0 all, scissors=[0,0,1.4]).
  - `morph`: assert the influence array differs per shape (active idx → 1, others → 0 at `k=1`).
  - `clips`: assert a different `AnimationAction` is `.play()`-active per shape (spy/inspect the mixer).
- **Traces:** R2, R5(c), Acceptance gate 3 (Pose).
- **Accept:** the three pose states are pairwise distinct for the asset's active strategy.

### T8 — T-d: regression floor
- **Do:** Assert `GltfHandRig.tryLoad` on a **throwing/empty** loader → `null`, and the `loadHands`-level
  contract stays `PrimitiveHandRig` (complements T6's negative fixture).
- **Traces:** R6 (regression floor), NFR2 · independent of the real asset.
- **Accept:** unclearable/broken loader never crashes; primitive floor ships.

---

## Child C / issue #18 (f3) — budget + provenance CI guardrail

> New headless vitest suite `test/asset-budget.test.ts` over shipped repo files (Node `fs`, no browser).
> Asset-independent — reads whatever `.glb` + LICENSE.md ship — so it can land first and gate T2/T3.

### T9 — G-budget: enforce ≤ 2 MB (NFR3)
- **Do:** If `public/assets/hands/hand.glb` exists, assert `fs.statSync(path).size <= 2 * 1024 * 1024`
  (2 MB hard). Optionally `console.warn` above the recommended 500 KB soft budget. If the asset is
  absent, the assert passes trivially (legal no-asset build).
- **Traces:** R6, NFR3, Acceptance gate 4 (Budget).
- **Accept:** an oversized `hand.glb` fails the build; today's 15 KB / any ≤2 MB asset passes; no asset passes.

### T10 — G-provenance: every shipped `.glb` has a LICENSE.md row (NFR5)
- **Do:** For every `*.glb` under `public/assets/hands/`, assert `LICENSE.md` contains a row referencing
  that filename. Makes "an asset entered the repo without a LICENSE row" a **build failure**. Do **not**
  attempt to parse/validate license legality from the `.glb` (not machine-checkable) — assert *row
  presence* only; the SPDX allowlist (NFR1) stays a human-at-download call recorded in the row.
- **Traces:** R6, NFR5, NFR1 (presence-only split), Acceptance gate 1 (License).
- **Accept:** a `.glb` with no matching LICENSE row fails; all rows present → pass.

### T11 — Wire the guardrail into the test/CI run
- **Do:** Ensure `test/asset-budget.test.ts` runs under the existing `npm test` (`vitest run`) — no new
  script needed (vitest auto-discovers `test/*.test.ts`). Confirm the guardrail executes in the same
  green suite as T5–T8.
- **Traces:** R6 (enforced as CI, not honor system).
- **Accept:** `npm test` runs the budget+provenance asserts alongside the harness tests; the full suite is green.

---

## §2 — Global acceptance (parent card exit criteria)

The parent card's PR is complete when, on branch `dlc/card-backlog-14`:

1. **License gate** — shipped asset is CC0 or CC-BY-4.0 with a provenance row (T3); G-provenance green (T10).
2. **Plausibility gate** — asset clears `tryLoad` to a non-null strategy (T2/T5); if `bones`, `isHandSkeleton` accepts (T6).
3. **Pose gate** — rock/paper/scissors render distinctly (T7).
4. **Budget gate** — `hand.glb` ≤ 2 MB (T9).
5. **Attribution gate** — credit line renders iff CC-BY + real rig active (T4).
6. **Regression floor** — breaking/removing the asset still ships `PrimitiveHandRig`, no crash (T6/T8).
7. **Build + test green** — `npm run build` (`tsc --noEmit && vite build`) and `npm test` (`vitest run`) both pass.
8. **NFR2 honored** — `HandRig` interface + `loadHands` happy path UNCHANGED (git diff shows only asset bytes, LICENSE row, and `test/*.test.ts` additions).

## §3 — Effort attribution & back-step check

Per-task sizing (points): T1=**2**, T2=**S/1**, T3=**S/1**, T4=verify (~0.5→**1**) · T5=**1**, T6=**1**,
T7=**1**, T8=**1** (harness ≈ f2 M/3) · T9=**S**, T10=**S**, T11=trivial (guardrail ≈ f3 S/1).
Rolled to the three features: **f1 = 3 (M), f2 = 3 (M), f3 = 1 (S)** → **`effort.scope[tasks] = 7`**.

This is the **same** scope as requirements (7) and design (7): tasks *detailed* the design's build
targets into atomic units without introducing new features or scope — the count is inherited, not grown.

- **Back-step heuristic (deep `GROWTH_FACTOR = 3.0`):** predecessor `design` scope = 7.
  `scope[tasks] (7) > 3.0 × 7 (=21)`? **NO** — no back-step. Tasks did not outgrow design.
- **No feature parked** — no new feature surfaced; the three children already carry the work.

## §4 — Decision gate

**No new decision gate raised.** Self-check: (a) the task list serves intent — it converts the design's
integration targets into atomic, traceable, checkable units for the three children, nothing more; (b) no
entities introduced that design didn't sanction (tasks map 1:1 onto design §7's #16/#17/#18 build
targets and the two literal test files; no new files, no new children); (c) no implicit consequential
technical choice — the one real fork (external-vs-author) was raised + auto-resolved at investigate
(`dec-cb14-viability`) and inherited here; (d) capability-gap: the missing tool is only the crew
*dispatch* mechanism (handled inline per PRODUCE-OR-BLOCK, §Dispatch note), not a tool the task-breakdown
work needs. Clean serve → no gate.

## §5 — Handoff

Tasks complete — atomic breakdown (T1–T11) grounded in live design (`494d619`) + source
(`hands.ts`, `LICENSE.md`, `test/hands.test.ts`, `main.ts`, `package.json`, all re-verified present this
run), strictly additive (NFR2), non-regression structural. Each task carries requirement traceability +
per-task acceptance and maps to the already-filed children #16 (f1: T1–T4) / #17 (f2: T5–T8) / #18
(f3: T9–T11). **No new child cards** (fan-out happened at requirements; re-fanning would duplicate).
Written to the durable results area and mirrored to the repo (`.dlc-yolo/card-backlog-14/tasks.md`,
`results_in_repo=true`) on the single card branch `dlc/card-backlog-14`.

Under `trust=autonomous`, the downstream `gate-impl` auto-approves; the next pipeline step is
`implement` — but this parent card stays `handed-off` and its own implement is thin: the actual feature
implementation lives in children #16/#17/#18 (each runs its own investigate→…→pr ladder). This parent
retires only when all three children are `consumed`. `step_status['tasks'] = done`.
