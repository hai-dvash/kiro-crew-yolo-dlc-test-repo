# Implement — card-backlog-14 (parent, thin-slice)

**Source a licensed real rigged-hand `.glb` (RPS clips/morphs) to replace the primitive rig**

- **Card:** `card-backlog-14` · **Pipeline:** `pl-rps3d` · **Issue:** [#14](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/14) (OPEN)
- **Effective modes:** trust=`autonomous`, depth=`deep`, capability=`dlcyolo-builder`
- **Branch:** `dlc/card-backlog-14` (single card branch — one PR per card)
- **Derives from:** `tasks.md` (T1–T11) @ `6b9d68f`, `design.md` @ `494d619`, `requirements.md` (R1–R6, NFR1–NFR5) @ `5a7d0f2`
- **Grounded in live source:** `src/render/hands.ts` (HandRig / PrimitiveHandRig / GltfHandRig, `tryLoad` clips→morph→(bones ∧ isHandSkeleton)→null ladder, `GltfLoadFn` seam, `curlFor`, `SHAPE_ALIASES`), `public/assets/hands/{LICENSE.md, hand.glb 15104B RiggedSimple}`, `test/hands.test.ts` (proven harness), `package.json` (test=`vitest run`, build=`tsc --noEmit && vite build`).

## §0 — Posture: this is a decomposed parent; its implement is the shared, asset-independent slice

The card fanned out at **requirements** into three independently-shippable child tickets
(#16 f1 / #17 f2 / #18 f3). Per `tasks.md` §0, the **parent's own PR carries the test/CI scaffolding
that isn't child-specific**; the children carry their feature slices. The one child-specific,
human/external unit — **sourcing + license-vetting a real `.glb` (T1/#16)** — is deliberately NOT done
here (it is an at-download human decision under `dec-cb14-viability`'s time-boxed-external + C4 fallback).
Faking an asset hunt would violate PRODUCE-OR-BLOCK; instead the parent produces the genuinely-buildable,
**strictly additive (NFR2)** guardrail + harness that regression-lock the acceptance gates NOW, and the
asset itself lands on the same branch via child #16.

## §1 — Produced (real, additive, green)

Two new headless vitest suites (auto-discovered by `npm test` — **T11** needs no new script):

1. **`test/asset-budget.test.ts`** — the **f3 / #18** CI guardrail:
   - **T9 · G-budget (NFR3):** every shipped `*.glb` under `public/assets/hands/` is asserted ≤ **2 MB**
     (hard) with a 500 KB soft-budget `console.warn`. A no-asset build passes trivially (legal primitive floor).
   - **T10 · G-provenance (NFR5):** every shipped `*.glb` must have a matching row in `LICENSE.md`, and
     no lingering placeholder may remain once an asset ships. **Row presence only** — SPDX legality (NFR1)
     stays a human-at-download call recorded in the row, not parsed from bytes.
   - Asset-**independent** (reads whatever ships: today the 15 KB RiggedSimple, tomorrow child #16's real asset),
     so it lands first and immediately gates T2/T3.

2. **`test/hand-poses.test.ts`** — the **f2 / #17** Pose-distinctness harness (**T7 / T-c**, R2, design §4),
   the one acceptance gate `hands.test.ts` did not already cover (it covers detection T5, the
   plausibility gate + negative RiggedSimple fixture T6, and the null floor T8):
   - **morph:** each shape drives its own influence toward 1 and the others toward 0 → three pairwise-distinct vectors.
   - **bones:** each shape drives a distinct per-bone curl vector (`curlFor` rock/paper/scissors all differ).
   - **clips:** all three shapes are independently drivable and cross-fade without throwing (numeric distinctness
     is proven by the morph + bones cases; the mixer/actions are private).
   - Fully headless via the injectable `GltfLoadFn` seam (NFR4) — no GLTFLoader / WebGL.

## §2 — Deferred to children (NOT done here — by design, not a block on the parent)

- **T1–T4 (#16 f1):** source + license-vet + place `public/assets/hands/hand.glb` at the exact drop-in path +
  LICENSE row + CC-BY attribution verify. **T1 is a human/external at-download decision** (or C4 author-our-own);
  the child card runs its own ladder. When the real asset lands, the guardrail (this PR) already gates it.
- **T5/T6/T8 (#17 f2):** already satisfied by the pre-existing `test/hands.test.ts`; T7 was the gap, closed here.

## §3 — Verification (this run)

- `npm test` → **10 files, 64 passed** (was 57; +7 from the two new suites). Baseline re-confirmed green before adding.
- `npm run build` (`tsc --noEmit && vite build`) → **clean** (pre-existing rapier chunk-size warning only, unrelated).
- **NFR2 honored:** `git status` shows ONLY the two new `test/*.test.ts` files — **zero edits to `src/` or `public/`**
  (engine + `HandRig` interface + `loadHands` happy path UNCHANGED). A spurious mirror-drift in `tasks.md` was reverted
  so the commit is single-purpose.

## §4 — Effort & back-step

`effort.scope[implement] = 2` (the shared slice actually built: pose harness ≈ 1 + budget/provenance guardrail ≈ 1;
the bulk f1/f2 points remain in the children, not consumed by this thin parent slice). Predecessor `design`/`tasks`
scope = 7. Deep `GROWTH_FACTOR = 3.0`: `2 > 3.0 × 7`? **NO** — the parent implement did not outgrow its predecessor
(it under-ran, as expected for a decomposed parent). No back-step, no feature parked.

## §5 — Decision gate

**No new decision gate raised.** (a) The artifact serves intent — it regression-locks NFR3/NFR5/R2 with strictly
additive tests and defers the one genuine human/external unit (asset sourcing) to the child that owns it, per the
design. (b) No unseen scope: the two suites map 1:1 onto tasks T7 + T9/T10/T11; the T1 external-vs-author fork was
raised + auto-resolved at investigate (`dec-cb14-viability`) and inherited. (c) No implicit consequential choice.
(d) Capability: `dlcyolo-builder` holds `read`/`write`/`shell` — sufficient for authoring + running tests + git;
no crew-dispatch tool was needed (the buildable work is inline builder scope). Clean serve → no gate.

## §6 — Handoff

Parent implement complete for its shared slice. Card stays `lifecycle=handed-off` — it retires only when children
#16/#17/#18 are `consumed`. Under `autonomous`, `step_status['implement']='done'`; the advance cron relabels
`dlc:implement → dlc:review` and escalates review next. The children run their own ladders to source the real asset
and land it against this PR's guardrail.
