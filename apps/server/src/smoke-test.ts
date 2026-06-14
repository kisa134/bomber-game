// Throwaway end-to-end check: quickplay -> ws -> wait for match -> count frames.
import { ServerMsg, MatchPhase, decodeServer } from "@bomberpump/shared";

const BASE = process.env.BASE ?? "http://localhost:8799";

async function main(): Promise<void> {
  const res = await fetch(`${BASE}/quickplay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "smoke" }),
  });
  const { token } = (await res.json()) as { token: string };
  const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/ws?token=${token}`);
  ws.binaryType = "arraybuffer";

  const counts: Record<string, number> = {};
  let myId = -1;
  let snapshotPlayers = 0;
  let lastPhase = -1;

  ws.onmessage = (ev) => {
    const msg = decodeServer(ev.data as ArrayBuffer);
    if (!msg) return;
    counts[ServerMsg[msg.type]] = (counts[ServerMsg[msg.type]] ?? 0) + 1;
    if (msg.type === ServerMsg.WELCOME) myId = msg.playerId;
    if (msg.type === ServerMsg.MATCH_PHASE && msg.phase !== lastPhase) {
      lastPhase = msg.phase;
      console.log(`  phase -> ${MatchPhase[msg.phase]} (timer ${msg.timerMs}ms)`);
    }
    if (msg.type === ServerMsg.STATE_SNAPSHOT) snapshotPlayers = msg.players.length;
  };

  ws.onopen = () => console.log("ws open, waiting for match (bots fill at ~15s)...");

  await new Promise((r) => setTimeout(r, 17000));
  ws.close();

  console.log("myId:", myId);
  console.log("players in snapshot:", snapshotPlayers);
  console.log("message counts:", counts);

  const ok = myId === 0 && snapshotPlayers === 4 && (counts.STATE_SNAPSHOT ?? 0) > 50;
  console.log(ok ? "SMOKE TEST PASSED" : "SMOKE TEST FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
