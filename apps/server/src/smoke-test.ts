// Throwaway end-to-end check: two clients quickplay into one room, host starts,
// match runs, snapshots flow. No bots involved.
import { ServerMsg, MatchPhase, decodeServer, encodeRequestStart } from "@bomberpump/shared";

const BASE = process.env.BASE ?? "http://localhost:8799";

interface ClientStat {
  snapshots: number;
  players: number;
  reachedPlaying: boolean;
  startSent: boolean;
}

function openClient(token: string, stat: ClientStat): WebSocket {
  const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/ws?token=${token}`);
  ws.binaryType = "arraybuffer";
  ws.onmessage = (ev) => {
    const msg = decodeServer(ev.data as ArrayBuffer);
    if (!msg) return;
    if (msg.type === ServerMsg.ROOM_INFO && msg.isHost && msg.players.length >= 2 && !stat.startSent) {
      stat.startSent = true;
      ws.send(encodeRequestStart());
    }
    if (msg.type === ServerMsg.MATCH_PHASE && msg.phase === MatchPhase.PLAYING) {
      stat.reachedPlaying = true;
    }
    if (msg.type === ServerMsg.STATE_SNAPSHOT) {
      stat.snapshots++;
      stat.players = msg.players.length;
    }
  };
  return ws;
}

async function main(): Promise<void> {
  const join = async (name: string) =>
    (await (await fetch(`${BASE}/quickplay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })).json()) as { code: string; token: string };

  const a = await join("Alice");
  const b = await join("Bob");
  console.log("room codes:", a.code, b.code, a.code === b.code ? "(same room ✓)" : "(DIFFERENT ✗)");

  const sa: ClientStat = { snapshots: 0, players: 0, reachedPlaying: false, startSent: false };
  const sb: ClientStat = { snapshots: 0, players: 0, reachedPlaying: false, startSent: false };
  openClient(a.token, sa);
  openClient(b.token, sb);

  await new Promise((r) => setTimeout(r, 7000));

  console.log("A:", sa);
  console.log("B:", sb);
  const ok =
    a.code === b.code &&
    sa.reachedPlaying &&
    sb.reachedPlaying &&
    sa.players === 2 &&
    sa.snapshots > 30;
  console.log(ok ? "SMOKE TEST PASSED" : "SMOKE TEST FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
