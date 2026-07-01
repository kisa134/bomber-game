"use client";

/* ── Live champions marquee ────────────────────────────────────────────────
   Scrolling horizontal strip of REAL top earners, fetched from the game
   server's public /leaderboard?board=tokens endpoint. No mock data — if the
   server is unreachable, the strip renders nothing rather than faking activity.
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { fetchLeaderboard, toTokens, type LeaderRow } from "@/lib/gameApi";
import { TOKEN_TICKER } from "@/lib/token";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";

interface Earner {
  name: string;
  won: number; // whole tokens
  wins: number;
}

function FeedItem({ e, rank }: { e: Earner; rank: number }) {
  return (
    <span className="mx-6 inline-flex items-center gap-2.5" style={{ flexShrink: 0 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>#{rank}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>{e.name}</span>
      <span style={{ color: "rgba(255,255,255,0.1)", fontSize: "0.5rem" }}>·</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", fontWeight: 700, color: "#f5c842", textShadow: "0 0 10px rgba(245,200,66,0.5)" }}>
        {e.won.toLocaleString(undefined, { maximumFractionDigits: e.won < 100 ? 2 : 0 })} ${TOKEN_TICKER}
      </span>
      {e.wins > 0 && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, color: "#3a9e9e", background: "rgba(58,158,158,0.12)", border: "1px solid rgba(58,158,158,0.3)", borderRadius: 4, padding: "1px 5px" }}>
          {e.wins} W
        </span>
      )}
      <span style={{ color: "rgba(255,255,255,0.08)", fontSize: "0.5rem", marginLeft: "8px" }}>◆</span>
    </span>
  );
}

export function LiveMatchFeed() {
  const [earners, setEarners] = useState<Earner[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const rows = await fetchLeaderboard("tokens");
      if (!alive) return;
      const mapped: Earner[] = rows
        .map((r: LeaderRow) => ({
          name: (r.name ?? "").trim() || "anon",
          won: toTokens(r.tokens_won),
          wins: r.wins ?? 0,
        }))
        .filter((e) => e.won > 0);
      setEarners(mapped);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // No real activity yet → render nothing (never fabricate a feed).
  if (earners.length === 0) return null;

  const doubled = [...earners, ...earners];

  return (
    <PixelGlassGlitch variant="cyan" mode="idle" intensity={0.55} className="marquee-mask relative z-10 w-full">
      <div
        className="relative w-full overflow-hidden border-y"
        style={{ background: "rgba(16,13,22,0.55)", borderColor: "rgba(255,210,120,0.10)", padding: "10px 0" }}
      >
      <div
        className="absolute left-0 top-0 z-20 hidden h-full items-center gap-2 px-4 sm:flex"
        style={{ background: "linear-gradient(90deg, rgba(7,8,16,1) 55%, transparent)", paddingRight: "32px" }}
      >
        <span className="animate-hud-blink" style={{ color: "#f5c842", fontSize: "0.55rem", textShadow: "0 0 6px rgba(245,200,66,0.8)" }}>●</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
          Top Earners
        </span>
      </div>

      <div className="marquee-track">
        {doubled.map((e, i) => (
          <FeedItem key={`${e.name}-${i}`} e={e} rank={(i % earners.length) + 1} />
        ))}
      </div>
      </div>
    </PixelGlassGlitch>
  );
}
