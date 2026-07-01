"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import { PlayLink } from "@/components/ui/PlayLink";
import type { TokenData } from "@/app/api/token/route";
import {
  TOKEN_TICKER, TOKEN_MINT, TOTAL_SUPPLY,
  INITIAL_ALLOCATION_PCT, RAKE_SPLIT_BPS, HOUSE_RAKE_BP_DEFAULT, PUMP_URL,
} from "@/lib/token";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── Real distribution (shared) ──────────────────────────────────────────── */
const ALLOC = [
  { key: "freeMarket",   label: "Free Market",   pct: INITIAL_ALLOCATION_PCT.freeMarket,   color: "#f5c842", note: "Fair-launch liquidity" },
  { key: "gameTreasury", label: "Game Treasury", pct: INITIAL_ALLOCATION_PCT.gameTreasury, color: "#3a9e9e", note: "Arena pools, seasons" },
  { key: "marketingCex", label: "Marketing/CEX", pct: INITIAL_ALLOCATION_PCT.marketingCex, color: "#f0a92a", note: "Global expansion" },
  { key: "devTeam",      label: "Dev Team",      pct: INITIAL_ALLOCATION_PCT.devTeam,      color: "#7a8290", note: "Locked · 3-month vest" },
] as const;

const RAKE = [
  { label: "Burn",     pct: RAKE_SPLIT_BPS.burn / 100,       color: "#d44030", note: "Deflationary — destroyed on-chain" },
  { label: "Ecosystem",pct: RAKE_SPLIT_BPS.devTreasury / 100,color: "#3a9e9e", note: "Servers, anti-cheat, prize pools" },
  { label: "Guild",    pct: RAKE_SPLIT_BPS.referral / 100,   color: "#f5c842", note: "5-tier referral network" },
] as const;

