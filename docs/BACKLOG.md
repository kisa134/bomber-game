# Pre-launch backlog (single source of truth)

Tracked task list. `[ ]` = todo, `[~]` = in progress, `[x]` = done. Numbers in
() = how many times you raised it = priority signal.

## 🔴 Bugs (fix first)
- [~] (2) **Ghost free lobby:** empty lobby stays listed/joinable, can't be entered → *fix in progress: hide empty (0-human) rooms from the lobby list; they reap in ≤30s.*
- [ ] (2) **Invite on empty seats:** can't invite friends from the room; make a click on a free seat at the table trigger invite.
- [ ] (1) **[NEW] Room drops on misclick:** after creating a room, an accidental click elsewhere auto-leaves and the room is gone with no way back.
- [ ] (1) **Co-op/Practice lobby resets:** changing settings in co-op/practice lobby blows the lobby away.
- [ ] (1) **Kick:** kicking players from the lobby doesn't work.
- [ ] (1) **Friends online status:** existing friends don't show as online.

## 🟡 Build before launch — UI/UX
- [ ] (2) **Bank/winnings display toggle:** menu/settings switch to show room earnings in USD or tokens (auto-convert).
- [ ] (1) **Stake indication:** replace the bulky top banner with a glassmorphism/subtle-animation element for "stake raised?".
- [ ] (1) **Match result screen:** dark premium screen, animated LVL bar fill + rich per-match stats as minimal cards.
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
