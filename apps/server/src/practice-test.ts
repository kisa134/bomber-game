import { ServerMsg, MatchPhase, decodeServer } from "@bomberpump/shared";
const BASE = process.env.BASE ?? "http://localhost:8799";
async function main() {
  const r = await (await fetch(`${BASE}/practice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Solo", skin: 1 }) })).json() as { token: string };
  const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/ws?token=${r.token}`);
  ws.binaryType = "arraybuffer";
  let players = 0, snaps = 0, reached = false, phase = -1, playStart = 0, endAt = 0, aliveAtEnd = 0;
  ws.onmessage = (ev) => {
    const m = decodeServer(ev.data as ArrayBuffer); if (!m) return;
    if (m.type === ServerMsg.MATCH_PHASE) { phase = m.phase; if (m.phase === MatchPhase.PLAYING && !playStart) playStart = Date.now(); if (m.phase === MatchPhase.END && !endAt) endAt = Date.now(); }
    if (m.type === ServerMsg.STATE_SNAPSHOT) { snaps++; players = m.players.length; if (phase === MatchPhase.END) aliveAtEnd = m.players.filter(p=>p.alive).length; }
  };
  await new Promise((res) => setTimeout(res, 14000));
  ws.close();
  const dur = endAt && playStart ? ((endAt - playStart)/1000).toFixed(1) : "still playing";
  console.log({ players, snaps, reached, phaseNow: MatchPhase[phase], roundDurationSec: dur });
  process.exit(reached && players === 4 ? 0 : 1);
}
main();
