// Throwaway: 2 players start a match, then a spectator attaches and must
// receive the SPECTATOR welcome id + flowing snapshots. Not a player.
import { ServerMsg, MatchPhase, SPECTATOR_ID, decodeServer, encodeSetReady } from "@bomberpump/shared";

const BASE = process.env.BASE ?? "http://localhost:8799";
const WS = BASE.replace(/^http/, "ws");

async function post(path: string): Promise<{ token: string }> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "p", skin: 0 }),
  });
  return (await r.json()) as { token: string };
}

function player(token: string): WebSocket {
  const ws = new WebSocket(`${WS}/ws?token=${token}`);
  ws.binaryType = "arraybuffer";
  ws.onmessage = (ev) => {
    const m = decodeServer(ev.data as ArrayBuffer);
    if (m?.type === ServerMsg.ROOM_INFO && m.players.length >= 2) ws.send(encodeSetReady(true));
  };
  return ws;
}

async function main(): Promise<void> {
  const a = await post("/quickplay");
  const b = await post("/quickplay");
  player(a.token);
  player(b.token);
  // wait for the match to be live
  await new Promise((r) => setTimeout(r, 4000));

  const watch = (await fetch(`${BASE}/watch`).then((r) => r.json())) as { token?: string };
  if (!watch.token) throw new Error("no /watch token: " + JSON.stringify(watch));

  let welcomeId = -1;
  let snaps = 0;
  let phase = -1;
  const sp = new WebSocket(`${WS}/ws?token=${watch.token}`);
  sp.binaryType = "arraybuffer";
  sp.onmessage = (ev) => {
    const m = decodeServer(ev.data as ArrayBuffer);
    if (!m) return;
    if (m.type === ServerMsg.WELCOME) welcomeId = m.playerId;
    if (m.type === ServerMsg.MATCH_PHASE) phase = m.phase;
    if (m.type === ServerMsg.STATE_SNAPSHOT) snaps++;
  };
  await new Promise((r) => setTimeout(r, 3000));

  console.log("spectator welcomeId:", welcomeId, "(expect", SPECTATOR_ID + ")");
  console.log("spectator phase:", phase, "(expect PLAYING", MatchPhase.PLAYING + ")");
  console.log("spectator snapshots:", snaps);
  const ok = welcomeId === SPECTATOR_ID && snaps > 10;
  console.log(ok ? "SPECTATE TEST PASSED" : "SPECTATE TEST FAILED");
  process.exit(ok ? 0 : 1);
}
void main();
