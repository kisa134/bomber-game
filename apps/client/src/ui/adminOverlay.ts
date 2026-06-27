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

  document.body.appendChild(btn);
  document.body.appendChild(panel);
  if (localStorage.getItem("bp_admin_overlay") === "1") setOpen(true);
}
