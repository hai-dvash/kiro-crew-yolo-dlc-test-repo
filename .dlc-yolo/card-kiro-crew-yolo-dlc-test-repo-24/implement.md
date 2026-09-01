# Implement — [f2] Poppy reveal animation on the thrown object

**Card:** `card-kiro-crew-yolo-dlc-test-repo-24`
**Issue:** [#24](https://github.com/hai-dvash/kiro-crew-yolo-dlc-test-repo/issues/24) (child of parent #22, feature **f2**)
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo
**Step:** implement · trust=assisted (inherited) · depth=deep · capability=dlcyolo-builder
**Branch:** `dlc/card-kiro-crew-yolo-dlc-test-repo-24` (ONE branch per card → ONE PR)
**Code commit:** `5c5f315`

---

## 1. What was built (T1–T6; T7 deferred)

A purely additive, cosmetic **poppy reveal animation** on the thrown object, driven off the
already-committed round result — no core/gameplay change.

- **T1 — `src/render/reveal-pop.ts` (NEW).** `PopTarget` seam (`{ setPopScale(scale) }`),
  `RevealPopOptions`, and the `RevealPop` controller: `POP_MS=260`, `OVERSHOOT=1.18`,
  `RISE_FRACTION=0.6`. `onResult` arms a scale-overshoot-settle (or instant rest under `tweenOnly`);
  `update(dtMs)` rises past `1.0` to `OVERSHOOT` then relaxes to **exactly** `1.0` and idles;
  `reset()` re-arms; a `null` target makes every method a safe no-op. **DOM/WebGL/`three`-free,
  deterministic** (no `Math.random`/`performance.now`) → node-testable.
- **T2 — `test/reveal-pop.test.ts` (NEW, node-env, DOM/WebGL-free).** Mirrors `main.test.ts`'s
  `makeHarness` DI discipline; drives a **real `RoundMachine`** with a deterministic `pickOpponent`
  and a fake `PopTarget` recording the `setPopScale` stream. 6 cases: (1) fires once per resolved,
  not on idle/capturing/lowConfidence; (2) never before commit (result+opponentShape set when it
  fires — `player=scissors` vs `opponent=rock` ⇒ `resolve()`='b', proving the committed result
  drove the beat); (3) full-motion overshoot rises >1.0 then lands exactly 1.0; (4) tween-only never
  exceeds 1.0 and ends at rest; (5) re-arm pops again; (6) absent target never throws.
- **T3 — main.ts (ADDITIVE).** `import { RevealPop }` + `const revealPop = new RevealPop(null);`
  after the `Juice` construction.
- **T4 — main.ts (ADDITIVE).** In the **existing** `machine.onChange` `phase==='resolved' && result`
  branch, `revealPop.onResult({ tweenOnly })` alongside `juice.onResult(...)` (reusing the already
  computed `tweenOnly`); re-arm via `revealPop.reset()` on `phase==='capturing'`. **Not a new
  listener.** `render(s)` byte-for-byte unchanged.
- **T5 — main.ts (ADDITIVE).** `revealPop.update(dt)` in the **existing** `frame()` RAF loop next to
  `juice.update(dt/1000)` — `dt` is **ms** here (deliberate unit distinction: `RevealPop.update`
  expects ms; `juice.update` takes seconds). **No new loop.**
- **T6 — Global gate.** Build clean, full suite green, additive-only diff + guard-bite (below).

## 2. Verification (live, this run)

- `npm run build` (`tsc --noEmit && vite build`) — **clean** (only the pre-existing rapier
  chunk-size warning).
- `npm test` — **63 passed / 9 files** (baseline 57 → +6 new f2 cases).
- **Additive-only diff (NFR2), diff-confirmed:** `origin/main..HEAD` code/test =
  EXACTLY `src/main.ts` + `src/render/reveal-pop.ts` + `test/reveal-pop.test.ts` (239 insertions).
  Protected-surface guard over `src/round/** src/rules.ts src/gesture/** src/types.ts
  src/physics/juice.ts src/a11y/**` = **EMPTY**.
- **NFR1 F1-first:** `pickOpponent()` remains solely in `RoundMachine.submit()`; the pop reads
  nothing from animation state; fired only from the existing committed-result consumer.
- **Guard-bite verified:** forcing the test wiring to fire the pop on every change (before commit)
  turns case (2) **RED**; reverted → 63 green. The never-before-commit net genuinely bites.

## 3. Deferred: T7 (the ONE f1-gated line)

`revealPop.setTarget(<f1 object as PopTarget>)` in `onRigLoaded` is the sole f1-gated task —
f1 (#23) is still **OPEN / unmerged** (at `dlc:gate-impl`), so there is no throwable/opponent object
to point at yet. Per design §7 + tasks §0, T1–T6 ship GREEN standalone via the null-safe target; the
1-line `setTarget` wiring lands once f1's object handle exists (a follow-up on this same branch or a
tiny integration commit). Faking an object here would violate PRODUCE-OR-BLOCK and NFR2 — so it is
correctly left as the documented integration point, not stubbed.

## 4. Notes / hygiene

- The shared clone `/tmp/dlc-yolo/repos/kiro-crew-yolo-dlc-test-repo` had **f1 (#23) bleed** in the
  working tree (uncommitted `src/render/objects.ts`, `test/objects.test.ts`, and an
  `opponent.setShape` edit to `main.ts`) from a concurrent sibling run, plus a stale branch label.
  The branch was **hard-reset to the correct remote card-24 head `fb20152`** and the tree cleaned
  before implementing, so this commit is a **CLEAN single-card diff** with ZERO card-23 bleed
  (verified `git diff --name-only origin/main..HEAD`).

## 5. Effort

`effort.scope[implement] = 1` (leaf S/1 slice; module + wiring + test built, scope not grown —
investigate=3 read / requirements=1 / design=1 / tasks=1). Back-step (deep, GF=3.0):
`implement(1) > 3 × tasks(1) = 3`? **NO.** No feature parked; no further decomposition (f2 is a
sibling of f1/#23 + f3/#25 under parent #22).
