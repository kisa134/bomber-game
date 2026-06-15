import { ServerMsg, MatchPhase, decodeServer, encodeRequestStart } from "@bomberpump/shared";
const BASE = "http://localhost:8799";
const join = async () => (await (await fetch(`${BASE}/quickplay`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"P"})})).json()) as {token:string};
function sleep(ms:number){return new Promise(r=>setTimeout(r,ms));}
async function main(){
  const a = await join(); const b = await join();
  let rtA=""; let bPlayers=0; let aReconnWelcome=false; let aStarted=false;
  const wsB = new WebSocket(`ws://localhost:8799/ws?token=${b.token}`); wsB.binaryType="arraybuffer";
  wsB.onmessage=(e)=>{const m=decodeServer(e.data as ArrayBuffer); if(!m)return;
    if(m.type===ServerMsg.ROOM_INFO && m.isHost && m.players.length>=2 && !aStarted){aStarted=true; wsB.send(encodeRequestStart());}
    if(m.type===ServerMsg.STATE_SNAPSHOT) bPlayers=m.players.length; };
  const wsA = new WebSocket(`ws://localhost:8799/ws?token=${a.token}`); wsA.binaryType="arraybuffer";
  await new Promise<void>(res=>{ wsA.onmessage=(e)=>{const m=decodeServer(e.data as ArrayBuffer); if(!m)return; if(m.type===ServerMsg.RECONNECT_TOKEN){rtA=m.token; res();}}; });
  // wait until playing
  await sleep(5000);
  console.log("before drop: B sees players =", bPlayers, "rtA?", !!rtA);
  wsA.close(); // simulate drop
  await sleep(1500);
  const playersDuringDrop = bPlayers;
  // reconnect A
  const wsA2 = new WebSocket(`ws://localhost:8799/ws?reconnect=${rtA}`); wsA2.binaryType="arraybuffer";
  let a2snaps=0;
  wsA2.onmessage=(e)=>{const m=decodeServer(e.data as ArrayBuffer); if(!m)return; if(m.type===ServerMsg.WELCOME) aReconnWelcome=true; if(m.type===ServerMsg.STATE_SNAPSHOT) a2snaps++; };
  await sleep(2500);
  console.log("players during drop (held?):", playersDuringDrop);
  console.log("reconnect welcome:", aReconnWelcome, "A2 snapshots after reconnect:", a2snaps);
  wsA2.close(); wsB.close();
  const ok = !!rtA && playersDuringDrop===2 && aReconnWelcome && a2snaps>10;
  console.log(ok?"RECONNECT TEST PASSED":"RECONNECT TEST FAILED");
  process.exit(ok?0:1);
}
main();
