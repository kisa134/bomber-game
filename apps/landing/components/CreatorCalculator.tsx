"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Constants ────────────────────────────────────────────────────────────── */

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const TIER_META = [
  { key: "L1" as const, label: "Tier 1 (Direct)", shortLabel: "L1", color: "#ffcc33", glow: "rgba(255,204,51,0.60)",  rake: 0.10, max: 1_000,  step: 10,   default: 100   },
  { key: "L2" as const, label: "Tier 2",           shortLabel: "L2", color: "#ff9a3d", glow: "rgba(255,154,61,0.55)", rake: 0.05, max: 5_000,  step: 50,   default: 500   },
  { key: "L3" as const, label: "Tier 3",           shortLabel: "L3", color: "#f0a92a", glow: "rgba(255,122,48,0.50)", rake: 0.03, max: 10_000, step: 100,  default: 2_000  },
  { key: "L4" as const, label: "Tier 4",           shortLabel: "L4", color: "#ff5a5f", glow: "rgba(255,90,95,0.45)",  rake: 0.02, max: 25_000, step: 250,  default: 5_000  },
  { key: "L5" as const, label: "Tier 5",           shortLabel: "L5", color: "#c084fc", glow: "rgba(192,132,252,0.45)",rake: 0.01, max: 50_000, step: 500,  default: 10_000 },
];

/* ── Math engine ─────────────────────────────────────────────────────────── */

interface TierResult {
  volume: number;
  rake: number;
  income: number;
}

function calcTier(players: number, matchesPerMonth: number, avgBet: number, rakeShare: number): TierResult {
  const volume = players * matchesPerMonth * avgBet;
  const rake   = volume * 0.05;
  const income = rake * rakeShare;
  return { volume, rake, income };
}

/* ── Formatter ───────────────────────────────────────────────────────────── */

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtExact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/* ── State shape ─────────────────────────────────────────────────────────── */

interface NetworkState {
  L1: number; L2: number; L3: number; L4: number; L5: number;
  matchesPerMonth: number;
  avgBet: number;
}

