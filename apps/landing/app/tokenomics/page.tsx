"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Footer } from "@/components/Footer";
import { EcosystemFlow } from "@/components/EcosystemFlow";
import { TheFurnace } from "@/components/TheFurnace";

/* ── constants ─────────────────────────────────────────────────────────── */
const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const CIRC = 2 * Math.PI * 120; // circumference of donut ring (r=120) ≈ 753.98

/* ── Pillar 1 data ─────────────────────────────────────────────────────── */
const ALLOCATIONS = [
  {
    pct: 88,
    label: "Free Market",
    chartLabel: "FREE MARKET",
    sublabel: "Fair Launch Liquidity",
    tag: "FAIR LAUNCH LIQUIDITY",
    color: "#4ade80",
    rgb: "74,222,128",
    body: "Total decentralization from second one. No hidden pre-sales, VC bags, or private rounds — the market and liquidity are 100% owned by the community.",
  },
  {
    pct: 5,
    label: "Game Treasury",
    chartLabel: "TREASURY",
    sublabel: "Ecosystem Rewards",
    tag: "ECOSYSTEM REWARDS",
    color: "#22d3ee",
    rgb: "34,211,238",
    body: "Guaranteed liquidity reserve for players. Smart contracts automatically fund Arena prize pools, seasonal leaderboards, and skill-based tournament rewards.",
  },
  {
    pct: 4,
    label: "Marketing & CEX",
    chartLabel: "MARKETING",
    sublabel: "",
    tag: "GLOBAL EXPANSION",
    color: "#ffcc33",
    rgb: "255,204,51",
    body: "Project scaling budget. Reserved for Tier-1 integrations, global partnerships, and securing liquidity pools on centralized exchanges (CEX).",
  },
  {
    pct: 3,
    label: "Dev Team",
    chartLabel: "DEV TEAM",
    sublabel: "Long-Term Commitment",
    tag: "LONG-TERM COMMITMENT",
    color: "#f59e0b",
    rgb: "245,158,11",
    body: "Long-term developer alignment. Tokens are cryptographically locked via a strict 3-month vesting smart contract, guaranteeing the market our absolute focus on continuous architectural improvement.",
  },
] as const;

/* ── Pillar 2 data — Model B: 3 active + 2 Phase 2 ───────────────────── */
interface RakeBucket {
  pct: number; share: number; phase2: boolean;
  icon: string; label: string; sublabel: string; tag: string;
  color: string; rgb: string; body: string;
}

const RAKE_DIST: readonly RakeBucket[] = [
  {
    pct: 25, share: 0.25, phase2: false,
    icon: "🔥", label: "Burn", sublabel: "Deflationary Core", tag: "DEFLATIONARY CORE",
    color: "#ff5a4d", rgb: "255,90,77",
    body: "Algorithmic supply destruction. Every match permanently removes 25% of the rake from circulation — on-chain, irreversible, immediate. The more the arena burns, the scarcer $BMB becomes.",
  },
  {
    pct: 54, share: 0.54, phase2: false,
    icon: "⚙️", label: "Ecosystem & Infrastructure", sublabel: "Operational Reserve", tag: "ECOSYSTEM CORE",
    color: "#5ad27a", rgb: "90,210,122",
    body: "Funds 20Hz ultra-low latency servers, anti-cheat AI, continuous gameplay evolution, and seeds upcoming tournament prize pools.",
  },
  {
    pct: 21, share: 0.21, phase2: false,
    icon: "🕸️", label: "Guild Yield", sublabel: "5-Tier Network", tag: "NETWORK REWARDS",
    color: "#ffd700", rgb: "255,215,0",
    body: "Smart-contract guild rewards. Automated payouts across 5 tiers deep for every fighter your guild network recruits. Clan leaders earn perpetually from their roster's matches.",
  },
  {
    pct: 0, share: 0, phase2: true,
    icon: "💎", label: "Real Yield", sublabel: "Coming Phase 2", tag: "PHASE 2",
    color: "#7fd8ff", rgb: "127,216,255",
    body: "Staking APY unlocks in Phase 2 when platform volume milestones are reached. Token holders will earn passive income generated directly from the global arena volume.",
  },
  {
    pct: 0, share: 0, phase2: true,
    icon: "🗳️", label: "DAO Impact", sublabel: "Coming Phase 2", tag: "PHASE 2",
    color: "#a855f7", rgb: "168,85,247",
    body: "On-chain governance activates in Phase 2 after TGE milestones. Token holders command the ecosystem budget via decentralized voting on prize pools and infrastructure grants.",
  },
];

