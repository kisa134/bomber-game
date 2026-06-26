# BomberMeme.fun — Handoff for the next AI agent

This file is the single source of truth for continuing the UI/UX redesign of
**BomberMeme.fun** (a crypto-meme Bomberman game). Read it fully before touching code.

---

## 0. TL;DR / how to work here

- **Repo:** `C:\Users\HYPERPC\Documents\projects\bomber-game` (GitHub `kisa134/bomber-game`).
- **Live prod:** https://bomberpump.onrender.com (Render Docker, **autoDeploy on `main`**).
- **Stack:** pnpm workspace. `apps/client` (Vite + Canvas2D + TS), `apps/server`
  (uWebSockets, TS), `packages/shared` (shared types/consts). Client is the bulk of UI work.
- **Build:** `pnpm --filter @bomberpump/client build` (server: `pnpm --filter @bomberpump/server build`).
- **Deploy:** commit + push `main` → Render rebuilds (~1–4 min). Confirm live by polling the
  asset hash: `curl -s "https://bomberpump.onrender.com/?cb=$RANDOM" | grep -oE 'assets/main-[^"]+\.css'`
  — when the hash changes from the previous one, the deploy is live.

### CRITICAL WORKFLOW RULES (the user is strict about these)

1. **DO NOT self-verify with browser previews / screenshots / `preview_eval`.** The user
   reviews visuals himself in prod. Workflow: edit → `build` (tsc/vite catches breakage) →
   commit → push → poll the deploy hash → tell the user **exactly what to check** (which
   screen, what action, expected result). This is a saved memory; honor it.
2. **⚠️ CONCURRENT-AGENT CLOBBERING — verify origin after EVERY push.** Multiple agents work
   on this same repo. During `git rebase origin/main` a concurrent push can silently drop your
   changes, so the commit lands WITHOUT your edits and the build still passes. This has
   happened repeatedly (whole feature commits were lost). **After every push, verify the change
   is actually on origin:**
   ```bash
   git show origin/main:apps/client/src/main.ts | grep -c <marker>
   ```
   If 0, your change was clobbered — re-apply and push again. Also note prod asset hashes change
   between your push and the next check (another agent deployed) — that's normal; just confirm
   YOUR markers are on origin.
3. **Commit message footer:** end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
4. **Always `git fetch origin && git rebase origin/main` before push** (then verify, per #2).
5. Language: the user writes in **Russian**; reply in Russian. Code/comments in English.

---

## 1. Key files & where things live

| What | File |
|---|---|
| Most client logic (hub, room, result, shop, profile, fireflies, dust, sounds, net handlers) | `apps/client/src/main.ts` (~5000 lines) |
| Screen routing + waiting-room render | `apps/client/src/ui/lobby.ts` (`showScreen`, `renderRoom`, `renderTables`) |
| All markup | `apps/client/index.html` |
| All styles | `apps/client/src/style.css` (~8200 lines) |
| Renderer (canvas), `skinAvatar`, in-game emote bubbles | `apps/client/src/game/renderer.ts` |
| Audio engine (`assets.play`, `rewardDing`, `countBlip`, `subBass`) | `apps/client/src/game/assets.ts` |
| Server match logic (sudden death, frags/kills, kick, stake) | `apps/server/src/room.ts` |
| Shared enums/consts (`EMOTES`, `BET_SIZES`, `START_LIVES`, `SUDDEN_DEATH_*`) | `packages/shared/src/{types,constants}.ts` |
| Telegram Mini-App glue | `apps/client/src/platform/telegram.ts` |

### Important patterns / gotchas

- **`renderRoom(state)` is called EVERY animation frame in the lobby** (from the rAF loop in
  `main.ts`, plus a 1s interval). It rebuilds the seat list. **Any interactive element built
  there must be guarded** or it's destroyed 60×/sec (hover never sticks, clicks die before
  firing). There is now a **signature guard** (`lastRoomSig` in `lobby.ts`) — only rebuilds on
  real state change. If you add room state, add it to that signature or your UI goes stale.
- **Global `button { width: 260px; border-radius: 12px }`** — custom buttons need `width:auto`.
- **Glass system:** `.glass-btn` (gold-glass primary CTA, used hub-wide); `.passport-card` /
  `.info-card` = "texture A" glass (blur 1px, sat 200%, bright 1.1, radius 11, refraction via
  `::after { filter: url(#lg-distort-32) }`). SVG filters in `index.html`: `#lg-distort` (scale 78),
  `#lg-distort-32`, `#lg-distort-64`. Stronger filter on hover = more "living glass" refraction.
- **Brand colors:** `--accent #f0a92a`, `--accent-bright #ffd84d`, `--accent-lite #ffe27a`.
  Use these for any gold glow (an off-amber like `255,180,40` reads "wrong" to the user).