const DEFAULTS: NetworkState = {
  L1: 100, L2: 500, L3: 2_000, L4: 5_000, L5: 10_000,
  matchesPerMonth: 15,
  avgBet: 10,
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function CreatorCalculator() {
  const [net, setNet] = useState<NetworkState>(DEFAULTS);

  const setField = useCallback(<K extends keyof NetworkState>(key: K, val: number) => {
    setNet((prev) => ({ ...prev, [key]: val }));
  }, []);

  /* Compute per-tier results */
  const tierResults = TIER_META.map((t) =>
    calcTier(net[t.key], net.matchesPerMonth, net.avgBet, t.rake)
  );

  const totalIncome = tierResults.reduce((sum, r) => sum + r.income, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease }}
      style={{
        background: "rgba(255,255,255,0.018)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(32px) saturate(1.5)",
        WebkitBackdropFilter: "blur(32px) saturate(1.5)",
        borderRadius: "28px",
        overflow: "hidden",
        boxShadow: "0 2px 0 rgba(255,255,255,0.04) inset, 0 32px 80px rgba(0,0,0,0.60), 0 0 1px rgba(0,0,0,0.9)",
      }}
    >
      {/* ── Card Header ───────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "24px 28px",
        background: "rgba(0,0,0,0.20)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#4ade80",
            textShadow: "0 0 10px rgba(74,222,128,0.6)",
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span style={{ display: "inline-block", width: "20px", height: "1px", background: "rgba(74,222,128,0.5)" }} />
            5-Tier Yield Simulator
          </div>
          <h3 style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(1.3rem, 3vw, 1.9rem)",
            letterSpacing: "-0.03em",
            color: "#fff",
            lineHeight: 1.1,
            margin: 0,
          }}>
            YOUR PASSIVE INCOME ENGINE
          </h3>
        </div>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.58rem",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.22)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "999px",
          padding: "4px 14px",
        }}>
          5% HOUSE RAKE · 5 TIERS DEEP
        </div>
      </div>

      {/* ── ZONES 1 + 2: Two-column main body ─────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0",
      }} className="calculator-grid">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ZONE 1 — NETWORK SCALE                                          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div style={{
          padding: "28px",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.28)",
            marginBottom: "20px",
          }}>
            Your Network Scale
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {TIER_META.map((t) => (
              <TierSlider
                key={t.key}
                label={t.label}
                color={t.color}
                glow={t.glow}
                min={0}
                max={t.max}
                step={t.step}
                value={net[t.key]}
                onChange={(v) => setField(t.key, v)}
              />
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ZONE 2 — ENGAGEMENT + OUTPUT                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.58rem",
              fontWeight: 700,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.28)",
              marginBottom: "20px",
            }}>
              Engagement Metrics
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <TierSlider
                label="Matches per Player / Month"
                color="#7fd8ff"
                glow="rgba(74,163,255,0.55)"
                min={1}
                max={100}
                step={1}
                value={net.matchesPerMonth}
                onChange={(v) => setField("matchesPerMonth", v)}
                formatValue={(v) => `${v} matches`}
              />
              <TierSlider
                label="Average Bet Size"
                color="#4ade80"
                glow="rgba(74,222,128,0.55)"
                min={1}
                max={1000}
                step={1}
                value={net.avgBet}
                onChange={(v) => setField("avgBet", v)}
                formatValue={(v) => `$${v}`}
                formatMin="$1"
                formatMax="$1,000"
              />
            </div>
          </div>

          {/* ── Giant Output Block ───────────────────────────────────────── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <motion.div
              style={{
                background: "rgba(74,222,128,0.04)",
                border: "1px solid rgba(74,222,128,0.18)",
                borderRadius: "20px",
                padding: "28px 20px",
                textAlign: "center",
                boxShadow: "0 0 60px rgba(74,222,128,0.07), 0 0 0 1px rgba(74,222,128,0.05) inset",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Subtle ambient pulse */}
              <div aria-hidden style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(74,222,128,0.10) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />

              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.60rem",
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
                marginBottom: "10px",
              }}>
                Monthly Passive Income
              </div>

              <AnimatedDollar value={totalIncome} />

              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.60rem",
                color: "rgba(74,222,128,0.50)",
                letterSpacing: "0.14em",
                marginTop: "10px",
              }}>
                Calculated based on 5% House Rake
              </div>

              {/* Yearly estimate */}
              <div style={{
                marginTop: "16px",
                paddingTop: "14px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "center",
                gap: "6px",
                alignItems: "baseline",
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.58rem",
                  color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}>
                  Yearly est.
                </span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={Math.round(totalIncome * 12)}
                    initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                    transition={{ duration: 0.2, ease }}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "1.15rem",
                      letterSpacing: "-0.03em",
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    {fmt(totalIncome * 12)}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ZONE 3 — REVENUE BREAKDOWN FOOTER                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "24px 28px",
        background: "rgba(0,0,0,0.15)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.58rem",
          fontWeight: 700,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.22)",
          marginBottom: "16px",
        }}>
          Revenue Breakdown by Tier
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "10px",
        }} className="tier-breakdown-grid">
          {TIER_META.map((t, i) => (
            <TierBreakdownCard
              key={t.key}
              shortLabel={t.shortLabel}
              label={t.label}
              rakePercent={Math.round(t.rake * 100)}
              color={t.color}
              glow={t.glow}
              income={tierResults[i].income}
              players={net[t.key]}
              index={i}
            />
          ))}
        </div>

        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.56rem",
          color: "rgba(255,255,255,0.15)",
          textAlign: "center",
          marginTop: "16px",
          letterSpacing: "0.10em",
          lineHeight: 1.7,
        }}>
          House rake = 5% of every match · L1: 10% · L2: 5% · L3: 3% · L4: 2% · L5: 1% of collected rake · Estimates only
        </p>
      </div>

      {/* Responsive styles injected inline */}
      <style>{`
        @media (max-width: 680px) {
          .calculator-grid { grid-template-columns: 1fr !important; }
          .calculator-grid > div:first-child { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .tier-breakdown-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .tier-breakdown-grid > div:last-child { grid-column: span 2; }
        }
      `}</style>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  TierSlider — custom premium slider                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface TierSliderProps {
  label: string;
  color: string;
  glow: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  formatMin?: string;
  formatMax?: string;
}

