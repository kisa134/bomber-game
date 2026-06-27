// BomberMeme.fun — marketing landing engine (standalone page at /).
//
// landing.html ships the static shell (nav, hero, footer); this module builds
// the 8-block progressive-disclosure strips, wires the live data, and fills the
// footer/socials + Buy CTA. Every number is REAL — from the same backend the
// game uses (/stats, /price, /leaderboard, /tournaments) and the shared
// tokenomics constants. What the backend doesn't track yet shows "Soon", never
// faked. CTAs go to /play (the game). The block numbers match docs/LANDING.md;
// Block 1 (core pitch) is the hero, so the strips below are Blocks 2–8.

import {
  TOKEN_TICKER,
  TOKEN_MINT,
  TOTAL_SUPPLY,
  GAME_BUYBACK_TOKENS,
  INITIAL_ALLOCATION_PCT,
  RAKE_SPLIT_BPS,
  HOUSE_RAKE_BP_DEFAULT,
  LEAGUES,
  ELO_K,
  STARTING_RATING,
  MAX_PLAYERS_PER_ROOM,
} from "@bomberpump/shared";
import { SERVER_HTTP } from "../config.js";
import { initAnalytics, captureAttribution, track, initErrorTracking } from "../analytics.js";
import "./landing.css";

const PUMP_URL = `https://pump.fun/coin/${TOKEN_MINT}`;
const TELEGRAM_URL = "https://t.me/bombermeme";
const SKIN_NAMES = ["Shiba", "Pepe", "Trump", "Musk", "Doge", "Pump", "Durov", "Vitalik", "Troll", "Bogdanoff", "Gigachad", "Nyan", "Grumpy", "Harambe", "Shrek", "Fine Dog", "Wojak", "NPC", "Chad", "Doomer", "Bloomer", "Stonks", "Satoshi", "SBF", "CZ", "Laser Eyes", "WAGMI", "Diamond", "Rich Pepe", "Bonk", "WIF", "Popcat", "Titan", "Salt Bae", "Harold", "Paper Hands", "Moonboy", "Brett", "Andy", "GOAT", "Pnut", "Moodeng", "MEW", "Ponke", "Sigma", "Boomer", "Zoomer", "Chemist", "Galaxy Brain", "Cry Jordan", "Disaster", "Leeroy", "MLG", "Keanu", "Rick", "Crewmate", "Grogu", "Voxel", "Skibidi", "Ohio", "Rizzler", "Zuck", "Bezos", "Gates", "Jobs", "Success", "Bad Luck", "Drake", "Distracted", "Two Buttons", "Philosoraptor", "Y U NO", "Good Guy Greg", "Smudge", "Fwog", "Woman Yelling", "Math Lady", "Scumbag", "Blinking Guy", "Overly GF", "Based Ape", "Michi", "Dank Pepe"];
const REFERRAL_LEVELS = [10, 5, 3, 2, 1]; // % of rake, L1..L5 (mirrors referral.ts)
let priceUsd = 0;

// --- helpers ----------------------------------------------------------------
function el(tag: string, cls = "", html = ""): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
function fmt(n: number): string { return Math.round(n).toLocaleString("en-US"); }
function fmtC(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}
function setText(id: string, v: string): void { const e = document.getElementById(id); if (e) e.textContent = v; }
function esc(s: string): string { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c)); }

function deepTray(body: HTMLElement, label: string, fill: (tray: HTMLElement) => void): void {
  const tray = el("div", "lp-deep");
  let filled = false;
  const btn = el("button", "lp-more", `${label} ↓`);
  btn.addEventListener("click", () => {
    const open = tray.classList.toggle("open");
    if (open && !filled) { fill(tray); filled = true; }
    btn.textContent = open ? "Show less ↑" : `${label} ↓`;
  });
  body.appendChild(btn);
  body.appendChild(tray);
}
function stat(k: string, v: string, id = ""): HTMLElement {
  const s = el("div", "lp-stat");
  const val = el("div", "lp-stat-v", v); if (id) val.id = id;
  s.appendChild(val);
  s.appendChild(el("div", "lp-stat-k", k));
  return s;
}
function chips(parent: HTMLElement, items: string[]): void {
  const row = el("div", "lp-row");
  for (const i of items) row.appendChild(el("span", "lp-chip", i));
  parent.appendChild(row);
}

