# Pre-launch backlog (single source of truth)

Tracked task list. `[ ]` = todo, `[~]` = in progress, `[x]` = done. Numbers in
() = how many times you raised it = priority signal.

## 🔴 Bugs (fix first)
- [x] (2) **Ghost free lobby:** empty lobby stays listed/joinable, can't be entered → *fixed: `listTables()` lists only rooms with `humanCount > 0 && acceptsPlayers()`; empties reap in ≤30s.* ✅
- [x] (2) **Invite on empty seats:** *fixed: EVERY empty seat is now a clickable "＋ Invite a friend" slot (was only the first) — taps fire the room invite/copy-link.* ✅
- [x] (1) **[NEW] Room drops on misclick:** *guarded: leaving the waiting room as host now confirms ("Leave and close this room?") so an accidental tap can't silently abandon/reap a room with no way back; cancels tracked to analytics.* ✅
- [x] (1) **Co-op/Practice lobby resets:** *fixed: the host now edits the match length live in the waiting room (segmented 2/3/5 min, server-broadcast) — no re-create needed; the host-leave confirm still guards accidental abandon. Mode/map stay fixed ("Soon").* ✅
- [x] (1) **Kick:** *fixed: root cause was reachability — the only kick was a tiny 26px ✕ in the seat corner, so on touch a near-miss opened the profile instead. Now there's a clear "👢 Kick from lobby" button inside a member's profile card, the seat ✕ is bigger (34px, above the tap target), and both paths confirm + toast. Server path was already correct.* ✅
- [~] (1) **Friends online status:** existing friends don't show as online → *hardened: presence TTL 45s→90s (survives background-tab timer throttling), beat on tab-visible, online-wallet count exposed to admin (`Signed-in online` tile) + AI snapshot. Also: friend rows now show live activity (⚔️ in a match / in a lobby / online) and a name taps through to the public profile. Needs live confirm.*

## 🟡 Build before launch — UI/UX
- [x] (2) **Bank/winnings display toggle:** *done: Settings → "Show value in" toggles USD $ / SOL ◎; all token-worth readouts (balance badge, HUD pot, prize pool, table browser, result earnings) convert in the chosen unit and update instantly. /price now returns USD + SOL.* ✅
- [x] (1) **Stake indication:** *done: stake-raise / kick / error notices are slim, blurred, auto-dismissing glassmorphism toasts (success/info/error accents) instead of the full-width red banner; the live vote panel got a matching backdrop blur.* ✅
- [x] (1) **Match result screen:** *done: animated LVL/XP bar fills from your pre-match XP to what you earned (level-up snaps to a fresh bar, distinct cyan/violet fill vs the league bar); reward strip gained First Blood + XP-earned cards on top of the existing animated league bar + win-streak chip.* ✅
- [ ] (1) **Mobile:** bring the main game screen to the final concept; check all screens. *(needs the final concept reference; safe polish + new-element mobile checks done.)*
- [ ] (1) **Web design:** port design to the landing + full integration.
- [x] (1) **Lobby UX:** *done: every empty seat invites — opens the friends list (invite mode) or copies a share link.* ✅

## 🟡 Build before launch — Gameplay/content
- [ ] (2) **Tournaments:** as described on the landing.
- [ ] (1) **New modes & maps.**
- [x] (1) **Always-open bot rooms:** *built (persistent public, non-ranked, chips-only; real lobbies you invite into / start vs 1-2 bots; match ends when the last human dies). **Currently DISABLED** (CASUAL_BOT_ROOMS=0) by request until the lobby flow is happy — flip the env var to re-enable.* ⏸️
- [ ] (1) **Cards (Season 1):** first drop; polish style (corners/"cool") per refs.
- [ ] (1) **Side-bets (GTA-style, optional):** spectators/players bet on others; design mechanic + revenue.

## 🟡 Progression / onboarding / social
- [ ] (1) **Ranked reward:** small extra token reward for ranked wins (continuous progression beyond LVL).
- [ ] (1) **Progression economy:** ~1 week of active play to unlock all current cards/skins.
- [x] (2) **Dailies & streaks:** *done: daily login reward (chips + XP) scaling with the login streak & level, plus a 7-day milestone bonus; 🎁 popup + pulsing top-bar icon shown only when claimable. (Real-token rewards intentionally NOT included — needs your numbers.)* ✅
- [~] (1) **Onboarding:** *done: dimmed-UI spotlight tutorial after the intro slides (Play / vs Bots / Friends / Shop). Remaining: grant a starter card set on first game.*
- [~] (1) **In-game chat / social ping:** light popup for quick chat with friends. *(DM chat deferred by request; instead shipped friend → room invites: tap an empty lobby seat to invite a friend, they get a Join/Decline ping + toast and the Friends module pulses.)*

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
> (≈USD), win-streak chip on result, friend live-activity status +
> tap-name-to-profile, reliable kick (profile-card button + bigger ✕ + confirm),
> USD/SOL value-unit toggle, glassmorphism toasts, animated result LVL bar +
> First Blood/XP stat cards, daily login reward (chips/XP streak + 7-day bonus),
> onboarding spotlight tutorial, English-only UI pass, always-open bot LOBBIES
> (invite/start vs bots, end-on-last-human-death, ×10), friend room invites,
> second hub music track (two-song playlist). Host match-length editing was
> built then hidden (didn't fit the lobby) — fixed 3-min rounds for now.
