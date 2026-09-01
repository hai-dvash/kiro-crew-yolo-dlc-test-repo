# rps3d — MAXXED 3D Rock-Paper-Scissors

A browser showcase: throw rock / paper / scissors with **free-flick mouse gestures**, rendered
in real 3D. Zero-install, keyboard-accessible, portfolio/tech-demo (no monetization).

> This is the from-scratch "maxxed" rebuild (branch `feat/rps3d-maxxed`, issue #6) with real 3D
> libraries — distinct from the shipped minimal card (`card-rps3d`, PR #5).

## Play
- **Gesture:** flick the mouse — a downward *chop* = rock, a flat *sweep* = paper, a
  back-and-forth *snip* = scissors. No press-and-hold; motion onset/decay segments the flick.
- **Keyboard (a11y):** press <kbd>R</kbd> / <kbd>P</kbd> / <kbd>S</kbd> or use the on-screen buttons.
- **Low confidence?** The game asks you to throw again rather than guessing.

## Architecture (the F1-first invariant)
The **gesture engine (F1)** is the authoritative, ≤100 ms result path: `capture → features →
classifier → GestureResult`. The round machine advances on that event alone. Render (PBR + HDR
IBL + bloom/SSAO post), Rapier physics juice, and hand rigs are **cosmetic consumers** that
subscribe *after* the result is committed — they can never delay or change the outcome.

```
src/
  gesture/   capture · features · classifier · engine · harness · fixtures   (F1)
  round/     machine                                                          (F5)
  render/    scene (PBR/IBL) · post (bloom/SSAO) · tiers (degrade) · hands    (F2/F3)
  physics/   world (Rapier fixed-step) · juice                                (F4)
  a11y/      fallback (keyboard) · motion (reduced-motion/tween)              (F5)
```

## Quality tiers (perf)
Auto-detected at boot (GPU + FPS probe) and downgraded at runtime before frames drop:
HIGH (bloom+SSAO+full physics) · MID (bloom, ≥50 fps target) · LOW (tween-only juice, ≥30 fps).
`prefers-reduced-motion` forces the calm path.

## Develop
```bash
npm install
npm run dev       # http://127.0.0.1:5173  (append ?dev for the accuracy harness overlay, ?tier=low to force a tier)
npm test          # vitest — rules, gesture, classifier, harness (≥85%), round machine, tiers, physics
npm run build     # tsc --noEmit + vite build
```

## Assets / licensing
Ships procedurally-authored primitive hand rigs (no third-party asset). A licensed rigged GLTF
can be dropped into `public/assets/hands/hand.glb` behind the same interface — provenance MUST be
recorded in `public/assets/hands/LICENSE.md` first.
