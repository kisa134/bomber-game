// Tournament reminder scheduler: every 60s, DM registered players (via their
// linked Telegram) as a contest approaches — so nobody forgets to show up.
// Best-effort and idempotent within a process (a Set guards against re-sends).

import { tournaments } from "./tournament.js";
import { identity } from "./identity.js";
import { notifyTelegram } from "./tgbot.js";

const sent = new Set<string>(); // `${tournamentId}:${kind}` already sent this process

async function dmRegistered(tid: string, text: string): Promise<void> {
  const players = await tournaments.players(tid);
  for (const p of players) {
    if (p.status === "eliminated") continue;
    const id = await identity.get(p.wallet);
    if (id?.telegramId) await notifyTelegram(id.telegramId, text);
  }
}

async function tick(): Promise<void> {
  const now = Date.now();
  const all = await tournaments.list();
  for (const t of all) {
    if (!t.startAt || t.status === "done" || t.status === "cancelled") continue;
    const dt = t.startAt - now;
    // Pick the most urgent unsent reminder whose threshold we've crossed.
    let kind = "";
    if (dt <= 5 * 60_000 && dt > -10 * 60_000) kind = "now"; // ~start time
    else if (dt <= 60 * 60_000) kind = "t1h";
    else if (dt <= 24 * 60_000 * 60) kind = "t24h";
    if (!kind) continue;
    const key = `${t.id}:${kind}`;
    if (sent.has(key)) continue;
    sent.add(key);
    const line =
      kind === "now"
        ? `🔴 <b>${t.name}</b> is starting now — open BomberMeme and check in!`
        : kind === "t1h"
          ? `⏰ <b>${t.name}</b> starts in ~1 hour. Get ready!`
          : `🏆 <b>${t.name}</b> starts in ~24 hours. You're registered — see you there!`;
    await dmRegistered(t.id, line).catch(() => {});
  }
}

export function startReminders(): void {
  setInterval(() => void tick().catch(() => {}), 60_000).unref?.();
}