- **Safe-area:** use `var(--sai-top/right/bottom/left)` NOT raw `env(safe-area-inset-*)` —
  the Telegram glue overrides `--sai-*` with the Telegram header inset so chrome doesn't overlap
  the TG close/back/⋮ buttons.
- **Fireflies/glow** on hub cards: `initCardFireflies()` in `main.ts`. Layers `.lg-fireflies`
  (JS-driven motes), `.lg-frost` (frosted pane that blurs motes), `.lg-glow` (radial centre glow,
  the one that's ~2× bright). Physics: per-dot gravity + swirl + repulsion + brownian; rAF runs
  only while hovered; 3s slow fade on leave.
- **Magic dust / press-sparks** on the fighter carousel: `buildDustField`, `emitSparks`,
  `tickSparks`, intensity scales by `tierPower(i)`/`tierRank(i)`, colors by `sparkColor(tier)`.
- **Frags:** counted client-side from the `EVENT_KILL` stream into `matchFrags` Map (snapshots
  are throttled so the killing-blow frag misses the last snapshot before `MATCH_END`). Result +
  standings use `max(matchFrags, snapshot.frags)`.

---

## 2. DONE (shipped to prod, verified on origin)

- **Splash:** centered on standard blur bg (no card), green blinking "SEASON 1 · LIVE", embers;
  auto-skip for returning visitors; "How to play" → onboarding; unified radii; wallet popup
  z-index above splash (`.modal { z-index: 100 }`).
- **Onboarding:** opens AFTER "Enter game" (not on page load); music starts only after entering
  the hub; welcome card tells new players they got starter characters (reward) + sprite visuals;
  glass Next button.
- **Hub:** heavy redesign (carousel, deck easter eggs, dust, metallic bomb logo, wallet plate,
  nav highlight, RANKS removed); **fireflies + frosted glass + centre glow** on profile + season
  cards (white / purple); season card turns purple on hover; "living glass" refraction stronger
  on hover.
- **Lobby (table browser):** full redesign — title, glass rows, green JOIN, filter pills, Sort
  dropdown, ≈$ conversion.
- **Room (waiting room):** back→lobby, return-to-room chip, **fixed glass bottom bar flush to
  edges** (only top corners), title inline with back arrow on mobile, Ready button shows
  "X/Y ready · tap to cancel" (no duplicate status line), **KICK works** (sig guard + 2-tap
  borderless red ✕), invite toast, stake popup with custom slider (thumb centered via
  `runnable-track`) + brand-gold concentrated glow, stake-proposal copy (WHO/amount/POT),
  Accept=Decline radius, Accept styled like Start, 16 emotes (🚀/❤️ removed).
- **In-game HUD:** no reaction-emoji bar, glass pills, dimmed ✕, opponent-only 2-line chips
  (no self-dup), pot shown ONCE on the right plaque (`#bal-hud`), wallet-connect nudge for
  wallet-less players.
- **Result:** order = stat squares (count-up) → highlighted PRIZE → lvl/rating bars → standings
  (avatars + medals) → buttons → ping/seed at the very bottom; cards wrap the number; gold/silver/
  bronze by place; count-up + chime + glow; Back-to-lobby full-width white-pulse (no sparks/lift);
  Share popup centered + tinted + gold CTA.
- **Shop:** title "SHOP" inline with back arrow (no emoji); "All" filter ranks by rarity TIER with
  minimalist subheadings; locked skins dimmed harder; Buy/Equip/token buttons are `glass-btn primary`.
- **Opponent profile popup** (`openPublicProfile`): redesigned hero (avatar+name+league) + big
  accent RATING + 3-col stat grid with colored accents (was a flat "Excel table").
- **Gameplay/server:** frags from kill-events; **sudden-death spiral paced to its length** so the
  arena fully closes in the final minute (was fixed 500ms/tile, never finished).
- **Skins:** frontal avatars use the live `_down_1` frame (stale `skin_N.webp` portraits fixed);
  your seat glows your player color inward; the centered hub card = your fighter (mobile too).
- **PWA/Telegram:** safe-area via `--sai-*`; carousel vertical scroll + edge arrows on mobile;
  vs-Bots button: "PRACTICE" label hidden + lighter glass on mobile.

---

## 3. QUEUE — not started / needs work (with the user's detailed specs)

> The user has explicitly described several of these in detail in the chat history. Where a spec
> is below, follow it. For Leaderboard + Profile full redesign, the user said he wrote detailed
> specs earlier — **search the conversation / ask him** before building those.

### 3.1 Move the tournaments block left → "Соревнования" (Competitions)
- Today: `#open-tournaments` button, class `rail-card season` (purple, "🏆 Season · Tournaments &
  prizes"), lives in `.hub-rail-right` (`index.html` ~line 226). It DUPLICATES the season info-card.
- Want: **move it to the LEFT** (under the profile `.passport-card`, e.g. into `.hub-rail-left`),
  **rename to "Соревнования"/"Competitions"**, give it an **inner-glass glow (NO fireflies)** —
  pick a tasteful on-theme color for the glow. Keep the season **info-card** (★ SEASON 1) on the
  right as the season block (it already has fireflies + purple hover).

### 3.2 Daily Spin → header perk popup (remove from hub)
- Today: `#open-wheel` ("🎰 Daily Spin") is a permanent button in `.hub-rail-left` (`index.html`
  ~189). The spin popup modal is `.daily-card-pop` (`index.html` ~273).
- Want: **remove it from the hub rail**; make it a **floating "perk" indicator in the header**
  (near settings), that pops the daily reward and **disappears once spun** (or just lives next to
  settings — not a permanent hub block). **Redesign the popup interior**: centered, adaptive,
  the spin button should be the hub `glass-btn` (gold glass).

### 3.3 Fighter-card pulse border (rarity glow) — the big one
- Today: the carousel fighter cards have a pulsing rarity border. **Bug:** a hard inner edge is
  visible (looks like a bug). 
- Want: **two-layer pulse** — a NEAR layer that's narrower / less spread / brighter, plus a far
  layer; should **move/pulse like a garland or a living heart**; **stronger the more you press**
  (press-and-hold intensifies). **Epic** = this variation; **Mythic** = an even more intense,
  flashier variation. Make it physics-beautiful (consistent with the dust/firefly quality bar).
  Look for the rarity-border CSS on the fighter card (`.fighter-card`, rarity via `--rarity`/tier).

### 3.4 Opponent profile popup — full-profile button (partially done)
- The popup is now redesigned (§2). **Remaining:** the user wants a button to open the player's
  **full profile page** — but **no full-profile page/screen exists yet** (the popup IS the
  profile). Building a dedicated public-profile screen is part of the Profile redesign (§3.9).
  Until then, either add the button wired to that new screen, or hold.

### 3.5 Onboarding — deeper visual polish
- `ONBOARD` array + `renderOnboard()` in `main.ts` (~line 3817). Has sprite visuals + copy now.
  The user wants it "seriously" better visually (richer, more premium). Possibly add screenshots/
  more art per step.

### 3.6 Profile (MOBILE): rating + level next to the avatar
- On the hub `.passport-card`, on mobile the rating/level "slid off to the side" — should sit
  **next to the avatar** like on desktop. Fix the passport-card mobile layout (`@media` for
  `.passport-card` / `.pc-head` / `.pc-id`).

### 3.7 Lucky spin / wheel — center buttons + vertical overlap (mobile)
- The wheel/daily popup buttons are off to the side — **center them**; fix **vertical overlap**
  on mobile. (Related to §3.2 but this is the layout-fix part.)

### 3.8 Shop — vertical overlap on mobile
- Beyond §2 (title/tiers/locked/buttons), the shop still has **vertical overlap on mobile** —
  blocks stack on each other. Audit `@media` for `.shop-body` / `.shop-grid` / `.shop-detail`.

### 3.9 Leaderboard / Profile / Shop — FULL redesign — **DO NOT do without the user.**
- The user explicitly said don't redesign these wholesale without him. He also said he **wrote
  detailed specs** for **Profile** and **Leaderboard** earlier in the chat — find those / ask him
  before starting. Leaderboard render: `openLeaderboard`/`renderLeaderboard` area in `main.ts`
  (~line 2200, look for `open-leaderboard`). Own profile: `openProfile()` (~line 2070).

### General mobile audit (the user keeps hitting this)
- Vertical overlap on mobile appears across screens (shop, lucky spin, etc.). When touching any
  screen, check its `@media (max-width: 820px)` block for `flex:1 1 auto; min-height:0` squish
  that overlaps stacked blocks — set content-size + scroll instead.
- The user reviews on an **iPhone PWA** and in **Telegram** — verify nothing overlaps the safe
  area / TG header (use `--sai-*`).

---

## 4. Things the user values (tone/quality bar)

- "AAA", "по физике", "красиво", "стеклянное", "living" — he wants real physics + tasteful glass,
  not cheap CSS. The dust/firefly systems are the quality bar; match it.
- Minimalism with clear accents — he hates "Excel table" / "slipped together / no accents" layouts.
- He gets (rightly) frustrated when fixes silently disappear — that's the clobbering issue (§0.2).
  **Always verify origin and tell him the verification result** so he trusts the work landed.
- He's running low on usage limits; keep responses efficient and ship working code.
