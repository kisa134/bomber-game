# Pre-launch QA checklist

Run before the public release + token launch. Tick on a real device + 2 accounts.

## 🔴 Money path (critical — real funds)
- [ ] Deposit → balance credited → shown in admin Money tab + ledger.
- [ ] Withdraw → tx succeeds → appears in withdrawals log + CSV.
- [ ] Staked match: stakes escrowed, winner paid, rake/referral split correct.
- [ ] Abort/disconnect mid-staked-match → tokens refunded (or recovered on boot).
- [ ] Bulk grant credits the right wallets (test small first).
- [ ] **DB wipe** done for a clean launch (ratings/balances/tournaments reset).

## 🏆 Tournaments
- [ ] Admin: create (points + bracket), open reg, announce.
- [ ] Players see Season + banner; register; check-in.
- [ ] Seed round → players get "Join your match" → play → standings update.
- [ ] Finish → winner shown; (prizes paid via bulk grant / manual).

## 🔑 Auth / accounts
- [ ] Google login (after Publish) links email to profile.
- [ ] Telegram link via bot; reminders DM arrives.
- [ ] Session persists; reconnect after drop works.

## 🎮 Gameplay / UX
- [ ] Mobile landscape: joystick precise, TAP bomb, HUD fits, no sideways scroll.
- [ ] Lobby: ready/countdown/AFK-drop; can't get yanked out by accident.
- [ ] Result screen: LVL bar, rating, cards render; no overflow.
- [ ] Daily reward popup; value shows in $/SOL per settings.
- [ ] Audio: see AUDIO.md checklist.

## 📡 System / admin
- [ ] Admin tabs all load (Director/Money/Players/Tournaments/System/Growth).
- [ ] AI "Analyze now" returns a brief; /admin/snapshot returns full JSON.
- [ ] Load benchmark sane; no console/Sentry errors during a full match.

## 🚀 Launch config
- [ ] Render envs set: GOOGLE_CLIENT_ID/SECRET, TG_BOT, wallet addresses, AUTH_SECRET, ADMIN_TOKEN, DATABASE_URL, SOLANA_RPC, TREASURY_*.
- [ ] Google OAuth app **Published**.
- [ ] Token relaunch (120M buyback) done; mint/ticker correct.
