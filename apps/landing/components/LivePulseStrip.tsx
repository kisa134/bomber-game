"use client";

/* ── LivePulseStrip ────────────────────────────────────────────────────────
   Phase B merge of LiveStatsBar + LiveMatchFeed into ONE broadcast ticker:
   left = live stats (online · matches · tokens in play) with a LIVE pulse,
   right = scrolling marquee of REAL top earners. Real API only — if there are
   no earners yet we show a quiet "loading champions" note instead of faking a
   feed. (The old LiveStatsBar / LiveMatchFeed files are kept for reference.)
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  fetchStats,
  fetchLeaderboard,
  toTokens,
  type GameStats,
  type LeaderRow,
} from "@/lib/gameApi";
import { announce } from "@/lib/announce";
import { TOKEN_TICKER } from "@/lib/token";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

function Counter({
  value,
  color,
  glow,
  trigger,
}: {
  value: number;
  color: string;
  glow: string;
  trigger: boolean;
}) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.floor(v).toLocaleString("en-US"));
  useEffect(() => {
    if (!trigger) return;
    const ctrl = animate(mv, value, { duration: 1.4, ease });
    return () => ctrl.stop();
  }, [trigger, value, mv]);
  return (
    <motion.span
      className="tabular-nums"
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.05rem, 2.2vw, 1.55rem)",
        fontWeight: 700,
        color,
        textShadow: `0 0 16px ${glow}`,
        lineHeight: 1,
      }}
    >
      {display}
    </motion.span>
  );
}

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

export function LivePulseStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [stats, setStats] = useState<GameStats | null>(null);
  const [earners, setEarners] = useState<Earner[]>([]);

  useEffect(() => {
    let alive = true;
    let announced = false;
    const load = () => {
      void fetchStats().then((d) => {
        if (!alive || !d) return;
        setStats(d);
        if (!announced) {
          announced = true;
          announce(
            `Live: ${Math.round(d.online ?? 0)} players online, ${Math.round(d.matches ?? 0).toLocaleString("en-US")} matches played`,
          );
        }
      });
      void fetchLeaderboard("tokens").then((rows) => {
        if (!alive) return;
        setEarners(
          rows
            .map((r: LeaderRow) => ({
              name: (r.name ?? "").trim() || "anon",
              won: toTokens(r.tokens_won),
              wins: r.wins ?? 0,
            }))
            .filter((e) => e.won > 0),
        );
      });
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const ready = inView && stats !== null;

  const statViews = [
    { label: "ONLINE", value: Math.round(stats?.online ?? 0), color: "#f5c842", glow: "rgba(245,200,66,0.85)", pulse: true },
    { label: "MATCHES", value: Math.round(stats?.matches ?? 0), color: "#ffcc33", glow: "rgba(255,204,51,0.7)", pulse: false },
    { label: `${TOKEN_TICKER} IN PLAY`, value: Math.round(stats?.tokensInPlay ?? 0), color: "#3a9e9e", glow: "rgba(58,158,158,0.7)", pulse: false },
  ];

  const doubled = earners.length ? [...earners, ...earners] : [];

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.6, ease }}
      className="relative z-10 w-full overflow-hidden border-y"
      style={{ background: "rgba(10,11,16,0.92)", borderColor: "rgba(255,210,120,0.10)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 100% at 22% 50%, rgba(245,200,66,0.05) 0%, transparent 65%)" }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-stretch lg:flex-row lg:items-center">
        {/* ── Live stats block ── */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-3 lg:justify-start lg:border-r"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              LIVE
            </span>
          </span>

          {statViews.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              {s.pulse && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: s.color }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: s.color }} />
                </span>
              )}
              {ready ? (
                <Counter value={s.value} color={s.color} glow={s.glow} trigger={ready} />
              ) : (
                <div className="skeleton h-6 w-14" aria-hidden />
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Top-earners marquee ── */}
        {doubled.length > 0 ? (
          <PixelGlassGlitch variant="cyan" mode="idle" intensity={0.5} className="marquee-mask relative min-w-0 flex-1">
            <div className="relative w-full overflow-hidden" style={{ padding: "10px 0" }}>
              <div
                className="absolute left-0 top-0 z-20 hidden h-full items-center gap-2 px-4 sm:flex"
                style={{ background: "linear-gradient(90deg, rgba(10,11,16,1) 55%, transparent)", paddingRight: "32px" }}
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
        ) : (
          <div
            className="flex min-w-0 flex-1 items-center justify-center px-5 py-3 lg:justify-start"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}
          >
            First champions incoming…
          </div>
        )}
      </div>
    </motion.section>
  );
}