// --- block definitions (Blocks 2–8; ids match nav anchors #block-N) ---------
interface Block { no: number; band: string; icon: string; title: string; line: string; build: (b: HTMLElement) => void; }

const BLOCKS: Block[] = [
  {
    no: 2, band: "#ff5a4d", icon: "📡", title: "Live Arena", line: "Real players. Real payouts.",
    build(b) {
      const g = el("div", "lp-statgrid");
      g.appendChild(stat("Online now", "—", "lp-online"));
      g.appendChild(stat("Matches played", "—", "lp-matches"));
      g.appendChild(stat(`${TOKEN_TICKER} paid out`, "—", "lp-paid"));
      g.appendChild(stat("Top MMR", "—", "lp-topmmr"));
      b.appendChild(g);
      b.appendChild(el("p", "lp-p", "A living arena, not a static promo. These numbers come straight from the game server, refreshed every few seconds."));
      deepTray(b, "Recent champions", (t) => {
        t.appendChild(el("h4", "lp-h4", `🏆 Top ${TOKEN_TICKER} earners`));
        const list = el("div", "lp-lbtable"); list.id = "lp-champs";
        list.appendChild(el("p", "lp-muted", "Loading…"));
        t.appendChild(list);
        void loadStats();
      });
    },
  },
  {
    no: 3, band: "#4aa3ff", icon: "🏆", title: "Ranked Skill Ladder", line: "Climb the MMR. Earn your league.",
    build(b) {
      b.appendChild(el("p", "lp-p", `Every ranked match updates your global rating with an Elo system (K=${ELO_K}, start ${STARTING_RATING}) — beat stronger players to climb faster. Practice and bot games never touch your rating.`));
      chips(b, [...LEAGUES].reverse().map((l) => `${l.emoji} ${l.name}`));
      const cta = el("a", "lp-cta-sm", "Open leaderboard →"); (cta as HTMLAnchorElement).href = "/play";
      b.appendChild(cta);
      deepTray(b, "Season leaderboard", (t) => {
        const tabs = el("div", "lp-tabs");
        const table = el("div", "lp-lbtable"); table.id = "lp-lbtable";
        (["rating", "tokens", "chips"] as const).forEach((board, i) => {
          const tb = el("button", "lp-tab" + (i === 0 ? " on" : ""), board === "rating" ? "Rating" : board === "tokens" ? `${TOKEN_TICKER} won` : "Chips won");
          tb.addEventListener("click", () => { tabs.querySelectorAll(".lp-tab").forEach((x) => x.classList.remove("on")); tb.classList.add("on"); void loadLeaderboard(board); });
          tabs.appendChild(tb);
        });
        t.appendChild(tabs); t.appendChild(table); void loadLeaderboard("rating");
      });
    },
  },
  {
    no: 4, band: "#f0a92a", icon: "💰", title: "Smart Prize Pools", line: "Escrow before the match. Winner takes 95%.",
    build(b) {
      const rake = HOUSE_RAKE_BP_DEFAULT / 100;
      b.appendChild(el("p", "lp-p", `Every player stakes the same amount; all stakes form the pot, locked in a Solana escrow before the match starts. The winner takes <b>${100 - rake}%</b> instantly; a small <b>${rake}% house rake</b> funds the ecosystem. On a draw, everyone is refunded — the house takes nothing.`));
      const calc = el("div", "lp-calc");
      calc.innerHTML = `<div class="lp-calc-head"><span>Your stake</span><span class="lp-calc-val" id="lp-bet">$10</span></div><input id="lp-bet-range" class="lp-range" type="range" min="1" max="1000" step="1" value="10"/><div class="lp-calc-rows" id="lp-calc-rows"></div>`;
      b.appendChild(calc);
      (calc.querySelector("#lp-bet-range") as HTMLInputElement).addEventListener("input", (e) => renderCalc(Number((e.target as HTMLInputElement).value)));
      renderCalc(10);
      deepTray(b, "Where the rake goes", (t) => {
        t.appendChild(el("h4", "lp-h4", `🔧 Rake split (of the ${rake}%)`));
        const rows = el("div", "lp-split");
        const items: Array<[string, number, boolean]> = [
          ["🔥 Burn (deflation)", RAKE_SPLIT_BPS.burn / 100, true],
          ["🕸️ 5-level referral", RAKE_SPLIT_BPS.referral / 100, true],
          ["⚙️ Dev Treasury (servers · R&D · prizes)", RAKE_SPLIT_BPS.devTreasury / 100, true],
          ["💎 Real Yield (staking)", 0, false],
          ["🗳️ DAO reserve", 0, false],
        ];
        for (const [n, p, live] of items) {
          const r = el("div", "lp-split-row");
          r.innerHTML = `<span>${n}</span><span class="lp-split-pct">${live ? `${p}%` : `<span class="lp-soon">Soon</span>`}</span>`;
          rows.appendChild(r);
        }
        t.appendChild(rows);
        t.appendChild(el("p", "lp-muted", "Live today: burn, 5-level referral and dev treasury. Real Yield + DAO arrive in Phase 2 — shown honestly until then."));
      });
    },
  },
  {
    no: 5, band: "#5fd96a", icon: "💣", title: "Last Bomber Standing", line: "Chaos with rules. No luck — pure skill.",
    build(b) {
      b.appendChild(el("p", "lp-p", `2–${MAX_PLAYERS_PER_ROOM} players drop bombs on a grid, blow up blocks and each other, grab power-ups, and the last one standing takes the pot. Run out of time and it's sudden death. The first player-on-player hit earns first blood — a callout and an instant power-up.`));
      chips(b, ["💣 Bomb Up", "🔥 Fire Up", "👟 Speed Up", "🦵 Kick", "👻 Wall Pass", "❤️ Health (rare 2%)"]);
      const cta = el("a", "lp-cta-sm", "🤖 Practice vs bots →"); (cta as HTMLAnchorElement).href = "/play";
      b.appendChild(cta);
    },
  },
  {
    no: 6, band: "#33e0d6", icon: "🌐", title: "Play Anywhere", line: "Browser-native. Telegram-ready. No download.",
    build(b) {
      b.appendChild(el("p", "lp-p", "A full esports lobby in your browser or inside Telegram — find ranked matches, spectate live games, invite friends with a room code, and collect payouts, without installing anything."));
      chips(b, ["⚡ Instant queue", "📺 Spectate live", "🔗 Room-code invites", "📱 Mobile-first", "✈️ Telegram Mini App", "🪙 Free casual chips"]);
    },
  },
  {
    no: 7, band: "#c879ff", icon: "🛡️", title: "Provably Fair", line: "No black boxes. No house edge on the RNG.",
    build(b) {
      b.appendChild(el("p", "lp-p", "Before each match the server commits to a hashed secret seed; your client adds entropy; after the match the seed is revealed so anyone can verify the map was never manipulated. All gameplay and balances are server-authoritative — a modified client can't fake stats or funds."));
      const steps = el("div", "lp-steps");
      ([["1", "Server commits", "sha256(seed) published before the match"], ["2", "You add entropy", "your client seed is mixed in"], ["3", "Reveal & verify", "seed revealed at the end — check it yourself"]] as Array<[string, string, string]>).forEach(([n, ti, d]) => {
        const s = el("div", "lp-step");
        s.innerHTML = `<span class="lp-step-n">${n}</span><div><div class="lp-step-t">${ti}</div><div class="lp-step-d">${d}</div></div>`;
        steps.appendChild(s);
      });
      b.appendChild(steps);
      deepTray(b, "Show the verification", (t) => {
        t.appendChild(el("pre", "lp-code", `// anyone can run this on the revealed seed
assert(sha256(seed) === commit);     // map seed wasn't swapped
const roll = hmac(seed, clientSeed); // your entropy is in the mix
// → ✓ MATCH VERIFIED · 100% FAIR`));
      });
    },
  },
  {
    no: 8, band: "#ff8a3d", icon: "🚀", title: "The Universe Expands", line: "From beta to global war.",
    build(b) {
      const tabs = el("div", "lp-tabs");
      const pane = el("div", "");
      const TABS: Array<[string, (p: HTMLElement) => void]> = [
        ["Fighters", tabFighters], ["Roadmap", tabRoadmap], ["Token", tabToken], ["Season", tabSeason], ["Community", tabCommunity],
      ];
      TABS.forEach(([name, fill], i) => {
        const tb = el("button", "lp-tab" + (i === 0 ? " on" : ""), name);
        tb.addEventListener("click", () => { tabs.querySelectorAll(".lp-tab").forEach((x) => x.classList.remove("on")); tb.classList.add("on"); pane.innerHTML = ""; fill(pane); });
        tabs.appendChild(tb);
      });
      b.appendChild(tabs); b.appendChild(pane); tabFighters(pane);
    },
  },
];

