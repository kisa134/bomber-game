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
  .feed{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow-y:auto;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:8px 12px}
  .feed .ev{display:flex;gap:8px;font-size:.85rem;padding:3px 0;border-bottom:1px solid var(--border)}
  .feed .ev time{color:var(--muted);flex:0 0 60px;font-variant-numeric:tabular-nums}
  .feed .empty{color:var(--muted);font-size:.85rem}
  .ext-links{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}
  .ext-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:8px;background:var(--panel);border:1px solid var(--border);color:var(--text);text-decoration:none;font-weight:700}
  .ext-btn:hover{border-color:var(--accent)}
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
    <h3>Activity feed <span class="muted" style="font-weight:400;font-size:.8rem">· live</span></h3>
    <div id="feed" class="feed"></div>
    <h3>Since restart</h3>
    <div class="grid" id="totals"></div>
    <h3>Top players</h3>
    <table id="top"><thead><tr><th>#</th><th>Player</th><th>Rating</th><th>Matches</th><th>Wins</th><th>Chips</th></tr></thead><tbody></tbody></table>
    <h3>Referral pyramid</h3>
    <p class="muted" id="ref-explain" style="margin:0 0 8px"></p>
    <div class="grid" id="ref-tiles"></div>
    <h4 style="margin:6px 0 4px">Your network by level (under the root)</h4>
    <table id="ref-levels"><thead><tr><th>Level</th><th>Players</th><th>Reward</th></tr></thead><tbody></tbody></table>
    <h4 style="margin:10px 0 4px">Top partners</h4>
    <table id="ref-top"><thead><tr><th>#</th><th>Partner</th><th>Direct refs</th><th>Earned</th></tr></thead><tbody></tbody></table>
    <h3>Analytics <span class="muted" style="font-weight:400;font-size:.8rem">· PostHog</span></h3>
    <div id="ext-links"></div>
    <div id="analytics">
      <p id="analytics-hint" class="muted">Embed the PostHog dashboard here: open it in PostHog → <b>Share</b> → enable sharing → copy the <b>embed URL</b> → set it as the <code>POSTHOG_EMBED_URL</code> env var. Then everything lives in this one panel.</p>
      <iframe id="ph-frame" style="display:none;width:100%;height:1400px;border:1px solid var(--border);border-radius:12px;background:#fff" allow="fullscreen"></iframe>
      <iframe id="ga-frame" style="display:none;width:100%;height:900px;border:1px solid var(--border);border-radius:12px;background:#fff;margin-top:12px" allow="fullscreen"></iframe>
    </div>
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
    // Live activity feed
    const ev=d.events||[];
    $("#feed").innerHTML = ev.length
      ? ev.map(function(e){return '<div class="ev"><time>'+new Date(e.t).toLocaleTimeString()+'</time><span>'+e.icon+' '+e.text+'</span></div>';}).join("")
      : '<div class="empty">No activity yet — actions (joins, deposits, matches, referral payouts) will appear here live.</div>';
    const ld=d.load||{tickMs:0,budgetMs:16.7,busy:false};
    $("#live").innerHTML=
      tile("Players online",fmt(d.online),"app open now")+
      tile("In match",fmt(d.live.humans),fmt(d.live.bots)+" bots")+
      tile("Rooms",fmt(d.live.rooms),fmt(d.live.playing)+" playing · "+fmt(d.live.lobby)+" lobby")+
      tile("Server load",(ld.busy?"⚠ ":"")+ld.tickMs+"ms",(ld.busy?"SATURATED — shedding":"of "+ld.budgetMs+"ms budget"));
    $("#totals").innerHTML=
      tile("Matches",fmt(d.totals.matches),fmt(d.totals.practiceMatches)+" practice")+
      tile("Deposits","${TOKEN_TICKER} "+fmt(d.totals.depositVolume),fmt(d.totals.deposits)+" tx")+
      tile("Withdrawals","${TOKEN_TICKER} "+fmt(d.totals.withdrawVolume),fmt(d.totals.withdrawals)+" tx");
    const tb=$("#top tbody");tb.innerHTML="";
    d.top.forEach((p,i)=>{const tr=document.createElement("tr");tr.innerHTML="<td>"+(i+1)+"</td><td>"+(p.name||p.wallet.slice(0,6))+"</td><td>"+fmt(p.rating)+"</td><td>"+fmt(p.matches)+"</td><td>"+fmt(p.wins)+"</td><td>"+fmt(p.chips)+"</td>";tb.appendChild(tr);});
    // Referral pyramid
    const rf=d.referrals||{root:"",networkSize:0,totalEarned:0,unattached:0,rootLevels:[0,0,0,0,0],top:[]};
    const LVL_PCT=[10,5,3,2,1];
    const rootSet=!!rf.root;
    $("#ref-explain").innerHTML=
      "You're the top of the pyramid. Players who join via someone's link attach under that inviter; "+
      (rootSet
        ? "players with <b>no</b> inviter attach under <b>you</b> (the root)."
        : "players with no inviter attach to <b>no one</b> — set <code>REFERRAL_ROOT</code> to your wallet to put them under you.")+
      " Rewards: 5 levels of the house rake (10/5/3/2/1%), paid in tokens.";
    const netUnder=(rf.rootLevels||[]).reduce((a,b)=>a+b,0);
    $("#ref-tiles").innerHTML=
      tile("Your network",fmt(netUnder),"players under you (5 levels)")+
      tile("Referral paid","${TOKEN_TICKER} "+fmt(rf.totalEarned),"lifetime · all partners")+
      tile("Attributed",fmt(rf.networkSize),"players with an inviter")+
      tile("Unattached",fmt(rf.unattached),rootSet?"(should be ~0)":"not under anyone");
    const lb=$("#ref-levels tbody");lb.innerHTML="";
    (rf.rootLevels||[]).forEach((n,i)=>{const tr=document.createElement("tr");tr.innerHTML="<td>L"+(i+1)+"</td><td>"+fmt(n)+"</td><td>"+LVL_PCT[i]+"% of rake</td>";lb.appendChild(tr);});
    const rb=$("#ref-top tbody");rb.innerHTML="";
    (rf.top||[]).forEach((p,i)=>{const tr=document.createElement("tr");tr.innerHTML="<td>"+(i+1)+"</td><td>"+(p.name||p.wallet.slice(0,6))+"</td><td>"+fmt(p.direct)+"</td><td>"+fmt(p.earned)+" ${TOKEN_TICKER}</td>";rb.appendChild(tr);});
    const fr=$("#ph-frame");
    if(d.embedUrl){if(fr.src!==d.embedUrl)fr.src=d.embedUrl;fr.style.display="block";$("#analytics-hint").style.display="none";}
    // GA4 (Looker Studio) can be iframed if provided; otherwise just a button.
    const gf=$("#ga-frame");
    if(d.gaEmbedUrl){if(gf.src!==d.gaEmbedUrl)gf.src=d.gaEmbedUrl;gf.style.display="block";}
    // One-click jump buttons to GA / Clarity / PostHog (these can't be iframed).
    const links=[];
    if(d.gaUrl)links.push('<a class="ext-btn" target="_blank" rel="noopener" href="'+d.gaUrl+'">📈 Google Analytics</a>');
    if(d.clarityUrl)links.push('<a class="ext-btn" target="_blank" rel="noopener" href="'+d.clarityUrl+'">🎥 Microsoft Clarity</a>');
    if(d.embedUrl)links.push('<a class="ext-btn" target="_blank" rel="noopener" href="'+d.embedUrl+'">📊 PostHog</a>');
    $("#ext-links").innerHTML=links.join("");
  }catch(e){$("#msg").innerHTML='<span class="err">'+e+'</span>';$("#dot").className="";}
}
$("#go").onclick=()=>{token=$("#token").value.trim();localStorage.setItem("bp_admin_token",token);poll();};
$("#token").value=token;
if(token)poll();
setInterval(poll,5000);
</script>
</body></html>`;
}
