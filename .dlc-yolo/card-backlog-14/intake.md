# Intake — card-backlog-14

- **Card:** `card-backlog-14`
- **Pipeline:** `pl-rps3d`
- **Repo (owned):** `hai-dvash/kiro-crew-yolo-dlc-test-repo`
- **Issue:** [#14](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/14) — OPEN
- **Title:** Upgrade: source a licensed real rigged-hand `.glb` (RPS clips/morphs) to replace the primitive rig
- **Effective modes:** trust=`autonomous`, depth=`deep`, capability=`dlcyolo-authoring`
- **Intake at:** 2026-09-01T09:00:00+03:00
- **Intake by:** dlc-yolo · intake step-agent (session `f3e2e041`)

## Ownership guard

PASS. Issue #14 author `hai-dvash` (`is_bot:false`) == gh-auth user `hai-dvash`.
`config.trusted_authors` unset → default `[hai-dvash]`. Verified live at intake
(`gh api user` → `hai-dvash`; `gh issue view 14 --json author`). Fail-closed satisfied.

## Source verification (live GitHub ground truth)

- Issue #14 exists, state **OPEN**.
- Labels on the issue: `dlc-backlog`, `dlc:investigate`.
- Card `source` correctly links repo `hai-dvash/kiro-crew-yolo-dlc-test-repo` issue `14`.
- Provenance: parked from `card-rps3d-fix` (issue #13) at the implement step
  (design §1 Q1 / §8) via the backlog-intake path; back-fed as this card.

## Classification (triage note)

- **Type:** `feature` (explicitly framed in the issue as *"a feature, NOT a bug"*).
  This is an **optional visual upgrade**, not a defect — the primitive hand rig is a
  correct, distinct-per-shape fallback that already ships and passes tests.
- **Rough size:** **M** (~3 pts). The engineering scaffolding is already in place —
  `HandRig` interface, `GltfHandRig`, the `isHandSkeleton` plausibility gate
  (`src/render/hands.ts`), and the `public/assets/hands/LICENSE.md` provenance gate were
  all built and preserved by card-rps3d-fix (both files verified present on this branch at
  intake). The work is: **source + vet a licensed asset** and drop it in so the existing
  gate re-activates `GltfHandRig` automatically. The license-vetting/provenance dimension
  is the genuinely non-trivial part (drives the `enhanced`/research-gate treatment at the
  `investigate` step).
- **Key risk / decision surface for downstream steps:**
  1. **Licensing** — asset must be CC-BY (or more permissive) with recorded provenance
     in `public/assets/hands/LICENSE.md` (NFR5 gate must stay green). This is where the
     `investigate` step's viability/licensing go/no-go crew (`dlcyolo-rps3d-market`) earns
     its keep.
  2. **Rig plausibility** — asset must pass `isHandSkeleton`: ≥3 finger chains /
     finger-named bones, OR named RPS clips, OR morph targets. A demo skeleton (like the
     retained Khronos RiggedSimple) will be rejected by design.
  3. **Budget** — ≤ ~2MB (NFR3); poses rock/paper/scissors distinctly; CC-BY credit line
     renders while the GLTF is active.

## Acceptance sketch (carried from the issue, for the requirements step)

New asset with recorded provenance in `public/assets/hands/LICENSE.md` (NFR5 gate green);
≤ ~2MB (NFR3); passes `isHandSkeleton`; poses rock/paper/scissors distinctly; existing
tests + harness gate stay green; CC-BY credit renders while the GLTF is active.

## Proposed GitHub labels

- **Keep:** `dlc-backlog` (origin marker), `dlc:investigate` (already applied — the
  card's stage sits at the step after intake; the advance loop drives it onward).
- **Suggest adding at investigate:** `enhancement` (upstream GitHub type label, human-aided
  under assisted; may be auto-applied under autonomous by the investigate step).

## Handoff

Intake complete — card registered, source verified live, ownership guard PASS,
classification recorded. Next step: **`investigate`** (viability/licensing go/no-go via
`dlcyolo-rps3d-market`, the first real reasoning step). No decision gate raised at intake
(clean entry, serves intent, no fork). `step_status['intake'] = done`.
