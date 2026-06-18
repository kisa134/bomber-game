// Daily growth metrics for the /admin cockpit. Tracked in memory and reset at
// UTC midnight, so they map 1:1 to "what happened today". Cumulative/funnel
// history lives in PostHog (embedded in /admin); this is the at-a-glance panel.

function utcDay(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

let day = utcDay();
let presence = new Set<string>(); // unique devices seen today (DAU)
let players = new Set<string>(); // wallets that played any match today
let tokenPlayers = new Set<string>(); // wallets that played a TOKEN match today (paying)
let depositors = new Set<string>(); // wallets that deposited today
let matches = 0; // matches finished today (non-practice)
let tokenMatches = 0; // of those, token-staked
let deposits = 0; // deposit count today
let depositVolume = 0; // whole tokens deposited today

function roll(): void {
  const d = utcDay();
  if (d === day) return;
  day = d;
  presence = new Set();
  players = new Set();
  tokenPlayers = new Set();
  depositors = new Set();
  matches = 0;
  tokenMatches = 0;
  deposits = 0;
  depositVolume = 0;
}

export const metrics = {
  presence(id: string): void {
    if (!id) return;
    roll();
    presence.add(id);
  },
  match(humanWallets: string[], tokenStakers: string[]): void {
    roll();
    matches++;
    for (const w of humanWallets) if (w) players.add(w);
    if (tokenStakers.length) {
      tokenMatches++;
      for (const w of tokenStakers) if (w) tokenPlayers.add(w);
    }
  },
  deposit(wallet: string, whole: number): void {
    roll();
    if (wallet) depositors.add(wallet);
    deposits++;
    depositVolume += whole;
  },
  snapshot(): {
    day: string;
    dau: number;
    players: number;
    payingPlayers: number;
    matches: number;
    tokenMatches: number;
    deposits: number;
    depositVolume: number;
    depositors: number;
  } {
    roll();
    return {
      day,
      dau: presence.size,
      players: players.size,
      payingPlayers: tokenPlayers.size,
      matches,
      tokenMatches,
      deposits,
      depositVolume,
      depositors: depositors.size,
    };
  },
};
