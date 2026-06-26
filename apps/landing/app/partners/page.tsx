"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";

const GuildRevenueSimulator = dynamic(
  () => import("@/components/CreatorCalculator").then((m) => m.GuildRevenueSimulator),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-2xl" style={{ background: "rgba(255,140,0,0.04)" }} />
    ),
  }
);

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease },
};

/* ── Guild tier data ─────────────────────────────────────────────────────── */
const GUILD_TIERS = [
  { level: 1, name: "Iron Clan",          shortName: "IRON",    pct: 10, color: "#8a90a0", glow: "rgba(138,144,160,0.55)", bg: "138,144,160", icon: "⚔" },
  { level: 2, name: "Bronze Guild",        shortName: "BRONZE",  pct:  5, color: "#f0a92a", glow: "rgba(255,140,0,0.55)",   bg: "255,140,0",   icon: "🛡" },
  { level: 3, name: "Silver Organization", shortName: "SILVER",  pct:  3, color: "#c0c0c0", glow: "rgba(192,192,192,0.55)", bg: "192,192,192", icon: "⭐" },
  { level: 4, name: "Gold Academy",        shortName: "GOLD",    pct:  2, color: "#ffd700", glow: "rgba(255,215,0,0.60)",   bg: "255,215,0",   icon: "🏆" },
  { level: 5, name: "Diamond Franchise",   shortName: "DIAMOND", pct:  1, color: "#7fd8ff", glow: "rgba(127,216,255,0.60)",   bg: "127,216,255",   icon: "💎" },
];

/* ── Conquest steps ──────────────────────────────────────────────────────── */
const CONQUEST_STEPS = [
  {
    num: "01", icon: "🚩",
    title: "PLANT YOUR FLAG",
    tag: "?ref=...",
    body: "Deploy your guild link across every channel. When a fighter clicks it, they're tracked. No wallet needed to start — free-chip matches still count.",
    color: "#f5c842",
    glow: "rgba(245,200,66,0.35)",
  },
  {
    num: "02", icon: "🔐",
    title: "CHAIN YOUR FIGHTERS",
    tag: "Wallet Connect",
    body: "The moment they connect their Solana wallet, they are cryptographically bound to your guild. Permanently. If you don't claim your territory, another guild leader will.",
    color: "#7fd8ff",
    glow: "rgba(127,216,255,0.35)",
  },
  {
    num: "03", icon: "🌐",
    title: "THE GUILD NETWORK (5 TIERS)",
    tag: "GUILD_ROOT",
    body: "Your fighter recruits a massive Telegram clan? You earn a cut from every single match played across all 5 tiers. Your treasury grows even when you're offline.",
    color: "#f0a92a",
    glow: "rgba(255,140,0,0.35)",
  },
  {
    num: "04", icon: "⚡",
    title: "TREASURY YIELD, INSTANTLY",
    tag: "5% House Rake",
    body: "Every token match your network plays — the house takes 5%. Your guild cut is instantly routed to your treasury wallet. No vesting, no gatekeeping.",
    color: "#f5c842",
    glow: "rgba(245,200,66,0.35)",
  },
];

/* ── Guild Constitution clauses ──────────────────────────────────────────── */
const CONSTITUTION_CLAUSES = [
  {
    article: "§ 1.0",
    title: "ANTI-SYBIL ENFORCEMENT",
    color: "#ff5a4d",
    desc: "WASH TRADING IS IMPOSSIBLE. Playing against yourself? You pay 100% of the rake and recover at most 21%. Every self-play is a guaranteed financial loss.",
  },
  {
    article: "§ 2.0",
    title: "ZERO INFLATION PLEDGE",
    color: "#f5c842",
    desc: "Guild rewards originate exclusively from collected rake. Nothing is minted or printed. Real volume = real yield. No dilution. Ever.",
  },
  {
    article: "§ 3.0",
    title: "TREASURY TRANSPARENCY",
    color: "#7fd8ff",
    desc: "Every payout is anchored in on-chain Solana ledgers. Guild balances are publicly verifiable in real time. No black boxes.",
  },
  {
    article: "§ 4.0",
    title: "RAKE-CAPPED PAYOUTS",
    color: "#ffd700",
    desc: "The 21% guild pool is mathematically bounded by collected rake. The system cannot overpay under any conditions or market state.",
  },
];

