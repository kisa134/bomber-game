# LVL / Rating / Progression — system spec

Single source of truth for how XP, levels, Elo rating, and unlocks work.
Derived from the code (`packages/shared/src/constants.ts`, `apps/server/src/store.ts`).

## XP & Level
- **XP per match** (`xpForMatch`, store.ts): `10 + 5 × frags + (won ? 30 : 0)`.
  - Typical: a loss with 1-2 frags ≈ 15-20 XP; a win with 3 frags ≈ 55 XP.
- **Level** (`levelForXp`): `1 + floor(xp / 200)` — a flat **200 XP per level**.
- **Where XP comes from:** real PvP matches, competitive bot matches (small), and
  the **daily reward** (`dailyReward` grants XP too).
- **What level affects:**
  - **Skin unlocks** — each skin needs a minimum level (below) + a chip price.
  - Passport / hub "LVL" badge, leaderboard "LV" tag.
  - Daily reward scales slightly with level.

## Rating (Elo)
- Start **1000** (`STARTING_RATING`), **K = 32** (`ELO_K`), zero-sum per match
  (`eloDeltas`): the winner gains ≈ the sum of what losers lose; beating a
  stronger player pays more.
- **Only real PvP moves rating** — `recordStats()` skips practice / bot rooms
  (and tournament pods are real PvP, so they DO move rating).
- **Affects:** league tier (Beginner→Advanced→Pro→Champion), the ranked
  leaderboard, and the displayed rank.

## Skins / unlocks (tuned economy)
- `SKIN_UNLOCK_LEVEL = [0,0,0,0,0,4,7,10,14,18,22]` — **first 5 free** (the 4
  starters + a free starter rare, Doge #4, owned from the first login).
- `SKIN_PRICES (chips) = [0,0,0,0,0,2500,4000,6000,8000,11000,16000]`.
- New wallets also get a **welcome bundle** of `STARTING_CHIPS = 2500`.
- To own a paid skin you need **both** the level **and** the chips (or buy with
  token via the shop).

## Progression estimate ("~1 week to unlock all")
- Top skin = level 22 = **4400 XP** ≈ **~110-180 matches** (depends on win rate /
  frags). At ~3 min/match that's ≈ **5-9 h** of play ≈ a week at ~1.5 h/day. ✅
- Chips for the full paid set ≈ 47,500 chips; the 2,500 welcome bundle + match
  rewards (win 100 / play 20) + dailies (50→350 + 500 weekly bonus) cover this in
  roughly the same window, with a free rare skin in hand from day one.
- **Tuning levers:** `xpForMatch` constants, `200`-XP step, `SKIN_PRICES`,
  `SKIN_UNLOCK_LEVEL`, `STARTING_CHIPS`, `DEFAULT_SKINS`, daily reward constants.

## Notes / decisions
- No token reward for rating (by design) — tokens come from buying or referral.
- Daily login streak (chips/XP) + win-streak chip on the result screen are the
  retention loops alongside LVL.