// --- Universe tab builders --------------------------------------------------
function tabFighters(p: HTMLElement): void {
  p.appendChild(el("p", "lp-muted", "Elite roster — pick your fighter in the game. Skins are cosmetic; they never affect gameplay or odds."));
  const grid = el("div", "lp-roster");
  SKIN_NAMES.forEach((name, i) => {
    const c = el("div", "lp-fighter");
    c.innerHTML = `<img src="/sprites/skin_${i}.webp" alt="${name}" loading="lazy" onerror="this.style.visibility='hidden'"/><span>${name}</span>`;
    grid.appendChild(c);
  });
  p.appendChild(grid);
  const cta = el("a", "lp-cta-sm", "▶ Play & choose your fighter →"); (cta as HTMLAnchorElement).href = "/play";
  p.appendChild(cta);
}
function tabRoadmap(p: HTMLElement): void {
  const phases: Array<[string, string, string, string]> = [
    ["Phase 01", "The Drop", "Now", "Fair launch, ranked seasons, Arena stakes, Telegram Mini App."],
    ["Phase 02", "The Swarm", "Next", "Spectator mode, tournaments, clan wars, real-yield staking + DAO."],
    ["Phase 03", "The Furnace", "Soon", "Deflationary engine live, creator rev-share, live betting on matches."],
    ["Phase 04", "Global War", "Soon", "Esports tier, Twitch/Kick integration, cross-region championships."],
  ];
  const wrap = el("div", "lp-roadmap");
  phases.forEach(([ph, t, tag, d]) => {
    const c = el("div", "lp-phase");
    c.innerHTML = `<div class="lp-phase-no">${ph}<span class="lp-phase-tag">${tag}</span></div><div class="lp-phase-t">${t}</div><div class="lp-phase-d">${d}</div>`;
    wrap.appendChild(c);
  });
  p.appendChild(wrap);
}
function tabToken(p: HTMLElement): void {
  const live = priceUsd > 0;
  p.appendChild(el("p", "lp-p", `$${TOKEN_TICKER} powers Arena stakes, payouts, referral rewards and skins. Community-first fair launch on Solana via pump.fun — no private rounds, no hidden pre-sales.`));
  const g = el("div", "lp-statgrid");
  g.appendChild(stat("Total supply", fmtC(TOTAL_SUPPLY)));
  g.appendChild(stat("Fair-launch liquidity", `${INITIAL_ALLOCATION_PCT.freeMarket}%`));
  g.appendChild(stat("Live price", live ? `$${priceUsd.toPrecision(2)}` : "—", "lp-tprice"));
  g.appendChild(stat(`$1 in $${TOKEN_TICKER}`, live ? fmtC(1 / priceUsd) : "—", "lp-perdollar"));
  p.appendChild(g);
  const alloc = el("div", "lp-split");
  ([["Fair market / liquidity", INITIAL_ALLOCATION_PCT.freeMarket], ["Game Treasury (prizes, seasons)", INITIAL_ALLOCATION_PCT.gameTreasury], ["Marketing & CEX", INITIAL_ALLOCATION_PCT.marketingCex], ["Dev team (3-mo vesting)", INITIAL_ALLOCATION_PCT.devTeam]] as Array<[string, number]>).forEach(([n, pct]) => {
    const r = el("div", "lp-split-row");
    r.innerHTML = `<span>${n}</span><span class="lp-split-pct">${pct}% · ${fmtC((pct / 100) * TOTAL_SUPPLY)}</span>`;
    alloc.appendChild(r);
  });
  p.appendChild(alloc);
  p.appendChild(el("p", "lp-muted", `Team allocation (Treasury + Marketing + Dev = 12% = ${fmtC(GAME_BUYBACK_TOKENS)}) is acquired by an on-launch buyback — the only way to hold an allocation on a 100%-fair pump.fun launch. Burned supply % — Soon.`));
  const mint = el("div", "lp-mint");
  mint.innerHTML = `<span>Contract</span><code>${TOKEN_MINT}</code>`;
  const copy = el("button", "lp-copy", "Copy");
  copy.addEventListener("click", () => { void navigator.clipboard?.writeText(TOKEN_MINT); copy.textContent = "Copied ✓"; setTimeout(() => (copy.textContent = "Copy"), 1500); });
  mint.appendChild(copy);
  p.appendChild(mint);
  const buy = el("a", "lp-cta-sm", `💎 Buy $${TOKEN_TICKER} on pump.fun ↗`) as HTMLAnchorElement;
  buy.href = PUMP_URL; buy.target = "_blank"; buy.rel = "noopener"; buy.style.marginTop = "10px";
  p.appendChild(buy);
}
function tabSeason(p: HTMLElement): void {
  const box = el("div", "lp-season"); box.id = "lp-season";
  box.appendChild(el("p", "lp-muted", "Loading season…"));
  p.appendChild(box);
  const cta = el("a", "lp-cta-sm", "🏆 Open Season & tournaments →"); (cta as HTMLAnchorElement).href = "/play";
  p.appendChild(cta);
  void loadSeason();
}
function tabCommunity(p: HTMLElement): void {
  const links = el("div", "lp-row");
  ([[`💎 Buy $${TOKEN_TICKER}`, PUMP_URL], ["✈️ Telegram", TELEGRAM_URL]] as Array<[string, string]>).forEach(([label, url]) => {
    const a = el("a", "lp-chip", label) as HTMLAnchorElement; a.href = url; a.target = "_blank"; a.rel = "noopener";
    links.appendChild(a);
  });
  p.appendChild(links);
  const ref = el("a", "lp-cta-sm", "👥 Invite & Earn (5-level rake) →"); (ref as HTMLAnchorElement).href = "/play";
  p.appendChild(ref);
  p.appendChild(el("p", "lp-muted", `Refer friends and earn ${REFERRAL_LEVELS.join("/")}% of the rake across 5 levels, paid in $${TOKEN_TICKER}.`));
}

