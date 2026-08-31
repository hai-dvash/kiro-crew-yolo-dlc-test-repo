# 3D Rock-Paper-Scissors — Wii-style mouse-gesture throws

A zero-install, client-only browser game: **press and hold in the arena, then flick** to throw
Rock, Paper, or Scissors against the CPU. The gesture is classified from your mouse motion
(the genuinely hard part); the 3D hands are a lightweight Three.js render.

Built as a **showcase** (no monetization) per the DLC-YOLO pipeline's viability go/no-go.

## Controls

| Gesture | Shape |
|---|---|
| Short, sharp **down-flick** | ✊ Rock |
| Flat **horizontal sweep** | ✋ Paper |
| Quick **zig-zag** (two reversals) | ✌ Scissors |

Accessibility: three always-visible buttons play the exact same round path (NFR3). A
low-confidence gesture shows a badge and a one-click re-throw instead of guessing silently.

## Architecture

```
src/
  main.ts              app bootstrap + round loop
  gesture/
    capture.ts         pointerdown→move→up sampler (press-and-hold-then-flick window)
    features.ts        peak velocity, dominant axis, reversals, straightness
    classify.ts        rule-based classifier → {shape, confidence}
  render/
    scene.ts           Three.js scene + two low-poly hand rigs
    throwAnim.ts        cosmetic 3-2-1-shoot tween (decoupled from result latency)
  game/
    rules.ts           pure RPS resolve() + independent cpuPick()
    round.ts           IDLE→CAPTURING→CLASSIFIED→RESOLVED→replay
  ui/fallback.ts       a11y buttons + confidence badge
  dev/overlay.ts       ?dev accuracy overlay (R1.3 spot-check hook)
```

The classifier is **trainless and rule-based** for v1 (debuggable). A learned classifier and
free-flick (no-button) capture are parked backlog items.

## Develop

```bash
npm install
npm run dev       # http://127.0.0.1:5173  (append ?dev for the feature overlay)
npm run build     # tsc typecheck + static Vite bundle in dist/
npm test          # Vitest unit tests (rules, features, classify, round, accuracy harness)
```

## Requirements traceability

Implements tasks T0–T10 from the DLC-YOLO spec (`requirements.md` / `design.md` / `tasks.md`),
covering R1 (gesture), R2 (3D render), R3 (rules/replay), R4 (zero-install), NFR1 (lean),
NFR3 (a11y). NFR2 (no monetization) is honored by omission.
