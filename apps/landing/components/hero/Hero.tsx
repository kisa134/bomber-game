"use client";

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useState, useEffect } from "react";
import { fetchStats, type GameStats, GAME_URL } from "@/lib/gameApi";
import { TOKEN_TICKER } from "@/lib/token";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const PLAY_URL = `${GAME_URL}/play`;

/* ── Real HUD chip (count-up to a real /stats value) ─────────────────────── */
function HudChip({
  value,
  label,
  suffix = "",
  color,
  trigger,
}: {
  value: number;
  label: string;
  suffix?: string;
  color: string;
  trigger: boolean;
}) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `${Math.floor(v).toLocaleString("en-US")}${suffix}`);
  useEffect(() => {
    if (!trigger) return;
    const ctrl = animate(mv, value, { duration: 1.4, ease });
    return () => ctrl.stop();
  }, [trigger, value, mv]);

  return (
    <div className="flex flex-col gap-0.5">
      <motion.span
        className="tabular-nums"
        style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,2.4vw,1.6rem)", fontWeight: 800, color, lineHeight: 1 }}
      >
        {display}
      </motion.span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)" }}>
        {label}
      </span>
    </div>
  );
}

export function Hero() {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => void fetchStats().then((d) => { if (alive && d) setStats(d); });
    load();
    const id = setInterval(load, 30_000);
    const t = setTimeout(() => setReady(true), 500);
    return () => { alive = false; clearInterval(id); clearTimeout(t); };
  }, []);

  const detonate = () => { setFlash(true); setTimeout(() => setFlash(false), 650); };

  return (
    <section
      className="hero-spec-bg relative flex min-h-[100svh] w-full items-center overflow-hidden"
      style={{ paddingTop: "88px", paddingBottom: "64px", paddingInline: "var(--section-px, 1.5rem)" }}
    >
      {/* detonation flash easter egg */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash" aria-hidden
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 0] }}
            transition={{ duration: 0.65, times: [0, 0.08, 0.35, 1], ease: "easeOut" }}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 30, background: "radial-gradient(ellipse 120% 100% at 35% 55%, rgba(245,200,66,0.10) 0%, rgba(212,64,48,0.22) 55%, transparent 100%)" }}
          />
        )}
      </AnimatePresence>

      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-8 lg:grid-cols-12" style={{ zIndex: 10 }}>
        {/* ── LEFT: headline + CTAs (cols 1–7) ───────────────────────────── */}
        <div className="flex flex-col items-start gap-6 lg:col-span-7">
          {/* status pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{ border: "1px solid rgba(245,200,66,0.22)", background: "rgba(245,200,66,0.06)" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-80" style={{ background: "#f09020" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#f09020" }} />
            </span>
            <span style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", letterSpacing: "0.06em", color: "rgba(245,200,66,0.9)" }}>
              SEASON 01
            </span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              Solana Deathmatch
            </span>
          </motion.div>

          {/* headline FIGHT / EXPLODE / GET PAID */}
          <h1
            onClick={detonate}
            title="detonate"
            className="cursor-pointer select-none"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: "var(--text-hero, clamp(3.5rem, 7vw, 9rem))",
              lineHeight: 0.86,
              letterSpacing: "-0.01em",
              color: "#fff",
              margin: 0,
            }}
          >
            {["FIGHT.", "EXPLODE."].map((line, i) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease, delay: 0.1 + i * 0.1 }}
                style={{ display: "block" }}
              >
                {line}
              </motion.span>
            ))}
            <motion.span
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.3 }}
              style={{ display: "block" }}
            >
              GET <span className="foil-paid">PAID.</span>
            </motion.span>
          </h1>

          {/* body line */}
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.45 }}
            style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-base, 1rem)", lineHeight: 1.6, color: "var(--color-text-secondary, rgba(255,255,255,0.6))", maxWidth: "44ch" }}
          >
            A real-time PvP bomber arena on Solana. Pure skill, no luck —{" "}
            <span style={{ color: "#d44030" }}>last bomber standing takes the pot.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.55 }}
            className="flex flex-wrap items-center gap-3"
          >
            <a href={PLAY_URL} target="_blank" rel="noopener noreferrer"
              className="cta-yellow inline-flex items-center justify-center rounded-md px-7"
              style={{ height: "52px", fontSize: "0.95rem" }}>
              ▶ Play Now
            </a>
            <a href="/faq"
              className="cta-ghost inline-flex items-center justify-center rounded-md px-7"
              style={{ height: "52px", fontSize: "0.9rem" }}>
              How It Works
            </a>
          </motion.div>

          {/* real HUD strip */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.7 }}
            className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-4"
          >
            <HudChip value={Math.round(stats?.online ?? 0)}     label="Players Online" color="#f5c842" trigger={ready} />
            <HudChip value={Math.round(stats?.matches ?? 0)}    label="Matches"        color="#7fd8ff" trigger={ready} />
            <HudChip value={Math.round(stats?.prizePaid ?? 0)}  label="Paid Out"       suffix={` ${TOKEN_TICKER}`} color="#f5c842" trigger={ready} />
            <HudChip value={Math.round(stats?.topMmr ?? 0)}     label="Top MMR"        color="#3a9e9e" trigger={ready} />
          </motion.div>
        </div>

        {/* ── RIGHT: fighter (cols 8–12) ──────────────────────────────────── */}
        <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
          {/* bomb glow halo behind the fighter */}
          <div aria-hidden className="pointer-events-none absolute" style={{ right: "8%", bottom: "10%", width: "min(60vw,360px)", height: "min(60vw,360px)", background: "radial-gradient(circle, rgba(212,64,48,0.18) 0%, transparent 65%)", filter: "blur(8px)", animation: "neon-pulse 2.4s ease-in-out infinite" }} />
          <motion.img
            src="/sprites/skin_2.webp"
            alt="BomberMeme fighter"
            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, ease, delay: 0.25 }}
            className="hero-fighter relative"
            style={{ height: "min(58vh, 520px)", width: "auto", objectFit: "contain", imageRendering: "pixelated", filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.6))", animation: "hero-fighter-float 3s ease-in-out infinite", zIndex: 10 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>

      {/* scroll cue */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }}
        className="absolute bottom-7 left-1/2 -translate-x-1/2" style={{ zIndex: 10 }}
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} className="flex flex-col items-center gap-1.5">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.28em", color: "rgba(245,200,66,0.35)", textTransform: "uppercase" }}>scroll</span>
          <div style={{ width: "1px", height: "34px", background: "linear-gradient(to bottom, rgba(245,200,66,0.4), transparent)" }} />
        </motion.div>
      </motion.div>
    </section>
  );
}