// --- calculator -------------------------------------------------------------
function renderCalc(bet: number): void {
  setText("lp-bet", `$${bet}`);
  const rows = document.getElementById("lp-calc-rows");
  if (!rows) return;
  const players = MAX_PLAYERS_PER_ROOM;
  const pot = bet * players;
  const rakePct = HOUSE_RAKE_BP_DEFAULT / 100;
  const rake = pot * (rakePct / 100);
  const payout = pot - rake;
  const profit = payout - bet;
  rows.innerHTML = `
    <div class="lp-calc-row"><span>Pot (${players} players)</span><b>$${fmt(pot)}</b></div>
    <div class="lp-calc-row"><span>House rake ${rakePct}%</span><b>−$${rake.toFixed(2)}</b></div>
    <div class="lp-calc-row win"><span>Winner takes</span><b>$${fmt(payout)}</b></div>
    <div class="lp-calc-row win"><span>Your profit</span><b>+$${fmt(profit)} (+${Math.round((profit / bet) * 100)}%)</b></div>`;
}

// --- live data --------------------------------------------------------------
async function loadStats(): Promise<void> {
  try {
    const d = await (await fetch(`${SERVER_HTTP}/stats`)).json();
    priceUsd = Number(d.priceUsd) || 0;
    const online = typeof d.online === "number" ? fmt(d.online) : "—";
    const matches = typeof d.matches === "number" ? fmt(d.matches) : "—";
    const pot = typeof d.tokensInPlay === "number" && d.tokensInPlay > 0 ? `${fmtC(d.tokensInPlay)} ${TOKEN_TICKER}` : "—";
    const paid = typeof d.prizePaid === "number" && d.prizePaid > 0 ? `${fmtC(d.prizePaid)} ${TOKEN_TICKER}` : "—";
    setText("hero-online", online);
    setText("hero-pot", pot);
    setText("hero-matches", matches);
    setText("lp-online", online);
    setText("lp-matches", matches);
    setText("lp-paid", paid);
    setText("lp-topmmr", d.topMmr ? fmt(d.topMmr) : "—");
    setText("lp-tprice", priceUsd > 0 ? `$${priceUsd.toPrecision(2)}` : "—");
    setText("lp-perdollar", priceUsd > 0 ? fmtC(1 / priceUsd) : "—");
    const champs = document.getElementById("lp-champs");
    if (champs && Array.isArray(d.champions)) {
      champs.innerHTML = "";
      if (!d.champions.length) champs.appendChild(el("p", "lp-muted", `No ${TOKEN_TICKER} winners yet — be the first.`));
      else d.champions.slice(0, 8).forEach((c: { name?: string; won?: number }, i: number) => {
        const row = el("div", "lp-lbrow");
        row.innerHTML = `<span class="lp-lbrank">${i + 1}</span><span class="lp-lbname">${esc(c.name || "anon")}</span><b>${fmtC(c.won || 0)} ${TOKEN_TICKER}</b>`;
        champs.appendChild(row);
      });
    }
  } catch { /* offline — keep placeholders */ }
}

