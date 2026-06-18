// Server-side analytics. Fires authoritative events (match results, deposits,
// withdrawals) to PostHog so they can't be blocked by ad-blockers or faked by
// the client, and keeps in-memory counters for the live /admin panel.
// Inert unless POSTHOG_KEY is set.

const KEY = process.env.POSTHOG_KEY ?? "";
const HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
const ENABLED = KEY.length > 0;

const bootAt = Date.now();
const totals = {
  matches: 0,
  practiceMatches: 0,
  deposits: 0,
  depositVolume: 0, // whole tokens
  withdrawals: 0,
  withdrawVolume: 0, // whole tokens
};

function capture(event: string, distinctId: string, properties: Record<string, unknown> = {}): void {
  if (!ENABLED) return;
  try {
    void fetch(`${HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId || "server",
        properties: { ...properties, $lib: "bomberpump-server" },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    /* analytics must never break the game */
  }
}

export const analytics = {
  matchCompleted(p: {
    winner: string | null;
    players: number;
    stake: number;
    currency: number;
    practice: boolean;
    hasBots: boolean;
  }): void {
    totals.matches++;
    if (p.practice) totals.practiceMatches++;
    capture("match_completed", p.winner ?? "server", {
      players: p.players,
      stake: p.stake,
      currency: p.currency,
      practice: p.practice,
      has_bots: p.hasBots,
      ranked: !p.practice && !p.hasBots,
    });
  },
  depositCredited(wallet: string, whole: number): void {
    totals.deposits++;
    totals.depositVolume += whole;
    capture("deposit_credited", wallet, { amount: whole });
  },
  withdrawal(wallet: string, whole: number): void {
    totals.withdrawals++;
    totals.withdrawVolume += whole;
    capture("withdrawal", wallet, { amount: whole });
  },
  /** Snapshot of since-boot counters for the admin panel. */
  snapshot(): typeof totals & { uptimeMs: number } {
    return { ...totals, uptimeMs: Date.now() - bootAt };
  },
};
