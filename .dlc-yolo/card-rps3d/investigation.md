# Investigation — card-rps3d

**Card:** 3D Rock-Paper-Scissors with Wii-style mouse-gesture throws
**Repo:** hai-dvash/kiro-crew-yolo-dlc-test-repo (issue #4)
**Step:** investigate (crew: dlcyolo-rps3d-market)
**Depth:** standard · **Trust:** assisted
**Run:** escalated subagent, executed INLINE (read/write/shell only — no select_crew/spawn_run in this runtime; crew-routing flattened per the tool-inheritance fix)

## 1. Classification (triage note)

- **Type:** feature (net-new browser game / tech-demo)
- **Rough size:** M–L. The 3D RPS render is table-stakes (Three.js). The Wii-style
  mouse-gesture recognition is the genuinely hard, size-driving piece.
- **Proposed GitHub labels:** `enhancement`, `game`, `showcase` (human-aided; not auto-applied under assisted trust).

## 2. Viability + Monetization go/no-go (market crew verdict)

**Verdict: GO — as a PORTFOLIO / SHOWCASE piece. NO-GO as a revenue play.**

- Browser 3D motion-gesture RPS is a **novelty hook, not a retention loop**. Players try it
  once ("lol I swung my mouse and it threw rock") and leave. No progression, no reason to return.
- **No meaningful revenue path.** Ads on a single-session novelty web game earn cents-per-thousand-plays
  at volumes RPS won't reach; no IAP hook; no subscription logic.
- **Recommendation:** build it as a showcase/tech-demo. Treat monetization as "decide later /
  probably skip." Do not let scope bloat chase a revenue story that isn't there.

## 3. Where the real effort (and interest) lives

- **Hard + worthwhile:** Wii-style mouse-gesture recognition — pointer-velocity sampling + a
  small in-browser gesture classifier (rock/paper/scissors throw). This is the piece most
  likely to feel janky and is the design/impl risk to front-load.
- **Comparatively easy:** the 3D RPS render (Three.js scene, hand models, throw animation).

## 4. Recommendation to the pipeline

- Proceed past investigate to the **gate-research** human gate.
- Frame requirements around the gesture-recognition feel as the primary acceptance driver;
  keep the 3D render scoped as supporting.
- Carry the "showcase, not revenue" framing forward so downstream phases don't spec monetization.

## Effort attribution
- effort.scope[investigate] = 2 (classification + go/no-go, no build work)
