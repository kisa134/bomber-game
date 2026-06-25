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

## Skins / unlocks
- `SKIN_UNLOCK_LEVEL = [0,0,0,0,3,5,8,12,16,20,25]` (first 4 free).
- `SKIN_PRICES (chips) = [0,0,0,0,2000,3500,5000,7000,9000,12000,20000]`.
- To own a paid skin you need **both** the level **and** the chips (or buy with
  token via the shop).

## Progression estimate ("~1 week to unlock all")
- Top skin = level 25 = **5000 XP** ≈ **~125-200 matches** (depends on win rate /
  frags). At ~3 min/match that's ≈ **6-10 h** of play ≈ a week at ~1.5 h/day. ✅
- Chips for the full set ≈ 58,500 chips; match rewards (win 100 / play 20) +
  dailies (50→350 + bonuses) cover this in roughly the same window.
- **Tuning levers:** `xpForMatch` constants, `200`-XP step, `SKIN_PRICES`,
  `SKIN_UNLOCK_LEVEL`, daily reward constants. (See economy-tuning task.)

## Notes / decisions
- No token reward for rating (by design) — tokens come from buying or referral.
- Daily login streak (chips/XP) + win-streak chip on the result screen are the
  retention loops alongside LVL.
