# Investigation — card-backlog-14 (viability + licensing go/no-go)

- **Card:** `card-backlog-14`
- **Pipeline:** `pl-rps3d`
- **Repo (owned):** `hai-dvash/kiro-crew-yolo-dlc-test-repo`
- **Issue:** [#14](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/14) — OPEN
- **Title:** Upgrade: source a licensed real rigged-hand `.glb` (RPS clips/morphs) to replace the primitive rig
- **Effective modes:** trust=`autonomous`, depth=`deep`, capability resolved=`dlcyolo-coordinator`
- **Step crew (assigned):** `dlcyolo-rps3d-market` (profile `dlcyolo-readonly`) + one matching addendum (same crew, "viability + monetization go/no-go", writes `artifacts.investigation`)
- **Investigate at:** 2026-09-01T09:06:00+03:00
- **Investigate by:** dlc-yolo · investigate step-agent (session `bfcb7397`, coordinator profile)

## Ownership guard

PASS. Issue #14 author `hai-dvash` (`is_bot:false`) == gh-auth user `hai-dvash`
(`config.trusted_authors` unset → default `[hai-dvash]`). Re-verified live at this run
(`gh api user` → `hai-dvash`; `gh issue view 14 --json author,state` → author `hai-dvash`,
state `OPEN`). Fail-closed satisfied.

## Dispatch note (capability grounding — no faked crew run)

The step is crew-assigned to `dlcyolo-rps3d-market` and this session was spawned as
`dlcyolo-coordinator`, which per the task text should hold `select_crew` / `spawn_run`. In
THIS runtime those crew-routing MCP tools are **not present** in the tool list (calling
`spawn_run`/`select_crew` returns "a tool with the name ... does not exist"); only
`read` / `shell` / `write` are wired. Per the PRODUCE-OR-BLOCK contract, a run that lacks
crew-routing tools **performs the step inline** rather than faking a crew run or silently
downgrading. The `investigate` step is a **read-only research / classification pass**
(viability + licensing go/no-go) — exactly the work the assigned crew (a `dlcyolo-readonly`
profile) would do, and it needs only read + shell + write, all of which this coordinator
session holds (superset). So the step is performed inline here, grounded in the live repo +
GitHub, and this is recorded honestly rather than escalated as a hard block. (A true
capability gap would be a step needing a tool NO available profile can supply; here the
tool that is missing is only the *dispatch* mechanism, and the underlying research does not
require it.)

## What actually needs doing (grounded in live source)

The engineering is **already complete and asset-shape-agnostic** — confirmed by reading
`src/render/hands.ts` on `dlc/card-backlog-14`:

- `HandRig` interface + `PrimitiveHandRig` (always-legal floor) + `GltfHandRig` all exist.
- `GltfHandRig.tryLoad` runs a **capability ladder**: `clips → morph → bones → null`, so it
  works regardless of how a sourced `.glb` expresses the three poses.
- The hand-plausibility gate `isHandSkeleton(bones)` accepts a skeleton iff **either** a
  bone is finger-named (`/finger|index|middle|thumb|ring|pinky/`) **or** there are
  `>= MIN_FINGER_BONES (=3)` bones. The generic `bone` token was deliberately dropped, so
  Khronos RiggedSimple's 2 generic joints are rejected.
- `SHAPE_ALIASES` already matches clip/morph names loosely: rock←`rock|fist|closed`,
  paper←`paper|open|flat|hand`, scissors←`scissors|peace|victory|two`.
- The NFR5 provenance gate (`public/assets/hands/LICENSE.md`) and the gated CC-BY credit
  line (`h instanceof GltfHandRig` in `src/main.ts`) are wired and inactive-by-design.
- Current asset: `public/assets/hands/hand.glb` = Khronos **RiggedSimple**, CC-BY-4.0,
  ~15 KB — retained, redistributable, but correctly rejected (not a hand).

**Therefore the work is purely: source + vet + drop in a licensed real-hand `.glb`.** No new
code is required for the happy path; the sourced asset auto-activates `GltfHandRig` when it
clears the ladder. This makes the *licensing + plausibility + pose* research the entire
substance of the card — which is why it warrants this investigate/research gate.

## Acceptance constraints the asset must meet

1. **License** — CC0 / CC-BY-4.0 (or more permissive), with recorded provenance
   (asset, source URL, author, SPDX license, attribution string) in
   `public/assets/hands/LICENSE.md`. NFR5 gate must stay green. CC-BY **-SA / -NC / -ND
   are NOT acceptable** (share-alike/non-commercial/no-derivatives conflict with a
   permissively-licensed showcase repo).
2. **Rig plausibility** — must pass `isHandSkeleton`: a finger-named-bone skeleton
   (≥1 finger-named bone) **or** ≥3 bones, **or** named clips matching `SHAPE_ALIASES`,
   **or** morph targets matching them. The ladder means ANY of the three strategies works.
3. **Pose distinctness** — must express **rock / paper / scissors** distinctly. Note: a
   rigged mesh with a generic finger skeleton satisfies the *gate* via the `bones` strategy
   (procedural curl in `setShapeBones`), but for clean, readable poses the requirements step
   may pin **either** authoring 3 named clips (`rock`/`paper`/`scissors`) **or** 3 morph
   targets, since `bones`-strategy curl is a coarse fallback.
4. **Budget** — `.glb` **≤ ~2 MB** (NFR3, zero-install web budget). Prefer ≤ ~500 KB.

## VERDICT: **CONDITIONAL-GO**

Green-light the upgrade **on the condition** that a sourced asset clears all four gates at
download-time verification. The scaffolding guarantees the integration is low-risk and
non-breaking (unclearable asset → `null` → PrimitiveHandRig floor, so we can never regress
below today's shipping quality). The only real risk is **sourcing** — finding a CC0/CC-BY
rigged hand that *both* is a plausible hand skeleton *and* poses RPS distinctly at ≤2 MB.

## Candidate assets (must-verify-at-download — do not assert license/rig without checking)

> Honest scoping: I did not fetch external catalogs in this run (read-only research inline);
> the below are the well-known, plausible sourcing lanes for a permissively-licensed rigged
> hand. Each candidate's **exact license and rig contents MUST be verified at download** by
> the requirements/implement step before commit — treat all license/rig claims here as
> "must-verify", not settled fact.

| # | Source lane | Typical license | Rig fit | RPS-pose caveat | Size |
|---|-------------|-----------------|---------|-----------------|------|
| C1 | **Quaternius** hand/character packs (quaternius.com) | **CC0** (verify per-asset) | Often rigged w/ finger bones → passes `isHandSkeleton` via `bones` | Usually no named RPS clips → we author curl poses (bones strategy already handles it) | small, ≤ few hundred KB |
| C2 | **Poly Pizza** (poly.pizza) filtered to CC0/CC-BY rigged hands | CC0 or CC-BY (verify) | Varies — must confirm ≥3 finger bones or morphs | Likely need to author clips/morphs | usually small |
| C3 | **Sketchfab** filtered `Downloadable + CC0/CC-BY + rigged hand` | CC0/CC-BY (verify — many are CC-BY-NC/ND, EXCLUDE those) | Many are fully finger-rigged | Some ship RPS-ish clips; most need authored poses | ranges — enforce ≤2 MB, may need decimation |
| C4 | **Author our own** minimal finger-skeleton `.glb` (Blender) with 3 named clips or 3 morphs | **project-owned, no third-party license** | Guaranteed pass by construction | Guaranteed distinct RPS by construction | tiny, controllable |

## Recommended path

**Primary: C1 (Quaternius CC0 rigged hand) or, if none fits cleanly, C4 (author our own).**
Rationale:

- CC0 (C1/C4) sidesteps the attribution-render requirement entirely and keeps the licensing
  gate trivially green — the strongest fit for a permissive showcase repo. CC-BY is
  acceptable but adds the (already-wired) credit-line obligation.
- The **`bones` strategy already works** for any finger-rigged mesh, so C1 can ship without
  authoring clips — the coarse procedural curl is enough to clear the gate and read as
  distinct. If the poses read poorly, escalate to authored clips/morphs (a requirements-step
  decision, not an investigate blocker).
- **C4 (author our own) is the reliable fallback** and de-risks the whole card: a
  hand-crafted low-poly finger-skeleton glb with 3 named clips (`rock`/`paper`/`scissors`)
  is guaranteed to pass every gate, is project-owned (no license risk), and is tiny. If
  external sourcing stalls at the requirements/implement step, fall back to C4 rather than
  shipping a marginal CC-BY-NC asset.

## Risks & money / viability angle

- **This is a SHOWCASE / portfolio piece with no revenue loop** (established repeatedly for
  this pipeline). There is **no monetization dimension** to weigh — the "market/money"
  crew's real job here is the **licensing viability** call, not ad/retention economics.
- **Cost/benefit:** the visual upgrade is *nice-to-have polish*, not load-bearing. The
  shipping `PrimitiveHandRig` is already a correct, distinct-per-shape hand. The upgrade's
  value is purely aesthetic credibility for a portfolio demo. Given the scaffolding is done,
  the *engineering* cost is low (drop-in), but the *sourcing/vetting* cost is the real spend
  and is unbounded if we chase a perfect external asset. **Recommendation: time-box external
  sourcing; if it exceeds a small budget, ship C4 (author our own).** Do NOT let asset-hunt
  scope-creep inflate a low-priority polish card.
- **Non-regression is guaranteed** by design (unclearable asset → primitive floor), so the
  downside risk of the upgrade is effectively zero — worst case we ship exactly today's
  quality.

## Downstream handoff — what `requirements` should pin

1. **License allowlist:** CC0 or CC-BY-4.0 only; explicitly EXCLUDE `-SA`, `-NC`, `-ND`.
   Require provenance row appended to `public/assets/hands/LICENSE.md` BEFORE the asset
   enters the repo (NFR5).
2. **Plausibility test:** add a `hands.test.ts` case that loads the sourced (or synthetic)
   asset through `GltfHandRig.tryLoad` and asserts it does NOT fall through to `null`
   (i.e. it activates a real strategy), plus a case asserting `isHandSkeleton` accepts it.
3. **Budget assertion:** a test/CI check that `public/assets/hands/hand.glb` is ≤ 2 MB.
4. **Pose-distinctness:** assert `setShape('rock'|'paper'|'scissors', 1)` produces three
   distinct rig states (per active `poseStrategy`).
5. **Attribution-render test (if CC-BY):** assert the credit line renders while a
   `GltfHandRig` is active and stays hidden for `PrimitiveHandRig` (already gated in
   `src/main.ts`).
6. **Fallback clause:** if external sourcing does not yield a clearing asset within the
   time-box, author a project-owned minimal finger-skeleton glb (C4) instead.

## Proposed GitHub labels

- **Keep:** `dlc-backlog` (origin marker), `dlc:investigate` (advance loop drives it onward
  to `gate-research`).
- **Add (autonomous — investigate may apply):** `enhancement` (GitHub type label; this is an
  optional visual upgrade, not a defect).

## Decision gate

**RAISED — one entry (`intent-fidelity` / viability go/no-go), auto-resolved under
`autonomous`.** The card's intent ("real hand asset") admits a materially cheaper,
lower-risk path (author-our-own / `bones`-strategy CC0 asset) than an open-ended external
hunt for a perfect RPS-clipped mesh. Under `trust=autonomous` the orchestrator auto-resolves
to **CONDITIONAL-GO with a time-boxed sourcing + C4 fallback** (rationale above); recorded in
`card.decisions[]`, `action: "continue"` (no back-step / split / park). Confidence: **high**
(scaffolding verified live, non-regression guaranteed).

## Handoff

Investigate complete — viability/licensing go/no-go produced (CONDITIONAL-GO), classification
+ decision surface + downstream pins recorded, ownership guard PASS (re-verified live).
Artifact written to the durable results area and mirrored to the repo
(`.dlc-yolo/card-backlog-14/investigation.md`, `results_in_repo=true`) on the SINGLE card
branch `dlc/card-backlog-14`. `step_status['investigate'] = done`. NEXT = `gate-research`
(the advance-cron consumes `done` and relabels `dlc:investigate` → `dlc:gate-research`).
