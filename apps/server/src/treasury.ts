// Rake engine accounting (Model B) + treasury wallet registry. On each PAID
// (token) match the 5% house rake splits per the tokenomics:
//   Burn 25% · 5-Tier Referral 21% · Dev Treasury 54%.
// Referral is actually paid out (see referral.ts). Burn is ACCRUED here and
// swept on-chain on demand from /admin (burnFromTreasury). Dev Treasury is the
// remainder the house keeps in the treasury wallet.
//
// Counters are since-restart (in-memory); promote to a DB table when durable
// lifetime history is needed.

import { RAKE_SPLIT_BPS } from "@bomberpump/shared";

export interface RakeBuckets {
  total: number; // base units, since restart
  burn: number; // accrued to burn
  referral: number; // paid out to referral chains
  devTreasury: number; // kept by the house
  matches: number;
  burnSwept: number; // already burned on-chain
  burnSweepable: number; // accrued − swept
}

const buckets = { total: 0, burn: 0, referral: 0, devTreasury: 0, matches: 0 };
let burnSwept = 0; // base units burned on-chain so far (since restart)

/** Record one match's house rake (token base units) into the split buckets. */
export function recordRake(rakeBase: number): void {
  if (!(rakeBase > 0)) return;
  buckets.total += rakeBase;
  buckets.matches += 1;
  buckets.burn += Math.floor((rakeBase * RAKE_SPLIT_BPS.burn) / 10000);
  buckets.referral += Math.floor((rakeBase * RAKE_SPLIT_BPS.referral) / 10000);
  buckets.devTreasury += Math.floor((rakeBase * RAKE_SPLIT_BPS.devTreasury) / 10000);
}

/** Accrued rake split, since restart (token base units). */
export function rakeAccrued(): RakeBuckets {
  return { ...buckets, burnSwept, burnSweepable: Math.max(0, buckets.burn - burnSwept) };
}

/** Mark `amountBase` as burned on-chain (call AFTER a successful burn tx). */
export function markBurned(amountBase: number): void {
  if (amountBase > 0) burnSwept += amountBase;
}

/** Treasury & destination wallets, from env (shown in admin for transparency).
 *  The first three are the locked allocation wallets; `burn` is the rake sink.
 *  (Real Yield / DAO wallets are Phase 2 — not used at launch.) */
export function treasuryWallets(): Record<string, string> {
  return {
    gameTreasury: process.env.WALLET_TREASURY ?? process.env.TREASURY_ADDRESS ?? "",
    marketingCex: process.env.WALLET_MARKETING ?? "",
    devTeam: process.env.WALLET_DEVTEAM ?? "",
    burn: process.env.WALLET_BURN ?? "",
  };
}
