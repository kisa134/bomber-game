# Game screens — content, function & where it lives

Reference for designing the screens of **BomberMeme.fun** (desktop + mobile web,
PWA). One SPA; screens are `<section class="screen">` toggled by `.hidden`.

## Where everything lives
- **Markup (all screens & modals):** `apps/client/index.html`
- **Styles:** `apps/client/src/style.css` (single file; class-based, plain CSS — no Tailwind)
- **Logic / handlers / dynamic content:** `apps/client/src/main.ts`
- **Screen switching + screen list:** `apps/client/src/ui/lobby.ts` (`showScreen()`, `ScreenName`)
- **In-match canvas rendering:** `apps/client/src/game/renderer.ts`; input `…/game/input.ts`
- **Sprites/art:** `apps/client/public/sprites/` (characters `skin_0..10`, bombs, explosions, powerups, floor)
- **Sitemap / flow:** `docs/SITEMAP.md`

Many screens render their inner body dynamically from JS into a container div
(noted as “JS-rendered” below) — those have no static markup to restyle, only a
mount point + the JS template.

Two persistent layers sit above every screen (except `game`/`splash`):
- **`#chrome` top bar** (`index.html` ~30–49): brand left; right cluster = 🪙 chips · 💎 $BGDF balance · 🔗 wallet · ⚙ settings · ❓ help.

---

## Full-screen screens

### 1. `#splash` — entry (currently disabled)
`index.html:67` · video backdrop + logo, tagline, **Enter game / Connect wallet / About**, and the red alpha-token banner. Boot currently skips straight to the hub.

### 2. `#loading` — `index.html:87`
Logo + spinner + status line. Shown during connect/reconnect.

### 3. `#menu` — MAIN HUB — `index.html:94`
Hero-centered premium hub (recently redesigned). Contains:
- Thin service header (in `#chrome`).
- **Hero stage:** big character sprite (`#hub-hero-img`) on a theatrical spotlight + floor shadow; deep atmospheric background.
- **Player passport** (`.hero-passport`): crowned nickname input (`#nickname`) + one progress line (rank · LV · bar · next) — `#hub-progress`.
- **Primary CTA:** golden `🌐 PLAY ONLINE` (`#open-play`); quiet text link `or practice vs bots →` (`#open-practice`).
- **Footer:** bottom-left teaser chips (Season / Leaderboard / Friends), bottom-right utility dock (Profile / Shop / Spin / Invite) — dark-glass tabs, 50%→100% on hover.

### 4. `#training` — Train vs Bots setup — `index.html:186`
Two modes (Practice Sandbox / Competitive Bots). Panels: **Match** (difficulty seg, bots stepper), **Practice rules** (toggles: co-op, god mode, respawn bots/crates, freeze bots), **Starting loadout** (bombs/fire/speed steppers + kick/wall-pass chips). Footer: reward note + **▶ Start**. Sandbox-only panels hide in competitive.

### 5. `#lobby` — online lobby browser — `index.html:300`
- **Bento mode cards:** *Casual* (chips: ⚡ Quick Match + stake chips) and *The Arena* (real tokens, winner takes pot, stake chips).
- **Active lobbies:** ➕ Create, join-by-CODE input, filter/sort bar, room list (`#tables-list`, JS-rendered). Tap a room to join.

### 6. `#room` — pre-match waiting room — `index.html:415`
3-column grid:
- **Left:** your character carousel (`#skin-hero`, prev/next, lock/unlock-in-shop).
- **Center:** player seats grid (`#room-players`) + match settings (`#room-settings`).
- **Right:** prize pot (`#room-prize`), chat (`#chat-log`/`#chat-input`), reactions/emotes.
- Top: room type/Public-Private, invite CODE + copy, region. Live **stake-raise vote**.
- Bottom action bar: status + **⬆ Raise stake / ✅ Ready up / ▶ Start now**.

### 7. `#game` — the match — `index.html:486`
- `<canvas id="canvas">` (rendered by `renderer.ts`), leave ✕, hit-flash, callout, spectator overlay, countdown overlay, killfeed, toast.
- **HUD panel** (`#hud-panel`): timer, your kit (`#hud-bottom`), balance bar, players/scores (`#players`), in-game emotes, ping. Reflows to side strips in landscape phones.
- **Touch controls** (`#touch-controls`): d-pad or joystick (settings), bomb button + full right-side bomb tap-zone. Portrait phones show a **Rotate** hint.

### 8. `#result` — post-match — `index.html:546`
Hero (title + place), rewards (`#result-rewards`), progression bar, **Standings** board, fairness note. Actions: **↩ Back to lobby**, Change setup, 📸 Share, 👥 Invite, Leave to menu.

### 9. `#profile` — career — `index.html:365`
Header (back, 📸 Share). Body `#profile-body` is **JS-rendered**: hero/skin, level/XP progression, lifetime stats, wallet/balance. (Template in `main.ts` `openProfile()`.)

### 10. `#leaderboard` — `index.html:377`
Tabs: 🏆 Rating / 💎 Earned / 🪙 Free. Ranked list `#leaderboard-body` (JS-rendered, rows open public profile). Back.

### 11. `#referral` — Invite & Earn — `index.html:579`
KPI strip; left col = invite link + share (X/TG) + your network tree; right col = “how it works” (5-level rake) + earnings calculator (projection). Mostly static markup + JS-filled facts.

### 12. `#shop` — skin store — `index.html:639`
Header with economy balances. Filters (All/Owned/Available/Locked) · grid `#shop-grid` (JS-rendered cards) · detail panel `#shop-detail` (selected skin: art, price, buy/equip).

### 13. `#settings` — `index.html:391`
Toggles: Music, Sound effects; Mobile controls (Joystick/Buttons). Back.

---

## Modals (overlay any screen) — `.modal`

- **`#wallet-modal`** `index.html:723` — connect Solana wallet: browser wallet list + phone QR + deeplinks (Phantom/Solflare/Backpack/OKX/Coinbase).
- **`#bank-modal`** `index.html:676` — deposit / claim-by-signature / withdraw the real token; in-game vs wallet balances; treasury address; pump.fun link.
- **`#create-modal`** `index.html:165` — create a lobby: currency (chips/token), visibility (public/private), stake picker.
- **`#friends-modal`** `index.html:149` — add by nickname, requests, list, online status.
- **`#pubprofile-modal`** `index.html:571` — another player's public profile (JS-rendered body).
- **`#sharecard-modal`** `index.html:346` — share card preview (1080² canvas PNG + QR) + share/save/copy/X/TG, style cycle.
- **`#wheel-modal`** `index.html:661` — Lucky Spin: horizontal reel strip + marker, result, **Spin · 200 🪙**.
- **`#onboard`** `index.html:~58` — first-launch onboarding / how-to (re-openable via ❓).

---

## Notes for design
- **Single accent = gold** (`--accent`); glow is reserved for the primary CTA. Dark, atmospheric, “premium game”, not SaaS/admin.
- **Mobile-first matters:** every screen must work portrait + landscape; the match is landscape-only (rotate hint).
- **JS-rendered bodies** (profile, shop grid, leaderboard list, room seats/prize, referral tree, result board) are built in `main.ts` — to restyle them, design the component and we wire the same class names there.
- The standalone **admin** (`/admin`, server-rendered) and the **character-cards** tool (`/cards.html`) are separate from the game SPA and not part of player-facing design.
