// Lightweight operational alerting — no external SDK. Money-path failures call
// alert(); it logs, pushes to the /admin activity feed, and (if ALERT_WEBHOOK is
// set) POSTs to a webhook. The JSON body carries both "content" (Discord) and
// "text" (Slack/generic) so a Discord or Slack incoming-webhook URL works as-is.
// For richer error tracking later, layer Sentry on top — this is the floor so
// you're never blind to failing withdrawals/settlements.

import { logEvent } from "./events.js";

const WEBHOOK = process.env.ALERT_WEBHOOK ?? "";
const THROTTLE_MS = 60_000;
const lastSent = new Map<string, number>(); // de-dupe identical alerts

export function alert(msg: string, key = msg): void {
  console.error("[ALERT]", msg);
  try {
    logEvent("🚨", msg);
  } catch {
    // events buffer is best-effort
  }
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < THROTTLE_MS) return;
  lastSent.set(key, now);
  if (lastSent.size > 200) lastSent.clear();
  if (!WEBHOOK) return;
  void fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `🚨 Bombermeme: ${msg}`, text: `🚨 Bombermeme: ${msg}` }),
  }).catch(() => {
    // never let alerting throw into the money path
  });
}
