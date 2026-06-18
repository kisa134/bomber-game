// Multi-level referral rewards. When a player pays rake into a TOKEN staked
// match, a slice of that house rake is paid up their referral chain — 5 levels
// deep. Rewards are custodial token credits (the tokens already sit in the
// treasury as rake), so this is a pure ledger operation. Everything is
// best-effort and guarded so it can NEVER break match settlement.

import { store } from "./store.js";
import { fromBaseUnits } from "./token.js";
import { logEvent, shortWallet } from "./events.js";

// Level payout in basis points of the rake: L1 10%, L2 5%, L3 3%, L4 2%, L5 1%.
// House keeps the remaining 79% of the rake.
export const REFERRAL_LEVEL_BPS = [1000, 500, 300, 200, 100];

/** Pay `rakeBase` (token base units of house rake from one staker) up that
 *  staker's referral chain. Safe to await-less; resolves quietly on any error. */
export async function distributeReferralRewards(staker: string, rakeBase: number): Promise<void> {
  if (!staker || rakeBase <= 0) return;
  try {
    const seen = new Set<string>([staker]); // cycle guard
    let current = staker;
    for (let level = 0; level < REFERRAL_LEVEL_BPS.length; level++) {
      const profile = await store.getProfile(current);
      const upline = profile?.referred_by ?? "";
      if (!upline || seen.has(upline)) break; // top of the pyramid (or a cycle)
      seen.add(upline);
      const reward = Math.floor((rakeBase * REFERRAL_LEVEL_BPS[level]) / 10000);
      if (reward > 0) {
        await store.creditReferral(upline, reward);
        logEvent("💸", `${shortWallet(upline)} earned ${fromBaseUnits(reward).toLocaleString(undefined, { maximumFractionDigits: 2 })} (L${level + 1})`);
      }
      current = upline;
    }
  } catch (e) {
    console.error("[referral] distribute failed", e);
  }
}
