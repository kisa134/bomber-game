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
    <h3>📈 Growth today <span class="muted" style="font-weight:400;font-size:.8rem">· resets at UTC midnight</span></h3>
    <div class="grid" id="growth"></div>
    <h3>🤖 AI Analyst <span class="muted" style="font-weight:400;font-size:.8rem">· business + game + tech, analyzed together</span></h3>
    <div style="margin-bottom:16px">
      <button id="ai-run">Analyze now</button>
      <span id="ai-info" class="muted" style="margin-left:10px"></span>
      <span id="ai-status" class="muted" style="margin-left:10px"></span>
      <div id="ai-out" class="ai-out" style="display:none"></div>
    </div>
    <h3>🩺 System health</h3>
    <div class="grid" id="system"></div>
    <div id="err-feed" class="feed" style="margin:0 0 16px"></div>
    <h3>Live now</h3>
    <div class="grid" id="live"></div>
    <h3>💰 Economy <span class="muted" style="font-weight:400;font-size:.8rem">· circulation &amp; treasury</span></h3>
    <div class="grid" id="economy"></div>
    <div class="cfg" id="toggles"></div>
    <h3>💸 Rake Engine <span class="muted" style="font-weight:400;font-size:.8rem">· per-match 5% split · accrued since restart</span></h3>
    <div class="grid" id="rake"></div>
    <h3>🏦 Treasury &amp; supply <span class="muted" style="font-weight:400;font-size:.8rem">· on-chain transparency</span></h3>
    <div class="grid" id="supply"></div>
    <div id="wallets" class="feed" style="margin:0 0 16px"></div>
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
    $("#live").innerHTML=
      tile("Players online",fmt(d.online),"app open now")+
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
      tile("🔥 Burn","${TOKEN_TICKER} "+fmt(ra.burn),bps(rs.burn)+" · deflation")+
      tile("💎 Real Yield","${TOKEN_TICKER} "+fmt(ra.realYield),bps(rs.realYield)+" · staking")+
      tile("⚙️ Dev Treasury","${TOKEN_TICKER} "+fmt(ra.devTreasury),bps(rs.devTreasury)+" · R&D")+
      tile("👥 Referral","${TOKEN_TICKER} "+fmt(ra.referral),bps(rs.referral)+" · paid out")+
      tile("🏛️ DAO Impact","${TOKEN_TICKER} "+fmt(ra.daoImpact),bps(rs.daoImpact)+" · community");
    // Treasury & supply
    var su=re.supply||{allocation:{}}, al=su.allocation||{};
    $("#supply").innerHTML=
      tile("Total supply",fmt(su.total),"$BMB cap")+
      tile("In-game buyback",fmt(su.buyback),"seeded into the economy")+
      tile("Fair launch",(al.freeMarket||0)+"%","free market liquidity")+
      tile("Allocations",(al.gameTreasury||0)+"/"+(al.marketingCex||0)+"/"+(al.devTeam||0)+"%","treasury / mktg / dev (locked)");
    var w=re.wallets||{};
    var wrow=function(name,addr,note){return '<div class="ev"><time>'+name+'</time><span>'+(addr?('<code>'+addr+'</code>'):'<span class="err">⚠ set wallet env</span>')+(note?(' · '+note):'')+'</span></div>';};
    $("#wallets").innerHTML=
      wrow("Game Treasury",w.gameTreasury,"5% · lock")+
      wrow("Marketing/CEX",w.marketingCex,"4% · lock")+
      wrow("Dev Team",w.devTeam,"3% · 3-mo vesting lock")+
      wrow("Burn",w.burn,"rake 25%")+
      wrow("Real Yield",w.realYield,"rake 25%")+
      wrow("DAO Impact",w.daoImpact,"rake 5%");
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
if(token)poll();
setInterval(poll,5000);
</script>
</body></html>`;
}