async function loadLeaderboard(board: "rating" | "tokens" | "chips"): Promise<void> {
  const table = document.getElementById("lp-lbtable");
  if (!table) return;
  table.innerHTML = `<p class="lp-muted">Loading…</p>`;
  try {
    const d = await (await fetch(`${SERVER_HTTP}/leaderboard?board=${board}`)).json();
    const rows: Array<{ name?: string; rating?: number; tokens_won?: number; chips_won?: number }> = d.leaderboard || d.top || d || [];
    table.innerHTML = "";
    if (!rows.length) { table.appendChild(el("p", "lp-muted", "No entries yet.")); return; }
    rows.slice(0, 10).forEach((p, i) => {
      const v = board === "rating" ? fmt(p.rating ?? 0) : board === "tokens" ? `${fmtC((p.tokens_won ?? 0) / 1e6)} ${TOKEN_TICKER}` : fmt(p.chips_won ?? 0);
      const row = el("div", "lp-lbrow");
      row.innerHTML = `<span class="lp-lbrank">${i + 1}</span><span class="lp-lbname">${esc(p.name || "anon")}</span><b>${v}</b>`;
      table.appendChild(row);
    });
  } catch { table.innerHTML = `<p class="lp-muted">Couldn't load the leaderboard.</p>`; }
}

