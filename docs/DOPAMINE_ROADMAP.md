# Dopamine / Game-Feel Roadmap — BomberMeme.fun

Distilled from the "Дофаминовая архитектура / нейроэкономика" TDD into concrete,
staged, codebase-mapped work. Goal: make matches maximally juicy and sticky
**without** crossing into deceptive/predatory patterns (we take real-money
stakes — that line matters legally and reputationally).

Legend: ✅ adopt · ⚠️ adopt only in a transparent/ethical form · ❌ skip (harmful).

---

## Ethics gate (read first)
The source doc mixes legit game-feel with a few genuine dark patterns. We adopt
the feel/retention; we refuse the deception:
- ❌ **Hiding real crypto losses** in the periphery (dim/grey/silent) so the user
  doesn't notice they lost money. Deceptive, almost certainly non-compliant for
  real-stakes play. We show losses **honestly** (just don't make them the LAST
  beat — see Peak-End).
- ❌ **Predatory post-loss gambling** ("spin-to-win" lootbox engineered with
  near-miss to bait re-deposits right after a real-money loss). ⚠️ A **fair,
  transparent, free** post-match reward (earned XP / a daily cosmetic spin with
  shown odds, NOT tied to re-staking) is fine and great.
- ⚠️ **Cortisol manipulation** (Shepard tone, vignette panic) is fine as *match
  tension* — keep it match-scoped, never tied to spending decisions.
Everything else below is standard, legit juice.

---

## What we already have (baseline)
Screen shake (`renderer.shake`), 5-frame explosions + volumetric light, gory
blood (gibs + face-aware block blood + drips), player color glow, FIRST BLOOD
callout, scorched ground, sudden-death wall-closing, 3-min match, 11 characters
with action poses, share card (stats+QR+referral), rating + leagues, leaderboard,
result screen with a 3s battlefield linger, SFX set + 2 music tracks, Web-Audio
reverb. Good base — most phases below *extend* these.

---

## Phase 1 — Core game feel (client only, fast, highest visible payoff)
Where: `apps/client/src/game/renderer.ts`, `main.ts` frame loop.
- ✅ **Hit-stop**: 40–80 ms freeze of the render/sim on a kill / big blast
  (longer for kills). Sells mass. (new: a `freezeUntil` skip in `frame()`).
- ✅ **Screen shake = damped sine**: `A·e^(−λt)·cos(ωt)`, A≈15–20px, λ≈8–10,
  ω≈40–50Hz, ~250 ms, independent X/Y. Replace the current linear-ish shake.
- ✅ **Impact pop**: a 1–2 frame, *subtle* additive white bloom at the blast
  center (NOT a full-screen seizure flash — we removed those for a reason).
- ✅ **Kill color-inversion**: invert the canvas 2 frames on an elimination
  (cheap `globalCompositeOperation='difference'` flash).
- ✅ **Particle tuning** (gore/debris): gravity ×2–2.5, linear damping 2.5–3.5,
  restitution gore 0.15 / debris 0.6, friction 0.9. (tune existing `push()` params.)
- ✅ **Popups easing**: damage/`+chips`/crit numbers `ease-out-back`
  (cubic-bezier(.175,.885,.32,1.275)); victory `ease-out-elastic` ~900 ms.

## Phase 2 — Audio juice (client only)
Where: `apps/client/src/game/assets.ts` (Web-Audio graph).
- ✅ **Sidechain duck**: on explode/kill, drop music −6…−12 dB for ~150–200 ms
  with a fast recover (route music through a GainNode we automate).
- ✅ **Reward vs threat frequency**: pickup/kill SFX bright 2–4 kHz transients;
  bomb-fuse a low 18–60 Hz sub-bass rumble.
- ✅ **Shepard tone** in the final ~15–30 s (endless-rising illusion) — match
  tension only.
- ✅ **Dynamic music**: layer/secondary track or BPM/intensity step-ups by phase
  (see Phase 3 timeline). Today we just swap lobby↔battle.