/* ── Dashboard sub-components ─────────────────────────────────────────────── */
function DashCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(7,8,16,0.90)", padding: "22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <span style={{ fontSize: "1rem" }}>{icon}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function AttributionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.85rem", color, textShadow: `0 0 8px ${color}66` }}>{value}%</span>
      </div>
      <div style={{ height: "5px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, borderRadius: "999px", background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 8px ${color}66` }} />
      </div>
    </div>
  );
}

function FormField({ label, placeholder, value, onChange, type = "text", required }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)" }}>
        {label}
      </label>
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        style={{
          fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "rgba(255,255,255,0.85)",
          background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "10px", padding: "12px 14px", outline: "none", width: "100%",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
        }}
        onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#f5c842"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(245,200,66,0.10)"; }}
        onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function PartnersPage() {
  const [form, setForm] = useState({ guildName: "", channelUrl: "", email: "", region: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden" style={{ background: "transparent" }}>

      {/* ── Fixed ambient glows ────────────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        background: `
          radial-gradient(ellipse 70% 40% at 50% 10%, rgba(245,200,66,0.040) 0%, transparent 60%),
          radial-gradient(ellipse 50% 60% at 90% 40%, rgba(255,140,0,0.025) 0%, transparent 60%),
          radial-gradient(ellipse 40% 50% at 8% 80%,  rgba(127,216,255,0.025) 0%, transparent 60%)
        `,
      }} />

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-16 sm:px-8">

        {/* ── Back link ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease }} className="mb-14">
          <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px", transition: "color 0.18s ease" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f5c842")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)")}
          >
            ← Back to Arena
          </Link>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HERO                                                              */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, ease }} className="mb-28 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5"
            style={{ background: "rgba(245,200,66,0.06)", borderColor: "rgba(245,200,66,0.22)", backdropFilter: "blur(12px)" }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f5c842", boxShadow: "0 0 8px rgba(245,200,66,0.9)", display: "inline-block", animation: "neon-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(245,200,66,0.75)", textShadow: "0 0 8px rgba(245,200,66,0.5)" }}>
              Esports Guild System · Season 1 · 5-Tier Network
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic",
            fontSize: "clamp(2.4rem, 8vw, 6rem)", lineHeight: 0.92, letterSpacing: "-0.04em",
            textTransform: "uppercase", marginBottom: "1.2rem",
          }}>
            <span style={{
              background: "linear-gradient(170deg, #ffffff 0%, #f5c842 40%, #7fd8ff 90%)",
              WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(245,200,66,0.30))",
              display: "block",
            }}>
              BUILD YOUR GUILD.
            </span>
            <span style={{
              background: "linear-gradient(170deg, #f0a92a, #ffd700)",
              WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 24px rgba(255,140,0,0.35))",
              display: "block",
            }}>
              CLAIM YOUR TERRITORY.
            </span>
          </h1>

          <p style={{
            fontFamily: "var(--font-mono)", fontSize: "clamp(0.70rem, 2vw, 0.88rem)",
            color: "rgba(255,255,255,0.42)", maxWidth: "560px", margin: "0 auto 2rem", lineHeight: 1.7, letterSpacing: "0.04em",
          }}>
            Forge your clan. Recruit fighters. Earn{" "}
            <span style={{ color: "#f5c842", textShadow: "0 0 10px rgba(245,200,66,0.6)", fontWeight: 700 }}>perpetual rake</span>{" "}
            from every match your network plays — up to 5 tiers deep. Once a fighter joins your guild, their yield is yours.{" "}
            <span style={{ color: "rgba(255,255,255,0.65)" }}>Forever.</span>
          </p>

          <a href="#found-guild" className="cta-find-match inline-block rounded-xl px-10 py-4 font-bold"
            style={{ fontFamily: "var(--font-display)", fontSize: "1rem", textDecoration: "none" }}
          >
            ⚔ Found a Guild ↓
          </a>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* GUILD WAR PROTOCOL MANIFESTO                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp} className="mt-16 mb-24 relative max-w-4xl mx-auto">
          <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none"
            style={{ background: "rgba(245,200,66,0.06)", filter: "blur(100px)", borderRadius: "50%", transform: "translateY(-20%)" }}
          />
          <div style={{
            background: "rgba(7,8,16,0.88)",
            border: "1px solid rgba(245,200,66,0.14)",
            borderRadius: "24px",
            padding: "clamp(2rem, 5vw, 3rem)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(245,200,66,0.04)",
          }}>
            <h2 style={{
              fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(1.3rem, 3.5vw, 2rem)", letterSpacing: "-0.03em",
              color: "#fff", lineHeight: 1.1, marginBottom: "1.5rem", textTransform: "uppercase",
            }}>
              GUILD WAR PROTOCOL:{" "}
              <span style={{ color: "#f5c842", textShadow: "0 0 20px rgba(245,200,66,0.5)" }}>
                WHY FLAT FEES ARE FOR PEASANTS
              </span>
            </h2>

            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.75, marginBottom: "1.5rem" }}>
              You command a massive crypto clan, and you&apos;re asking:{" "}
              <em style={{ color: "rgba(255,255,255,0.55)" }}>&ldquo;What&apos;s your rate for a sponsored post?&rdquo;</em>{" "}
              Our answer:{" "}
              <strong style={{ color: "#f5c842", textShadow: "0 0 12px rgba(245,200,66,0.5)" }}>$0</strong>.{" "}
              We don&apos;t do one-off paid placements. We offer something infinitely better.
            </p>

            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.75, marginBottom: "1.5rem" }}>
              Selling a sponsored post is a peasant&apos;s game. You get paid once, the post dies in 24 hours, and your income resets to zero. We are offering you{" "}
              <strong style={{ color: "#fff" }}>Guild Commander Status</strong>{" "}
              — a chance to build a{" "}
              <strong style={{ color: "#f5c842", textShadow: "0 0 12px rgba(245,200,66,0.4)" }}>24/7 self-growing treasury engine</strong>.
            </p>

            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.75, marginBottom: "2rem" }}>
              Our platform runs on a 5-Tier smart-contract guild network. You plant your flag once, and the blockchain routes perpetual yield from every match your network plays — 5 tiers deep:
            </p>

            {/* Guild tier breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
              {[
                { tier: "IRON CLAN (Direct)", pct: 10, color: "#8a90a0", icon: "⚔", desc: "You drop your guild link. A fighter plays their first match. The contract instantly locks them to your wallet — you earn 10% of the house rake on every single match they play. Forever." },
                { tier: "BRONZE GUILD (2nd Wave)", pct: 5, color: "#f0a92a", icon: "🛡", desc: "They love the arena and recruit their friends. You automatically capture 5% of ALL their matches. This is yield from fighters you didn't even recruit directly." },
                { tier: "DIAMOND FRANCHISE (5th Wave)", pct: 1, color: "#7fd8ff", icon: "💎", desc: "The network explodes. While you sleep, the blockchain automatically routes 3%, 2%, and 1% of the global volume directly to your treasury — up to 5 levels deep." },
              ].map((row, i) => (
                <div key={i} style={{ background: `rgba(${row.color === "#8a90a0" ? "138,144,160" : row.color === "#f0a92a" ? "255,140,0" : "127,216,255"},0.05)`, border: `1px solid ${row.color}22`, borderRadius: "14px", padding: "16px 20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1, marginTop: "2px" }}>{row.icon}</span>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.7, margin: 0 }}>
                    <strong style={{ color: row.color, textShadow: `0 0 10px ${row.color}80` }}>{row.tier}:</strong>{" "}{row.desc}
                    {" "}<strong style={{ color: row.color, textShadow: `0 0 8px ${row.color}70` }}>{row.pct}%</strong> of rake on every match.
                  </p>
                </div>
              ))}
            </div>

            {/* Endgame */}
            <div style={{ borderLeft: "4px solid rgba(127,216,255,0.50)", paddingLeft: "1.5rem", margin: "2.5rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", margin: 0 }}>
                THE ENDGAME:{" "}
                <span style={{ color: "#7fd8ff", textShadow: "0 0 14px rgba(127,216,255,0.45)" }}>
                  GUILD COMMANDER GRANTS
                </span>
              </h3>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.98rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.75, margin: 0 }}>
                Top guild commanders on our global leaderboard won&apos;t just earn daily rake — they&apos;ll receive massive exclusive{" "}
                <strong style={{ color: "#ffd700", textShadow: "0 0 12px rgba(255,215,0,0.5)" }}>$BMB Airdrops</strong>{" "}
                directly from the Platform Treasury as official Web3 Grants. The map is wide open. Plant your flag now.
              </p>
            </div>

            {/* FOMO Warning */}
            <div style={{ background: "rgba(255,90,77,0.07)", border: "1px solid rgba(255,90,77,0.28)", borderRadius: "14px", padding: "24px", marginBottom: "2rem" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", color: "#ff5a4d", textShadow: "0 0 12px rgba(255,90,77,0.6)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "8px" }}>
                ⚡ TERRITORY IS FIRST-COME, FIRST-SERVED
              </h3>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.75, margin: 0 }}>
                Web3 attention is finite. Your community{" "}
                <strong style={{ color: "#fff" }}>WILL</strong> find this game. The only question: Will{" "}
                <strong style={{ color: "#ffd700" }}>YOU</strong> plant your guild flag and lock them in{" "}
                <strong style={{ color: "#fff" }}>TODAY</strong>, or will another guild commander drop their link in your comment section tomorrow?{" "}
                <strong style={{ color: "#f5c842", textShadow: "0 0 10px rgba(245,200,66,0.4)" }}>Stop selling posts. Start building your empire.</strong>
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              <a href="#found-guild" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", background: "linear-gradient(135deg, #f5c842, #7fd8ff)", color: "#111", padding: "14px 28px", borderRadius: "999px", textDecoration: "none", letterSpacing: "0.02em", boxShadow: "0 4px 24px rgba(245,200,66,0.35)", display: "inline-flex", alignItems: "center", gap: "8px", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 32px rgba(245,200,66,0.55)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(245,200,66,0.35)"; }}
              >
                ⚔ FOUND MY GUILD
              </a>
              <a href="#" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.80)", padding: "14px 24px", borderRadius: "999px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px", transition: "all 0.18s ease" }}>
                📦 GUILD PROMO KIT
              </a>
            </div>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — CONQUEST STEPS                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp} className="mb-24">
          <GuildSectionLabel color="#7fd8ff" glowColor="rgba(127,216,255,0.5)">Guild Protocol</GuildSectionLabel>
          <h2 className="section-heading" style={{ textTransform: "uppercase" }}>The Conquest Playbook</h2>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "rgba(255,255,255,0.38)", maxWidth: "520px", marginBottom: "2.5rem", lineHeight: 1.65 }}>
            You don&apos;t just earn from your fighters. You earn from everyone they recruit, up to 5 tiers deep. Build your empire while you sleep.
          </p>
          <div className="flex flex-col gap-4">
            {CONQUEST_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, ease, delay: i * 0.09 }}
                style={{ display: "flex", gap: "20px", alignItems: "flex-start", background: "rgba(7,8,16,0.85)", border: `1px solid ${step.color}20`, borderRadius: "18px", padding: "20px 24px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden" }}
              >
                <div aria-hidden style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3px", background: `linear-gradient(180deg, ${step.color}88, ${step.color}22)`, borderRadius: "18px 0 0 18px" }} />
                <div style={{ flexShrink: 0, width: "44px", height: "44px", borderRadius: "12px", background: `${step.color}10`, border: `1px solid ${step.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                  {step.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "1rem", color: "#fff", textTransform: "uppercase", letterSpacing: "-0.01em" }}>{step.title}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: step.color, textShadow: `0 0 8px ${step.glow}`, background: `${step.color}12`, border: `1px solid ${step.color}30`, borderRadius: "999px", padding: "2px 10px" }}>
                      {step.tag}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "rgba(255,255,255,0.42)", lineHeight: 1.65, margin: 0 }}>{step.body}</p>
                </div>
                <div style={{ flexShrink: 0, alignSelf: "center", fontFamily: "var(--font-mono)", fontSize: "0.62rem", fontWeight: 700, color: `${step.color}45`, letterSpacing: "0.1em" }}>{step.num}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — GUILD TIER RANKS                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp} className="mb-8">
          <GuildSectionLabel color="#ffd700" glowColor="rgba(255,215,0,0.5)">Guild Tiers</GuildSectionLabel>
          <h2 className="section-heading" style={{ textTransform: "uppercase" }}>5-Tier Rake Distribution</h2>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "rgba(255,255,255,0.38)", maxWidth: "560px", marginBottom: "2.5rem", lineHeight: 1.65 }}>
            Guild rewards are funded exclusively from the{" "}
            <span style={{ color: "#ff5a4d" }}>house rake</span> on real token matches — never from printed tokens or a treasury subsidy.
          </p>

          <div className="bento-card p-6 sm:p-8 flex flex-col gap-4 mb-6">
            {GUILD_TIERS.map((tier, i) => (
              <motion.div key={tier.level}
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: i * 0.08 }}
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0, background: `rgba(${tier.bg},0.10)`, border: `1px solid ${tier.color}30`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                  <span style={{ fontSize: "1rem", lineHeight: 1 }}>{tier.icon}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.42rem", fontWeight: 700, letterSpacing: "0.06em", color: tier.color, textShadow: `0 0 6px ${tier.glow}` }}>{tier.shortName}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "4px" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "rgba(255,255,255,0.55)" }}>{tier.name}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", color: tier.color, textShadow: `0 0 10px ${tier.glow}` }}>{tier.pct}% of rake</span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(tier.pct / 10) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease, delay: i * 0.08 + 0.2 }}
                      style={{ height: "100%", borderRadius: "999px", background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})`, boxShadow: `0 0 8px ${tier.glow}` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Callout */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.2 }}
            style={{ background: "rgba(245,200,66,0.04)", border: "1px solid rgba(245,200,66,0.18)", borderRadius: "16px", padding: "20px 24px", display: "flex", gap: "16px", alignItems: "flex-start", boxShadow: "0 0 40px rgba(245,200,66,0.04)" }}
          >
            <span style={{ fontSize: "1.6rem", flexShrink: 0, lineHeight: 1 }}>⚖️</span>
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", color: "#f5c842", marginBottom: "6px", textShadow: "0 0 10px rgba(245,200,66,0.4)" }}>
                Guild Constitution — Golden Rule
              </p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "rgba(255,255,255,0.48)", lineHeight: 1.65, margin: 0 }}>
                Total guild payout{" "}
                <span style={{ color: "#f5c842", fontWeight: 700 }}>(21% of rake)</span>{" "}
                never exceeds the collected house rake. The platform retains{" "}
                <span style={{ color: "#7fd8ff", fontWeight: 700 }}>79%</span>{" "}
                to back the treasury. No tokens are ever minted or printed out of thin air.
              </p>
            </div>
          </motion.div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3 — GUILD REVENUE SIMULATOR                              */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp} className="mb-24 mt-16">
          <GuildSectionLabel color="#f5c842" glowColor="rgba(245,200,66,0.5)">Simulate</GuildSectionLabel>
          <h2 className="section-heading" style={{ textTransform: "uppercase" }}>Guild Treasury Simulator</h2>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "rgba(255,255,255,0.38)", maxWidth: "520px", marginBottom: "2rem", lineHeight: 1.65 }}>
            Drag the sliders to model your guild network. Treasury yield updates instantly using live rake math.
          </p>
          <GuildRevenueSimulator />
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4 — GUILD CONSTITUTION                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp} className="mb-24">
          <GuildSectionLabel color="#ff5a4d" glowColor="rgba(255,90,77,0.5)">Governance</GuildSectionLabel>
          <h2 className="section-heading" style={{ textTransform: "uppercase" }}>Guild Constitution</h2>

          {/* Terminal-style constitution block */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease }}
            style={{
              background: "rgba(0,4,0,0.92)", border: "1px solid rgba(245,200,66,0.22)",
              borderRadius: "16px", overflow: "hidden",
              boxShadow: "0 0 60px rgba(245,200,66,0.06), 0 24px 64px rgba(0,0,0,0.8)",
              marginBottom: "20px",
              fontFamily: "var(--font-mono)",
            }}
          >
            {/* Terminal chrome */}
            <div style={{ borderBottom: "1px solid rgba(245,200,66,0.14)", padding: "10px 18px", background: "rgba(0,0,0,0.50)", display: "flex", alignItems: "center", gap: "8px" }}>
              {["#ff5a4d", "#ffd700", "#f5c842"].map((c) => (
                <div key={c} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
              <span style={{ fontSize: "0.58rem", letterSpacing: "0.18em", color: "rgba(245,200,66,0.45)", marginLeft: "8px", textTransform: "uppercase" }}>
                bombermeme.gg / guild / constitution.sol
              </span>
              <div style={{ marginLeft: "auto" }}>
                <span style={{ fontSize: "0.56rem", letterSpacing: "0.14em", color: "#f5c842", textShadow: "0 0 6px rgba(245,200,66,0.6)", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.22)", borderRadius: "999px", padding: "2px 10px" }}>
                  ● ON-CHAIN
                </span>
              </div>
            </div>

            {/* Constitution content */}
            <div style={{ padding: "24px 28px" }}>
              {/* Header */}
              <div style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid rgba(245,200,66,0.10)" }}>
                <div style={{ fontSize: "0.56rem", letterSpacing: "0.24em", color: "rgba(245,200,66,0.50)", textTransform: "uppercase", marginBottom: "4px" }}>
                  // GUILD_CONSTITUTION_V1.sol · IMMUTABLE · VERIFIED
                </div>
                <div style={{ fontSize: "0.90rem", fontWeight: 700, letterSpacing: "0.06em", color: "#f5c842", textShadow: "0 0 12px rgba(245,200,66,0.6)", textTransform: "uppercase" }}>
                  BOMBERMEME GUILD FAIR PLAY PROTOCOL
                </div>
              </div>

              {/* Articles */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                {CONSTITUTION_CLAUSES.map((clause, i) => (
                  <motion.div
                    key={clause.article}
                    initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.08 }}
                    style={{ padding: "12px 0", borderBottom: i < CONSTITUTION_CLAUSES.length - 1 ? "1px solid rgba(245,200,66,0.06)" : "none" }}
                  >
                    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "0.60rem", fontWeight: 700, color: clause.color, textShadow: `0 0 6px ${clause.color}80`, letterSpacing: "0.10em", minWidth: "36px", flexShrink: 0, marginTop: "2px" }}>
                        {clause.article}
                      </span>
                      <div>
                        <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: clause.color, textShadow: `0 0 8px ${clause.color}60`, marginBottom: "4px" }}>
                          {clause.title}
                        </div>
                        <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.40)", lineHeight: 1.6, letterSpacing: "0.04em" }}>
                          {clause.desc}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(245,200,66,0.10)", fontSize: "0.52rem", color: "rgba(245,200,66,0.30)", letterSpacing: "0.14em" }}>
                {'>'} CONSTITUTION_HASH: 0x4f6e2d...cafe ·&nbsp;
                DEPLOYED: Solana Mainnet ·&nbsp;
                STATUS: ACTIVE
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 5 — GUILD COMMAND CENTER (dashboard preview)            */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp} className="mb-24">
          <GuildSectionLabel color="#f0a92a" glowColor="rgba(255,140,0,0.5)">Command Center</GuildSectionLabel>
          <h2 className="section-heading" style={{ textTransform: "uppercase" }}>Guild Dashboard Preview</h2>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "rgba(255,255,255,0.38)", maxWidth: "520px", marginBottom: "2.5rem", lineHeight: 1.65 }}>
            Guild commanders get an institutional-grade analytics panel. Track every fighter, every match, every satoshi — across all 5 tiers.
          </p>

          <div style={{ background: "rgba(7,8,16,0.90)", border: "1px solid rgba(255,140,0,0.16)", borderRadius: "24px", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 60px rgba(255,140,0,0.04)" }}>
            {/* Mock chrome */}
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 20px", display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.30)" }}>
              {["#ff5a4d", "#ffd700", "#f5c842"].map((c) => (
                <div key={c} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.60rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.20)", marginLeft: "8px", textTransform: "uppercase" }}>
                bombermeme.gg / guild / command-center
              </span>
              <div style={{ marginLeft: "auto" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.12em", color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.5)", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.20)", borderRadius: "999px", padding: "2px 10px" }}>
                  ● LIVE
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
              <DashCard title="Guild Roster" icon="⚔">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    { label: "Iron Clan (Direct)", value: "247",    color: "#8a90a0" },
                    { label: "Bronze Guild",        value: "1,830",  color: "#f0a92a" },
                    { label: "Silver + Above",      value: "12,441", color: "#7fd8ff" },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.10em" }}>{row.label}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem", color: row.color, textShadow: `0 0 10px ${row.color}66` }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.60rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Total Fighters</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "#fff" }}>14,518</span>
                  </div>
                </div>
              </DashCard>

              <DashCard title="Territory Control" icon="🌐">
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <AttributionBar label="Guild-attributed" value={78} color="#f5c842" />
                  <AttributionBar label="Organic discovery" value={22} color="#7fd8ff" />
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.60rem", color: "rgba(255,255,255,0.20)", letterSpacing: "0.10em", margin: 0, lineHeight: 1.5 }}>
                    78% of network volume directly attributed to your guild links.
                  </p>
                </div>
              </DashCard>

              <DashCard title="Treasury Ledger" icon="💰">
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "4px" }}>Total Treasury Yield</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "2rem", letterSpacing: "-0.04em", color: "#f5c842", textShadow: "0 0 16px rgba(245,200,66,0.7)", lineHeight: 1 }}>$8,342.50</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "rgba(255,255,255,0.18)", marginTop: "4px", letterSpacing: "0.10em" }}>≈ 51.2 SOL at current price</div>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "14px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "8px" }}>This Month</div>
                    <div style={{ display: "flex", gap: "16px" }}>
                      {[{ label: "Volume", val: "$24,100" }, { label: "Rake", val: "$1,205" }, { label: "Guild Cut", val: "$120.5" }].map((s) => (
                        <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>{s.val}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DashCard>

              <DashCard title="Guild Commanders" icon="🏆">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    { rank: 1, handle: "0xWarlord_GG",    vol: "$18,420", color: "#ffd700"  },
                    { rank: 2, handle: "PepeArmy_Lead",   vol: "$12,310", color: "#c0c0c0"  },
                    { rank: 3, handle: "SolanaGuild_HQ",  vol: "$9,875",  color: "#f0a92a"  },
                    { rank: 4, handle: "DiamondDoge",     vol: "$7,240",  color: "rgba(255,255,255,0.30)" },
                    { rank: 5, handle: "TrumpClan_Alpha", vol: "$5,102",  color: "rgba(255,255,255,0.30)" },
                  ].map((p) => (
                    <div key={p.rank} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", fontWeight: 700, color: p.color, width: "16px", textAlign: "center", textShadow: p.rank <= 3 ? `0 0 8px ${p.color}88` : "none" }}>{p.rank}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "rgba(255,255,255,0.60)", flex: 1 }}>{p.handle}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.85rem", color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.5)" }}>{p.vol}</span>
                    </div>
                  ))}
                </div>
              </DashCard>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", color: "rgba(255,255,255,0.16)", letterSpacing: "0.12em" }}>
                Available after guild approval · All data real-time on-chain
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", color: "rgba(255,140,0,0.40)", letterSpacing: "0.10em" }}>
                PREVIEW MODE
              </span>
            </div>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* APPLICATION FORM — FOUND A GUILD                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp} id="found-guild" className="mb-24">
          <GuildSectionLabel color="#f5c842" glowColor="rgba(245,200,66,0.5)">Recruitment</GuildSectionLabel>
          <h2 className="section-heading" style={{ textTransform: "uppercase" }}>Found a Guild</h2>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "rgba(255,255,255,0.38)", maxWidth: "460px", marginBottom: "2.5rem", lineHeight: 1.65 }}>
            Every application is reviewed manually. Guild commanders with engaged communities in any region are welcome. Season 1 slots are limited.
          </p>

          <div className="bento-card p-7 sm:p-10 max-w-2xl" style={{ border: "1px solid rgba(245,200,66,0.14)" }}>
            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }} style={{ textAlign: "center", padding: "2rem 0" }}>
                <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>⚔</div>
                <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "1.6rem", textTransform: "uppercase", color: "#f5c842", textShadow: "0 0 16px rgba(245,200,66,0.7)", marginBottom: "0.75rem" }}>
                  Guild Application Received
                </h3>
                <p style={{ fontFamily: "var(--font-display)", color: "rgba(255,255,255,0.45)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                  Your guild application is under review. Expect a response within 48 hours. Sharpen your fighters.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Guild Name / Handle" placeholder="e.g. 0xWarriors_GG" value={form.guildName} onChange={(v) => setForm((f) => ({ ...f, guildName: v }))} required />
                  <FormField label="Community URL" placeholder="https://t.me/yourguild" value={form.channelUrl} onChange={(v) => setForm((f) => ({ ...f, channelUrl: v }))} type="url" required />
                  <FormField label="Email Address" placeholder="commander@guild.gg" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} type="email" required />
                  <FormField label="Primary Region" placeholder="e.g. Asia, Europe, LatAm..." value={form.region} onChange={(v) => setForm((f) => ({ ...f, region: v }))} required />
                </div>
                <button type="submit"
                  className="cta-find-match w-full rounded-xl py-5 font-bold cursor-pointer border-none"
                  style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.04em", marginTop: "8px" }}
                  onMouseDown={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(0.97)")}
                  onMouseUp={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
                >
                  ⚔ Found My Guild →
                </button>
              </form>
            )}
          </div>
        </motion.section>

        {/* Footer note */}
        <motion.p {...fadeUp} style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", textAlign: "center", paddingBottom: "3rem" }}>
          Bombermeme Guild System · Solana · Provably Fair · All rewards on-chain
        </motion.p>

      </div>
    </main>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */
function GuildSectionLabel({ children, color, glowColor }: { children: React.ReactNode; color: string; glowColor: string }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color, textShadow: `0 0 10px ${glowColor}`, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ display: "inline-block", width: "24px", height: "1px", background: `${color}70` }} />
      {children}
    </div>
  );
}
