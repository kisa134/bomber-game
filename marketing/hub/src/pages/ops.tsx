// Real operations pages for managing the live project. ALL data is real, pulled
// from the game server's token-gated /admin/* API (no mock data). Styled with
// the hub's own components/theme so it's one unified system.
import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, Wallet, Trophy, Activity, Brain, Coins, Send, RefreshCw, Search, AlertTriangle,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { useStats, useAdmin, adminGet, adminPost, fmt, fmtC, shortWallet } from "@/lib/adminApi";

const C = { purple: "#8B5CF6", cyan: "#06B6D4", green: "#10B981", amber: "#F59E0B", red: "#EF4444" };

function Tile({ label, value, sub, accent = C.purple }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-bg-glass p-5 backdrop-blur-xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</div>
      <div className="mt-1.5 font-mono text-3xl font-bold" style={{ color: accent }}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-text-secondary">{sub}</div>}
    </div>
  );
}

function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-orbitron text-3xl font-bold tracking-tight text-white">{title}</h1>
      <p className="mt-1 text-[13px] text-text-muted">{sub}</p>
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
export function Dashboard() {
  const { data: d, error, loading } = useStats(5000);
  if (loading && !d) return <Loading />;
  if (error) return <ErrBox error={error} />;
  const g = d.growth || {}, ec = d.economy || {}, live = d.live || {}, lo = d.load || {}, cf = d.config || {}, sys = d.system || {};
  const loadHist = (d.loadHistory || []).map((v: number, i: number) => ({ i, ms: v }));
  return (
    <div className="space-y-6">
      <PageHead title="Mission Control" sub="Live state of the whole project · refreshes every 5s" />
      {/* attention flags */}
      <div className="flex flex-wrap gap-2">
        <Flag ok={cf.rakePct > 0} label={cf.rakePct > 0 ? `Rake ${cf.rakePct}%` : "Rake OFF — set HOUSE_RAKE_BP"} />
        <Flag ok={!!cf.referralRoot} label={cf.referralRoot ? `Referral root ${cf.referralRoot}` : "Referral root NOT SET"} />
        <Flag ok={!!cf.deposits} label={`Deposits ${cf.deposits ? "on" : "off"}`} />
        <Flag ok={!!cf.withdrawals} label={`Withdrawals ${cf.withdrawals ? "on" : "off"}`} />
        <Flag ok={(sys.errors || 0) === 0} label={`Errors ${fmt(sys.errors || 0)}`} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Online now" value={fmt(d.online)} sub="app open now" accent={C.green} />
        <Tile label="Paying today" value={fmt(g.payingPlayers)} sub="played for tokens" accent={C.amber} />
        <Tile label="DAU" value={fmt(g.dau)} sub="unique devices today" accent={C.cyan} />
        <Tile label="Matches today" value={fmt(g.matches)} sub={`${fmt(g.tokenMatches)} on tokens`} />
        <Tile label="In match" value={fmt(live.humans)} sub={`${fmt(live.bots)} bots`} accent={C.cyan} />
        <Tile label="Players total" value={fmt(ec.players)} sub="registered wallets" />
        <Tile label="Chips circulating" value={fmtC(ec.chips)} sub="soft currency" accent={C.amber} />
        <Tile label="Tokens in play" value={fmtC(ec.tokens)} sub="custodial balances" accent={C.green} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard title="Server load" subtitle={`tick ${Number(lo.tickMs || 0).toFixed(1)}ms · budget ${lo.budgetMs || 16.7}ms`}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={loadHist} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs><linearGradient id="ld" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.cyan} stopOpacity={0.3} /><stop offset="100%" stopColor={C.cyan} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="i" tick={{ fill: "#6B7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="ms" stroke={C.cyan} strokeWidth={2} fill="url(#ld)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard title="Live activity" subtitle="joins · deposits · matches · payouts">
          <div className="max-h-[230px] space-y-1 overflow-y-auto">
            {(d.events || []).length ? (d.events || []).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 border-b border-white/[0.04] py-1.5 text-[13px]">
                <span className="font-mono text-[11px] text-text-muted">{new Date(e.t).toLocaleTimeString()}</span>
                <span className="text-white">{e.icon} {e.text}</span>
              </div>
            )) : <p className="text-text-muted text-sm">No activity yet.</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Players ────────────────────────────────────────────────────────────────
export function Players() {
  const { data: d } = useStats(8000);
  const [wallet, setWallet] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const top = d?.top || [];
  const lookup = async () => {
    if (!wallet.trim()) return;
    setBusy("lookup"); setInfo(null);
    try { setInfo(await adminGet("/admin/wallet", { wallet: wallet.trim() })); } catch (e) { setInfo({ error: String((e as Error).message) }); }
    setBusy("");
  };
  const act = async (path: string, params: Record<string, string>, label: string) => {
    setBusy(label);
    try { await adminGet(path, { wallet: wallet.trim(), ...params }); await lookup(); } catch { /* ignore */ }
    setBusy("");
  };
  return (
    <div className="space-y-6">
      <PageHead title="Players" sub="Top ladder + wallet lookup & support actions (real accounts)" />
      <GlassCard title="Wallet lookup & support" glowColor="cyan">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Wallet address"
              className="w-full rounded-lg border border-white/[0.08] bg-bg-surface py-2.5 pl-9 pr-3 text-[13px] text-white outline-none focus:border-accent-purple/40" />
          </div>
          <button onClick={lookup} className="rounded-lg bg-accent-purple px-4 py-2.5 text-[13px] font-semibold text-white">{busy === "lookup" ? "…" : "Lookup"}</button>
        </div>
        {info && (info.error ? <p className="mt-3 text-accent-red text-sm">{info.error}</p> : (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Chips" value={fmt(info.chips ?? info.profile?.chips)} accent={C.amber} />
              <Tile label="Tokens" value={fmtC(info.gameTokens ?? info.profile?.gameTokens)} accent={C.green} />
              <Tile label="Rating" value={fmt(info.rating ?? info.profile?.rating)} accent={C.cyan} />
              <Tile label="Matches" value={fmt(info.matches ?? info.profile?.matches)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Act label="+1000 chips" busy={busy} on={() => act("/admin/grant-chips", { amount: "1000" }, "chips")} />
              <Act label="+10000 chips" busy={busy} on={() => act("/admin/grant-chips", { amount: "10000" }, "chips")} />
              <Act label="Set rating 1000" busy={busy} on={() => act("/admin/set-rating", { rating: "1000" }, "rating")} />
            </div>
          </div>
        ))}
      </GlassCard>
      <GlassCard title="Top players" subtitle="by rating">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="pb-2">#</th><th className="pb-2">Player</th><th className="pb-2 text-right">Rating</th><th className="pb-2 text-right">W/M</th><th className="pb-2 text-right">Chips</th>
            </tr></thead>
            <tbody>
              {top.map((p: any, i: number) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  <td className="py-2 font-mono text-text-muted">{i + 1}</td>
                  <td className="py-2 text-white">{p.name || shortWallet(p.wallet)}</td>
                  <td className="py-2 text-right font-mono text-accent-cyan">{fmt(p.rating)}</td>
                  <td className="py-2 text-right font-mono text-text-secondary">{fmt(p.wins)}/{fmt(p.matches)}</td>
                  <td className="py-2 text-right font-mono">{fmtC(p.chips)}</td>
                </tr>
              ))}
              {!top.length && <tr><td colSpan={5} className="py-4 text-center text-text-muted">No players yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Money ──────────────────────────────────────────────────────────────────
export function Money() {
  const { data: d } = useStats(8000);
  const { data: tre } = useAdmin<any>("/admin/treasury", {}, []);
  const ec = d?.economy || {}, re = d?.rakeEngine || {}, sp = d?.spins || {};
  return (
    <div className="space-y-6">
      <PageHead title="Money" sub="Economy, rake engine, treasury & ledgers (live)" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Chips circulating" value={fmtC(ec.chips)} accent={C.amber} />
        <Tile label="Tokens in play" value={fmtC(ec.tokens)} accent={C.green} />
        <Tile label="Players" value={fmt(ec.players)} />
        <Tile label="Bans" value={fmt(d?.bans)} accent={C.red} />
      </div>
      <GlassCard title="Rake engine" subtitle="house commission split (live)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Collected" value={fmtC(re.collected)} accent={C.amber} />
          <Tile label="Referral paid" value={fmtC(re.referralPaid)} accent={C.purple} />
          <Tile label="Dev treasury" value={fmtC(re.devTreasury)} />
          <Tile label="Burn accrued" value={fmtC(re.burnAccrued)} accent={C.red} />
        </div>
      </GlassCard>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard title="Recent deposits">
          <Ledger rows={tre?.deposits} kind="in" />
        </GlassCard>
        <GlassCard title="Recent withdrawals">
          <Ledger rows={tre?.withdrawals} kind="out" />
        </GlassCard>
      </div>
      <GlassCard title="Lucky Spin" subtitle="chips sink">
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Spins" value={fmt(sp.spins)} />
          <Tile label="Paid out" value={fmtC(sp.paid)} accent={C.amber} />
          <Tile label="Net" value={fmtC(sp.net)} accent={C.green} />
        </div>
      </GlassCard>
    </div>
  );
}
function Ledger({ rows, kind }: { rows?: any[]; kind: "in" | "out" }) {
  if (!rows?.length) return <p className="text-text-muted text-sm">None yet.</p>;
  return (
    <div className="max-h-[260px] space-y-1 overflow-y-auto">
      {rows.slice(0, 30).map((r, i) => (
        <div key={i} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 text-[12px]">
          <span className="font-mono text-text-secondary">{shortWallet(r.wallet)}</span>
          <span className={`font-mono ${kind === "in" ? "text-accent-green" : "text-accent-amber"}`}>{kind === "in" ? "+" : "−"}{fmtC(r.amount)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tournaments ────────────────────────────────────────────────────────────
export function Tournaments() {
  const { data, reload } = useAdmin<any>("/admin/tournaments", {}, []);
  const list = data?.tournaments || [];
  const [name, setName] = useState("");
  const [testBots, setTestBots] = useState(true);
  const create = async () => {
    await adminPost("/admin/tournament/create", { name: name || "Tournament", format: "points", regOpen: true, testFillBots: testBots });
    setName(""); reload();
  };
  const status = async (id: string, s: string) => { await adminPost("/admin/tournament/status", { id, status: s }); reload(); };
  const seed = async (id: string) => { const r: any = await adminPost("/admin/tournament/seed", { id }); reload(); const pods = r?.result?.pods?.length || 0; if (!pods) alert("Nothing seeded — need ≥2 players (or 🤖 test mode)."); };
  const next: Record<string, [string, string]> = { draft: ["reg_open", "▶ Open reg"], reg_open: ["checkin", "▶ Check-in"], checkin: ["__seed", "🎲 Seed round 1"], live: ["__seed", "🎲 Seed next"], done: ["", ""], cancelled: ["", ""] };
  return (
    <div className="space-y-6">
      <PageHead title="Tournaments" sub="Create & run contests (real)" />
      <GlassCard title="Create" glowColor="amber">
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="flex-1 min-w-[200px] rounded-lg border border-white/[0.08] bg-bg-surface px-3 py-2.5 text-[13px] text-white outline-none focus:border-accent-purple/40" />
          <label className="flex items-center gap-2 text-[13px] text-text-secondary"><input type="checkbox" checked={testBots} onChange={(e) => setTestBots(e.target.checked)} /> 🤖 test (fill with bots)</label>
          <button onClick={create} className="rounded-lg bg-accent-purple px-4 py-2.5 text-[13px] font-semibold text-white">Create</button>
        </div>
      </GlassCard>
      {list.map((t: any) => {
        const [ns, nl] = next[t.status] || ["", ""];
        return (
          <GlassCard key={t.id}>
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-white">{t.name}</b>
              <span className="rounded-full bg-accent-purple/20 px-2 py-0.5 text-[11px] text-accent-purple">{t.status}</span>
              <span className="text-[12px] text-text-muted">{t.format} · {t.registered}/{t.maxPlayers} · ${t.prizeUsd}{t.testFillBots ? " · 🤖 test" : ""}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ns === "__seed" ? <button onClick={() => seed(t.id)} className="rounded-lg bg-accent-green px-3 py-2 text-[12px] font-semibold text-white">{nl}</button>
                : ns ? <button onClick={() => status(t.id, ns)} className="rounded-lg bg-accent-amber px-3 py-2 text-[12px] font-semibold text-black">{nl}</button> : null}
              {t.status === "live" && <button onClick={() => status(t.id, "done")} className="rounded-lg bg-white/10 px-3 py-2 text-[12px] font-semibold text-white">🏁 Finish</button>}
              <button onClick={() => { if (confirm("Cancel?")) status(t.id, "cancelled"); }} className="rounded-lg bg-accent-red/80 px-3 py-2 text-[12px] font-semibold text-white">Cancel</button>
            </div>
          </GlassCard>
        );
      })}
      {!list.length && <p className="text-text-muted">No tournaments yet — create one above.</p>}
    </div>
  );
}

// ─── System ─────────────────────────────────────────────────────────────────
export function System() {
  const { data: d } = useStats(5000);
  const sys = d?.system || {}, lo = d?.load || {};
  return (
    <div className="space-y-6">
      <PageHead title="System" sub="Health, load & store (live)" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Uptime" value={d ? humanDur(sys.uptimeMs ?? d.totals?.uptimeMs) : "—"} />
        <Tile label="Memory" value={sys.memMB ? `${fmt(sys.memMB)}MB` : "—"} accent={C.cyan} />
        <Tile label="Errors" value={fmt(sys.errors)} accent={(sys.errors || 0) > 0 ? C.red : C.green} />
        <Tile label="Tick load" value={`${Number(lo.tickMs || 0).toFixed(1)}ms`} accent={C.amber} />
        <Tile label="WS sockets" value={fmt(sys.sockets)} />
        <Tile label="Store" value={d?.store || "—"} />
        <Tile label="Online" value={fmt(d?.online)} accent={C.green} />
        <Tile label="Rooms" value={fmt(d?.load?.rooms)} />
      </div>
    </div>
  );
}

// ─── AI Director chat ───────────────────────────────────────────────────────
export function AIChat() {
  const [msgs, setMsgs] = useState<Array<{ role: "you" | "ai"; text: string; meta?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const analyze = async () => {
    setBusy(true);
    setMsgs((m) => [...m, { role: "you", text: "Analyze the current project state." }]);
    try {
      const r: any = await adminPost("/admin/ai-analyze", {});
      setMsgs((m) => [...m, { role: "ai", text: r.text || r.error || "(no response)", meta: r.model ? `${r.model} · ${r.provider}` : "" }]);
    } catch (e) { setMsgs((m) => [...m, { role: "ai", text: "Error: " + String((e as Error).message) }]); }
    setBusy(false);
  };
  return (
    <div className="space-y-6">
      <PageHead title="AI Director" sub="Reads every data flow and reports. (External AI with memory can hook the same /admin/snapshot.)" />
      <GlassCard glowColor="purple">
        <div className="mb-4 flex items-center gap-3 border-b border-white/[0.06] pb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(139,92,246,0.15)" }}><Brain size={20} className="text-accent-purple" /></div>
          <div className="flex-1"><h2 className="text-lg font-semibold text-white">Chief Analyst</h2><p className="text-[12px] text-text-muted">full snapshot → analysis</p></div>
          <button onClick={analyze} disabled={busy} className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#8B5CF6,#06B6D4)" }}>{busy ? <RefreshCw size={14} className="animate-spin" /> : <Brain size={14} />} Analyze now</button>
        </div>
        <div className="max-h-[460px] space-y-3 overflow-y-auto">
          {!msgs.length && <p className="text-text-muted text-sm">Tap “Analyze now” for a live brief on economy, players, tournaments, load and growth.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`rounded-xl p-3 text-[13px] ${m.role === "you" ? "bg-accent-purple/10 text-accent-purple" : "bg-bg-surface text-text-secondary"}`}>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-text-muted">{m.role === "you" ? "You" : "AI"}{m.meta ? ` · ${m.meta}` : ""}</div>
              <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Connections (Подключения) ───────────────────────────────────────────────
export function Connections() {
  const { data, error, loading, reload } = useAdmin<any>("/admin/connections", {}, []);
  const items = data?.items || [];
  const okN = items.filter((i: any) => i.ok).length;
  return (
    <div className="space-y-6">
      <PageHead title="Подключения" sub="Статус всех шлюзов данных и интеграций — что реально подключено" />
      <div className="flex items-center gap-3">
        <Tile label="Подключено" value={loading ? "…" : `${okN}/${items.length}`} accent={C.green} />
        <button onClick={reload} className="rounded-lg border border-white/[0.08] bg-bg-surface px-4 py-2.5 text-[13px] font-medium text-white hover:bg-bg-surface-hover">↻ Обновить</button>
      </div>
      {error && <ErrBox error={error} />}
      <GlassCard>
        <div className="space-y-1">
          {items.map((i: any) => (
            <div key={i.key} className="flex items-center justify-between border-b border-white/[0.04] py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-lg">{i.ok ? "🟢" : "🔴"}</span>
                <span className="text-[14px] text-white">{i.label}</span>
              </div>
              <span className={`font-mono text-[12px] ${i.ok ? "text-accent-green" : "text-text-muted"}`}>{i.detail}</span>
            </div>
          ))}
          {!items.length && !loading && <p className="text-text-muted text-sm">Нет данных.</p>}
        </div>
      </GlassCard>
      <p className="text-[12px] text-text-muted">🔴 = не подключено/не настроено. Соц-API (X/TikTok/IG/YT) подключаются отдельно — до этого маркетинг-страницы помечены «DEMO».</p>
    </div>
  );
}

// ─── shared bits ────────────────────────────────────────────────────────────
function Flag({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${ok ? "bg-accent-green/15 text-accent-green" : "bg-accent-red/15 text-accent-red"}`}>{ok ? "✓" : "⚠"} {label}</span>;
}
function Act({ label, on, busy }: { label: string; on: () => void; busy: string }) {
  return <button onClick={on} disabled={!!busy} className="rounded-lg border border-white/[0.08] bg-bg-surface px-3 py-2 text-[12px] font-medium text-white hover:bg-bg-surface-hover disabled:opacity-50">{label}</button>;
}
function Loading() { return <div className="flex h-64 items-center justify-center text-text-muted"><RefreshCw className="mr-2 animate-spin" size={18} /> Loading live data…</div>; }
function ErrBox({ error }: { error: string }) {
  return <div className="mx-auto mt-10 max-w-md rounded-2xl border border-accent-red/30 bg-accent-red/10 p-6 text-center"><AlertTriangle className="mx-auto mb-2 text-accent-red" /><p className="text-white">{error === "unauthorized" ? "Wrong admin token." : `Couldn't load: ${error}`}</p></div>;
}
function humanDur(ms?: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
// keep imports used
void Users; void Wallet; void Trophy; void Activity; void Coins; void Send; void BarChart; void Bar;
