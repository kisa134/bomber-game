"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fetchStats, fetchLeaderboard, type GameStats } from "@/lib/gameApi";
import { PlayLink } from "@/components/ui/PlayLink";
import { TOKEN_TICKER } from "@/lib/token";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const POWERUP_SPRITES = [
  "/sprites/powerup_bomb.png",
  "/sprites/powerup_fire.png",
  "/sprites/powerup_speed.png",
  "/sprites/powerup_kick.png",
];

function AnimatedFighter({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const frames = [0, 1, 2].map((f) => src.replace("_0.webp", `_${f}.webp`));
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), 280);
    return () => clearInterval(id);
  }, [frames.length]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={frames[frame]}
      alt=""
      className={className}
      style={{ imageRendering: "pixelated", ...style }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = src;
      }}
    />
  );
}

export function LiveArena({ embedded = false }: { embedded?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [topName, setTopName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [s, board] = await Promise.all([fetchStats(), fetchLeaderboard("tokens")]);
      if (!alive) return;
      if (s) setStats(s);
      const top = board[0];
      if (top?.name) setTopName(top.name);
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <section
      className={`live-arena relative flex h-full w-full flex-col justify-center overflow-hidden px-5 sm:px-8 ${embedded ? "min-h-0 py-10" : "min-h-[100svh] py-20"}`}
    >
      <div className="bm-scanlines pointer-events-none absolute inset-0 opacity-60" aria-hidden />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {POWERUP_SPRITES.map((src, i) => (
          <motion.img
            key={src}
            src={src}
            alt=""
            className="absolute"
            style={{
              width: 32 + i * 4,
              imageRendering: "pixelated",
              left: `${12 + i * 20}%`,
              top: `${20 + (i % 2) * 45}%`,
              opacity: 0.35,
            }}
            animate={{ y: [0, -12, 0], rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3.5 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-10 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease }}
          className="lg:col-span-5"
        >
          <span style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", letterSpacing: "0.06em", color: "rgba(245,200,66,0.9)" }}>
            LIVE ARENA
          </span>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
              lineHeight: 0.92,
              color: "#fff",
              margin: "0.75rem 0",
            }}
          >
            Matches running{" "}
            <span style={{ color: "#f5c842", textShadow: "0 0 24px rgba(245,200,66,0.45)" }}>right now.</span>
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", lineHeight: 1.65, color: "rgba(255,255,255,0.5)", maxWidth: "38ch" }}>
            Real players. Real pots.{" "}
            {topName ? (
              <>Top earner <strong style={{ color: "#f5c842" }}>{topName}</strong> is on the board.</>
            ) : (
              "Leaderboard updates every 30 seconds."
            )}
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "Online", value: Math.round(stats?.online ?? 0), color: "#f5c842" },
              { label: "Matches", value: Math.round(stats?.matches ?? 0), color: "#3a9e9e" },
              { label: "Paid out", value: Math.round(stats?.prizePaid ?? 0), suffix: ` ${TOKEN_TICKER}`, color: "#f5c842" },
            ].map((chip) => (
              <div
                key={chip.label}
                className="pixel-inset px-3 py-3"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.35)" }}
              >
                <div className="tabular-nums" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem", color: chip.color }}>
                  {chip.value.toLocaleString("en-US")}
                  {"suffix" in chip && chip.suffix ? chip.suffix : ""}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  {chip.label}
                </div>
              </div>
            ))}
          </div>

          <PlayLink
            className="cta-yellow mt-8 inline-flex items-center px-8"
            style={{ height: 52, fontSize: "0.95rem" }}
          >
            Enter matchmaking
          </PlayLink>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease, delay: 0.1 }}
          className="relative lg:col-span-7"
        >
          <PixelGlassGlitch variant="gold" mode="idle" intensity={0.9} className="w-full">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              poster="/sprites/web/gameplay-1.jpg"
            >
              <source src="/sprites/demo2.mp4" type="video/mp4" />
            </video>
            <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.55)" }} />

            <AnimatedFighter
              src="/sprites/pepe/new/skin_1_side_0.webp"
              className="pointer-events-none absolute bottom-2 left-[8%] z-10"
              style={{ height: 96, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.9))" }}
            />
            <AnimatedFighter
              src="/sprites/doge/skin_4_side_0.webp"
              className="pointer-events-none absolute bottom-2 right-[10%] z-10"
              style={{ height: 88, transform: "scaleX(-1)", filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.9))" }}
            />
          </PixelGlassGlitch>

          <div
            className="mt-3 flex items-center justify-between"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}
          >
            <span>In-engine capture</span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 bg-red-500" style={{ boxShadow: "0 0 8px rgba(255,90,90,0.8)" }} />
              Live feed
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
