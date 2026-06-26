// Token identity + tokenomics — single source of truth.
//
// Re-exported straight from the game's shared package (`@bomberpump/shared`) so
// the landing can NEVER drift from what the game actually uses. Do not hardcode
// the ticker/mint/percentages anywhere in the landing — import from here.
export {
  TOKEN_MINT,
  TOKEN_TICKER,
  TOKEN_DECIMALS,
  TOTAL_SUPPLY,
  GAME_BUYBACK_TOKENS,
  INITIAL_ALLOCATION_PCT,
  HOUSE_RAKE_BP_DEFAULT,
  RAKE_SPLIT_BPS,
  LEAGUES,
  leagueFor,
  ELO_K,
  STARTING_RATING,
  MAX_PLAYERS_PER_ROOM,
} from "@bomberpump/shared";

import { TOKEN_MINT } from "@bomberpump/shared";

/** pump.fun buy link, always pointed at the real mint. */
export const PUMP_URL = `https://pump.fun/coin/${TOKEN_MINT}`;

/** Rake split as whole percents (basis points / 100), live buckets only. */
export { RAKE_SPLIT_BPS as RAKE_SPLIT_BPS_RAW } from "@bomberpump/shared";
