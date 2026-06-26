"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { fetchStats, type GameStats } from "@/lib/gameApi";
import { TOKEN_TICKER } from "@/lib/token";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface StatView {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color: string;
  glow: string;
  pulse?: boolean;
}

function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  color,
  glow,
  pulse,
  trigger,
}: StatView & { trigger: boolean }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `${prefix}${Math.floor(v).toLocaleString("en-US")}${suffix}`);

  useEffect(() => {
    if (!trigger) return;
    const ctrl = animate(mv, value, { duration: 1.6, ease });
    return () => ctrl.stop();
  }, [trigger, value, mv]);

  return (
    <div className="flex items-center gap-2">
      {pulse && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: color }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
        </span>
      )}
      <motion.span
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.4rem, 3vw, 2rem)",
          fontWeight: 700,
          color,
          textShadow: `0 0 18px ${glow}, 0 0 36px ${glow.replace("0.7", "0.3")}`,
          lineHeight: 1,
        }}
      >
        {display}
      </motion.span>
    </div>
  );
}

export function LiveStatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [stats, setStats] = useState<GameStats | null>(null);

  // Real data only — polled from the game server's public /stats (CORS-enabled).
  useEffect(() => {
    let alive = true;
    const load = () => {
      void fetchStats().then((d) => {
        if (alive && d) setStats(d);
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

  const views: StatView[] = [
    {
      label: "MATCHES PLAYED",
      value: Math.round(stats?.matches ?? 0),
      color: "#ffcc33",
      glow: "rgba(255,204,51,0.7)",
    },
    {
      label: `${TOKEN_TICKER} IN PLAY`,
      value: Math.round(stats?.tokensInPlay ?? 0),
      color: "#4ade80",
      glow: "rgba(74,222,128,0.7)",
    },
    {
      label: "PLAYERS ONLINE",
      value: Math.round(stats?.online ?? 0),
      color: "#4ade80",
      glow: "rgba(74,222,128,0.85)",
      pulse: true,
    },
  ];

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.7, ease }}
      className="relative z-10 w-full overflow-hidden py-5"
      style={{
        background:
          "linear-gradient(90deg, rgba(8,9,14,0) 0%, rgba(8,9,14,0.95) 8%, rgba(8,9,14,0.95) 92%, rgba(8,9,14,0) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 50%, rgba(74,222,128,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 px-5 sm:flex-row sm:justify-around">
        {views.map((stat, i) => (
          <div key={stat.label} className="flex flex-col items-center gap-1.5">
            <AnimatedCounter {...stat} trigger={ready} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.58rem",
                fontWeight: 700,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.28)",
              }}
            >
              {stat.label}
            </span>

            {i < views.length - 1 && (
              <div
                className="hidden sm:block"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "1px",
                  height: "40px",
                  background:
                    "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="absolute left-4 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 lg:flex">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.52rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          LIVE
        </span>
      </div>
    </motion.section>
  );
}
