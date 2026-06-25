# BomberMeme.fun — Landing page spec (source of truth)

Standalone marketing landing at the **root** (`bombermeme.fun/`), in the game
hub's visual language (glassmorphism, gold/purple, Cinzel + Space Grotesk).
Built as a **progressive-disclosure** site: a one-screen manifesto up top, every
strip expands into deeper layers (L0 → L4). Everything is real data wherever the
backend already exposes it; honest "Soon" where it doesn't yet.

The game moves to **`/play`**; the landing owns `/`. Token ticker/mint/contract
come from `packages/shared/src/constants.ts` (`TOKEN_TICKER`, `TOKEN_MINT`) so the
landing and the game always agree and auto-update on token relaunch.

## Disclosure levels
- **L0** — one-screen manifesto: hero promise + 8 horizontal strips, < 10 theses.
- **L1** — hover/tap: strip grows, shows a 1-line sub + a micro-visual.
- **L2** — click: inline panel under the strip (mechanic + numbers + CTA).
- **L3** — "More": full tray/section (schemes, tables, walkthrough, UI panels).
- **L4** — deep: all raw data (tokenomics, code, FAQ, external links, sub-pages).

## Data sources (legend)
- 🟢 **live** — real, from an existing public endpoint.
- 🔵 **config/doc** — from constants/docs (static but real & authoritative).
- 🟡 **new** — needs a small new public endpoint (we add it).
- 🔴 **soon** — no real source yet; shown honestly as "Soon"/0, never faked.

---

## Block 1 — Core pitch
- L0 strip: **"Pure skill. Massive stakes. No luck."** / "Winner takes the pot."
- Markers: browser-native · no download · Solana-native · instant payout ·
  provably fair · 2–4 players. 🔵 (FAQ/constants: `MAX_PLAYERS_PER_ROOM=4`)
- L2: 2–3 line pitch + CTAs **Find Match** / **Enter Ranked** (→ `/play`) /
  **Buy $TICKER** (→ pump.fun/coin/`TOKEN_MINT`). 🔵
- L4: Season 1 narrative, live prize pool, escrow-live statement, TMA mention,
  closing promise. Prize pool 🟡 (`/stats`).

## Block 2 — Live arena
- L0 strip: "Real players. Real payouts." + one live number (online). 🟢 `/online`
- L2 dashboard: active prize pool 🟡, **players online** 🟢 `/online`,
  matches today 🟡, prize paid out 🟡, top MMR 🟢 `/leaderboard?board=rating`.
- L3 kill feed: recent eliminations / winners + pot + arena label. 🟡 `/stats`
  (recent finished matches) — live per-kill WS feed is a later upgrade. 🔴
- Counters "games played / total pot / active players". 🟡 `/stats`

## Block 3 — Competitive layer
- L0 strip: "Climb the MMR."
- L2: Elo rating, anti-smurf, season resets, decay protection; rank tiers
  **Beginner → Advanced → Pro → Champion**. 🔵 (FAQ; `STARTING_RATING`, `ELO_K`)
- L3 leaderboard table (rank / player / earned / MMR), tabs Rating / Tokens won /
  Chips won. 🟢 `/leaderboard?board=rating|tokens|chips`
- Tournaments / Season. 🟢 `/tournaments`

## Block 4 — Match economy
- L0 strip: "Escrow before the match."
- L2: pot escrowed in Solana before start; **winner 95%**, **5% rake** splits:
  🔥 Burn 25% · 💎 Yield 25% · ⚙️ Dev 24% · 🕸️ Referral 21% · 🗳️ DAO 5%. 🔵 TOKENOMICS.md
- L3: live bet/profit calculator (stake $1–$1000 → pot & payout example). 🔵
  Example pot $10,000 → rake $500 split table (from TOKENOMICS.md). 🔵
- Status note: which splits are live vs planned (rake engine: referral 21% live,
  burn/yield/DAO planned). 🔵 (be honest — matches TOKENOMICS.md §3)

## Block 5 — Gameplay system
- L0 strip: "Last bomber standing."
- L2: 2–8 players, arena, bombs, positioning, survival, elimination; "no luck"
  as a gameplay claim. 🔵 (`MATCH_LENGTH_MS=180s`, sudden death)