async function loadSeason(): Promise<void> {
  const box = document.getElementById("lp-season");
  if (!box) return;
  try {
    const d = await (await fetch(`${SERVER_HTTP}/tournaments`)).json();
    const list: Array<{ name?: string; status?: string; format?: string }> = d.tournaments || d || [];
    box.innerHTML = "";
    if (!list.length) { box.appendChild(el("p", "lp-muted", "No tournaments scheduled yet — Season 1 is warming up.")); return; }
    list.slice(0, 4).forEach((t) => {
      const row = el("div", "lp-tourn");
      row.innerHTML = `<div><div class="lp-tourn-n">${esc(t.name || "Tournament")}</div><div class="lp-muted">${esc(t.format || "")}</div></div><span class="lp-tourn-s">${esc(t.status || "")}</span>`;
      box.appendChild(row);
    });
  } catch { box.innerHTML = `<p class="lp-muted">Couldn't load the season.</p>`; }
}

// Referral capture: a /?ref=<wallet> link lands here (the landing owns root).
// Persist it to localStorage (same origin as the game) so the game binds it on
// wallet connect, and append it to every /play link so the query survives too.
function refQuery(): string {
  const ref = (new URLSearchParams(location.search).get("ref") ?? "").trim();
  if (ref && !localStorage.getItem("bp_ref_done")) localStorage.setItem("bp_ref", ref);
  return ref ? `?ref=${encodeURIComponent(ref)}` : "";
}