function TierSlider({
  label, color, glow, min, max, step, value, onChange,
  formatValue, formatMin, formatMax,
}: TierSliderProps) {
  const fillPct = ((value - min) / (max - min)) * 100;
  const displayVal = formatValue
    ? formatValue(value)
    : value.toLocaleString("en-US");

  const minLabel = formatMin ?? min.toLocaleString("en-US");
  const maxLabel = formatMax ?? max.toLocaleString("en-US");

  return (
    <div>
      {/* Label row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: "8px",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.60rem",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
        }}>
          {label}
        </span>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={displayVal}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.12 }}
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.92rem",
              color,
              textShadow: `0 0 12px ${glow}`,
              minWidth: "70px",
              textAlign: "right",
            }}
          >
            {displayVal}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Custom track */}
      <div style={{
        position: "relative",
        height: "5px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.07)",
      }}>
        {/* Fill */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: `${fillPct}%`,
          borderRadius: "999px",
          background: `linear-gradient(90deg, ${color}55, ${color})`,
          boxShadow: `0 0 8px ${glow}`,
          pointerEvents: "none",
          transition: "width 0.04s linear",
        }} />
        {/* Thumb */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: `${fillPct}%`,
          transform: "translate(-50%, -50%)",
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${color}ff, ${color}bb)`,
          boxShadow: `0 0 16px ${glow}, 0 0 6px ${glow}, 0 2px 8px rgba(0,0,0,0.55)`,
          border: "1.5px solid rgba(255,255,255,0.30)",
          pointerEvents: "none",
          transition: "left 0.04s linear",
        }} />
        {/* Transparent native input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute",
            inset: "-8px 0",
            width: "100%",
            height: "calc(100% + 16px)",
            opacity: 0,
            cursor: "pointer",
            WebkitAppearance: "none",
            appearance: "none",
            margin: 0,
          }}
        />
      </div>

      {/* Min / Max hints */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", color: "rgba(255,255,255,0.17)" }}>
          {minLabel}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", color: "rgba(255,255,255,0.17)" }}>
          {maxLabel}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  TierBreakdownCard                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

function TierBreakdownCard({
  shortLabel, label, rakePercent, color, glow, income, players, index,
}: {
  shortLabel: string;
  label: string;
  rakePercent: number;
  color: string;
  glow: string;
  income: number;
  players: number;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, ease, delay: index * 0.06 }}
      style={{
        background: `rgba(${hexToRgb(color)},0.05)`,
        border: `1px solid ${color}22`,
        borderRadius: "14px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        backdropFilter: "blur(12px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top accent line */}
      <div aria-hidden style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        background: `linear-gradient(90deg, transparent, ${color}66, transparent)`,
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "0.78rem",
          color,
          textShadow: `0 0 10px ${glow}`,
        }}>
          {shortLabel}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.52rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: `${color}99`,
          background: `${color}12`,
          border: `1px solid ${color}25`,
          borderRadius: "999px",
          padding: "2px 7px",
        }}>
          {rakePercent}% rake
        </span>
      </div>

      {/* Income value */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={Math.round(income)}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.18 }}
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(1rem, 2.5vw, 1.35rem)",
            letterSpacing: "-0.03em",
            color,
            textShadow: `0 0 18px ${glow}`,
            lineHeight: 1,
          }}
        >
          {fmtExact(income)}
        </motion.div>
      </AnimatePresence>

      {/* Label + player count */}
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.52rem",
        color: "rgba(255,255,255,0.22)",
        letterSpacing: "0.08em",
        lineHeight: 1.5,
      }}>
        {label}
        <br />
        <span style={{ color: `${color}66` }}>{players.toLocaleString("en-US")} players</span>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  AnimatedDollar — big glowing animated number                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

function AnimatedDollar({ value }: { value: number }) {
  const display = fmt(value);

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={display}
        initial={{ opacity: 0, y: 14, filter: "blur(6px)", scale: 0.95 }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
        exit={{ opacity: 0, y: -14, filter: "blur(6px)", scale: 1.02 }}
        transition={{ duration: 0.22, ease }}
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
          letterSpacing: "-0.05em",
          lineHeight: 1,
          color: "#4ade80",
          textShadow:
            "0 0 20px rgba(74,222,128,0.85), 0 0 50px rgba(74,222,128,0.50), 0 0 100px rgba(74,222,128,0.25)",
          display: "inline-block",
        }}
      >
        {display}
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Helper: hex → "r,g,b" for rgba() ───────────────────────────────────── */

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "255,255,255";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

/* ════════════════════════════════════════════════════════════════════════════
   GUILD REVENUE SIMULATOR — esports amber/green skin of CreatorCalculator
════════════════════════════════════════════════════════════════════════════ */

const GUILD_TIER_META = [
  { key: "L1" as const, label: "Iron Clan (Direct)",    shortLabel: "IRON",    color: "#f0a92a", glow: "rgba(255,140,0,0.65)",  rake: 0.10, max: 1_000,  step: 10,   default: 100    },
  { key: "L2" as const, label: "Bronze Guild",           shortLabel: "BRONZE",  color: "#ff6a00", glow: "rgba(255,106,0,0.60)",  rake: 0.05, max: 5_000,  step: 50,   default: 500    },
  { key: "L3" as const, label: "Silver Organization",    shortLabel: "SILVER",  color: "#c0c0c0", glow: "rgba(192,192,192,0.55)",rake: 0.03, max: 10_000, step: 100,  default: 2_000  },
  { key: "L4" as const, label: "Gold Academy",           shortLabel: "GOLD",    color: "#ffd700", glow: "rgba(255,215,0,0.60)",  rake: 0.02, max: 25_000, step: 250,  default: 5_000  },
  { key: "L5" as const, label: "Diamond Franchise",      shortLabel: "DIAMOND", color: "#7fd8ff", glow: "rgba(127,216,255,0.60)",  rake: 0.01, max: 50_000, step: 500,  default: 10_000 },
];

function GuildTierSlider({
  label, color, glow, min, max, step, value, onChange, formatValue, formatMin, formatMax,
}: {
  label: string; color: string; glow: string; min: number; max: number;
  step: number; value: number; onChange: (v: number) => void;
  formatValue?: (v: number) => string; formatMin?: string; formatMax?: string;
}) {
  const fillPct = ((value - min) / (max - min)) * 100;
  const displayVal = formatValue ? formatValue(value) : value.toLocaleString("en-US");
  const minLabel = formatMin ?? min.toLocaleString("en-US");
  const maxLabel = formatMax ?? max.toLocaleString("en-US");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
          {label}
        </span>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={displayVal}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.12 }}
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.92rem", color, textShadow: `0 0 12px ${glow}`, minWidth: "70px", textAlign: "right" }}
          >
            {displayVal}
          </motion.span>
        </AnimatePresence>
      </div>
      <div style={{ position: "relative", height: "5px", borderRadius: "999px", background: "rgba(255,255,255,0.07)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${fillPct}%`, borderRadius: "999px", background: `linear-gradient(90deg, ${color}55, ${color})`, boxShadow: `0 0 8px ${glow}`, pointerEvents: "none", transition: "width 0.04s linear" }} />
        <div style={{ position: "absolute", top: "50%", left: `${fillPct}%`, transform: "translate(-50%, -50%)", width: "15px", height: "15px", borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${color}ff, ${color}bb)`, boxShadow: `0 0 16px ${glow}, 0 2px 8px rgba(0,0,0,0.55)`, border: "1.5px solid rgba(255,255,255,0.30)", pointerEvents: "none", transition: "left 0.04s linear" }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: "-8px 0", width: "100%", height: "calc(100% + 16px)", opacity: 0, cursor: "pointer", WebkitAppearance: "none", appearance: "none", margin: 0 }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", color: "rgba(255,255,255,0.17)" }}>{minLabel}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", color: "rgba(255,255,255,0.17)" }}>{maxLabel}</span>
      </div>
    </div>
  );
}

export function GuildRevenueSimulator() {
  const [net, setNet] = useState<NetworkState>(DEFAULTS);
  const setField = useCallback(<K extends keyof NetworkState>(key: K, val: number) => {
    setNet((prev) => ({ ...prev, [key]: val }));
  }, []);

  const tierResults = GUILD_TIER_META.map((t) => calcTier(net[t.key], net.matchesPerMonth, net.avgBet, t.rake));
  const totalIncome = tierResults.reduce((sum, r) => sum + r.income, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: "rgba(7,8,16,0.92)",
        border: "1px solid rgba(255,140,0,0.18)",
        backdropFilter: "blur(32px) saturate(1.5)",
        WebkitBackdropFilter: "blur(32px) saturate(1.5)",
        borderRadius: "24px",
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(255,140,0,0.07), 0 32px 80px rgba(0,0,0,0.70)",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "22px 26px", background: "rgba(0,0,0,0.30)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "#f0a92a", textShadow: "0 0 10px rgba(255,140,0,0.6)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "1px", background: "rgba(255,140,0,0.5)" }} />
            Guild Treasury Simulator
          </div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.1rem, 3vw, 1.7rem)", letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.1, margin: 0 }}>
            CALCULATE GUILD YIELD
          </h3>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "999px", padding: "4px 14px" }}>
          5% HOUSE RAKE · 5 TIERS DEEP
        </div>
      </div>

      {/* Main 2-col body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }} className="calculator-grid">
        {/* Zone 1 — Guild Member Count */}
        <div style={{ padding: "26px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: "18px" }}>
            Guild Member Count
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {GUILD_TIER_META.map((t) => (
              <GuildTierSlider
                key={t.key}
                label={t.label}
                color={t.color}
                glow={t.glow}
                min={0}
                max={t.max}
                step={t.step}
                value={net[t.key]}
                onChange={(v) => setField(t.key, v)}
              />
            ))}
          </div>
        </div>

        {/* Zone 2 — Engagement + Treasury Output */}
        <div style={{ padding: "26px", display: "flex", flexDirection: "column", gap: "22px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: "18px" }}>
              Match Engagement
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <GuildTierSlider label="Matches per Fighter / Month" color="#f0a92a" glow="rgba(255,140,0,0.55)" min={1} max={100} step={1} value={net.matchesPerMonth} onChange={(v) => setField("matchesPerMonth", v)} formatValue={(v) => `${v} matches`} />
              <GuildTierSlider label="Average Bet Size" color="#5ad27a" glow="rgba(90,210,122,0.55)" min={1} max={1000} step={1} value={net.avgBet} onChange={(v) => setField("avgBet", v)} formatValue={(v) => `$${v}`} formatMin="$1" formatMax="$1,000" />
            </div>
          </div>
          {/* Treasury Output */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <motion.div style={{ background: "rgba(90,210,122,0.04)", border: "1px solid rgba(90,210,122,0.18)", borderRadius: "18px", padding: "24px 18px", textAlign: "center", boxShadow: "0 0 40px rgba(90,210,122,0.06)", position: "relative", overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(90,210,122,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", marginBottom: "8px" }}>
                Guild Treasury Yield / Month
              </div>
              <AnimatedDollar value={totalIncome} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", color: "rgba(90,210,122,0.45)", letterSpacing: "0.12em", marginTop: "8px" }}>
                Based on 5% House Rake
              </div>
              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "center", gap: "6px", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Yearly est.</span>
                <AnimatePresence mode="popLayout">
                  <motion.span key={Math.round(totalIncome * 12)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-0.03em", color: "rgba(255,255,255,0.65)" }}>
                    {fmt(totalIncome * 12)}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tier breakdown footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "22px 26px", background: "rgba(0,0,0,0.18)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: "14px" }}>
          Treasury Breakdown by Tier
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }} className="tier-breakdown-grid">
          {GUILD_TIER_META.map((t, i) => (
            <TierBreakdownCard
              key={t.key}
              shortLabel={t.shortLabel}
              label={t.label}
              rakePercent={Math.round(t.rake * 100)}
              color={t.color}
              glow={t.glow}
              income={tierResults[i].income}
              players={net[t.key]}
              index={i}
            />
          ))}
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", color: "rgba(255,255,255,0.14)", textAlign: "center", marginTop: "14px", letterSpacing: "0.10em", lineHeight: 1.7 }}>
          House rake = 5% of every match · Iron: 10% · Bronze: 5% · Silver: 3% · Gold: 2% · Diamond: 1% of rake · Estimates only
        </p>
      </div>
      <style>{`
        @media (max-width: 680px) {
          .calculator-grid { grid-template-columns: 1fr !important; }
          .calculator-grid > div:first-child { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .tier-breakdown-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .tier-breakdown-grid > div:last-child { grid-column: span 2; }
        }
      `}</style>
    </motion.div>
  );
}
