# Implement report — card-rps3d-max (issue #6)

**Branch:** `feat/rps3d-maxxed` · **Step:** implement · **Trust:** autonomous · **Depth:** deep

Full from-scratch rebuild of the 3D RPS showcase with real 3D libraries, executing tasks
T1–T20 from `tasks.md`. F1 (gesture engine) built and proven headless **before** any 3D
(Milestone M-A), per the design's prime directive.

## Build & test gates (all green)
- `tsc --noEmit` — clean
- `vite build` — clean (rapier WASM in its own dynamically-imported chunk; gesture/gameplay
  never blocks on the 2 MB WASM load)
- `vitest run` — **34/34 passing** across 5 files

## Milestone M-A — F1 proven before render
Accuracy harness (`?dev`) on the committed fixture suite:
```
overall 100.0% (12/12)
  rock: 100% (4/4)
  paper: 100% (4/4)
  scissors: 100% (4/4)
```
R1.3 bar is ≥85% — cleared. The harness test (`test/harness.test.ts`) enforces this in CI as
the FORK-1 escape-hatch trigger.

## Feature coverage
| Feature | Modules | Status |
|--------|---------|--------|
| F1 gesture | capture (motion-onset free-flick), features, classifier (margin confidence), engine (GestureResult ≤100ms), harness+fixtures, round machine | done, unit-tested |
| F2 render | scene (PBR + RoomEnvironment IBL + ACES tonemap), post (bloom + SSAO via `postprocessing`), tiers (boot detect + runtime degrade) | done |
| F3 assets | hands (PrimitiveHandRig baseline + GltfHandRig seam behind one interface) | primitive shipped; GLTF slot + LICENSE gate recorded |
| F4 physics | world (Rapier WASM, fixed 60Hz accumulator, off the result path), juice (impact/particles/shake), motion (reduced-motion + tween fallback) | done |
| F5 shell/a11y | main (DI wiring, layering invariant), config, rules, index.html/style.css, a11y/fallback (keyboard R/P/S into the same round path) | done |

## Resolved-fork execution (from design §2)
- **FORK 1** — rule-based classifier with margin confidence; `classify()` kept as the
  reversible seam for a future learned model.
- **FORK 2** — `@dimforge/rapier3d-compat` WASM, fixed-timestep, cosmetic-only; tween-only
  fallback under LOW tier / reduced-motion / WASM-unavailable (`shouldTweenOnly`).
- **FORK 3** — PrimitiveHandRig ships v1 (zero licensing risk); GLTF is a strict upgrade
  behind the same interface. **Licensing gate:** `public/assets/hands/LICENSE.md` records
  that no external GLTF ships in v1 → GLTF sourcing is a parked `dlc-backlog` upgrade
  (orchestrator to file; agents don't call `gh`).

## Layering invariant (the core architecture)
The round machine advances on `GestureResult` **alone**. Render + physics/juice subscribe
**after** the machine commits the result — cosmetic, fire-and-forget, cannot delay or alter
the outcome. The a11y keyboard path emits the **same** `GestureResult` into the **same**
round path (confidence=1), so gesture and button input share one code path.

## Perf (NFR4)
3-tier ladder (HIGH/MID/LOW): boot detect via GPU renderer-string + FPS heuristic; runtime
`TierMonitor` drops a tier (SSAO→off, bloom→off, physics→tween) after a sustained sub-floor
FPS window, **before** visible frame-drops. MID = the ≥50 fps bar. Verified by
`test/render-physics.test.ts` (degrade fires under a simulated 30 fps feed; holds at 100 fps).

## Parked tangent (for the orchestrator)
- **GLTF hand-rig sourcing** — a licensed rigged GLTF would upgrade F3 visuals. Could not
  source clean provenance in this pass; primitive rig ships. Recommend `dlc-backlog`.

## Notes
- Repo-root `.dlc-yolo/card-rps3d-max/` mirror committed on branch (results_in_repo=true).
- Ownership guard PASSED (issue #6 author `hai-dvash` == gh-auth user). Stayed within the
  owned repo throughout. PR opened by the `pr` step, not here.