## Phase 3 — Match pacing / "cortisol surfing" (client; uses existing phases)
Where: `renderer.ts` (post-pass) + `main.ts` phase handling. Drive by match time.
- ✅ **Timeline grade**: 0–1:00 warm/neutral; 1:00–2:00 cooler + light duck;
  2:00–3:00 push toward red + bigger shake.
- ✅ **Vignette**: pulsing edge-darken at **4–7 Hz** when local HP ≤30% or in
  sudden death (tunnel-vision). (canvas radial-gradient overlay.)
- ✅ **Peripheral threat flash**: a sharp high-contrast flash at the screen EDGE
  toward an off-screen bomb about to blow / an incoming wall — breaks foveal
  focus on purpose.
- ✅ **Music BPM/intensity ramp** synced to the timeline + Shepard in the last leg.

## Phase 4 — Near-miss "clutch" survival (needs SERVER — do carefully)
Where: `apps/server/src/room.ts` hit logic + a client callout.
- ✅ **Coyote-time on blast edge**: if a player is in the outermost ~5% of a
  blast cell for <~0.1 s, null the lethal hit but drop them to 1 HP and fire a
  **CLUTCH!** moment (max shake, red vignette, slow-mo blip). Reads as skill, not
  luck → big dopamine, strong "play again". Server-authoritative; keep it fair
  and identical in prediction.

## Phase 5 — Nemesis / social dominance (client + small server)
- ✅ **Death cam (1.5–3.5 s)**: on your elimination, snap-focus the killer and
  **show their exact HP** (the "1-HP reveal" → near-miss revenge urge). We
  already linger 3 s — repoint it at the killer.
- ✅ **Leader crown**: the player with the most frags/loot gets a pulsing crown
  glow visible map-wide (we have per-player glow — extend it). Drives target-effect.
- ✅ **"One step from #1" HUD**: small bar showing how close you are to the
  leader (Zeigarnik tension). ⚠️ Keep taunts mild (anti-toxicity): an
  *interrupted* taunt that cuts to the rematch CTA is fine; don't humiliate.

## Phase 6 — Retention meta (client + server/economy)
- ✅ **Peak-End result screen**: last beat = bright XP/streak/quest progress, not
  the loss figure. Show losses **honestly** but earlier/smaller. (We already
  delay the scoreboard 3 s and show a share card — slot the progress beat in.)
- ✅ **Zeigarnik progress**: XP/streak/league bars NEVER end empty — on level-up
  immediately open the next bar **pre-filled 5–15%**. "Session ended, next task
  already started."
- ✅ **Streaks + daily quests**: win-streak tracker, 2–3 daily challenges
  ("10 frags", "win 3"), login streak. Variable (Skinner) reward *schedule* for
  quest rewards is fine.
- ⚠️ **Post-match reward**: a **free, transparent** spin/lootbox (shown odds,
  earned by playing, NOT requiring a re-stake, NOT shown as "win your money
  back"). This keeps the dopamine loop without the predatory framing.
- ❌ Do NOT hide real-money loss in the periphery; do NOT gate the spin behind
  re-depositing after a loss.

## Phase 7 — Adaptive systems (server)
- ✅ **APM-adaptive stimulus density**: if a player's actions/min drop, nudge
  bot/event density up to hold Flow. (bots/matchmaker.)
- ✅ **Analytics-tuned constants**: A/B the feel constants (shake A/λ, hit-stop
  ms, duck dB) via the existing PostHog events.

---

## Suggested order (impact ÷ effort)
1. **Phase 1** (game feel) — biggest felt difference, client-only, low risk.
2. **Phase 2** (audio) — pairs with P1 for cross-modal punch.
3. **Phase 3** (pacing) — turns the existing 3-min arc into a stress curve.
4. **Phase 5** (death cam + crown) — strong social/revenge hooks, mostly client.
5. **Phase 6** (peak-end + streaks/quests) — the real retention lever.
6. **Phase 4** (clutch coyote-time) — needs careful server work; ship after P1–3.
7. **Phase 7** (adaptive/analytics) — ongoing tuning.

Each phase ships independently and is reversible (constants live in one place).
Do P1 first, measure, then proceed. Numeric params above are external industry
defaults — verify by feel in-engine and tune.
