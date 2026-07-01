"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { GlassCard } from "@/components/shared/GlassCard";
import { NeonBadge, type BadgeColor } from "@/components/shared/NeonBadge";
import { fetchLeaderboard, toTokens, type LeaderRow } from "@/lib/gameApi";
import { TOKEN_TICKER, leagueFor } from "@/lib/token";

/* ── Real leaderboard row (derived purely from /leaderboard data) ─────────── */
interface Row {
  rank: number;
  ign: string;
  mmr: number;
  winRate: number; // 0-100, from wins/matches
  earned: number; // whole tokens won
}

/* League → badge colour (tier is derived from real rating via shared LEAGUES). */
const LEAGUE_BADGE: Record<string, BadgeColor> = {
  Champion: "gold",
  Pro: "amber",
  Advanced: "amber",
  Beginner: "muted",
};

function RankMedal({ rank }: { rank: number }) {
  const medals: Record<number, { glow: string; symbol: string }> = {
    1: { glow: "rgba(255,215,0,0.9)", symbol: "🥇" },
    2: { glow: "rgba(192,192,192,0.7)", symbol: "🥈" },
    3: { glow: "rgba(205,127,50,0.7)", symbol: "🥉" },
  };
  if (medals[rank]) {
    return <span style={{ fontSize: "1.1rem", lineHeight: 1, filter: `drop-shadow(0 0 8px ${medals[rank].glow})` }}>{medals[rank].symbol}</span>;
  }
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.28)", minWidth: "20px", textAlign: "right" }}>
      #{rank}
    </span>
  );
}

function WinRateBar({ pct, trigger }: { pct: number; trigger: boolean }) {
  const barColor = pct >= 75 ? "#f5c842" : pct >= 65 ? "#3a9e9e" : pct >= 55 ? "#f0a92a" : "#d44030";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "80px" }}>
      <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: trigger ? `${pct}%` : 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          style={{ height: "100%", background: barColor, boxShadow: `0 0 6px ${barColor}80` }}
        />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", fontWeight: 700, color: barColor, textShadow: `0 0 6px ${barColor}70`, minWidth: "30px" }}>
        {pct}%
      </span>
    </div>
  );
}

function LeaderboardRow({ entry, index, trigger }: { entry: Row; index: number; trigger: boolean }) {
  const isTop3 = entry.rank <= 3;
  const league = leagueFor(entry.mmr);
  const badgeColor = LEAGUE_BADGE[league.name] ?? "muted";
  const earnedFmt =
    entry.earned >= 1_000 ? `${(entry.earned / 1_000).toFixed(1)}K` : Math.round(entry.earned).toLocaleString("en-US");

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={trigger ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.055 }}
      style={{
        display: "grid",
        gridTemplateColumns: "36px 1fr auto auto auto",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        background: isTop3 ? "rgba(245,200,66,0.05)" : "transparent",
        border: isTop3 ? "1px solid rgba(245,200,66,0.12)" : "1px solid transparent",
        transition: "background 0.2s ease, border-color 0.2s ease",
        cursor: "default",
      }}
      whileHover={{
        background: isTop3 ? "rgba(255,215,0,0.07)" : "rgba(255,255,255,0.03)",
        borderColor: isTop3 ? "rgba(255,215,0,0.22)" : "rgba(245,200,66,0.12)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <RankMedal rank={entry.rank} />
      </div>

      {/* IGN + league badge (tier derived from real rating) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.78rem",
            fontWeight: 700,
            color: isTop3 ? "#ffd700" : "rgba(255,255,255,0.85)",
            textShadow: isTop3 ? "0 0 10px rgba(255,215,0,0.5)" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
          }}
        >
          {entry.ign}
        </span>
        <NeonBadge color={badgeColor} size="xs" dot>
          {league.emoji} {league.name}
        </NeonBadge>
      </div>

      <div className="hidden sm:block">
        <WinRateBar pct={entry.winRate} trigger={trigger} />
      </div>

      {/* Tokens won (real BGDF) */}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.70rem", fontWeight: 700, color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.6)", minWidth: "50px", textAlign: "right", whiteSpace: "nowrap" }}>
        {earnedFmt} <span style={{ opacity: 0.45, fontSize: "0.58rem" }}>{TOKEN_TICKER}</span>
      </span>

      {/* MMR */}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.80rem", fontWeight: 700, color: "#3a9e9e", textShadow: "0 0 10px rgba(58,158,158,0.5)", minWidth: "48px", textAlign: "right", letterSpacing: "-0.02em" }}>
        {entry.mmr.toLocaleString("en-US")}
      </span>
    </motion.div>
  );
}

export function LiveLeaderboard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchLeaderboard("rating").then((data: LeaderRow[]) => {
      if (!alive) return;
      const mapped: Row[] = data.slice(0, 10).map((p, i) => ({
        rank: i + 1,
        ign: p.name || "anon",
        mmr: Math.round(p.rating ?? 0),
        winRate: p.matches && p.matches > 0 ? Math.round(((p.wins ?? 0) / p.matches) * 100) : 0,
        earned: toTokens(p.tokens_won),
      }));
      setRows(mapped);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section ref={ref} className="relative w-full px-5 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex items-center justify-between"
        >
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.03em", fontSize: "clamp(1.5rem, 4vw, 2.2rem)", color: "#fff" }}>
            Who's on{" "}
            <span style={{ color: "#f5c842", textShadow: "0 0 20px rgba(245,200,66,0.45)" }}>top</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-80" style={{ background: "#ff5a4d" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#ff5a4d", boxShadow: "0 0 6px rgba(255,90,77,0.9)" }} />
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.16em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              Live
            </span>
          </div>
        </motion.div>

        <GlassCard variant="gold" padding="0" radius="0" noHover>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr auto auto auto", gap: "12px", padding: "10px 16px", borderBottom: "1px solid rgba(245,200,66,0.12)" }}>
            {["RANK", "PLAYER", "WIN RATE", "EARNED", "MMR"].map((h, i) => (
              <span
                key={h}
                className={h === "WIN RATE" ? "hidden sm:block" : ""}
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", textAlign: i >= 2 ? "right" : "left" }}
              >
                {h}
              </span>
            ))}
          </div>

          <div style={{ padding: "6px 0", minHeight: "120px" }}>
            {rows === null ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>Loading…</p>
            ) : rows.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px 0", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>No carnage yet. Be the first.</p>
            ) : (
              rows.map((entry, i) => <LeaderboardRow key={`${entry.ign}-${entry.rank}`} entry={entry} index={i} trigger={inView} />)
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.7, duration: 0.5 }}
            style={{ borderTop: "1px solid rgba(245,200,66,0.12)", padding: "12px 16px", textAlign: "center" }}
          >
            <Link
              href="/tournaments"
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,200,66,0.55)", textDecoration: "none", transition: "color 0.18s ease" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f5c842")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(245,200,66,0.55)")}
            >
              See the full bloodshed →
            </Link>
          </motion.div>
        </GlassCard>
      </div>
    </section>
  );
}
