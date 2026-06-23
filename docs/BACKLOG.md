# Pre-launch backlog (single source of truth)

Tracked task list. `[ ]` = todo, `[~]` = in progress, `[x]` = done. Numbers in
() = how many times you raised it = priority signal.

## 🔴 Bugs (fix first)
- [x] (2) **Ghost free lobby:** empty lobby stays listed/joinable, can't be entered → *fixed: `listTables()` lists only rooms with `humanCount > 0 && acceptsPlayers()`; empties reap in ≤30s.* ✅
- [x] (2) **Invite on empty seats:** *fixed: EVERY empty seat is now a clickable "＋ Invite a friend" slot (was only the first) — taps fire the room invite/copy-link.* ✅
- [x] (1) **[NEW] Room drops on misclick:** *guarded: leaving the waiting room as host now confirms ("Leave and close this room?") so an accidental tap can't silently abandon/reap a room with no way back; cancels tracked to analytics.* ✅
- [x] (1) **Co-op/Practice lobby resets:** *fixed: the host now edits the match length live in the waiting room (segmented 2/3/5 min, server-broadcast) — no re-create needed; the host-leave confirm still guards accidental abandon. Mode/map stay fixed ("Soon").* ✅
- [ ] (1) **Kick:** kicking players from the lobby doesn't work. *(code path verified correct end-to-end client→server; needs live repro to pinpoint — likely UI/state, not protocol.)*
- [~] (1) **Friends online status:** existing friends don't show as online → *hardened: presence TTL 45s→90s (survives background-tab timer throttling), beat on tab-visible, online-wallet count exposed to admin (`Signed-in online` tile) + AI snapshot. Also: friend rows now show live activity (⚔️ in a match / in a lobby / online) and a name taps through to the public profile. Needs live confirm.*

## 🟡 Build before launch — UI/UX
- [~] (2) **Bank/winnings display toggle:** menu/settings switch to show room earnings in USD or tokens (auto-convert). *(partial: the in-game HUD now shows the pot on the line in tokens + ≈USD; the settings USD/token toggle itself is still TODO.)*
- [ ] (1) **Stake indication:** replace the bulky top banner with a glassmorphism/subtle-animation element for "stake raised?".
- [~] (1) **Match result screen:** dark premium screen, animated LVL bar fill + rich per-match stats as minimal cards. *(partial: the league bar now fills in lock-step with the rating count-up, and a win-streak chip 🔥 N shows on a roll. Still TODO: LVL-bar fill specifically + richer per-match stat cards.)*
- [ ] (1) **Mobile:** bring the main game screen to the final concept; check all screens.
- [ ] (1) **Web design:** port design to the landing + full integration.
- [ ] (1) **Lobby UX:** Invite button fires directly on the lobby grid.

## 🟡 Build before launch — Gameplay/content
- [ ] (2) **Tournaments:** as described on the landing.
- [ ] (1) **New modes & maps.**
- [ ] (1) **Always-open bot rooms:** non-ranked, 1-2 bots, chips-only (for skins/cards).
- [ ] (1) **Cards (Season 1):** first drop; polish style (corners/"cool") per refs.
- [ ] (1) **Side-bets (GTA-style, optional):** spectators/players bet on others; design mechanic + revenue.

## 🟡 Progression / onboarding / social
- [ ] (1) **Ranked reward:** small extra token reward for ranked wins (continuous progression beyond LVL).
- [ ] (1) **Progression economy:** ~1 week of active play to unlock all current cards/skins.
- [ ] (2) **Dailies & streaks:** daily rewards (scale with level/streak) + 7-day streak reward.
- [ ] (1) **Onboarding:** dimmed-UI tutorial; grant a starter card set for completing / first game.
- [ ] (1) **In-game chat:** light popup for quick chat with friends.

## 🟡 Auth / integrations
- [ ] (1) **Telegram:** Solana wallets connect natively to phone apps (not web pages); seamless App→Web→TG.
- [ ] (1) **Web2 login:** Google + Twitter (single account linked to a crypto wallet).
- [ ] (1) **More Solana wallets.**

## 🟢 QA / testing
- [ ] (1) **Audio:** full asset list; verify coverage + music on/off behaves as intended.
- [ ] (1) **Ratings/leaderboards:** verify; full wipe before launch.
- [ ] (1) **LVL system audit:** how it's computed, what it affects; document final spec.
- [ ] (1) **Transactions end-to-end:** deposit→withdraw→distribution (games/tournaments/referral/tokenomics)→correct admin display.
- [ ] (1) **General QA:** automated + manual pass before launch.

## 🟣 Tokenomics / infra / AI
- [ ] (1) **Token relaunch (critical):** buy back 120M of the correct token at the start.
- [x] (2) **Tokenomics integration:** Model B in code (Burn 25 / Referral 21 / Treasury 54) + referral verified. ✅
- [ ] (1) **Key security:** hand all access/keys to Kirill.
- [~] (1) **Wallet visibility:** verify all system/admin wallets; all fund monitoring in admin. *(rake engine + treasury wallets panel done; needs real addresses + balances)*
- [ ] (2) **Macro forecasting:** project macro-economics (mcap, users); research & forecasts.
- [~] (2) **AI / data-science infra:** data → DB → AI; AI is wired (kimi via WaveSpeed) and reads the full admin snapshot. *Remaining: daily Markdown audit log; recommendation engine.*
- [ ] (2) **Marketing metrics dashboard:** AI-driven, in admin, for marketing-influenced KPIs.

> Done earlier this cycle: hub redesign, character cards tool, control-centre
> (System health / Rake Engine / AI / load benchmark), GA runtime fix, Sentry,
> referral sybil cap, security headers, CI, Model B + on-chain burn.
>
> Done this session: animated result rating/league bar, in-game pot-on-the-line
> (≈USD), win-streak chip on result, host-editable match length (2/3/5 min),
> friend live-activity status + tap-name-to-profile.
