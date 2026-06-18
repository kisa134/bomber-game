// In-memory ring buffer of recent notable events for the /admin live feed —
// referral attributions, deposits, withdrawals, referral payouts, matches.
// Lets you watch things happen in real time (e.g. a friend's wallet attaching).

export interface AdminEvent {
  t: number; // epoch ms
  icon: string;
  text: string;
}

const buf: AdminEvent[] = [];
const MAX = 80;

export function logEvent(icon: string, text: string): void {
  buf.push({ t: Date.now(), icon, text });
  if (buf.length > MAX) buf.shift();
}

/** Newest first, capped for the panel. */
export function recentEvents(limit = 40): AdminEvent[] {
  return buf.slice(-limit).reverse();
}

/** Short wallet form for display: ABCD…WXYZ. */
export function shortWallet(w: string): string {
  return w && w.length > 10 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w || "?";
}