/* ── flow line data for the SVG connector (matches RAKE_DIST order) ───── */
interface FlowLine { cx: number; color: string; delay: string; phase2: boolean; }
const FLOW_LINES: readonly FlowLine[] = [
  { cx: 100, color: "#ff5a4d", delay: "0s",     phase2: false },
  { cx: 300, color: "#5ad27a", delay: "-0.12s", phase2: false },
  { cx: 500, color: "#ffd700", delay: "-0.24s", phase2: false },
  { cx: 700, color: "#7fd8ff", delay: "-0.36s", phase2: true  },
  { cx: 900, color: "#a855f7", delay: "-0.48s", phase2: true  },
];

/* ══════════════════════════════════════════════════════════════════════════
   AnimatedNumber — smooth RAF-based counter
══════════════════════════════════════════════════════════════════════════ */
function AnimatedNumber({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    const from = displayRef.current;
    const to = value;
    const startTime = performance.now();
    const duration = 320;

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      const current = from + (to - from) * eased;
      displayRef.current = current;
      setDisplay(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return (
    <span>
      {prefix}
      {Math.round(display).toLocaleString("en-US")}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DonutChart — interactive SVG ring chart
══════════════════════════════════════════════════════════════════════════ */
function DonutChart() {
  const [hovered, setHovered] = useState<number | null>(null);

  let offset = 0;
  const segments = ALLOCATIONS.map((a, i) => {
    const dash = (a.pct / 100) * CIRC;
    const seg = { ...a, i, dash, offset };
    offset += dash;
    return seg;
  });

  const active = hovered !== null ? ALLOCATIONS[hovered] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <svg
        viewBox="0 0 320 320"
        width="300"
        height="300"
        style={{ overflow: "visible", flexShrink: 0 }}
        aria-label="Token supply allocation donut chart"
      >
        {/* Background track */}
        <circle
          cx="160" cy="160" r="120"
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="28"
        />

        {/* Segments */}
        {segments.map((seg) => {
          const isHovered = hovered === seg.i;
          const isDimmed = hovered !== null && !isHovered;
          return (
            <circle
              key={seg.i}
              cx="160" cy="160" r="120"
              fill="none"
              stroke={seg.color}
              strokeWidth={isHovered ? 36 : 26}
              strokeDasharray={`${seg.dash - 3} ${CIRC - seg.dash + 3}`}
              strokeDashoffset={-seg.offset}
              transform="rotate(-90 160 160)"
              style={{
                filter: isHovered
                  ? `drop-shadow(0 0 18px ${seg.color}) drop-shadow(0 0 40px ${seg.color}80)`
                  : isDimmed
                  ? "opacity(0.18)"
                  : `drop-shadow(0 0 5px ${seg.color}60)`,
                cursor: "pointer",
                transition: "stroke-width 0.25s ease, filter 0.25s ease",
              }}
              onMouseEnter={() => setHovered(seg.i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Center label */}
        <text
          x="160"
          y="152"
          textAnchor="middle"
          fill={active ? active.color : "rgba(255,255,255,0.92)"}
          fontSize="44"
          fontWeight="700"
          fontFamily="var(--font-display)"
          style={{ transition: "fill 0.2s ease" }}
        >
          {active ? `${active.pct}%` : "$BMB"}
        </text>
        <text
          x="160"
          y="178"
          textAnchor="middle"
          fill="rgba(255,255,255,0.32)"
          fontSize="11"
          fontFamily="var(--font-mono)"
          letterSpacing="1.8"
        >
          {active ? active.chartLabel : "SUPPLY"}
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 16px" }}>
        {ALLOCATIONS.map((a, i) => (
          <button
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
            aria-label={`${a.pct}% ${a.label}`}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: a.color, boxShadow: `0 0 6px ${a.color}`,
              display: "block", flexShrink: 0,
              transform: hovered === i ? "scale(1.5)" : "scale(1)",
              transition: "transform 0.2s ease",
            }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "0.62rem",
              color: hovered === i ? a.color : "rgba(255,255,255,0.38)",
              letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
              transition: "color 0.2s ease",
            }}>
              {a.pct}% {a.chartLabel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RakeFlowSVG — animated dashed connector lines (desktop only)
══════════════════════════════════════════════════════════════════════════ */
function RakeFlowSVG() {
  return (
    <>
      <style>{`
        @keyframes dashTravel {
          from { stroke-dashoffset: 14; }
          to   { stroke-dashoffset: 0; }
        }
        .flow-path {
          stroke-dasharray: 8 6;
          animation: dashTravel 0.55s linear infinite;
          stroke-linecap: round;
        }
      `}</style>
      <svg
        viewBox="0 0 1000 68"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 68, display: "block", overflow: "visible" }}
        aria-hidden
      >
        {FLOW_LINES.map(({ cx, color, delay, phase2 }) => (
          <path
            key={cx}
            d={`M500,0 L500,28 L${cx},28 L${cx},68`}
            fill="none"
            stroke={color}
            strokeWidth={phase2 ? "1.2" : "1.8"}
            strokeDasharray={phase2 ? "3 6" : "8 6"}
            className={phase2 ? undefined : "flow-path"}
            style={{
              animationDelay: delay,
              opacity: phase2 ? 0.25 : 0.70,
              filter: phase2 ? "none" : `drop-shadow(0 0 3px ${color}80)`,
            }}
          />
        ))}
      </svg>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RakeSimulator — live interactive calculator
══════════════════════════════════════════════════════════════════════════ */
const PRESETS = [100, 500, 1000, 5000, 10000, 50000] as const;

function RakeSimulator() {
  const [pool, setPool] = useState(10000);
  const rake = pool * 0.05;
  const pct = ((pool - 10) / (50000 - 10)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 36, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, ease }}
      style={{
        maxWidth: 720,
        margin: "0 auto",
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        backdropFilter: "blur(28px) saturate(1.4)",
        WebkitBackdropFilter: "blur(28px) saturate(1.4)",
        padding: "clamp(24px, 5vw, 44px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Widget header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.25em",
          color: "rgba(255,204,51,0.65)", textTransform: "uppercase", marginBottom: 10,
        }}>
          — REAL-TIME RAKE DISTRIBUTOR —
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(1.1rem, 3.5vw, 1.55rem)",
          color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em",
        }}>
          Размер общего банка матча
        </div>
      </div>

      {/* Pool value display */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(2.2rem, 8vw, 3.5rem)", letterSpacing: "-0.04em",
          color: "#5ad27a",
          textShadow: "0 0 24px rgba(90,210,122,0.55), 0 0 60px rgba(90,210,122,0.25)",
          lineHeight: 1,
        }}>
          <AnimatedNumber value={pool} />
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginTop: 6,
        }}>
          match pool size
        </div>
      </div>

      {/* Slider track */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", height: 32, display: "flex", alignItems: "center" }}>
          {/* Track */}
          <div style={{
            position: "absolute", left: 0, right: 0, height: 6,
            borderRadius: 999, background: "rgba(255,255,255,0.07)",
          }}>
            <div style={{
              height: "100%", borderRadius: 999,
              width: `${pct}%`,
              background: "linear-gradient(90deg, #5ad27a, #7fd8ff)",
              boxShadow: "0 0 10px rgba(90,210,122,0.5)",
              transition: "width 0.04s linear",
            }} />
          </div>
          {/* Thumb dot */}
          <div style={{
            position: "absolute",
            left: `${pct}%`,
            transform: "translateX(-50%)",
            width: 16, height: 16, borderRadius: "50%",
            background: "#5ad27a",
            boxShadow: "0 0 0 3px rgba(90,210,122,0.2), 0 0 16px rgba(90,210,122,0.5)",
            pointerEvents: "none",
            transition: "left 0.04s linear",
            zIndex: 1,
          }} />
          {/* Invisible range input */}
          <input
            type="range"
            min={10}
            max={50000}
            step={10}
            value={pool}
            onChange={(e) => setPool(Number(e.target.value))}
            style={{
              position: "absolute", inset: 0, width: "100%",
              opacity: 0, cursor: "pointer",
              WebkitAppearance: "none", appearance: "none",
            }}
            aria-label="Match pool size"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>$10</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>$50,000</span>
        </div>
      </div>

      {/* Preset chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" }}>
        {PRESETS.map((v) => (
          <button
            key={v}
            onClick={() => setPool(v)}
            style={{
              flex: 1, minWidth: 52,
              padding: "5px 0",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              border: `1px solid ${pool === v ? "rgba(90,210,122,0.40)" : "rgba(255,255,255,0.1)"}`,
              background: pool === v ? "rgba(90,210,122,0.08)" : "rgba(255,255,255,0.05)",
              color: pool === v ? "#5ad27a" : "rgba(255,255,255,0.4)",
              boxShadow: pool === v ? "0 0 10px rgba(90,210,122,0.25)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            {v >= 1000 ? `$${v / 1000}K` : `$${v}`}
          </button>
        ))}
      </div>

      {/* Rake total */}
      <div style={{
        background: "rgba(90,210,122,0.05)",
        border: "1px solid rgba(90,210,122,0.18)",
        borderRadius: 14,
        padding: "14px 20px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 3 }}>
            5% House Rake
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "rgba(255,255,255,0.2)" }}>
            Collected instantly per match
          </div>
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(1.3rem, 4vw, 1.9rem)", letterSpacing: "-0.03em",
          color: "#5ad27a", textShadow: "0 0 20px rgba(90,210,122,0.65)",
        }}>
          <AnimatedNumber value={rake} />
        </div>
      </div>

      {/* Distribution rows — active buckets only */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RAKE_DIST.filter((d) => !d.phase2).map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease, delay: i * 0.06 }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              background: `rgba(${d.rgb},0.05)`,
              border: `1px solid rgba(${d.rgb},0.12)`,
              borderRadius: 12,
              padding: "11px 16px",
            }}
          >
            <span style={{ fontSize: "1.15rem", flexShrink: 0, lineHeight: 1 }}>{d.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: "0.82rem", color: d.color,
                textTransform: "uppercase", letterSpacing: "0.03em",
              }}>
                {d.label}
                <span style={{ color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>
                  {" "}({d.pct}%)
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ width: 60, height: 3, borderRadius: 999,
              background: "rgba(255,255,255,0.06)", flexShrink: 0, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 999,
                width: `${d.pct * 4}%`,
                background: d.color, opacity: 0.6,
              }} />
            </div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "clamp(0.9rem, 2.5vw, 1.15rem)", letterSpacing: "-0.02em",
              color: d.color, textShadow: `0 0 12px ${d.color}70`,
              flexShrink: 0, minWidth: 64, textAlign: "right",
            }}>
              <AnimatedNumber value={rake * d.share} />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SectionLabel — reusable pillar label
