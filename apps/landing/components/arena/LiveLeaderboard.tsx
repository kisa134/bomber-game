"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { GlassCard } from "@/components/shared/GlassCard";
import { NeonBadge, TIER_BADGES } from "@/components/shared/NeonBadge";

/* ── Types & mock data ───────────────────────────────────────────────────── */
type Tier = keyof typeof TIER_BADGES;

interface LBEntry {
  rank:     number;
  char:     string;
  ign:      string;
  mmr:      number;
  tier:     Tier;
  winRate:  number;   // 0-100
  wonBMB:   number;   // lifetime $BMB earned
  matches:  number;
}

const LEADERBOARD: LBEntry[] = [
  { rank: 1,  char: "elon",    ign: "0xNeuralLink",    mmr: 8_420, tier: "champion", winRate: 87, wonBMB: 142_800, matches: 892 },
  { rank: 2,  char: "vitalik", ign: "L2_Speedrunner",  mmr: 7_840, tier: "legend",   winRate: 82, wonBMB:  97_400, matches: 741 },
  { rank: 3,  char: "pepe",    ign: "FrogGodPvP",      mmr: 7_510, tier: "legend",   winRate: 79, wonBMB:  84_200, matches: 688 },
  { rank: 4,  char: "trump",   ign: "MakeGG4ever",     mmr: 7_180, tier: "diamond",  winRate: 74, wonBMB:  61_900, matches: 534 },
  { rank: 5,  char: "doge",    ign: "MuchWinSuchMMR",  mmr: 6_920, tier: "diamond",  winRate: 71, wonBMB:  48_300, matches: 467 },
  { rank: 6,  char: "shiba",   ign: "INU_Samurai",     mmr: 6_640, tier: "diamond",  winRate: 68, wonBMB:  39_100, matches: 412 },
  { rank: 7,  char: "pumpfun", ign: "whale_watcher",   mmr: 6_210, tier: "diamond",  winRate: 65, wonBMB:  28_700, matches: 388 },
  { rank: 8,  char: "mem",     ign: "chaotic_neutral", mmr: 5_890, tier: "gold",     winRate: 62, wonBMB:  19_400, matches: 324 },
  { rank: 9,  char: "elon",    ign: "rekt_u_all",      mmr: 5_560, tier: "gold",     winRate: 59, wonBMB:  14_200, matches: 291 },
  { rank: 10, char: "pepe",    ign: "hopium_dealer",   mmr: 5_240, tier: "gold",     winRate: 57, wonBMB:  10_800, matches: 267 },
];

const SPRITE: Record<string, string> = {
  trump:   "/sprites/trump/new/skin_2_side_0.webp",
  elon:    "/sprites/elon/new/skin_3_side_0.webp",
  pepe:    "/sprites/pepe/new/skin_1_side_0.webp",
  shiba:   "/sprites/shiba/new/skin_0_side_0.webp",
  doge:    "/sprites/doge/skin_4_side_0.webp",
  pumpfun: "/sprites/pumpfun/skin_5_side_0.webp",
  vitalik: "/sprites/vitalik/skin_7_side_0.webp",
  mem:     "/sprites/mem/skin_8_side_0.webp",
};

/* ── Rank medal helper ──────────────────────────────────────────────────── */
function RankMedal({ rank }: { rank: number }) {
  const medals: Record<number, { color: string; glow: string; symbol: string }> = {
    1: { color: "#ffd700", glow: "rgba(255,215,0,0.9)",   symbol: "🥇" },
    2: { color: "#c0c0c0", glow: "rgba(192,192,192,0.7)", symbol: "🥈" },
    3: { color: "#cd7f32", glow: "rgba(205,127,50,0.7)",  symbol: "🥉" },
  };

  if (medals[rank]) {
    return (
      <span
        style={{
          fontSize:   "1.1rem",
          lineHeight: 1,
          filter:     `drop-shadow(0 0 8px ${medals[rank].glow})`,
        }}
      >
        {medals[rank].symbol}
      </span>
    );
  }

  return (
    <span
      style={{
        fontFamily:    "var(--font-mono)",
        fontSize:      "0.72rem",
        fontWeight:    700,
        color:         "rgba(255,255,255,0.28)",
        letterSpacing: "-0.02em",
        minWidth:      "20px",
        textAlign:     "right",
      }}
    >
      #{rank}
    </span>
  );
}

