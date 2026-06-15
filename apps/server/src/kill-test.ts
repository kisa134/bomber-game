import { ServerMsg, MatchPhase, decodeServer } from "@bomberpump/shared";
const BASE = "http://localhost:8799";
async function main() {
  const r = await (await fetch(`${BASE}/practice`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name:"Solo",skin:0}) })).json() as {token:string};
  const ws = new WebSocket(`ws://localhost:8799/ws?token=${r.token}`); ws.binaryType="arraybuffer";
  let kills=0, snaps=0, maxFrag=0, reached=false;
  ws.onmessage = (ev)=>{ const m=decodeServer(ev.data as ArrayBuffer); if(!m) return;
    if(m.type===ServerMsg.MATCH_PHASE && m.phase===MatchPhase.PLAYING) reached=true;
    if(m.type===ServerMsg.EVENT_KILL) kills++;
    if(m.type===ServerMsg.STATE_SNAPSHOT){ snaps++; for(const p of m.players) maxFrag=Math.max(maxFrag,p.frags); } };
  await new Promise(r=>setTimeout(r,13000)); ws.close();
  console.log({reached, snaps, killEvents:kills, maxFragSeen:maxFrag});
  process.exit(reached && snaps>60 ? 0 : 1);
}
main();
