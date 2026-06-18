// Load test: spawn N concurrent practice rooms (each fills with bots and runs a
// full 60Hz match — the heaviest realistic per-room cost) and report how many
// the server holds plus its game-loop tick load.
//
// Usage:
//   node scripts/loadtest.mjs <baseUrl> <count> [adminToken] [rampPerSec]
// Examples:
//   node scripts/loadtest.mjs http://localhost:8787 100
//   node scripts/loadtest.mjs https://bombermeme.fun 300 kaif666aA! 20
//
// With an adminToken it polls /admin/stats and prints the live "Server load"
// (tick ms vs the 16.7ms budget) — watch for `busy` to find your safe MAX_ROOMS.
// Node 21+ has global fetch + WebSocket, so there are no dependencies.

const base = (process.argv[2] || "http://localhost:8787").replace(/\/$/, "");
const COUNT = Number(process.argv[3] || 50);
const adminToken = process.argv[4] || "";
const RAMP_PER_SEC = Number(process.argv[5] || 25);
const wsBase = base.replace(/^http/, "ws") + "/ws";

let created = 0;
let serverFull = 0;
let failed = 0;
const sockets = [];

function moveFrame() {
  const b = new Uint8Array(6);
  const dv = new DataView(b.buffer);
  dv.setUint8(0, 1); // ClientMsg.INPUT_MOVE
  dv.setUint8(1, 1 + Math.floor(Math.random() * 4)); // dir 1..4
  dv.setUint32(2, 0, true); // tick 0 -> applied immediately as intent
  return b;
}

async function spawnOne(i) {
  let res;
  try {
    res = await fetch(`${base}/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `load${i}`, skin: i % 4, difficulty: 1 }),
    });
  } catch {
    failed++;
    return;
  }
  if (res.status === 503) { serverFull++; return; } // load-shed / MAX_ROOMS
  if (!res.ok) { failed++; return; }
  const { token } = await res.json();
  const ws = new WebSocket(`${wsBase}?token=${encodeURIComponent(token)}`);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => {
    created++;
    sockets.push(ws);
    // Drive some input so the server does input + rollback work, like a real player.
    ws.__t = setInterval(() => {
      try { ws.send(moveFrame()); } catch { /* closing */ }
    }, 250);
  };
  ws.onclose = () => { if (ws.__t) clearInterval(ws.__t); };
  ws.onerror = () => { failed++; };
}

async function pollLoad() {
  if (!adminToken) {
    try {
      const h = await (await fetch(`${base}/health`)).json();
      console.log(`  live: rooms=${h.rooms} players=${h.players}`);
    } catch { /* ignore */ }
    return;
  }
  try {
    const d = await (await fetch(`${base}/admin/stats?token=${encodeURIComponent(adminToken)}`)).json();
    const l = d.load || {};
    console.log(
      `  rooms=${d.live?.rooms} inMatch=${d.live?.humans} | tick=${l.tickMs}/${l.budgetMs}ms peak=${l.peakMs}ms ${l.busy ? "⚠ BUSY (shedding)" : "ok"}`,
    );
  } catch { /* ignore */ }
}

async function main() {
  console.log(`Load test → ${base}  target=${COUNT} rooms  ramp=${RAMP_PER_SEC}/s`);
  const interval = 1000 / RAMP_PER_SEC;
  const poll = setInterval(pollLoad, 2000);
  for (let i = 0; i < COUNT; i++) {
    void spawnOne(i);
    await new Promise((r) => setTimeout(r, interval));
  }
  // Let it settle, then report.
  await new Promise((r) => setTimeout(r, 8000));
  clearInterval(poll);
  await pollLoad();
  console.log(`\nResult: created=${created}  serverFull=${serverFull}  failed=${failed}`);
  console.log("Tip: the room count where `tick` nears the budget (or `BUSY` appears) is your safe MAX_ROOMS.");
  for (const ws of sockets) { try { ws.close(); } catch { /* ignore */ } }
  process.exit(0);
}

main();