══════════════════════════════════════════════════════════════════════════ */
function SectionLabel({ pillar, title, subtitle }: {
  pillar: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease }}
      style={{ textAlign: "center", marginBottom: 56 }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 36, height: 1, background: "rgba(90,210,122,0.25)" }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.28em",
          color: "rgba(90,210,122,0.55)", textTransform: "uppercase",
          textShadow: "0 0 8px rgba(90,210,122,0.4)",
        }}>
          {pillar}
        </span>
        <div style={{ width: 36, height: 1, background: "rgba(90,210,122,0.25)" }} />
      </div>
      <h2 style={{
        fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic",
        fontSize: "clamp(1.9rem, 4.5vw, 3rem)", letterSpacing: "-0.04em",
        color: "#fff", margin: "0 0 10px", textTransform: "uppercase",
        filter: "drop-shadow(0 0 20px rgba(90,210,122,0.15))",
      }}>
        {title}
      </h2>
      <p style={{
        fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.22)", textTransform: "uppercase", margin: 0,
      }}>
        {subtitle}
      </p>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   WalletCard — on-chain transparency address card
══════════════════════════════════════════════════════════════════════════ */
function WalletCard({
  title, tag, color, rgb, address,
}: {
  title: string;
  tag: string;
  color: string;
  rgb: string;
  address: string;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      style={{
        padding: "16px 18px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "background 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 600,
          fontSize: "0.88rem", color: "#fff",
        }}>
          {title}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.58rem",
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: color,
          background: `rgba(${rgb},0.12)`,
          border: `1px solid rgba(${rgb},0.25)`,
          boxShadow: `0 0 10px rgba(${rgb},0.2)`,
          padding: "2px 8px", borderRadius: "999px",
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {tag}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.68rem",
          color: "rgba(255,255,255,0.45)", letterSpacing: "-0.01em",
          wordBreak: "break-all", flex: 1, lineHeight: 1.6,
        }}>
          {address}
        </span>
        <button
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy address"}
          style={{
            flexShrink: 0, background: "none", border: "none",
            cursor: "pointer", padding: "4px", marginTop: "1px",
            color: copied ? color : "rgba(255,255,255,0.28)",
            transition: "color 0.2s ease",
          }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      {copied && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.58rem",
          color: color, letterSpacing: "0.14em",
        }}>
          ADDRESS COPIED ✓
        </span>
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════════ */
export default function TokenomicsPage() {
  return (
    <main
      className="relative min-h-screen w-full overflow-x-hidden"
      style={{ background: "transparent" }}
    >
      {/* ── Fixed ambient glows ─────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          background: `
            radial-gradient(ellipse 65% 45% at 50% 0%,   rgba(90,210,122,0.040)   0%, transparent 62%),
            radial-gradient(ellipse 40% 55% at 8%  50%,  rgba(127,216,255,0.025)   0%, transparent 60%),
            radial-gradient(ellipse 40% 55% at 92% 60%,  rgba(255,90,77,0.020)  0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 50% 90%,  rgba(90,210,122,0.018)   0%, transparent 60%)
          `,
        }}
      />

      <div className="relative z-10 px-4 sm:px-6 lg:px-8" style={{ paddingTop: 128, paddingBottom: 96 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 48, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, ease }}
            style={{ textAlign: "center", marginBottom: 112 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease, delay: 0.1 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: "rgba(90,210,122,0.06)", border: "1px solid rgba(90,210,122,0.15)",
                borderRadius: 999, padding: "6px 18px",
                fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                letterSpacing: "0.22em", color: "rgba(90,210,122,0.75)",
                textTransform: "uppercase", marginBottom: 28,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#5ad27a",
                boxShadow: "0 0 8px #5ad27a", display: "inline-block", animation: "neon-pulse 2s ease-in-out infinite" }} />
              $BMB · Solana · Economic Architecture
            </motion.div>

            <h1 style={{
              fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(3.8rem, 12vw, 8.5rem)", lineHeight: 0.88,
              letterSpacing: "-0.05em",
              background: "linear-gradient(170deg, #ffffff 0%, #5ad27a 40%, #7fd8ff 80%)",
              WebkitBackgroundClip: "text", backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 40px rgba(90,210,122,0.30)) drop-shadow(0 0 80px rgba(127,216,255,0.15))",
              marginBottom: 28,
            }}>
              TOKENOMICS
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{
                fontFamily: "var(--font-display)", fontSize: "clamp(0.95rem, 2.5vw, 1.25rem)",
                color: "rgba(255,255,255,0.38)", maxWidth: 520,
                margin: "0 auto", lineHeight: 1.7, letterSpacing: "0.01em",
              }}
            >
              Fair launch. Zero team dump.{" "}
              <span style={{ color: "rgba(255,255,255,0.6)" }}>Every match fuels the engine.</span>
            </motion.p>

            {/* Stat pills */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.55 }}
              style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 36 }}
            >
              {[
                { label: "Total Supply", value: "1,000,000,000", color: "#5ad27a" },
                { label: "House Rake",   value: "5% per match",  color: "#7fd8ff" },
                { label: "Token",        value: "$BMB",           color: "#ffd700" },
                { label: "Network",      value: "Solana",         color: "#ff5a4d" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 999, padding: "8px 18px",
                  display: "flex", gap: 8, alignItems: "center",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem",
                    letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase" }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem",
                    fontWeight: 700, color, letterSpacing: "-0.01em" }}>
                    {value}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* ══════════════════════════════════════════════════════════════
              PILLAR 1 — Initial Supply Allocation
          ══════════════════════════════════════════════════════════════ */}
          <section style={{ marginBottom: 132 }}>
            <SectionLabel
              pillar="PILLAR 01"
              title="Initial Supply Allocation"
              subtitle="1,000,000,000 $BMB · Total Supply · 100% Cap"
            />

            {/* Desktop: 2-column (chart | cards). Mobile: stacked. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 48,
                alignItems: "center",
              }}
              className="lg:!grid-cols-2"
            >
              {/* Left — Donut Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.82, filter: "blur(12px)" }}
                whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.85, ease }}
                style={{ display: "flex", justifyContent: "center" }}
              >
                <DonutChart />
              </motion.div>

              {/* Right — Allocation cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {ALLOCATIONS.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 28, filter: "blur(8px)" }}
                    whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.65, ease, delay: i * 0.1 }}
                    whileHover={{ boxShadow: `0 0 36px rgba(${a.rgb},0.12), 0 8px 32px rgba(0,0,0,0.45)` }}
                    style={{
                      background: `rgba(${a.rgb},0.04)`,
                      border: `1px solid rgba(${a.rgb},0.12)`,
                      borderLeft: `3px solid ${a.color}`,
                      borderRadius: 16,
                      padding: "20px 22px",
                      backdropFilter: "blur(14px) saturate(1.2)",
                      WebkitBackdropFilter: "blur(14px) saturate(1.2)",
                      transition: "box-shadow 0.22s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start",
                      justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <div>
                        <div style={{
                          fontFamily: "var(--font-display)", fontWeight: 700,
                          fontSize: "clamp(1.5rem, 4vw, 2rem)", letterSpacing: "-0.04em",
                          color: a.color, lineHeight: 1, marginBottom: 3,
                          textShadow: `0 0 20px ${a.color}50`,
                        }}>
                          {a.pct}%
                        </div>
                        <div style={{
                          fontFamily: "var(--font-display)", fontWeight: 600,
                          fontSize: "0.95rem", color: "#fff",
                        }}>
                          {a.label}
                          {a.sublabel && (
                            <span style={{ color: "rgba(255,255,255,0.32)", fontWeight: 400 }}>
                              {" "}/ {a.sublabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.55rem",
                        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
                        background: `rgba(${a.rgb},0.1)`,
                        border: `1px solid rgba(${a.rgb},0.25)`,
                        borderRadius: 999, padding: "4px 10px",
                        color: a.color, boxShadow: `0 0 8px rgba(${a.rgb},0.2)`,
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                        {a.tag}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: "var(--font-display)", fontSize: "0.82rem",
                      color: "rgba(255,255,255,0.42)", lineHeight: 1.65, margin: 0,
                    }}>
                      {a.body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── On-Chain Transparency ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease }}
            style={{ marginBottom: 96 }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 14, marginBottom: 24,
            }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "0.58rem",
                letterSpacing: "0.32em", color: "rgba(255,255,255,0.22)",
                textTransform: "uppercase",
              }}>
                On-Chain Transparency
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "14px",
            }}>
              <WalletCard
                title="Game Treasury"
                tag="5% ALLOCATION"
                color="#22d3ee"
                rgb="34,211,238"
                address="Treasury111111111111111111111111111111111"
              />
              <WalletCard
                title="Marketing & CEX"
                tag="4% ALLOCATION"
                color="#ffcc33"
                rgb="255,204,51"
                address="Market11111111111111111111111111111111111"
              />
              <WalletCard
                title="Dev Team"
                tag="3% ALLOCATION"
                color="#f59e0b"
                rgb="245,158,11"
                address="DevTeam1111111111111111111111111111111111"
              />
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════════════════════
              ECOSYSTEM FLOW — animated token flow diagram
          ══════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease }}
            style={{ marginBottom: 96 }}
          >
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                <div style={{ width: 36, height: 1, background: "rgba(90,210,122,0.25)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.28em", color: "rgba(90,210,122,0.55)", textTransform: "uppercase" }}>
                  Token Flow
                </span>
                <div style={{ width: 36, height: 1, background: "rgba(90,210,122,0.25)" }} />
              </div>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.5rem, 3.5vw, 2.4rem)", letterSpacing: "-0.04em", color: "#fff", margin: "0 0 10px", textTransform: "uppercase" }}>
                ECOSYSTEM{" "}
                <span style={{ color: "#5ad27a", textShadow: "0 0 20px rgba(90,210,122,0.6)" }}>FLOW</span>
              </h2>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", margin: 0 }}>
                Players → Match Pot → Winner 95% + 5% Rake → Burn 25% · Ecosystem 54% · Guild 21% · [Phase 2: Yield + DAO]
              </p>
            </div>

            <div style={{
              background: "rgba(7,8,16,0.75)",
              border: "1px solid rgba(90,210,122,0.08)",
              borderRadius: 20,
              padding: "28px 20px",
              backdropFilter: "blur(12px)",
            }}>
              <EcosystemFlow />
            </div>
          </motion.section>

          {/* ══════════════════════════════════════════════════════════════
              PILLAR 2 — Economic Engine / 5% House Rake
          ══════════════════════════════════════════════════════════════ */}
          <section>
            <SectionLabel
              pillar="PILLAR 02"
              title="The 5% House Rake Engine"
              subtitle="Economic Perpetuum Mobile · Per-match instantaneous distribution"
            />

            {/* Hub card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, filter: "blur(10px)" }}
              whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.75, ease }}
              style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}
            >
              <div style={{
                background: "rgba(255,90,77,0.04)",
                border: "1px solid rgba(255,90,77,0.22)",
                borderRadius: 22,
                padding: "22px 52px",
                textAlign: "center",
                backdropFilter: "blur(28px) saturate(1.4)",
                WebkitBackdropFilter: "blur(28px) saturate(1.4)",
                boxShadow: "0 0 70px rgba(255,90,77,0.07), 0 0 140px rgba(255,90,77,0.03)",
                position: "relative",
              }}>
                {/* Pulsing ring */}
                <div style={{
                  position: "absolute", inset: -1, borderRadius: 22,
                  border: "1px solid rgba(255,90,77,0.14)",
                  animation: "hubRingPulse 3s ease-in-out infinite",
                }} />
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.22em",
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 8,
                }}>
                  Per Match · Instantaneous
                </div>
                <div style={{
                  fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic",
                  fontSize: "clamp(2rem, 5.5vw, 3.2rem)", letterSpacing: "-0.04em",
                  background: "linear-gradient(170deg, #ff5a4d, #f0a92a)",
                  WebkitBackgroundClip: "text", backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 24px rgba(255,90,77,0.50))",
                  textTransform: "uppercase",
                }}>
                  5% HOUSE RAKE
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginTop: 8,
                }}>
                  Charged on every paid match pool
                </div>
              </div>
            </motion.div>

            {/* Flow SVG connector — desktop only */}
            <div className="hidden lg:block">
              <RakeFlowSVG />
            </div>
            {/* Mobile spacer */}
            <div className="lg:hidden" style={{ height: 28 }} />

            {/* 5 rake distribution cards (3 active + 2 Phase 2) */}
            <div
              style={{ display: "grid", gap: 14, marginBottom: 64 }}
              className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
            >
              {RAKE_DIST.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 36, filter: "blur(10px)" }}
                  whileInView={{ opacity: d.phase2 ? 0.55 : 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.65, ease, delay: i * 0.09 }}
                  whileHover={d.phase2 ? {} : {
                    boxShadow: `0 0 40px rgba(${d.rgb},0.16), 0 12px 40px rgba(0,0,0,0.5)`,
                  }}
                  style={{
                    background: d.phase2
                      ? `rgba(${d.rgb},0.02)`
                      : `rgba(${d.rgb},0.04)`,
                    border: d.phase2
                      ? `1px dashed rgba(${d.rgb},0.20)`
                      : `1px solid rgba(${d.rgb},0.12)`,
                    borderTop: d.phase2
                      ? `1px dashed ${d.color}40`
                      : `2px solid ${d.color}`,
                    borderRadius: 18,
                    padding: "22px 18px",
                    backdropFilter: "blur(16px) saturate(1.2)",
                    WebkitBackdropFilter: "blur(16px) saturate(1.2)",
                    transition: "box-shadow 0.22s ease",
                    display: "flex", flexDirection: "column",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  {/* Phase 2 diagonal watermark */}
                  {d.phase2 && (
                    <div aria-hidden style={{
                      position: "absolute", top: 10, right: 10,
                      fontFamily: "var(--font-mono)", fontSize: "0.50rem",
                      fontWeight: 700, letterSpacing: "0.10em",
                      color: d.color, opacity: 0.55,
                      background: `rgba(${d.rgb},0.10)`,
                      border: `1px solid rgba(${d.rgb},0.25)`,
                      borderRadius: 999, padding: "2px 7px",
                    }}>🔒 PHASE 2</div>
                  )}

                  <div style={{ fontSize: "1.55rem", marginBottom: 14, lineHeight: 1, opacity: d.phase2 ? 0.6 : 1 }}>{d.icon}</div>

                  {/* Pct display — lock icon for Phase 2 */}
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    fontSize: d.phase2 ? "clamp(1.1rem, 3vw, 1.5rem)" : "clamp(1.7rem, 5vw, 2.2rem)",
                    letterSpacing: "-0.04em",
                    color: d.phase2 ? `rgba(${d.rgb},0.45)` : d.color,
                    lineHeight: 1, marginBottom: 5,
                    textShadow: d.phase2 ? "none" : `0 0 22px ${d.color}55`,
                  }}>
                    {d.phase2 ? "— %" : `${d.pct}%`}
                  </div>

                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    fontSize: "0.88rem",
                    color: d.phase2 ? "rgba(255,255,255,0.45)" : "#fff",
                    marginBottom: 3,
                  }}>
                    {d.label}
                    {d.sublabel && (
                      <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                        {" "}/ {d.sublabel}
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.5rem",
                      letterSpacing: "0.13em", textTransform: "uppercase", fontWeight: 700,
                      background: `rgba(${d.rgb},${d.phase2 ? 0.06 : 0.1})`,
                      border: `1px solid rgba(${d.rgb},${d.phase2 ? 0.15 : 0.22})`,
                      borderRadius: 999, padding: "3px 8px",
                      color: d.phase2 ? `rgba(${d.rgb},0.50)` : d.color,
                      boxShadow: d.phase2 ? "none" : `0 0 6px rgba(${d.rgb},0.2)`,
                    }}>
                      {d.tag}
                    </span>
                  </div>

                  <p style={{
                    fontFamily: "var(--font-display)", fontSize: "0.75rem",
                    color: d.phase2 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.36)",
                    lineHeight: 1.65, margin: 0, flex: 1,
                  }}>
                    {d.body}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* The Furnace — burn mechanic highlight */}
            <div style={{ marginBottom: 64 }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.3rem, 3vw, 2rem)", letterSpacing: "-0.03em", color: "rgba(255,255,255,0.9)", margin: 0, textTransform: "uppercase" }}>
                  🔥 THE{" "}
                  <span style={{ color: "#ff5a00", textShadow: "0 0 20px rgba(255,90,0,0.7)" }}>FURNACE</span>
                </h3>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginTop: 8 }}>
                  25% of every house rake is permanently destroyed — live, on-chain, irreversible
                </p>
              </div>
              <TheFurnace />
            </div>

            {/* Simulator */}
            <div style={{ marginBottom: 96 }}>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, ease }}
                style={{ textAlign: "center", marginBottom: 32 }}
              >
                <h3 style={{
                  fontFamily: "var(--font-display)", fontWeight: 700,
                  fontSize: "clamp(1.3rem, 3.5vw, 1.9rem)", letterSpacing: "-0.03em",
                  color: "rgba(255,255,255,0.9)", margin: 0,
                }}>
                  Real-Time Rake Distributor
                </h3>
                <p style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginTop: 8,
                }}>
                  Drag the slider — watch the ecosystem scale instantly
                </p>
              </motion.div>
              <RakeSimulator />

              {/* ── On-Chain Transparency : Rake Accumulation ─────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease }}
                style={{ marginTop: 48 }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 14, marginBottom: 24,
                }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.58rem",
                    letterSpacing: "0.32em", color: "rgba(255,255,255,0.22)",
                    textTransform: "uppercase",
                  }}>
                    On-Chain Transparency : Rake Accumulation
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "14px",
                  maxWidth: 896,
                  margin: "0 auto",
                }}>
                  {/* Phase 2 placeholder — Real Yield */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 0.50, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, ease }}
                    style={{
                      padding: "16px 18px",
                      borderRadius: "12px",
                      background: "rgba(127,216,255,0.02)",
                      border: "1px dashed rgba(127,216,255,0.20)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      display: "flex", flexDirection: "column", gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.88rem", color: "rgba(255,255,255,0.45)" }}>
                        💎 Real Yield Staking Pool
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", letterSpacing: "0.15em", color: "rgba(127,216,255,0.55)", background: "rgba(127,216,255,0.08)", border: "1px dashed rgba(127,216,255,0.22)", padding: "2px 8px", borderRadius: "999px" }}>
                        🔒 PHASE 2
                      </span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "rgba(255,255,255,0.25)", letterSpacing: "-0.01em", lineHeight: 1.5 }}>
                      Staking contract deploys at Phase 2 milestone. Address will be published on-chain upon activation.
                    </div>
                  </motion.div>

                  {/* Phase 2 placeholder — DAO */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 0.50, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, ease, delay: 0.08 }}
                    style={{
                      padding: "16px 18px",
                      borderRadius: "12px",
                      background: "rgba(168,85,247,0.02)",
                      border: "1px dashed rgba(168,85,247,0.20)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      display: "flex", flexDirection: "column", gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.88rem", color: "rgba(255,255,255,0.45)" }}>
                        🗳️ DAO Governance Fund
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", letterSpacing: "0.15em", color: "rgba(168,85,247,0.55)", background: "rgba(168,85,247,0.08)", border: "1px dashed rgba(168,85,247,0.22)", padding: "2px 8px", borderRadius: "999px" }}>
                        🔒 PHASE 2
                      </span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "rgba(255,255,255,0.25)", letterSpacing: "-0.01em", lineHeight: 1.5 }}>
                      DAO multisig deploys at Phase 2 milestone. Governance contract address published upon TGE activation.
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </section>

        </div>
      </div>

      {/* Hub ring pulse keyframe */}
      <style>{`
        @keyframes hubRingPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.015); }
        }
      `}</style>

      <Footer />
    </main>
  );
}