- L3 power-ups: **BOMB UP · FIRE UP · SPEED UP · KICK · WALL PASS · HEALTH (rare,
  2%)**. 🔵 (`HEALTH_DROP_CHANCE=0.02`, PowerUpType). First-blood bonus. 🔵 FAQ
- Trailer "Watch the chaos". 🔴 soon (placeholder card, in-engine footage later)

## Block 6 — Access layer
- L0 strip: "Play anywhere."
- L2: browser-native · no download · Telegram Mini App. 🔵
- L3: full TMA flow (queue, lobby, spectate, guilds, payouts), browser fallback.
  🔵 (docs/telegram.md). Queue-time number 🔴 soon.

## Block 7 — Trust layer
- L0 strip: "Provably fair."
- L2: 3 steps — server commits a hashed seed → client adds entropy → reveal &
  verify. 🔵 FAQ + `MatchSeedMsg` (commit/seed) really shipped in protocol.
- L4 code block: `sha256(seed)` commit, `assert(sha256(seed) === commit)` +
  "✓ MATCH VERIFIED · 100% FAIR" badge. "No black boxes, no house edge on RNG." 🔵

## Block 8 — Universe layer (tabs: Fighters / Roadmap / Token / Community)
- **Fighters**: 11-skin roster — Shiba, Pepe, Trump, Musk, Doge, Pump, Durov,
  Vitalik, Troll, Bogdanoff, Gigachad (class/rarity by `SKIN_PRICES`). 🔵
- **Roadmap**: Phase 01 The Drop · 02 The Swarm · 03 The Furnace · 04 Global War
  (spectator, Twitch/Kick, live betting, creator rev-share, clan wars, esports).
  🔵 (copy from user; mark phases Now/Next/Soon honestly)
- **Token**: 1B $TICKER, fair launch, 88% liquidity / 5% treasury / 4% mkt / 3%
  dev (3-mo vest); live price/supply/burned/market cap; contract address (copy);
  Trade CTA. 🔵 TOKENOMICS.md + 🟢 `/price` (live price). burned % 🔴 soon.
- **Community/footer**: X, Telegram, Telegram community, TMA, pump.fun; nav
  Arena/Tournaments/FAQ/Tokenomics; "Built on Solana · Powered by Pump.fun ·
  SHA256 Provably Fair"; risk disclaimer. 🔵

---

## New backend: `GET /stats` (public, read-only)
Safe aggregate numbers for Blocks 1/2 (no PII, cached ~10s):
`{ online, players, gamesPlayed, potValueTokens, prizePaidTokens, topMmr,
   recent: [{ winner, potTokens, mode, ago }] , ticker, priceUsd }`.
Sourced from `onlineCount()`, `analytics.snapshot()`, `store.economyStats()`,
`store.leaderboard()`, token price. Whatever isn't tracked yet → 0 + 🔴 in UI.

## Routing & integration
- `/` → `landing.html` (new Vite entry). `/play` → game `index.html`.
- Vite: add `landing` input; PWA `start_url`/`scope` → `/play` (installed app =
  game), landing stays a normal page; deny `/` from SW navigate-fallback.
- Server `serveStatic`: `/` & `/index.html`→landing; `/play`(+deep links)→game.
- All landing CTAs → `/play` (+ optional hash for leaderboard/tournaments/shop).
- Buy/Trade → `https://pump.fun/coin/${TOKEN_MINT}`. Socials from config/env.
- Admin link NOT on the public landing (stays `/admin`, token-gated).

## Build phases (each shippable, nothing breaks prod)
1. `GET /stats` endpoint (+ reuse `/online`,`/price`,`/leaderboard`,`/tournaments`).
2. Landing scaffold: `landing.html` + `landing.css` (reuse hub tokens) + 8 strips
   + progressive-disclosure engine. Block 1 fully wired.
3. Fill Blocks 2–8 (content from this spec) + live fetches.
4. Routing: landing at `/`, game at `/play`, PWA + internal links.
5. Build, verify (desktop + mobile coarse-pointer), commit. **Deploy on confirm.**
