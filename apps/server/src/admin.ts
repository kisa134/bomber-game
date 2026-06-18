// Self-contained live admin dashboard (served at GET /admin). It asks for the
// admin token, stores it in localStorage, then polls /admin/stats every few
// seconds. Handy to keep open on a second screen while streaming.

import { TOKEN_TICKER } from "@bomberpump/shared";

export function adminPageHtml(): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bombermeme · Admin</title>
<style>
  :root{--bg:#0e1018;--panel:#1b2030;--border:#2c313f;--text:#e7e9ee;--muted:#8a90a0;--accent:#ffcc33}
  *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  body{margin:0;background:radial-gradient(1200px 800px at 50% -10%,#1d2336,var(--bg) 60%);color:var(--text);min-height:100vh}
  header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border)}
  header h1{font-size:1.1rem;margin:0}
  #dot{width:10px;height:10px;border-radius:50%;background:#555}
  #dot.live{background:#5fd96a;box-shadow:0 0 8px #5fd96a}
  main{padding:18px;max-width:1100px;margin:0 auto}
  .gate{display:flex;gap:8px;margin:18px 0}
  .gate input{flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:#0c0e14;color:var(--text)}
  button{padding:10px 14px;border:0;border-radius:8px;background:var(--accent);color:#1a1300;font-weight:700;cursor:pointer}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:18px}
  .tile{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px}
  .tile .label{color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
  .tile .value{font-size:1.8rem;font-weight:800;margin-top:6px}
  .tile .sub{color:var(--muted);font-size:.8rem;margin-top:2px}
  table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);font-size:.9rem}
  th{color:var(--muted);font-weight:600}
  .muted{color:var(--muted)}
  .err{color:#ff7a7e}
</style></head><body>
<header><span id="dot"></span><h1>🎮 Bombermeme — Admin</h1><span id="meta" class="muted"></span></header>
<main>
  <div class="gate" id="gate">
    <input id="token" type="password" placeholder="Admin token" autocomplete="off">
    <button id="go">Connect</button>
  </div>
  <p id="msg" class="muted"></p>
  <div id="board" style="display:none">
    <h3>Live now</h3>
    <div class="grid" id="live"></div>
    <h3>Since restart</h3>
    <div class="grid" id="totals"></div>
    <h3>Top players</h3>
    <table id="top"><thead><tr><th>#</th><th>Player</th><th>Rating</th><th>Matches</th><th>Wins</th><th>Chips</th></tr></thead><tbody></tbody></table>
  </div>
</main>
<script>
const $=s=>document.querySelector(s);
let token=localStorage.getItem("bp_admin_token")||"";
const tile=(label,value,sub)=>'<div class="tile"><div class="label">'+label+'</div><div class="value">'+value+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>';
const fmt=n=>(n||0).toLocaleString();
const dur=ms=>{const s=Math.floor(ms/1000);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h+"h "+m+"m";};
async function poll(){
  if(!token)return;
  try{
    const r=await fetch("/admin/stats?token="+encodeURIComponent(token));
    if(r.status===401){$("#msg").innerHTML='<span class="err">Wrong or missing token.</span>';$("#board").style.display="none";$("#gate").style.display="flex";$("#dot").className="";return;}
    const d=await r.json();
    $("#gate").style.display="none";$("#board").style.display="block";$("#msg").textContent="";$("#dot").className="live";
    $("#meta").textContent="store: "+d.store+" · uptime "+dur(d.totals.uptimeMs)+" · "+new Date(d.now).toLocaleTimeString();
    $("#live").innerHTML=
      tile("Players online",fmt(d.live.humans),fmt(d.live.bots)+" bots")+
      tile("Rooms",fmt(d.live.rooms),fmt(d.live.playing)+" playing · "+fmt(d.live.lobby)+" lobby");
    $("#totals").innerHTML=
      tile("Matches",fmt(d.totals.matches),fmt(d.totals.practiceMatches)+" practice")+
      tile("Deposits","${TOKEN_TICKER} "+fmt(d.totals.depositVolume),fmt(d.totals.deposits)+" tx")+
      tile("Withdrawals","${TOKEN_TICKER} "+fmt(d.totals.withdrawVolume),fmt(d.totals.withdrawals)+" tx");
    const tb=$("#top tbody");tb.innerHTML="";
    d.top.forEach((p,i)=>{const tr=document.createElement("tr");tr.innerHTML="<td>"+(i+1)+"</td><td>"+(p.name||p.wallet.slice(0,6))+"</td><td>"+fmt(p.rating)+"</td><td>"+fmt(p.matches)+"</td><td>"+fmt(p.wins)+"</td><td>"+fmt(p.chips)+"</td>";tb.appendChild(tr);});
  }catch(e){$("#msg").innerHTML='<span class="err">'+e+'</span>';$("#dot").className="";}
}
$("#go").onclick=()=>{token=$("#token").value.trim();localStorage.setItem("bp_admin_token",token);poll();};
$("#token").value=token;
if(token)poll();
setInterval(poll,5000);
</script>
</body></html>`;
}
