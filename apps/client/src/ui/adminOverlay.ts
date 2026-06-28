// In-game ADMIN MODE — only for admin wallets (server flags profile.admin).
// Shows a floating 🛡 toggle; when on, a live-stats overlay polls /admin/live
// (session-gated to admin wallets) and shows the real numbers we track, so an
// admin can watch the project pulse while playing. Self-contained (inline
// styles, builds its own DOM) — no other UI file is touched.
import { SERVER_HTTP } from "../config.js";

let inited = false;

export function initAdminMode(isAdmin: boolean, getSession: () => string): void {
  if (!isAdmin || inited) return;
  inited = true;

  const fmt = (n: number): string => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
  const fmtC = (n: number): string => {
    if (n == null) return "—";
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
    return `${Math.round(n)}`;
  };

  // Floating toggle
  const btn = document.createElement("button");
  btn.id = "admin-fab";
  btn.textContent = "🛡";
  btn.title = "Admin live stats";
  Object.assign(btn.style, {
    position: "fixed", left: "12px", bottom: "calc(12px + env(safe-area-inset-bottom,0px))",
    zIndex: "9000", width: "44px", height: "44px", borderRadius: "50%", border: "1px solid rgba(124,58,237,.5)",
    background: "linear-gradient(135deg,#7c3aed,#22d3ee)", color: "#fff", fontSize: "20px", cursor: "pointer",
    boxShadow: "0 6px 18px rgba(124,58,237,.4)",
  } as CSSStyleDeclaration);

  // Overlay panel
  const panel = document.createElement("div");
  panel.id = "admin-overlay";
  Object.assign(panel.style, {
    position: "fixed", left: "12px", bottom: "64px", zIndex: "9000", width: "230px",
    background: "rgba(10,8,18,.92)", border: "1px solid rgba(124,58,237,.4)", borderRadius: "14px",
    padding: "12px 14px", color: "#e6eefc", font: "12px/1.5 'Space Grotesk',system-ui,sans-serif",
    backdropFilter: "blur(12px)", display: "none", boxShadow: "0 12px 40px rgba(0,0,0,.5)",
  } as CSSStyleDeclaration);
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <b style="font-family:'Cinzel',serif;letter-spacing:.04em">🛡 LIVE</b>
      <span id="adm-dot" style="width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399"></span>
    </div>
    <div id="adm-rows" style="display:grid;grid-template-columns:1fr auto;gap:3px 10px"></div>
    <div style="margin-top:10px;border-top:1px solid rgba(124,58,237,.25);padding-top:9px">
      <div style="color:#8b97ad;font-weight:700;margin-bottom:6px">🧪 DEV · my profile</div>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <input id="adm-lvl" type="number" min="1" placeholder="level" inputmode="numeric"
          style="flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(124,58,237,.4);border-radius:7px;color:#e6eefc;padding:5px 8px;font:12px/1 'Space Mono',monospace" />
        <button data-dev="setlvl" class="adm-devb">Set lvl</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        <button data-dev="chips" class="adm-devb">+1M 🪙</button>
        <button data-dev="xp" class="adm-devb">+5 lvl</button>
        <button data-dev="max" class="adm-devb">MAX 🪙</button>
        <button data-dev="ownall" id="adm-ownall" class="adm-devb">Own all: ON</button>
        <button data-dev="reset" class="adm-devb" style="border-color:rgba(255,90,77,.55)">Reset profile</button>
      </div>
      <div style="color:#6b7689;font-size:9px;margin-top:4px">💎 tokens = real money — never editable here</div>
      <div id="adm-dev-st" style="color:#34d399;margin-top:6px;min-height:14px;font:11px/1.3 'Space Mono',monospace"></div>
    </div>
    <a href="/admin/marketing/" target="_blank" rel="noopener" style="display:block;margin-top:9px;text-align:center;color:#22d3ee;text-decoration:none;font-weight:700;font-size:11px">Open full admin ↗</a>`;

  const rowsEl = panel.querySelector("#adm-rows") as HTMLElement;
  const dot = panel.querySelector("#adm-dot") as HTMLElement;
  const row = (k: string, v: string, c = "#ffd84d"): string =>
    `<span style="color:#8b97ad">${k}</span><b style="font-family:'Space Mono',monospace;color:${c};text-align:right">${v}</b>`;

  let timer: ReturnType<typeof setInterval> | null = null;
  const refresh = async (): Promise<void> => {
    const s = getSession();
    if (!s) return;
    try {
      const d = await (await fetch(`${SERVER_HTTP}/admin/live?session=${encodeURIComponent(s)}`, { cache: "no-store" })).json();
      if (d.error) { rowsEl.innerHTML = row("status", d.error, "#ff6b6b"); dot.style.background = "#ff6b6b"; return; }
      dot.style.background = "#34d399";
      rowsEl.innerHTML =
        row("🟢 online", fmt(d.online), "#34d399") +
        row("⚔ in match", `${fmt(d.inMatchHumans)}+${fmt(d.inMatchBots)}🤖`) +
        row("rooms", fmt(d.rooms)) +
        row("DAU", fmt(d.dau), "#22d3ee") +
        row("matches/d", `${fmt(d.matchesToday)} (${fmt(d.tokenMatchesToday)}💎)`) +
        row("paying/d", fmt(d.payingToday), "#f59e0b") +
        row(`dep/d ${d.ticker || ""}`, fmtC(d.depositVolToday), "#34d399") +
        row("players", fmt(d.players)) +
        row("chips", fmtC(d.chips), "#f59e0b") +
        row("tokens", fmtC(d.tokens), "#34d399") +
        row("tick", `${Number(d.tickMs || 0).toFixed(1)}ms`) +
        row("errors", fmt(d.errors), d.errors > 0 ? "#ff6b6b" : "#34d399");
    } catch { dot.style.background = "#ff6b6b"; }
  };

  const setOpen = (open: boolean): void => {
    panel.style.display = open ? "block" : "none";
    btn.style.opacity = open ? "1" : "0.85";
    localStorage.setItem("bp_admin_overlay", open ? "1" : "0");
    if (open) { void refresh(); timer = setInterval(() => void refresh(), 5000); }
    else if (timer) { clearInterval(timer); timer = null; }
  };
  btn.addEventListener("click", () => setOpen(panel.style.display === "none"));

  // DEV controls — set level / add money on MY OWN admin profile (server-gated).
  const style = document.createElement("style");
  style.textContent =
    "#admin-overlay .adm-devb{flex:1 1 auto;min-width:60px;background:rgba(124,58,237,.18);border:1px solid rgba(124,58,237,.5);border-radius:7px;color:#e6eefc;padding:6px 4px;font:700 11px/1 'Space Grotesk',system-ui,sans-serif;cursor:pointer}#admin-overlay .adm-devb:hover{background:rgba(124,58,237,.34)}";
  document.head.appendChild(style);
  const devSt = panel.querySelector("#adm-dev-st") as HTMLElement;
  const lvlInput = panel.querySelector("#adm-lvl") as HTMLInputElement;
  const devSet = async (payload: Record<string, number | boolean>): Promise<void> => {
    const s = getSession();
    if (!s) { devSt.textContent = "✖ connect a wallet first"; return; }
    devSt.textContent = "…";
    try {
      const r = await (await fetch(`${SERVER_HTTP}/admin/dev-set`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: s, ...payload }),
      })).json();
      if (r.error) { devSt.textContent = "✖ " + r.error; return; }
      devSt.textContent = `✓ LV ${r.level} · 🪙${fmtC(r.chips)} · 💎${fmtC(r.gameTokens)} — reopen shop`;
    } catch { devSt.textContent = "✖ network"; }
  };
  const ownAllBtn = panel.querySelector("#adm-ownall") as HTMLButtonElement;
  const syncOwnAll = (): void => { ownAllBtn.textContent = `Own all: ${localStorage.getItem("bp_admin_ownall") === "0" ? "OFF" : "ON"}`; };
  syncOwnAll();
  panel.querySelectorAll<HTMLButtonElement>("[data-dev]").forEach((b) => {
    b.addEventListener("click", () => {
      const k = b.dataset.dev;
      if (k === "setlvl") { const lv = Math.max(1, Math.floor(Number(lvlInput.value) || 0)); if (lv >= 1) void devSet({ level: lv }); }
      else if (k === "chips") void devSet({ addChips: 1_000_000 });
      else if (k === "xp") void devSet({ addXp: 1000 }); // +5 levels (200xp each)
      else if (k === "max") void devSet({ level: 99, addChips: 1_000_000_000 }); // chips only — never tokens
      else if (k === "ownall") {
        const off = localStorage.getItem("bp_admin_ownall") === "0";
        localStorage.setItem("bp_admin_ownall", off ? "1" : "0"); // toggle
        syncOwnAll();
        devSt.textContent = "✓ reload to apply…";
        setTimeout(() => location.reload(), 500);
      } else if (k === "reset") {
        if (!confirm("Reset YOUR profile to a new player? (level/chips/skins/stats wiped — real 💎 tokens are kept)")) return;
        void devSet({ reset: true }).then(() => { devSt.textContent = "✓ reset — reloading…"; setTimeout(() => location.reload(), 700); });
      }
    });
  });

  document.body.appendChild(btn);
  document.body.appendChild(panel);
  if (localStorage.getItem("bp_admin_overlay") === "1") setOpen(true);
}
