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
  .tile.goal{border-color:#2f6b37;background:rgba(95,217,106,.10)}
  .tile .sub{color:var(--muted);font-size:.8rem;margin-top:2px}
  table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);font-size:.9rem}
  th{color:var(--muted);font-weight:600}
  .muted{color:var(--muted)}
  .err{color:#ff7a7e}
  .cfg{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
  .cfg .pill{padding:5px 10px;border-radius:999px;font-size:.8rem;font-weight:700;border:1px solid var(--border)}
  .cfg .ok{background:rgba(95,217,106,.15);border-color:#2f6b37;color:#bdf0c4}
  .cfg .bad{background:rgba(192,57,43,.18);border-color:#7a2a22;color:#ffb3ad}
  .feed{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow-y:auto;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:8px 12px}
  .feed .ev{display:flex;gap:8px;font-size:.85rem;padding:3px 0;border-bottom:1px solid var(--border)}
  .feed .ev time{color:var(--muted);flex:0 0 60px;font-variant-numeric:tabular-nums}
  .feed .empty{color:var(--muted);font-size:.85rem}
  .ai-out{margin-top:10px;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px 16px;white-space:pre-wrap;line-height:1.45;font-size:.9rem;max-height:520px;overflow-y:auto}
  #ai-run{cursor:pointer}
  .wl{display:flex;gap:8px}
  .wl input{flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:#0c0e14;color:var(--text);font-size:.85rem}
  .ext-links{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}
  .ext-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:8px;background:var(--panel);border:1px solid var(--border);color:var(--text);text-decoration:none;font-weight:700}
  .ext-btn:hover{border-color:var(--accent)}
  #atabs{position:sticky;top:0;z-index:20;display:flex;gap:6px;flex-wrap:wrap;padding:10px 0;margin:0 0 8px;background:linear-gradient(180deg,var(--bg) 70%,transparent);backdrop-filter:blur(6px)}
  #atabs button{padding:9px 16px;border-radius:999px;border:1px solid var(--border);background:var(--panel);color:var(--muted);font-weight:700;font-size:.85rem;cursor:pointer;transition:all .15s}
  #atabs button:hover{color:var(--text)}
  #atabs button.on{background:var(--accent);color:#1a1320;border-color:var(--accent)}
</style></head><body>
<header><span id="dot"></span><h1>🎮 Bombermeme — Admin</h1><span id="meta" class="muted"></span></header>
<main>
  <div id="config" class="cfg"></div>
  <div class="gate" id="gate">
    <input id="token" type="password" placeholder="Admin token" autocomplete="off">
    <button id="go">Connect</button>
  </div>
  <p id="msg" class="muted"></p>
  <div id="board" style="display:none">
    <nav id="atabs"></nav>
    <h3>📈 Growth today <span class="muted" style="font-weight:400;font-size:.8rem">· resets at UTC midnight</span></h3>
    <div class="grid" id="growth"></div>
    <h3>🧠 AI Director <span class="muted" style="font-weight:400;font-size:.8rem">· reads every data flow (economy · money · tournaments · players · system · logs) and reports</span></h3>
    <div style="margin-bottom:16px">
      <button id="ai-run">Analyze now</button>
      <a id="snap-link" href="#" style="margin-left:10px;font-size:.78rem">⬇ Full data snapshot (JSON)</a>
      <span id="ai-info" class="muted" style="margin-left:10px"></span>
      <span id="ai-status" class="muted" style="margin-left:10px"></span>
      <div id="ai-out" class="ai-out" style="display:none"></div>
    </div>
    <h3>🩺 System health</h3>
    <div class="grid" id="system"></div>
    <div id="err-feed" class="feed" style="margin:0 0 16px"></div>
    <h3>📊 Load <span class="muted" style="font-weight:400;font-size:.8rem">· live tick load (green) vs 16.7ms budget (red) · benchmark</span></h3>
    <canvas id="load-canvas" width="640" height="90" style="width:100%;max-width:640px;background:var(--panel);border:1px solid var(--border);border-radius:10px;display:block"></canvas>
    <div style="margin:8px 0 16px">
      Bot rooms: <input id="bench-n" type="number" value="30" min="1" max="80" style="width:64px;padding:6px;border-radius:6px;border:1px solid var(--border);background:#0c0e14;color:var(--text)">
      <button id="bench-run">Run benchmark</button>
      <span id="bench-status" class="muted" style="margin-left:8px"></span>
    </div>
    <h3>Live now</h3>
    <div class="grid" id="live"></div>
    <h3>💰 Economy <span class="muted" style="font-weight:400;font-size:.8rem">· circulation &amp; treasury</span></h3>
    <div class="grid" id="economy"></div>
    <div class="cfg" id="toggles"></div>
    <h3>💸 Rake Engine <span class="muted" style="font-weight:400;font-size:.8rem">· Model B: Burn 25 · Referral 21 · Treasury 54 · accrued since restart</span></h3>
    <div class="grid" id="rake"></div>
    <div style="margin:0 0 16px">
      <button id="burn-sweep">🔥 Burn now</button>
      <span id="burn-status" class="muted" style="margin-left:10px"></span>
    </div>
    <h3>🏦 Treasury &amp; supply <span class="muted" style="font-weight:400;font-size:.8rem">· on-chain transparency</span></h3>
    <div class="grid" id="supply"></div>
    <div id="wallets" class="feed" style="margin:0 0 16px"></div>
    <h3>💰 Live balances &amp; ledgers <span class="muted" style="font-weight:400;font-size:.8rem">· on-chain wallet balances · deposits · tournament prizes</span></h3>
    <div class="grid" id="onchain-bal"></div>
    <div id="tour-money" class="muted" style="margin:6px 0"></div>
    <h4 style="margin:8px 0 4px">Recent deposits <a id="csv-dep" href="#" style="font-size:.7rem;font-weight:400">⬇ CSV</a></h4>
    <table id="deposits"><thead><tr><th>When</th><th>Wallet</th><th>Amount</th><th>Tx</th></tr></thead><tbody></tbody></table>
    <h4 style="margin:10px 0 4px">Recent withdrawals <a id="csv-wd" href="#" style="font-size:.7rem;font-weight:400">⬇ CSV</a></h4>
    <table id="withdrawals"><thead><tr><th>When</th><th>Wallet</th><th>Amount</th><th>Tx</th></tr></thead><tbody></tbody></table>
    <h4 style="margin:10px 0 4px">💸 Bulk grant <span class="muted" style="font-weight:400;font-size:.78rem">· prizes / airdrops — credit a list of wallets</span></h4>
    <div class="cfg" style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start">
      <textarea id="bulk-wallets" placeholder="one wallet per line" style="min-width:260px;height:64px"></textarea>
      <input id="bulk-amount" type="number" placeholder="amount" style="max-width:110px">
      <select id="bulk-cur"><option value="0">chips</option><option value="1">token</option></select>
      <button id="bulk-go">Grant to all</button>
      <span id="bulk-status" class="muted"></span>
    </div>
    <h3>🎰 Lucky Spin <span class="muted" style="font-weight:400;font-size:.8rem">· since restart</span></h3>
    <div class="grid" id="spins"></div>
    <h3>Activity feed <span class="muted" style="font-weight:400;font-size:.8rem">· live</span></h3>
    <div id="feed" class="feed"></div>
    <h3>Wallet lookup</h3>
    <div class="wl"><input id="wl-input" placeholder="paste a wallet address"><button id="wl-go">Look up</button><button id="wl-attach">Attach under you</button></div>
    <div id="wl-out" class="muted" style="margin-top:6px"></div>
    <div id="wl-actions" class="wl" style="margin-top:8px;flex-wrap:wrap;gap:6px;display:none">
      <input id="wl-chips" type="number" placeholder="± chips" style="max-width:120px">
      <button id="wl-chips-go">Grant chips</button>
      <input id="wl-rating" type="number" placeholder="rating" style="max-width:110px">
      <button id="wl-rating-go">Set rating</button>
      <input id="wl-skin" type="number" placeholder="skin #" style="max-width:90px">
      <button id="wl-skin-go">Grant skin</button>
      <button id="wl-ban" style="background:#c0392b;color:#fff">Ban</button>
      <button id="wl-unban" style="background:var(--panel);color:var(--text);border:1px solid var(--border)">Unban</button>
    </div>
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
    <h3>🏆 Tournaments <span class="muted" style="font-weight:400;font-size:.8rem">· create & run contests (both formats), push announcements</span></h3>
    <div class="cfg" id="tour-create" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">
      <input id="t-name" placeholder="Name" style="max-width:160px">
      <select id="t-format"><option value="points">Points race</option><option value="bracket">Bracket</option></select>
      <select id="t-entry"><option value="free">Free</option><option value="buyin">Buy-in</option></select>
      <input id="t-amount" type="number" placeholder="buy-in" style="max-width:90px">
      <select id="t-cur"><option value="0">chips</option><option value="1">token</option></select>
      <input id="t-prize" type="number" placeholder="prize $" style="max-width:90px">
      <input id="t-max" type="number" placeholder="max" value="64" style="max-width:70px">
      <input id="t-start" type="datetime-local" style="max-width:185px">
      <label style="display:flex;align-items:center;gap:4px;font-size:.8rem" title="Test mode: pads pods with bots and auto-starts, so you can dry-run the whole tournament solo. Bots never score or advance."><input id="t-testbots" type="checkbox"> 🤖 test (fill with bots)</label>
      <button id="t-create">Create</button>
    </div>
    <div id="tour-list" class="muted">—</div>
    <h4 style="margin:10px 0 4px">📣 In-game announcement (shown to all players)</h4>
    <div class="cfg" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
      <input id="ann-text" placeholder="Announcement text" style="max-width:300px">
      <input id="ann-cta" placeholder="CTA (e.g. Join)" style="max-width:120px">
      <button id="ann-go">Push</button>
      <button id="ann-clear">Clear</button>
    </div>
    <h3>🎨 Character Cards <span class="muted" style="font-weight:400;font-size:.8rem">· marketing kit — download each character walking in a circle as a GIF/PNG</span></h3>
    <iframe id="cards-frame" data-src="/cards.html" style="width:100%;height:1300px;border:1px solid var(--border);border-radius:12px;background:var(--bg)" allow="fullscreen"></iframe>
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
function spark(id,vals,budget){var c=document.getElementById(id);if(!c)return;var ctx=c.getContext("2d");var W=c.width,H=c.height;ctx.clearRect(0,0,W,H);if(!vals||!vals.length)return;var max=Math.max(budget||16.7,Math.max.apply(null,vals))*1.15;var by=H-((budget||16.7)/max)*H;ctx.strokeStyle="rgba(255,90,90,.55)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,by);ctx.lineTo(W,by);ctx.stroke();ctx.strokeStyle="#5fd96a";ctx.lineWidth=2;ctx.beginPath();for(var i=0;i<vals.length;i++){var x=(i/((vals.length-1)||1))*W;var y=H-(vals[i]/max)*H;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
async function poll(){
  if(!token)return;
  try{
    const r=await fetch("/admin/stats?token="+encodeURIComponent(token));
    if(r.status===401){$("#msg").innerHTML='<span class="err">Wrong or missing token.</span>';$("#board").style.display="none";$("#gate").style.display="flex";$("#dot").className="";return;}
    const d=await r.json();
    $("#gate").style.display="none";$("#board").style.display="block";$("#msg").textContent="";$("#dot").className="live";
    // Load the character-cards tool only once the admin is authenticated.
    var cardsFr=$("#cards-frame");if(cardsFr&&!cardsFr.src)cardsFr.src=cardsFr.dataset.src;
    $("#meta").textContent="store: "+d.store+" · uptime "+dur(d.totals.uptimeMs)+" · "+new Date(d.now).toLocaleTimeString();
    // Config pills — at a glance: is the economy/referral actually turned on?
    var cf=d.config||{};
    var pill=function(ok,label){return '<span class="pill '+(ok?'ok':'bad')+'">'+(ok?'✅ ':'⚠ ')+label+'</span>';};
    $("#config").innerHTML=
      pill(cf.rakePct>0, cf.rakePct>0?('Rake '+cf.rakePct+'%'):'Rake 0% — set HOUSE_RAKE_BP')+
      pill(!!cf.referralRoot, cf.referralRoot?('Referral root '+cf.referralRoot):'Referral root NOT SET')+
      pill(!!cf.deposits,'Deposits '+(cf.deposits?'on':'off'))+
      pill(!!cf.withdrawals,'Withdrawals '+(cf.withdrawals?'on':'off'));
    // Growth cockpit — flagship daily metrics vs targets
    var goalTile=function(label,value,target,sub){
      var ok=target>0&&value>=target;
      return '<div class="tile'+(ok?' goal':'')+'"><div class="label">'+label+'</div><div class="value">'+fmt(value)+(target>0?'<span class="muted" style="font-size:.45em;font-weight:400"> / '+target+'</span>':'')+'</div><div class="sub">'+(ok?'✅ ':'')+sub+'</div></div>';
    };
    var g=d.growth||{dau:0,players:0,payingPlayers:0,matches:0,tokenMatches:0,deposits:0,depositVolume:0,depositors:0};
    var gt=d.growthTargets||{paying:10,dau:30,matches:0,depositors:0};
    $("#growth").innerHTML=
      goalTile("🎯 Paying players",g.payingPlayers,gt.paying,"played for tokens today")+
      goalTile("DAU",g.dau,gt.dau,"unique devices today")+
      goalTile("Players",g.players,0,"any match today")+
      goalTile("Matches",g.matches,gt.matches,fmt(g.tokenMatches)+" on tokens")+
      goalTile("Depositors",g.depositors,gt.depositors,"${TOKEN_TICKER} "+fmt(g.depositVolume)+" in");
    // Live activity feed
    const ev=d.events||[];
    $("#feed").innerHTML = ev.length
      ? ev.map(function(e){return '<div class="ev"><time>'+new Date(e.t).toLocaleTimeString()+'</time><span>'+e.icon+' '+e.text+'</span></div>';}).join("")
      : '<div class="empty">No activity yet — actions (joins, deposits, matches, referral payouts) will appear here live.</div>';
    const ld=d.load||{tickMs:0,budgetMs:16.7,busy:false};
    var soc=d.social||{onlineWallets:0};
    $("#live").innerHTML=
      tile("Players online",fmt(d.online),"app open now")+
      tile("Signed-in online",fmt(soc.onlineWallets),"wallets (friends presence)")+
      tile("In match",fmt(d.live.humans),fmt(d.live.bots)+" bots")+
      tile("Rooms",fmt(d.live.rooms),fmt(d.live.playing)+" playing · "+fmt(d.live.lobby)+" lobby")+
      tile("Server load",(ld.busy?"⚠ ":"")+ld.tickMs+"ms",(ld.busy?"SATURATED — shedding":"of "+ld.budgetMs+"ms budget"));
    // System health — technical state for the control centre
    var sys=d.system||{uptimeMs:0,rssMb:0,heapUsedMb:0,errors:0,recentErrors:[],wsConns:0,store:d.store};
    $("#system").innerHTML=
      tile("Uptime",dur(sys.uptimeMs),"since boot")+
      tile("Memory",sys.rssMb+" MB",sys.heapUsedMb+" MB heap")+
      tile("Errors",(sys.errors>0?"⚠ ":"")+fmt(sys.errors),"alerts since boot")+
      tile("WS sockets",fmt(sys.wsConns),fmt(sys.ipsConnected||0)+" IPs")+
      tile("Store",sys.store||d.store,d.store==="postgres"?"durable":"⚠ not durable");
    var ai=d.ai||{};
    $("#ai-info").innerHTML = ai.configured
      ? ("model: "+ai.provider+" · "+ai.model)
      : '<span class="err">⚠ set BOMBER_ADMIN (WaveSpeed) to enable</span>';
    var errs=sys.recentErrors||[];
    $("#err-feed").innerHTML = errs.length
      ? errs.map(function(e){return '<div class="ev"><time>'+new Date(e.t).toLocaleTimeString()+'</time><span>🚨 '+e.msg+'</span></div>';}).join("")
      : '<div class="empty">No errors logged since boot. ✅</div>';
    spark("load-canvas",(d.loadHistory||[]).map(function(p){return p.tick;}),d.load?d.load.budgetMs:16.7);
    // Economy — chips/tokens in circulation, treasury flow, live toggles
    var ec=d.economy||{players:0,chips:0,tokens:0};
    $("#economy").innerHTML=
      tile("Chips circulating",fmt(ec.chips),fmt(ec.players)+" profiles")+
      tile("Tokens circulating","${TOKEN_TICKER} "+fmt(ec.tokens),"player balances")+
      tile("Deposits","${TOKEN_TICKER} "+fmt(d.totals.depositVolume),fmt(d.totals.deposits)+" tx")+
      tile("Withdrawals","${TOKEN_TICKER} "+fmt(d.totals.withdrawVolume),fmt(d.totals.withdrawals)+" tx")+
      tile("Bans",fmt(d.bans),"wallets blocked");
    $("#toggles").innerHTML=
      '<button id="tg-dep">'+(cf.deposits?'Disable':'Enable')+' deposits</button>'+
      '<button id="tg-wd" style="margin-left:8px">'+(cf.withdrawals?'Disable':'Enable')+' withdrawals</button>';
    $("#tg-dep").onclick=function(){adminToggle("deposits",!cf.deposits);};
    $("#tg-wd").onclick=function(){adminToggle("withdrawals",!cf.withdrawals);};
    // Rake engine — the 5% house rake split into its pipes (since restart)
    var re=d.rakeEngine||{accrued:{},split:{},supply:{allocation:{}},wallets:{}};
    var ra=re.accrued||{}, rs=re.split||{};
    var bps=function(b){return (b/100)+"%";};
    $("#rake").innerHTML=
      tile("Rake collected","${TOKEN_TICKER} "+fmt(ra.total),fmt(ra.matches)+" paid matches · "+((re.rakeBp||0)/100)+"%")+
      tile("👥 Referral","${TOKEN_TICKER} "+fmt(ra.referral),bps(rs.referral)+" · paid out")+
      tile("⚙️ Dev Treasury","${TOKEN_TICKER} "+fmt(ra.devTreasury),bps(rs.devTreasury)+" · house/ops")+
      tile("🔥 Burn accrued","${TOKEN_TICKER} "+fmt(ra.burn),bps(rs.burn)+" of rake")+
      tile("🔥 Burned on-chain","${TOKEN_TICKER} "+fmt(ra.burnSwept),"swept (deflation)")+
      tile("🔥 To burn now","${TOKEN_TICKER} "+fmt(ra.burnSweepable),"pending sweep");
    // Treasury & supply
    var su=re.supply||{allocation:{}}, al=su.allocation||{};
    $("#supply").innerHTML=
      tile("Total supply",fmt(su.total),"$BMB cap")+
      tile("In-game buyback",fmt(su.buyback),"12% seeded into the economy")+
      tile("Fair launch",(al.freeMarket||0)+"%","free market liquidity")+
      tile("Allocations",(al.gameTreasury||0)+"/"+(al.marketingCex||0)+"/"+(al.devTeam||0)+"%","treasury / mktg / dev (locked)");
    var w=re.wallets||{};
    var wrow=function(name,addr,note){return '<div class="ev"><time>'+name+'</time><span>'+(addr?('<code>'+addr+'</code>'):'<span class="err">⚠ set wallet env</span>')+(note?(' · '+note):'')+'</span></div>';};
    $("#wallets").innerHTML=
      wrow("Game Treasury",w.gameTreasury,"5% · lock")+
      wrow("Marketing/CEX",w.marketingCex,"4% · lock")+
      wrow("Dev Team",w.devTeam,"3% · 3-mo vesting lock")+
      wrow("Burn",w.burn,"rake 25% sink")+
      '<div class="ev"><time>Real Yield</time><span class="muted">Phase 2 · coming soon</span></div>'+
      '<div class="ev"><time>DAO</time><span class="muted">Phase 2 · coming soon</span></div>';
    // Lucky Spin tallies
    var sp=d.spins||{spins:0,cost:0,paid:0,skins:0,net:0};
    $("#spins").innerHTML=
      tile("Spins",fmt(sp.spins),"since restart")+
      tile("Chips charged",fmt(sp.cost),"in")+
      tile("Chips paid out",fmt(sp.paid),"out")+
      tile("Net chip sink",fmt(sp.net),"removed from economy")+
      tile("Skins dropped",fmt(sp.skins),"rare wins");
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
$("#wl-go").onclick=async()=>{
  const w=$("#wl-input").value.trim();if(!w)return;
  $("#wl-actions").style.display="flex"; // reveal support actions for this wallet
  $("#wl-out").textContent="Loading…";
  try{
    const r=await fetch("/admin/wallet?token="+encodeURIComponent(token)+"&wallet="+encodeURIComponent(w));
    const d=await r.json();
    if(d.error){$("#wl-out").innerHTML='<span class="err">'+d.error+'</span>';return;}
    if(!d.found){$("#wl-out").innerHTML='<span class="err">Not in DB — this wallet never connected / has no profile.</span>';return;}
    const under=d.isRoot?'<b>ROOT</b> (top — under no one)':(d.referredBy?('under <b>'+d.referredBy.slice(0,4)+'…'+d.referredBy.slice(-4)+'</b>'+(d.rootMatches?' = YOU ✅':'')):'<span class="err">NOBODY — not attributed ⚠</span>');
    $("#wl-out").innerHTML=
      'Referred by: '+under+'<br>'+
      'Game tokens: '+fmt(d.gameTokens)+' · Chips: '+fmt(d.chips)+'<br>'+
      'Referral earned: '+fmt(d.referralEarned)+' '+'${TOKEN_TICKER}'+' · Direct refs: '+fmt(d.directRefs);
  }catch(e){$("#wl-out").innerHTML='<span class="err">'+e+'</span>';}
};
$("#wl-attach").onclick=async()=>{
  const w=$("#wl-input").value.trim();if(!w){return;}
  $("#wl-out").textContent="Attaching…";
  try{
    const r=await fetch("/admin/set-referrer?token="+encodeURIComponent(token)+"&wallet="+encodeURIComponent(w));
    const d=await r.json();
    if(d.ok){$("#wl-out").innerHTML='✅ Attached under root (you). Re-look up to confirm.';$("#wl-go").click();}
    else{$("#wl-out").innerHTML='<span class="err">Failed'+(d.error?(' — '+d.error+(d.error==="bad_ref"?" (set REFERRAL_ROOT first)":"")):'')+'</span>';}
  }catch(e){$("#wl-out").innerHTML='<span class="err">'+e+'</span>';}
};
// Live deposit/withdraw gate toggles.
async function adminToggle(key,on){
  try{await fetch("/admin/toggle?token="+encodeURIComponent(token)+"&key="+key+"&on="+(on?1:0));poll();}catch(e){}
}
// Wallet support actions: append &token&wallet, show the result, re-look up.
async function walletAction(path,extra){
  const w=$("#wl-input").value.trim();if(!w){return;}
  $("#wl-out").textContent="Working…";
  try{
    const r=await fetch("/admin/"+path+"?token="+encodeURIComponent(token)+"&wallet="+encodeURIComponent(w)+(extra||""));
    const d=await r.json();
    if(d.ok===false||d.error){$("#wl-out").innerHTML='<span class="err">Failed — '+(d.error||(d.already?"already owned":"declined"))+'</span>';}
    else{$("#wl-out").innerHTML='✅ Done.';$("#wl-go").click();}
  }catch(e){$("#wl-out").innerHTML='<span class="err">'+e+'</span>';}
}
$("#wl-chips-go").onclick=()=>{const a=Math.trunc(Number($("#wl-chips").value));if(a)walletAction("grant-chips","&amount="+a);};
$("#wl-rating-go").onclick=()=>{const v=Math.trunc(Number($("#wl-rating").value));if(v>=0)walletAction("set-rating","&rating="+v);};
$("#wl-skin-go").onclick=()=>{const s=Math.trunc(Number($("#wl-skin").value));if(s>=0)walletAction("grant-skin","&skin="+s);};
$("#wl-ban").onclick=()=>walletAction("ban","&on=1");
$("#wl-unban").onclick=()=>walletAction("ban","&on=0");
$("#ai-run").onclick=function(){
  if(!token){return;}
  var out=$("#ai-out"),st=$("#ai-status"),btn=$("#ai-run");
  btn.disabled=true;st.textContent="Analyzing…";out.style.display="none";
  fetch("/admin/ai-analyze?token="+encodeURIComponent(token),{method:"POST"})
    .then(function(r){return r.json();})
    .then(function(d){
      btn.disabled=false;st.textContent=d.model?("· "+(d.provider||"")+" "+d.model):"";
      out.textContent=d.ok?d.text:(d.reason||"AI failed.");
      out.style.display="block";
    })
    .catch(function(e){btn.disabled=false;st.innerHTML='<span class="err">'+e+'</span>';});
};
$("#burn-sweep").onclick=function(){
  if(!token){return;}
  if(!confirm("Permanently BURN the pending rake from the treasury on-chain? This is irreversible.")){return;}
  var btn=$("#burn-sweep"),st=$("#burn-status");
  btn.disabled=true;st.textContent="Burning…";
  fetch("/admin/burn-sweep?token="+encodeURIComponent(token),{method:"POST"})
    .then(function(r){return r.json();})
    .then(function(d){
      btn.disabled=false;
      if(d.ok){st.innerHTML='🔥 Burned '+fmt(d.burned)+' · <a href="https://solscan.io/tx/'+d.sig+'" target="_blank" rel="noopener">tx</a>';poll();}
      else{st.innerHTML='<span class="err">'+(d.reason||"failed")+'</span>';}
    })
    .catch(function(e){btn.disabled=false;st.innerHTML='<span class="err">'+e+'</span>';});
};
$("#bench-run").onclick=function(){
  if(!token){return;}
  if(!confirm("Run a load benchmark? Spawns bot rooms and loads the LIVE server (~8s) — run off-peak.")){return;}
  var n=Number($("#bench-n").value)||30;var btn=$("#bench-run"),st=$("#bench-status");
  btn.disabled=true;st.textContent="Running ~8s…";
  fetch("/admin/loadtest?token="+encodeURIComponent(token)+"&n="+n,{method:"POST"})
    .then(function(r){return r.json();})
    .then(function(d){
      btn.disabled=false;
      if(d.ok){
        st.innerHTML="spawned "+d.spawned+"/"+d.requested+" · peak tick "+d.peakTickMs+"ms"+(d.busy?' <span class="err">SATURATED</span>':' ✅');
        if(d.samples)spark("load-canvas",d.samples.map(function(s){return s.tick;}),d.budgetMs);
      }else{st.innerHTML='<span class="err">'+(d.reason||"failed")+'</span>';}
    })
    .catch(function(e){btn.disabled=false;st.innerHTML='<span class="err">'+e+'</span>';});
};
if(token)poll();
setInterval(poll,5000);
// --- tournaments admin ---
async function loadTours(){
  if(!token)return;
  try{
    const r=await fetch("/admin/tournaments?token="+encodeURIComponent(token));
    const d=await r.json();const ts=d.tournaments||[];
    $("#tour-list").innerHTML = ts.length ? ts.map(tCard).join("") : '<span class="empty">No tournaments yet — create one above.</span>';
    // Re-render the detail for whichever card the user had expanded (poll-safe).
    if(window.__openTour) tourDetail(window.__openTour, true);
  }catch(e){$("#tour-list").innerHTML='<span class="err">'+e+'</span>';}
}
function tEsc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function tShort(w){return w?(w.slice(0,4)+'…'+w.slice(-4)):'';}
function tPill(s){var c={draft:'#8a90a0',reg_open:'#2d8b57',checkin:'#d8a200',live:'#3a7bd5',done:'#6a6f7e',cancelled:'#b5483f'}[s]||'#8a90a0';return '<span style="background:'+c+';color:#fff;padding:1px 8px;border-radius:999px;font-size:.72em">'+s+'</span>';}
function tSteps(s){var order=['draft','reg_open','checkin','live','done'];var i=order.indexOf(s);return order.map(function(o,k){return '<span style="opacity:'+(k<=i?1:.4)+'">'+(k<i?'●':k===i?'◉':'○')+' '+o+'</span>';}).join(' <span class="muted">→</span> ');}
function tBtn(id,status,label,bg){return '<button onclick="tourStatus(\\''+id+'\\',\\''+status+'\\')" style="margin:2px 4px 0 0;background:'+bg+';color:#fff">'+label+'</button>';}
function tSeedBtn(id,label){return '<button onclick="tourSeed(\\''+id+'\\')" style="margin:2px 4px 0 0;background:#2d8b57;color:#fff;font-weight:600">'+label+'</button>';}
function tNext(t){
  if(t.status==='draft')return tBtn(t.id,'reg_open','▶ Open registration','#2d8b57');
  if(t.status==='reg_open')return tBtn(t.id,'checkin','▶ Start check-in','#d8a200');
  if(t.status==='checkin')return tSeedBtn(t.id,'🎲 Seed round 1 & go live');
  if(t.status==='live')return tSeedBtn(t.id,'🎲 Seed next round')+tBtn(t.id,'done','🏁 Finish','#6a6f7e');
  if(t.status==='done')return '<span class="muted">Finished'+(t.winners&&t.winners.length?(' · 🏆 '+tShort(t.winners[0])):'')+'</span>';
  return '<span class="muted">cancelled</span>';
}
function tCard(t){
  var meta=t.format+' · '+t.registered+'/'+t.maxPlayers+' · $'+t.prizeUsd+(t.entryType==='buyin'?(' · buy-in '+t.entryAmount):' · free')+(t.testFillBots?' · 🤖 test':'');
  return '<div class="tile" style="text-align:left;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>'+tEsc(t.name)+'</b> '+tPill(t.status)+' <span class="muted" style="font-size:.82em">· '+meta+'</span></div>'+
    '<div class="muted" style="font-size:.76em;margin:5px 0">'+tSteps(t.status)+'</div>'+
    '<div style="margin-top:4px">'+tNext(t)+' '+tBtn(t.id,'cancelled','Cancel','#b5483f')+' <button onclick="tourDetail(\\''+t.id+'\\')" style="margin:2px 4px 0 0">Details ▾</button></div>'+
    '<div id="tdet_'+t.id+'" style="margin-top:6px"></div></div>';
}
window.tourStatus=async function(id,status){if(status==='cancelled'&&!confirm('Cancel this tournament?'))return;await fetch("/admin/tournament/status?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id,status:status})});loadTours();};
window.tourSeed=async function(id){const r=await fetch("/admin/tournament/seed?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id})});const d=await r.json();var pods=(d.result&&d.result.pods)||[];window.__openTour=id;loadTours();if(!pods.length)alert("Nothing to seed — need at least 2 players (or enable 🤖 test mode for solo).");};
window.tourDetail=async function(id,keepOpen){
  if(!keepOpen) window.__openTour = (window.__openTour===id? null : id);
  var box=document.getElementById('tdet_'+id); if(!box)return;
  if(window.__openTour!==id){box.innerHTML='';return;}
  if(!keepOpen) box.innerHTML='<span class="muted">loading…</span>';
  try{
    var r=await fetch('/admin/tournament?id='+encodeURIComponent(id)+'&token='+encodeURIComponent(token));
    var d=await r.json(); var ps=(d.players||[]); var ms=(d.matches||[]);
    var standings=ps.slice().sort(function(a,b){return (b.points||0)-(a.points||0);});
    var pl=standings.length?standings.map(function(p,k){return '<div style="display:flex;justify-content:space-between;font-size:.82em;padding:1px 0"><span>'+(k+1)+'. '+tEsc(p.name||tShort(p.wallet))+' <span class="muted">'+p.status+'</span></span><b>'+(p.points||0)+' pts</b></div>';}).join(''):'<span class="muted">no players yet</span>';
    var pods=ms.length?ms.slice().reverse().map(function(m){return '<div style="font-size:.78em" class="muted">R'+m.round+' · pod '+m.pod+' · room <b>'+tEsc(m.roomCode)+'</b> · '+m.status+' · '+((m.players||[]).length)+'p</div>';}).join(''):'<span class="muted">no rounds seeded yet</span>';
    box.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid var(--border);padding-top:6px"><div><div class="label">Standings</div>'+pl+'</div><div><div class="label">Pods / rounds</div>'+pods+'</div></div>';
  }catch(e){box.innerHTML='<span class="err">'+e+'</span>';}
};
$("#t-create").onclick=async function(){
  var s=$("#t-start").value;var startAt=s?new Date(s).getTime():0;
  var body={name:$("#t-name").value||"Tournament",format:$("#t-format").value,entryType:$("#t-entry").value,entryAmount:Number($("#t-amount").value)||0,currency:Number($("#t-cur").value)||0,prizeUsd:Number($("#t-prize").value)||0,maxPlayers:Number($("#t-max").value)||64,startAt:startAt,regOpen:true,testFillBots:$("#t-testbots").checked};
  await fetch("/admin/tournament/create?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  $("#t-name").value="";loadTours();
};
$("#ann-go").onclick=async function(){if(!$("#ann-text").value)return;await fetch("/admin/tournament/announce?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:$("#ann-text").value,cta:$("#ann-cta").value})});$("#ann-go").textContent="Pushed ✓";setTimeout(function(){$("#ann-go").textContent="Push";},1500);};
$("#ann-clear").onclick=async function(){await fetch("/admin/tournament/announce/clear?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"}});$("#ann-clear").textContent="Cleared ✓";setTimeout(function(){$("#ann-clear").textContent="Clear";},1500);};
if(token)loadTours();
setInterval(loadTours,8000);
// --- role tabs: categorize the flat sections and show one group at a time ---
function ensureTabs(){
  if(window.__tabsDone)return;
  var board=document.getElementById("board");if(!board)return;
  var CAT=[[/growth today/i,"director"],[/ai analyst/i,"director"],[/system health/i,"director"],[/activity feed/i,"director"],[/load/i,"system"],[/live now/i,"system"],[/economy/i,"money"],[/rake engine/i,"money"],[/treasury/i,"money"],[/live balances/i,"money"],[/lucky spin/i,"money"],[/wallet lookup/i,"players"],[/since restart/i,"players"],[/top players/i,"players"],[/referral/i,"players"],[/tournaments/i,"tournaments"],[/character cards/i,"growth"],[/analytics/i,"growth"]];
  var cur="director";
  Array.prototype.forEach.call(board.children,function(el){
    if(el.id==="atabs")return;
    if(el.tagName==="H3"){var t=el.textContent||"";for(var i=0;i<CAT.length;i++){if(CAT[i][0].test(t)){cur=CAT[i][1];break;}}}
    el.dataset.cat=cur;
  });
  var TABS=[["director","🧠 Director"],["money","💰 Money"],["players","👥 Players"],["tournaments","🏆 Tournaments"],["system","📡 System"],["growth","📈 Growth"]];
  var nav=document.getElementById("atabs");nav.innerHTML="";
  TABS.forEach(function(t){var b=document.createElement("button");b.textContent=t[1];b.dataset.t=t[0];b.onclick=function(){showTab(t[0]);};nav.appendChild(b);});
  window.__tabsDone=true;showTab("director");
  var sl=document.getElementById("snap-link");if(sl&&token)sl.href="/admin/snapshot?token="+encodeURIComponent(token);
}
function showTab(cat){
  var board=document.getElementById("board");
  Array.prototype.forEach.call(board.querySelectorAll("[data-cat]"),function(el){el.style.display=(el.dataset.cat===cat)?"":"none";});
  Array.prototype.forEach.call(document.querySelectorAll("#atabs button"),function(b){b.classList.toggle("on",b.dataset.t===cat);});
}
ensureTabs();
// --- live balances & ledgers ---
async function loadTreasury(){
  if(!token)return;
  try{
    const r=await fetch("/admin/treasury?token="+encodeURIComponent(token));
    const d=await r.json();var b=d.balances||{};
    $("#onchain-bal").innerHTML=Object.keys(b).map(function(k){var w=b[k];return tile(k,w.address?fmt(Math.round(w.token)):"—",w.address?(w.address.slice(0,4)+"…"+w.address.slice(-4)):"not set");}).join("")||'<div class="empty">No system wallets set.</div>';
    var tm=d.tournaments||{prizeCommitted:0,prizePaid:0};
    $("#tour-money").innerHTML="🏆 Tournament prizes — committed: <b>$"+fmt(tm.prizeCommitted)+"</b> · paid out: <b>$"+fmt(tm.prizePaid)+"</b>";
    var rowsHtml=function(arr){return arr.length?arr.map(function(x){return "<tr><td>"+(x.at?new Date(x.at).toLocaleString():"")+"</td><td>"+x.wallet.slice(0,4)+"…"+x.wallet.slice(-4)+"</td><td>"+fmt(x.amount)+"</td><td><a href='https://solscan.io/tx/"+x.signature+"' target='_blank' rel='noopener'>tx</a></td></tr>";}).join(""):'<tr><td colspan="4" class="empty">None yet.</td></tr>';};
    $("#deposits tbody").innerHTML=rowsHtml(d.deposits||[]);
    $("#withdrawals tbody").innerHTML=rowsHtml(d.withdrawals||[]);
    $("#csv-dep").href="/admin/export?kind=deposits&token="+encodeURIComponent(token);
    $("#csv-wd").href="/admin/export?kind=withdrawals&token="+encodeURIComponent(token);
  }catch(e){$("#tour-money").innerHTML='<span class="err">'+e+'</span>';}
}
if(token)loadTreasury();
setInterval(loadTreasury,30000);
$("#bulk-go").onclick=async function(){
  if(!token)return;
  var ws=($("#bulk-wallets").value||"").split(/\\s+/).map(function(s){return s.trim();}).filter(Boolean);
  var amt=Number($("#bulk-amount").value)||0;
  if(!ws.length||!amt){$("#bulk-status").textContent="Need wallets + amount.";return;}
  if(!confirm("Grant "+amt+" "+($("#bulk-cur").value==="1"?"token":"chips")+" to "+ws.length+" wallet(s)?"))return;
  $("#bulk-status").textContent="Granting…";
  try{
    var r=await fetch("/admin/bulk-grant?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({wallets:ws,amount:amt,currency:Number($("#bulk-cur").value)})});
    var dd=await r.json();
    $("#bulk-status").innerHTML=dd.ok?("✅ "+dd.granted+"/"+dd.total):'<span class="err">'+(dd.error||"failed")+'</span>';
  }catch(e){$("#bulk-status").innerHTML='<span class="err">'+e+'</span>';}
};
</script>
</body></html>`;
}