/* ── Win-rate bar ───────────────────────────────────────────────────────── */
function WinRateBar({ pct, trigger }: { pct: number; trigger: boolean }) {
  const barColor = pct >= 75 ? "#5ad27a" : pct >= 65 ? "#7fd8ff" : pct >= 55 ? "#ffd700" : "#f0a92a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "80px" }}>
      <div
        style={{
          flex:         1,
          height:       "4px",
          borderRadius: "999px",
          background:   "rgba(255,255,255,0.08)",
          overflow:     "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: trigger ? `${pct}%` : 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          style={{
            height:       "100%",
            borderRadius: "999px",
            background:   barColor,
            boxShadow:    `0 0 6px ${barColor}80`,
          }}
        />
      </div>
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.62rem",
          fontWeight:    700,
          color:         barColor,
          textShadow:    `0 0 6px ${barColor}70`,
          minWidth:      "30px",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

/* ── Table row ──────────────────────────────────────────────────────────── */
function LeaderboardRow({
  entry,
  index,
  trigger,
}: {
  entry:   LBEntry;
  index:   number;
  trigger: boolean;
}) {
  const isTop3 = entry.rank <= 3;
  const tierDef = TIER_BADGES[entry.tier];
  const sprite  = SPRITE[entry.char];

  const wonFormatted =
    entry.wonBMB >= 1_000
      ? `${(entry.wonBMB / 1_000).toFixed(1)}K`
      : entry.wonBMB.toLocaleString("en-US");

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={trigger ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.055 }}
      style={{
        display:       "grid",
        gridTemplateColumns: "36px 44px 1fr auto auto auto",
        alignItems:    "center",
        gap:           "12px",
        padding:       "10px 16px",
        borderRadius:  "10px",
        background:    isTop3 ? "rgba(255,215,0,0.04)" : "transparent",
        border:        isTop3 ? "1px solid rgba(255,215,0,0.10)" : "1px solid transparent",
        transition:    "background 0.2s ease, border-color 0.2s ease",
        cursor:        "default",
      }}
      whileHover={{
        background:   isTop3 ? "rgba(255,215,0,0.07)" : "rgba(255,255,255,0.03)",
        borderColor:  isTop3 ? "rgba(255,215,0,0.22)" : "rgba(90,210,122,0.12)",
      }}
    >
      {/* Rank */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <RankMedal rank={entry.rank} />
      </div>

      {/* Avatar sprite */}
      <div
        style={{
          width:          "40px",
          height:         "40px",
          borderRadius:   "8px",
          overflow:       "hidden",
          background:     "rgba(255,255,255,0.05)",
          border:         `1px solid ${isTop3 ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.08)"}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}
      >
        {sprite && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sprite}
            alt={entry.char}
            width={34}
            height={34}
            style={{ objectFit: "contain", imageRendering: "pixelated" }}
          />
        )}
      </div>

      {/* IGN + tier badge */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" }}>
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.78rem",
            fontWeight:    700,
            color:         isTop3 ? "#ffd700" : "rgba(255,255,255,0.85)",
            textShadow:    isTop3 ? "0 0 10px rgba(255,215,0,0.5)" : "none",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
            letterSpacing: "0.01em",
          }}
        >
          {entry.ign}
        </span>
        <NeonBadge color={tierDef.color} size="xs" dot>
          {tierDef.label}
        </NeonBadge>
      </div>

      {/* Win rate bar — hidden on smallest screens */}
      <div className="hidden sm:block">
        <WinRateBar pct={entry.winRate} trigger={trigger} />
      </div>

      {/* $BMB earned */}
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.70rem",
          fontWeight:    700,
          color:         "#5ad27a",
          textShadow:    "0 0 8px rgba(90,210,122,0.6)",
          minWidth:      "50px",
          textAlign:     "right",
          whiteSpace:    "nowrap",
        }}
      >
        {wonFormatted} <span style={{ opacity: 0.45, fontSize: "0.58rem" }}>$BMB</span>
      </span>

      {/* MMR */}
      <span
        style={{
          fontFamily:    "var(--font-hud)",
          fontSize:      "0.80rem",
          fontWeight:    700,
          color:         "#7fd8ff",
          textShadow:    "0 0 10px rgba(127,216,255,0.7)",
          minWidth:      "48px",
          textAlign:     "right",
          letterSpacing: "-0.02em",
        }}
      >
        {entry.mmr.toLocaleString("en-US")}
      </span>
    </motion.div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function LiveLeaderboard() {
  const ref     = useRef<HTMLDivElement>(null);
  const inView  = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section
      ref={ref}
      className="relative w-full px-5 sm:px-8"
    >
      <div className="mx-auto max-w-5xl">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily:    "var(--font-heading)",
                fontWeight:    900,
                fontStyle:     "italic",
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
                fontSize:      "clamp(1.5rem, 4vw, 2.2rem)",
                color:         "#fff",
              }}
            >
              Global MMR{" "}
              <span
                style={{
                  color:      "#7fd8ff",
                  textShadow: "0 0 20px rgba(127,216,255,0.7)",
                }}
              >
                Leaderboard
              </span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Live indicator */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-80" style={{ background: "#ff5a4d" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#ff5a4d", boxShadow: "0 0 6px rgba(255,90,77,0.9)" }} />
            </span>
            <span
              style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "0.58rem",
                fontWeight:    700,
                letterSpacing: "0.16em",
                color:         "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
              }}
            >
              Live Rankings
            </span>
          </div>
        </motion.div>

        {/* Table card */}
        <GlassCard variant="blue" padding="0" radius="1.25rem" noHover>
          {/* Column headers */}
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "36px 44px 1fr auto auto auto",
              gap:                 "12px",
              padding:             "10px 16px",
              borderBottom:        "1px solid rgba(127,216,255,0.10)",
            }}
          >
            {["RANK", "AVATAR", "PLAYER", "WIN RATE", "EARNED", "MMR"].map((h, i) => (
              <span
                key={h}
                style={{
                  fontFamily:    "var(--font-mono)",
                  fontSize:      "0.52rem",
                  fontWeight:    700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color:         "rgba(255,255,255,0.22)",
                  textAlign:     i >= 3 ? "right" : "left",
                  ...(h === "WIN RATE" ? { display: "none" } : {}), // hide on mobile via CSS
                }}
                className={h === "WIN RATE" ? "hidden sm:block" : ""}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ padding: "6px 0" }}>
            {LEADERBOARD.map((entry, i) => (
              <LeaderboardRow
                key={entry.ign}
                entry={entry}
                index={i}
                trigger={inView}
              />
            ))}
          </div>

          {/* Footer CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.7, duration: 0.5 }}
            style={{
              borderTop:   "1px solid rgba(127,216,255,0.10)",
              padding:     "12px 16px",
              textAlign:   "center",
            }}
          >
            <Link
              href="/tournaments"
              style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "0.65rem",
                fontWeight:    700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color:         "rgba(127,216,255,0.55)",
                textDecoration:"none",
                transition:    "color 0.18s ease",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#7fd8ff")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(127,216,255,0.55)")}
            >
              View Full Leaderboard & Tournaments →
            </Link>
          </motion.div>
        </GlassCard>

      </div>
    </section>
  );
}
