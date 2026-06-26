"use client";

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { AnimatedTitle } from "./AnimatedTitle";
import { PrizePoolCounter } from "./PrizePoolCounter";
import { MatchmakingCta } from "./MatchmakingCta";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── HUD stat chips ──────────────────────────────────────────────────────── */
interface HudStat {
  icon:   string;
  target: number;
  prefix?: string;
  suffix?: string;
  label:  string;
  color:  string;
  glow:   string;
}

const HUD_STATS: HudStat[] = [
  { icon: "●", target: 14_284, suffix: "",   label: "PLAYERS ONLINE",  color: "#5ad27a", glow: "rgba(90,210,122,0.8)"   },
  { icon: "◎", target: 9_611,  suffix: "",   label: "MATCHES TODAY",   color: "#7fd8ff", glow: "rgba(127,216,255,0.8)"   },
  { icon: "$", target: 2.1,    suffix: "M",  label: "PRIZE PAID OUT",  color: "#ffd700", glow: "rgba(255,215,0,0.8)"   },
  { icon: "⚡", target: 8_420,  suffix: "",   label: "TOP MMR",         color: "#ff5a4d", glow: "rgba(255,90,77,0.8)"  },
];

function HudChip({ icon, target, prefix = "", suffix = "", label, color, glow, trigger }: HudStat & { trigger: boolean }) {
  const value   = useMotionValue(0);
  const display = useTransform(value, (v) => {
    const rounded = suffix === "M" ? v.toFixed(1) : Math.floor(v).toLocaleString("en-US");
    return `${prefix}${rounded}${suffix}`;
  });

  useEffect(() => {
    if (!trigger) return;
    const ctrl = animate(value, target, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
    return () => ctrl.stop();
  }, [trigger, target, value]);

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{
        background:     "rgba(10,12,20,0.68)",
        border:         `1px solid ${color}22`,
        borderRadius:   "12px",
        padding:        "10px 16px",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        minWidth:       "100px",
        boxShadow:      `0 0 20px ${color}08, inset 0 1px 0 rgba(255,255,255,0.04)`,
        transition:     "border-color 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ color, fontSize: "0.65rem", textShadow: `0 0 8px ${glow}` }}>{icon}</span>
        <motion.span
          className="tabular-nums"
          style={{
            fontFamily:    "var(--font-hud)",
            fontSize:      "clamp(0.95rem, 2.5vw, 1.25rem)",
            fontWeight:    700,
            color,
            textShadow:    `0 0 14px ${glow}, 0 0 32px ${glow.replace("0.8", "0.35")}`,
            lineHeight:    1,
            letterSpacing: "-0.02em",
          }}
        >
          {display}
        </motion.span>
      </div>
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.50rem",
          letterSpacing: "0.16em",
          color:         "rgba(255,255,255,0.30)",
          textTransform: "uppercase",
          whiteSpace:    "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Ambient CSS particles ───────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id:       i,
  left:     `${5 + (i * 397) % 90}%`,
  top:      `${10 + (i * 613) % 80}%`,
  size:     1.2 + (i % 3) * 0.9,
  delay:    (i * 0.37) % 4,
  duration: 3.5 + (i % 5) * 0.8,
  color:    i % 4 === 0 ? "#5ad27a" : i % 4 === 1 ? "#7fd8ff" : i % 4 === 2 ? "#ff5a4d" : "#ffd700",
  opacity:  0.12 + (i % 4) * 0.07,
}));

