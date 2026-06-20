# Bots / Training Setup — Redesign Proposal

Turn the tiny "difficulty + bot count" popup into a real **Training Setup screen**
— a scenario builder — with two clearly separate branches: **Practice Sandbox**
(no rewards, full cheats) and **Competitive Bots Match** (near-real rules, tiny
rewards). On our vanilla TS/CSS stack, full-screen, glass-consistent.

> Treat this not as a "bots menu" but as a **training-scenario builder + a fair
> bot-competition mode** — not a slightly bigger popup.

---

## 1. Why the current screen is weak
- It's a small modal: difficulty + bot count + Play. No sense of "I'm building a
  training scenario," no explanation of consequences, no map/duration/environment.
- It mixes (or rather, can't express) two fundamentally different intents:
  **free practice** (break the game however you like) vs **a fair match vs bots**
  (that should grant a little progress). One popup can't serve both.
- No rewards messaging, no presets, no advanced options, no anti-abuse model.

## 2. New architecture
A full-screen **Training Setup** screen, reached from the main-menu "Practice"
entry, with three bands:
- **Top: mode selector** — two big cards, **Practice Sandbox** vs **Competitive
  Bots Match** — each stating its reward rule up front.
- **Middle: settings** — two columns: **Basic** (always visible) + **Advanced**
  (collapsible). Which controls exist/enable depends on the chosen mode.
- **Bottom: summary + CTA** — a live **reward-eligibility badge**, estimated
  session type/duration, and a single primary **Start** that names the mode.

Sandbox shows the full (cheat-capable) settings; Competitive shows a restricted,
fair subset. Switching modes re-evaluates everything (and the reward badge).

## 3. Main zones
| Zone | Job |
|---|---|
| Mode selector | Choose Sandbox (no rewards) vs Competitive (tiny rewards) — with the trade-off stated |
| Basic settings | Bots count, bot difficulty, duration, map |
| Bot settings | AI quality, respawn on/off + delay, endless bots (sandbox) |
| Environment | Crate respawn + rate, loot/power-up density, hazards |
| Player cheats (sandbox only) | God mode, infinite bombs, starting power-ups, spawn invuln, no self-damage |
| Presets | Warmup / Aim & movement / Chaos sandbox / Survival / Real match vs bots |
| Summary + CTA | Reward badge, est. duration, Start + Quick Restart |

## 4. Per-zone breakdown

### 4.1 Mode selection (the first decision)
Two large cards, always explaining the deal:
- **🧪 Practice Sandbox** — *"Full custom · No rewards."* Everything tweakable,
  including cheats. Nothing counts toward progress.
- **⚔️ Competitive Bots Match** — *"Near-real rules · Tiny XP & coins."* Limited,
  fair settings; grants a small reward (well below real PvP).
The selected card is highlighted; the settings + reward badge below update.

### 4.2 Basic match settings (both modes)
Bots **count** (1–N), bot **difficulty** (Easy/Normal/Hard), **duration**
(3/5 min), **map/arena** (when we have more than one). Segmented chips, big tap
targets — a casual player can pick a mode and hit Start in 2 taps.

### 4.3 Advanced — bot settings
AI **difficulty/quality**; **respawn bots** on/off + **respawn delay**; **endless
bots** (sandbox only) for nonstop target practice; (later) aggression / aim /
error-rate sliders.

### 4.4 Advanced — environment
**Respawn crates** on/off + **rate**; **loot / power-up density**; **hazards**
on/off; starting map fill density.

### 4.5 Player cheats — **Sandbox only**
**God mode / immortal**, **infinite bombs**, **starting power-ups** (which + how
many), **spawn invulnerability**, **no self-explosion damage**, movement/speed
modifiers. Each of these forces **rewards OFF** (see anti-abuse).

### 4.6 Presets
One-tap scenarios that fill all settings: **Warmup**, **Aim & movement**, **Chaos
sandbox**, **Survival**, **Real match vs bots** (the competitive default). Plus
**Save preset**, **Last used**, **Reset to default**.

### 4.7 Rewards messaging
Always-visible badge:
- Sandbox → **"Rewards OFF"** (grey).
- Competitive (clean) → **"Tiny rewards ON · +X XP · +Y 🪙"** (green).
- Competitive + a reward-breaking toggle → **"Rewards OFF — <reason>"** with a
  tooltip naming the offending setting.

## 5. Wireframe (block layout)
```
┌────────────────────────────────────────────────────────────────────────┐
│ ←  TRAINING SETUP                                       Reset ⟳  Preset ▾ │
├──────────────────────────────────┬───────────────────────────────────────┤
│  🧪 PRACTICE SANDBOX              │  ⚔️ COMPETITIVE BOTS MATCH            │
│  Full custom · No rewards         │  Near-real rules · Tiny XP & coins   │
│  [ selected ]                     │  [               ]                   │
├──────────────────────────────────┴───────────────────────────────────────┤
│  BASIC                                                                    │
│  Bots [1][2][3]   Difficulty [😴][🤖][💀]   Time [3:00][5:00]   Map [Arena]│
│                                                                          │
│  ▸ ADVANCED — BOTS        (respawn bots ▢ · delay [3s] · endless ▢)       │
│  ▸ ADVANCED — ENVIRONMENT (crates respawn ▢ · loot density ▮▮▯ · hazards ▢)│
│  ▸ PLAYER CHEATS (sandbox) god mode ▢ · infinite bombs ▢ · start ⚡▮▮ ...  │
├──────────────────────────────────────────────────────────────────────────┤
│  🟢 Tiny rewards ON · +5 XP · +20 🪙        ~ 3 min · competitive sim     │
│                         [ ▶ START COMPETITIVE BOTS MATCH ]   [⟳ Restart]  │
└──────────────────────────────────────────────────────────────────────────┘
```
(Mobile: mode cards stack on top, settings in one scrollable column with the
Advanced sections collapsed, the summary+CTA pinned at the bottom.)

## 6. Which settings live where
| Setting | Sandbox | Competitive |
|---|---|---|
| Bot count | ✅ (up to max) | ✅ (capped) |
| Bot difficulty | ✅ | ✅ |
| Match timer | ✅ | ✅ |
| Map | ✅ | ✅ |
| Respawn bots | ✅ | limited / off |
| Respawn crates | ✅ | off or fixed |
| Loot density override | ✅ | off (default) |
| Starting power-ups | ✅ | ❌ |
| God mode / immortal | ✅ | ❌ |
| Infinite resources | ✅ | ❌ |
| **Rewards** | **none** | **tiny XP + coins** |

## 7. Anti-abuse rules (critical)
- **Rewards are decided server-side**, never trusted from the client.
- The server grants the tiny Competitive reward **only** when the match used the
  competitive ruleset (no cheat flags, no overridden density/respawn, bot count
  within the fair cap, full duration, you actually finished).
- **Any reward-breaking setting auto-disables rewards** and the UI recomputes the
  badge live — even if a hybrid mode ever appears.
- Reward is **well below** real-PvP payouts, and **rate-limited** (per-hour cap /
  diminishing returns) so bot-grinding can't replace real play.
- Sandbox is hard-wired to **zero** rewards regardless of settings.

## 8. Visual principles
- A real **setup screen**, not a popup: wide, zoned, glass, generous space.
- **Two clearly separate branches** — different accent colors (sandbox = neutral/
  grey, competitive = green/gold) so you always know which world you're in.
- **Basic first, Advanced collapsed** — casual players aren't overwhelmed; pros
  expand. One primary Start, labeled with the chosen mode.
- The **reward badge is always visible** and changes color/text instantly with
  your toggles, with a tooltip explaining any "rewards off" reason.

## 9. Recommended extras
Quick Restart / restart-same-settings; Save / Last-used / Favorite preset; reward
badge ("Rewards OFF / Tiny rewards ON"); tooltip for *why* rewards are off;
estimated session type (short warmup / long sandbox / competitive sim); Advanced
collapsed by default; **separate CTAs** "Start Sandbox" vs "Start Competitive
Bots Match"; infinite-rematch in sandbox.

## 10. Build order (incremental)
1. **Mode split + screen shell**: full-screen Training Setup with the two mode
   cards, Basic settings (bots/difficulty/timer), reward badge, Start. *(client +
   small server flag: practice vs competitive)*
2. **Competitive rewards** server-side (tiny XP/coins, ruleset-gated, rate-limited).
3. **Advanced sandbox settings** (cheats/environment) — each gated to sandbox and
   forcing rewards off.
4. **Presets + quick restart + save preset**.

Step 1 already gives the "real screen" feel + the meaningful Sandbox/Competitive
split; 2 makes bots worth playing without exploitability; 3–4 are depth.
