// Rake engine accounting + treasury wallet registry. On each PAID (token) match
// the 5% house rake is conceptually split per the published tokenomics
// (Burn 25 / Real Yield 25 / Dev Treasury 24 / Referral 21 / DAO 5). Referral is
// actually paid out (see referral.ts); the other buckets are ACCRUED here so the
// admin (and the AI analyst) can see exactly how much flows down each pipe.
//
// This is bookkeeping only — it does not move funds on-chain (the rake already
// sits in the treasury wallet). On-chain sweeps (burn tx, transfers to the
// yield/DAO wallets) are a later, deliberate step. Counters are since-restart
// in-memory; promote to a DB table when durable history is needed.

import { RAKE_SPLIT_BPS } from "@bomberpump/shared";

export interface RakeBuckets {
  total: number;
  burn: number;
  realYield: number;
  devTreasury: number;
  referral: number;
  daoImpact: number;
  matches: number;
}

const buckets: RakeBuckets = {
  total: 0,
  burn: 0,
  realYield: 0,
  devTreasury: 0,
  referral: 0,
  daoImpact: 0,
  matches: 0,
};

/** Record one match's house rake (token base units) into the split buckets. */
export function recordRake(rakeBase: number): void {
  if (!(rakeBase > 0)) return;
  buckets.total += rakeBase;
  buckets.matches += 1;
  buckets.burn += Math.floor((rakeBase * RAKE_SPLIT_BPS.burn) / 10000);
  buckets.realYield += Math.floor((rakeBase * RAKE_SPLIT_BPS.realYield) / 10000);
  buckets.devTreasury += Math.floor((rakeBase * RAKE_SPLIT_BPS.devTreasury) / 10000);
  buckets.referral += Math.floor((rakeBase * RAKE_SPLIT_BPS.referral) / 10000);
  buckets.daoImpact += Math.floor((rakeBase * RAKE_SPLIT_BPS.daoImpact) / 10000);
}

/** Accrued rake split, since restart (token base units). */
export function rakeAccrued(): RakeBuckets {
  return { ...buckets };
}

/** Treasury & destination wallets, from env (shown in admin for transparency).
 *  The first three are the locked allocation wallets; the rest are rake sinks. */
export function treasuryWallets(): Record<string, string> {
  return {
    gameTreasury: process.env.WALLET_TREASURY ?? process.env.TREASURY_ADDRESS ?? "",
    marketingCex: process.env.WALLET_MARKETING ?? "",
    devTeam: process.env.WALLET_DEVTEAM ?? "",
    burn: process.env.WALLET_BURN ?? "",
    realYield: process.env.WALLET_YIELD ?? "",
    daoImpact: process.env.WALLET_DAO ?? "",
  };
}