/* ── Component ───────────────────────────────────────────────────────────── */
export function Hero() {
  const [detonateFlash, setDetonateFlash] = useState(false);
  const [showFallback, setShowFallback]   = useState(false);
  const [statsVisible, setStatsVisible]   = useState(false);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const statsRef   = useRef<HTMLDivElement>(null);

  /* ── Video fallback: if video doesn't play within 3s, show static image ─ */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timeout = setTimeout(() => setShowFallback(true), 3_000);

    const onPlaying = () => clearTimeout(timeout);
    const onError   = () => { clearTimeout(timeout); setShowFallback(true); };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("error",   onError);
    return () => {
      clearTimeout(timeout);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error",   onError);
    };
  }, []);

  /* ── Trigger HUD stats count-up on mount ─────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => setStatsVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const triggerExplosion = () => {
    setDetonateFlash(true);
    setTimeout(() => setDetonateFlash(false), 700);
  };

  return (
    <section
      className="hero-section relative flex min-h-screen w-full flex-col items-center
                 justify-center overflow-hidden px-5 pt-24 pb-16 text-center"
      style={{ background: "transparent" }}
    >
      {/* ═══ BACKGROUND LAYER — clean: sits directly on the unified site bg ══ */}

      {/* Soft scrim only — keeps hero text legible over the blurred art */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex:     2,
          background: `
            radial-gradient(ellipse 72% 56% at 50% 46%, rgba(11,10,14,0) 0%, rgba(11,10,14,0.16) 70%, rgba(8,6,14,0.34) 100%),
            linear-gradient(to bottom, rgba(11,10,14,0.22) 0%, transparent 24%, transparent 82%, rgba(8,6,14,0.40) 100%)
          `,
        }}
      />

      {/* Bottom fade to next section */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-36"
        style={{ zIndex: 4, background: "linear-gradient(to bottom, transparent, rgba(11,10,14,0.5))" }}
      />

      {/* ═══ DETONATION FLASH (easter egg) ══════════════════════════════════ */}
      <AnimatePresence>
        {detonateFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.7, 0] }}
            transition={{ duration: 0.7, times: [0, 0.08, 0.35, 1], ease: "easeOut" }}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex:     30,
              background: "radial-gradient(ellipse 120% 100% at 50% 50%, rgba(90,210,122,0.06) 0%, rgba(255,90,77,0.22) 55%, rgba(127,216,255,0.10) 100%)",
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ CONTENT LAYER ══════════════════════════════════════════════════ */}
      <div className="relative flex w-full flex-col items-center gap-6" style={{ zIndex: 10 }}>

        {/* ── Status pill ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            "8px",
            borderRadius:   "999px",
            border:         "1px solid rgba(90,210,122,0.20)",
            background:     "rgba(90,210,122,0.06)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            padding:        "6px 16px",
            boxShadow:      "0 0 24px rgba(90,210,122,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-80"
              style={{ background: "#ff5a4d" }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ background: "#ff5a4d", boxShadow: "0 0 6px rgba(255,90,77,0.9)" }}
            />
          </span>
          <span
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "0.60rem",
              fontWeight:    700,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color:         "rgba(90,210,122,0.75)",
            }}
          >
            Ranked Season 1
          </span>
          <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.5rem" }}>·</span>
          <span
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "0.55rem",
              letterSpacing: "0.16em",
              color:         "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
            }}
          >
            Esports Deathmatch · Solana
          </span>
        </motion.div>

        {/* ── BOMBERMEME animated mascot title ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.85, ease }}
          className="relative z-10 flex h-[200px] w-full cursor-pointer select-none
                     justify-center overflow-visible sm:h-[220px] md:h-[180px] lg:h-[220px]"
          onClick={triggerExplosion}
          title="💣 Click to detonate"
        >
          <AnimatedTitle />
        </motion.div>

        {/* ── Sub-headline ─────────────────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease, delay: 0.18 }}
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.72rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color:         "rgba(255,255,255,0.35)",
            marginTop:     "-16px",
          }}
        >
          Pure Skill.{" "}
          <span style={{ color: "#ff5a4d", textShadow: "0 0 12px rgba(255,90,77,0.7)" }}>
            Massive Stakes.
          </span>
          {" "}No Luck.
        </motion.p>

        {/* ── Prize Pool Counter ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease, delay: 0.28 }}
        >
          <PrizePoolCounter />
        </motion.div>

        {/* ── Matchmaking CTAs ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.40 }}
        >
          <MatchmakingCta />
        </motion.div>

        {/* ── HUD Stats Strip ──────────────────────────────────────────────── */}
        <motion.div
          ref={statsRef}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.54 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {HUD_STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.56 + i * 0.08 }}
            >
              <HudChip {...stat} trigger={statsVisible} />
            </motion.div>
          ))}
        </motion.div>

      </div>

      {/* ── Scroll cue ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        style={{ zIndex: 10 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          className="flex flex-col items-center gap-1.5"
        >
          <span
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "0.56rem",
              letterSpacing: "0.28em",
              color:         "rgba(90,210,122,0.25)",
              textTransform: "uppercase",
            }}
          >
            explore
          </span>
          <div
            style={{
              width:      "1px",
              height:     "36px",
              background: "linear-gradient(to bottom, rgba(90,210,122,0.3), transparent)",
            }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