// --- boot -------------------------------------------------------------------
function boot(): void {
  // Old root-level room links (/?room=CODE) predate the /play move — bounce them
  // straight into the game so they still auto-join. (New links already use /play.)
  if (new URLSearchParams(location.search).get("room")) {
    location.replace(`/play${location.search}`);
    return;
  }

  // Analytics: the landing is the TOP of the funnel now, so first-touch
  // attribution + pageview fire here. Same backends as the game (PostHog/GA/
  // Clarity); same origin → the visitor's id carries through to /play, so the
  // funnel landing → play → wallet-connect is one person.
  const attribution = captureAttribution();
  initAnalytics({ platform: "web", surface: "landing", ...attribution });
  initErrorTracking();
  track("landing_view", { ...attribution });

  // Capture an inviter (?ref) into localStorage now (the game reads it on connect).
  const rq = refQuery();

  // Buy CTA → pump.fun
  const buy = document.getElementById("hero-buy") as HTMLAnchorElement | null;
  if (buy) { buy.href = PUMP_URL; buy.querySelector(".tk")!.textContent = `$${TOKEN_TICKER}`; }

  // Strips
  const strips = document.getElementById("strips");
  if (strips) {
    for (const blk of BLOCKS) {
      const sec = el("article", "strip"); sec.id = `block-${blk.no}`;
      sec.style.setProperty("--band", blk.band);
      const head = el("button", "strip-head");
      head.innerHTML = `<span class="strip-no">${String(blk.no).padStart(2, "0")}</span><span class="strip-ic">${blk.icon}</span><span class="strip-txt"><span class="strip-title">${blk.title}</span><span class="strip-line">${blk.line}</span></span><span class="strip-chev">›</span>`;
      const body = el("div", "strip-body");
      let filled = false;
      head.addEventListener("click", () => {
        const open = sec.classList.toggle("open");
        if (open) { track("landing_strip_open", { block: blk.no, title: blk.title }); if (!filled) { blk.build(body); filled = true; } }
      });
      sec.appendChild(head); sec.appendChild(body);
      strips.appendChild(sec);
    }
  }

  // Footer socials / nav
  const foot = document.getElementById("foot-socials");
  if (foot) {
    const links: Array<[string, string, boolean]> = [
      ["Play", "/play", false],
      ["Tournaments", "/play", false],
      [`Buy $${TOKEN_TICKER}`, PUMP_URL, true],
      ["Telegram", TELEGRAM_URL, true],
    ];
    for (const [label, url, ext] of links) {
      const a = el("a", "", label) as HTMLAnchorElement;
      a.href = url; if (ext) { a.target = "_blank"; a.rel = "noopener"; }
      foot.appendChild(a);
    }
  }

  // Forward the inviter (?ref) onto every /play CTA built above + in the shell.
  if (rq) document.querySelectorAll<HTMLAnchorElement>('a[href^="/play"]').forEach((a) => { a.href = `/play${rq}`; });

  // Funnel events: PostHog autocaptures clicks, but explicit names make the
  // landing → /play conversion easy to read. One delegated listener covers all.
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest("a,button");
    if (!a) return;
    const href = (a as HTMLAnchorElement).getAttribute?.("href") ?? "";
    if (href.startsWith("/play")) track("landing_play_click", { label: a.textContent?.trim().slice(0, 40) });
    else if (href.includes("pump.fun")) track("landing_buy_click");
    else if (href.includes("t.me")) track("landing_telegram_click");
  });

  void loadStats();
  setInterval(() => void loadStats(), 30_000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
