# BomberMeme.fun — Master Launch Plan (source of truth)

Consolidates everything remaining before launch + the build order. Owners:
**🤖 = Claude (code)**, **🧑 = you (decisions/design/visuals)**, **🔧 = ops/Kirill (config/keys)**.

Status legend: ✅ done · 🔨 in progress · ⏭ planned · ⚠️ verify on prod · 🔧 config/business.

---

## 0. Shipped recently (this stretch)
- ✅ Unique per-player lobby colours (8, no dup with 7 bots).
- ✅ New economy (~1 week unlock) + free starter skin + 2500 welcome chips.
- ✅ Marketing landing built (parked at `/landing.html`; game stays at root).
- ✅ Public `/stats` + landing analytics wiring.
- ✅ Tournament **test mode**: solo organizer fills pods with bots (dry-run).
- ✅ Google/Twitter OAuth **seamless return** to the same host + Settings shows the link.

---

## 1. 🔴 Launch blockers (must close before go-live)

### 1A. Money path — live end-to-end QA (🤖 build hooks · 🧑🔧 run on prod)
- Deposit → balance credited → shown in admin Money + ledger.
- Withdraw → tx → withdrawals log + CSV.
- Staked match: escrow → winner paid → rake/referral split correct.
- Abort/disconnect mid-staked → refunded (or recovered on boot).
- `HOUSE_RAKE_BP=500` + `REFERRAL_ROOT=<owner wallet>` set on prod. 🔧
- **DB wipe** for a clean launch (ratings/balances/tournaments). 🔧

### 1B. Tournament UX redesign (🤖) — *you couldn't run one; #1 build priority*
- **Admin:** one-screen "run a tournament" flow (create → open reg → check-in →
  seed → live → finish) with clear current-state + next-action buttons, live
  pod/standings view, prize tracking. Today it's scattered → make it a wizard.
- **In-game Seasons page** (see §3) so players can actually find/join.
- Verify the full loop with **test mode** (bots) before real money.

### 1C. Tokenomics in code (🤖 partial · 🔧 business)
- ✅ 5-level referral live. ⚠️ rake engine gated (`HOUSE_RAKE_BP=0`→500).
- ⏭ rake splitter (burn / dev / DAO) — only referral is wired; burn/yield/DAO
  are marketing-roadmap until built. Decide: ship with referral-only + "soon",
  or build burn now.
- 🔧 Token relaunch (120M buyback), keys → Kirill.

### 1D. Auth/config (🔧)
- Google OAuth app **Published** (In production) + redirect_uri
  `https://bombermeme.fun/auth/google/callback` registered.
- Render envs: GOOGLE_*, TG_BOT/TG_APP, wallet addresses, AUTH_SECRET,
  ADMIN_TOKEN, DATABASE_URL, SOLANA_RPC, TREASURY_*, analytics keys.
- Telegram Mini App URL → game (root).

---

## 2. 🟠 Admin 3.0 → 4.0 (🤖, internal = low risk, build in phases)

Goal: a "grown-up" control center — one overview that drills into everything,
more charts/logs, real AI chat, marketing metrics, interactive system map.

- **3.0 Phase A — Overview dashboard:** single landing with the KPIs that matter
  (online, DAU, matches, deposits/withdrawals, treasury, errors, load) as
  **clickable cards** → drill into each section. Trend charts (DAU / revenue /
  load) + live log stream. Redesign in a cleaner, modern theme (ref: Kirill's km).
- **3.0 Phase B — Real AI chat:** conversation + **streaming** (see it think) +
  visible **tool-calls** (what data it pulls), snapshot as context, history.
  Hook for your external AI-with-memory. Daily Markdown audit log written by AI.
- **3.0 Phase C — Marketing + interactive architecture:** integrate Kirill's
  marketing (kimi) data/metrics dashboard; turn the architecture HTML into a
  clickable map (block → logs/screen). Recommender (growth points) from AI.
- **4.0:** AI as recommender/forecaster (metrics prediction, macro/cap/users),
  marketing-attribution dashboards, anomaly alerts.

Blockers for C: **kimi repo access** (put `kisa134/km` files into our repo or
grant access) + confirm "build interactive map from code" (I can).

---

## 3. 🟣 Seasons & Tournaments — full player experience (🤖)

A real destination, like top games. **Hub → "Season" → Season Hub**, with sub-views:

1. **Season Hub (overview):** season name + countdown, your rank/points/tier,
   live prize pool, top-3 podium, "what's on now" (open tournaments/your match),
   quick CTA (Join / Check-in / Play your match), rewards preview.
2. **Tournaments list:** all tournaments (status pills: reg open / check-in /
   live / done), format, prize, entry (free/buy-in), registered count → tap for
   detail.
3. **Tournament detail:** rules, format (points/bracket), schedule, prize split,
   your status (register / check-in / your live match → Join), bracket/standings
   view (live), participants.
4. **Season leaderboard:** ranking by points (+ tabs: rating / tokens won).
5. **Rewards/track:** what you earn at each rank/tier this season (cosmetics,
   chips, token) — drives the grind.

Data: all from existing `/tournaments`, `/tournament?id=`, `/leaderboard`,
`/stats`. In hub-glass style. Decide later: integrate the new AAA visuals you're
making. **This is the #1 build chunk after the admin tournament flow.**

---

## 4. 🟡 Gameplay / engagement (🤖, post-blocker)

- **Bot lobbies** (your idea): create a lobby with bots + toggle **public** so
  others can join; kick bots (host, or majority one-click vote); kick buttons
  appear only when bots present; human-kick stays host-only (anti-grief).
- **Premium Match Results** rescreen: black/blue glass (no purple), animated LVL
  bar, stat cards, share image, loss-aversion framing.
- New modes & maps. Season-1 card drop. In-game quick chat with friends.
- More Solana wallets. Telegram wallet deep-links (App→Web→TG seamless).
- (Decide) small token reward for ranked wins — currently **NO** by your earlier
  rule; flag if changing.

---

## 5. 🟢 QA before launch (🧑🤖)
- Audio fire-check (AUDIO.md); leaderboard wipe; LVL audit (done, verify);
  full money E2E (§1A); general manual + programmatic pass (QA_CHECKLIST.md).

---

## Build order (Claude's recommended sequence)
1. **Admin tournament flow** (so you can actually run one) + verify with bots.
2. **Season/Tournaments player pages** (§3).
3. **Admin 3.0 Phase A** (overview dashboard) + **B** (AI chat).
4. **Bot lobbies** (§4) + **Match Results** rescreen.
5. **Admin 3.0 Phase C** (marketing/kimi + arch map) once repo access is given.
6. Continuous: money E2E hooks, tokenomics, QA — alongside, gated by 🔧 config.

Deploys: committed per chunk, pushed **only on your "ok"**. Admin work is
internal (safe). Anything touching root routing / game URL: never again without
explicit sign-off.

---

## What Claude needs from you (minimal)
1. **Priority order** ok as above? (or reorder)
2. **kimi repo** `github.com/kisa134/km`: add its files to our repo (a folder) or
   grant access — and say what to take (design / data / metrics).
3. **Prod config window** (§1D, §1A): when do we flip rake on, wipe DB, publish
   Google app?
4. Confirm: I build the **interactive architecture map from our code** (yes/no).
5. Token-for-ranked-win: keep **no**, or add small reward?