const UTILITIES = [
  { name: "Arena Stakes",   body: `Stake $${TOKEN_TICKER} in ranked matches. All stakes form the pot; the winner takes it minus the house rake.`, ex: "100-token pot → winner gets 95." },
  { name: "Instant Payouts",body: `Match winnings are paid out in $${TOKEN_TICKER} the moment a match settles. Withdraw to your wallet anytime.`, ex: "No lockups on winnings." },
  { name: "Guild Rewards",  body: "Earn a share of the rake from everyone in your guild network, five tiers deep — paid automatically.", ex: "Tiers: 10/5/3/2/1% of rake." },
  { name: "Cosmetic Skins", body: `Buy meme-fighter skins instantly with $${TOKEN_TICKER} (or grind chips). Purely cosmetic — never affects gameplay.`, ex: "21-fighter roster." },
  { name: "Deflation",      body: `25% of every house rake is permanently burned. The more the arena plays, the scarcer $${TOKEN_TICKER} becomes.`, ex: "Burn is on-chain & irreversible." },
  { name: "Governance",     body: "On-chain DAO over treasury allocation and prize pools.", ex: "Phase 2 — coming soon." },
] as const;

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
}
function fmtPrice(n: number): string {
  if (!n) return "—";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toPrecision(3)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/* ── Distribution donut (real allocation) ────────────────────────────────── */
function Donut() {
  const [hover, setHover] = useState<number | null>(null);
  const R = 120, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = ALLOC.map((a) => {
    const dash = (a.pct / 100) * C;
    const seg = { ...a, dash, offset };
    offset += dash;
    return seg;
  });
  const active = hover !== null ? ALLOC[hover] : null;
  return (
    <svg viewBox="0 0 320 320" width="300" height="300" style={{ overflow: "visible", flexShrink: 0 }} aria-label="Token allocation">
      <circle cx="160" cy="160" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="26" />
      {segs.map((s, i) => (
        <circle key={s.key} cx="160" cy="160" r={R} fill="none" stroke={s.color}
          strokeWidth={hover === i ? 34 : 24}
          strokeDasharray={`${s.dash - 3} ${C - s.dash + 3}`} strokeDashoffset={-s.offset}
          transform="rotate(-90 160 160)"
          style={{ cursor: "pointer", transition: "stroke-width 0.2s ease, filter 0.2s ease", filter: hover === i ? `drop-shadow(0 0 12px ${s.color})` : "none", opacity: hover !== null && hover !== i ? 0.3 : 1 }}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
      ))}
      <text x="160" y="152" textAnchor="middle" fill={active ? active.color : "#fff"} fontSize="40" fontWeight="800" fontFamily="var(--font-display)">
        {active ? `${active.pct}%` : `$${TOKEN_TICKER}`}
      </text>
      <text x="160" y="178" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="var(--font-mono)" letterSpacing="2">
        {active ? active.label.toUpperCase() : "SUPPLY"}
      </text>
    </svg>
  );
}

export default function TokenomicsPage() {
  const [data, setData] = useState<TokenData | null>(null);
  const [util, setUtil] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/token", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (alive) setData(d); }).catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const up = (data?.priceChange24h ?? 0) >= 0;
  const supplies = useMemo(() => [
    { label: "Total Supply", value: fmt(TOTAL_SUPPLY), color: "#fff" },
    { label: "Circulating", value: data ? fmt(data.supply) : "—", color: "#f5c842" },
    { label: "Burned", value: data ? `${data.burnedPct.toFixed(2)}%` : "—", color: "#d44030" },
  ], [data]);

  const label = "font-mono text-[0.55rem] uppercase tracking-[0.16em]";

  return (
    <main className="relative min-h-screen w-full" style={{ background: "var(--color-bg-3, #090810)" }}>
      <div className="mx-auto max-w-[1200px]" style={{ paddingInline: "var(--section-px,1.5rem)", paddingTop: "112px", paddingBottom: "64px" }}>

        {/* Hero */}
        <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-[1fr_auto]" style={{ minHeight: "28vh" }}>
          <div>
            <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", color: "#f5c842", marginBottom: "0.75rem" }}>TOKENOMICS</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, color: "#fff", margin: 0 }}>Token Architecture</h1>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "rgba(255,255,255,0.5)", marginTop: "1rem" }}>Every token has a job. Here is the structure.</p>
          </div>
          {/* compact live chip */}
          <div className="pixel-badge inline-flex items-center gap-4 px-4 py-2">
            <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem", color: "#f5c842" }}>{fmtPrice(data?.price ?? 0)}</span>
            <span className="tabular" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: up ? "#3a9e9e" : "#d44030" }}>{up ? "+" : ""}{(data?.priceChange24h ?? 0).toFixed(2)}%</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "rgba(255,255,255,0.35)" }}>${TOKEN_TICKER}</span>
          </div>
        </div>

        {/* Section 1: Supply Architecture */}
        <section className="mt-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {supplies.map((s) => (
              <div key={s.label}>
                <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl, 2.6rem)", color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div className={label} style={{ color: "rgba(255,255,255,0.35)", marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginTop: "3rem" }} />
        </section>

        {/* Section 2: Distribution */}
        <section className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_420px]">
          <div className="flex justify-center">
            <Donut />
          </div>
          <div className="flex flex-col">
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl,1.6rem)", color: "#fff", margin: "0 0 1rem" }}>Distribution</h2>
            {ALLOC.map((a) => (
              <div key={a.key} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: a.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "rgba(255,255,255,0.8)", flex: 1 }}>{a.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>{a.note}</span>
                <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem", color: "#f5c842", minWidth: 44, textAlign: "right" }}>{a.pct}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Rake engine + lock */}
        <section className="mt-20">
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl,1.6rem)", color: "#fff", margin: "0 0 0.5rem" }}>The {HOUSE_RAKE_BP_DEFAULT / 100}% Rake Engine</h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", margin: "0 0 1.5rem", maxWidth: "52ch" }}>Charged per staked match, split on-chain. Team allocation is locked on a 3-month vest — no team dump.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {RAKE.map((r) => (
              <div key={r.label} className="pixel-panel p-5" style={{ borderTop: `3px solid ${r.color}` }}>
                <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", color: r.color, lineHeight: 1 }}>{r.pct}%</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.9rem", color: "#fff", margin: "0.5rem 0 0.25rem" }}>{r.label}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{r.note}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Utility matrix (selector + panel) */}
        <section className="mt-20 grid grid-cols-1 gap-8 lg:grid-cols-[40%_1fr]">
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl,1.6rem)", color: "#fff", margin: "0 0 1.25rem" }}>Token Utility</h2>
            <div className="flex flex-col">
              {UTILITIES.map((u, i) => (
                <button key={u.name} onClick={() => setUtil(i)}
                  className="flex items-center gap-3 py-3 text-left"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "none", border: "none", cursor: "pointer" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: util === i ? "#f5c842" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", fontSize: "1rem", color: util === i ? "#fff" : "rgba(255,255,255,0.5)" }}>{u.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="pixel-panel p-8" style={{ minHeight: 200 }}>
            <AnimatePresence mode="wait">
              <motion.div key={util} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl,1.5rem)", color: "#f5c842", margin: "0 0 1rem" }}>{UTILITIES[util].name}</h3>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", margin: "0 0 1rem" }}>{UTILITIES[util].body}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>↳ {UTILITIES[util].ex}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Section 5: Live market data (real only) */}
        <section className="mt-20">
          <div className="pixel-panel p-6">
            <div className={label} style={{ color: "rgba(255,255,255,0.35)", marginBottom: "1.25rem" }}>MARKET DATA · UPDATED EVERY 60s</div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { l: "Price", v: fmtPrice(data?.price ?? 0), c: "#f5c842" },
                { l: "24h", v: `${up ? "+" : ""}${(data?.priceChange24h ?? 0).toFixed(2)}%`, c: up ? "#3a9e9e" : "#d44030" },
                { l: "Market Cap", v: data?.marketCap ? `$${fmt(data.marketCap)}` : "—", c: "#fff" },
                { l: "Circulating", v: data ? fmt(data.supply) : "—", c: "#fff" },
              ].map((m) => (
                <div key={m.l}>
                  <div className={label} style={{ color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{m.l}</div>
                  <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem", color: m.c }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 flex flex-wrap items-center gap-4">
          <PlayLink className="cta-yellow inline-flex items-center px-8" style={{ height: 52, fontSize: "0.95rem" }}>▶ Play ranked</PlayLink>
          <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="cta-ghost inline-flex items-center px-8" style={{ height: 52, fontSize: "0.9rem" }}>Buy ${TOKEN_TICKER}</a>
          <a href={`https://solscan.io/token/${TOKEN_MINT}`} target="_blank" rel="noopener noreferrer" className="cta-ghost inline-flex items-center px-8" style={{ height: 52, fontSize: "0.9rem" }}>View on Explorer</a>
        </section>
      </div>
      <Footer />
    </main>
  );
}
