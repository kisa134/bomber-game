"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const PHASES = [
  {
    number: "01",
    status: "LIVE NOW",
    title: "THE DROP",
    category: "Phase 1",
    text: "The arena opens. 2-4 players. Instant Solana payouts. Pure ROI deathmatch.",
    accent: "#ffcc33",
    side: "left" as const,
    icon: "💥",
  },
  {
    number: "02",
    status: "INCOMING",
    title: "THE SWARM",
    category: "Community & Creators",
    text: "Spectator mode & Twitch/Kick integration. Streamer lobbies, live betting, and creator rev-share. The community takes over.",
    accent: "#3a9e9e",
    side: "right" as const,
    icon: "📡",
  },
  {
    number: "03",
    status: "LOADING",
    title: "THE FURNACE",
    category: "Deflationary Tokenomics",
    text: "Supply shock initiated. A percentage of every match pool is permanently burned. As the player base scales, the token becomes hyper-scarce.",
    accent: "#f97316",
    side: "left" as const,
    icon: "🔥",
  },
  {
    number: "04",
    status: "FINAL FORM",
    title: "GLOBAL WAR",
    category: "Esports",
    text: "Massive prize pool tournaments, Clan Wars, and Ranked Seasons. Bombermeme enters the competitive esports tier.",
    accent: "#d44030",
    side: "right" as const,
    icon: "🏆",
  },
] as const;

type Phase = (typeof PHASES)[number];

export function RoadmapSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);

  /* The fuse line must run EXACTLY from the first dot to the last dot — never
     past the final card. Measure both dot centres (= row centres) and clamp. */
  const [line, setLine] = useState<{ top: number; height: number }>({ top: 0, height: 0 });
  useEffect(() => {
    const measure = () => {
      const rows = rowsRef.current;
      if (!rows || rows.children.length === 0) return;
      const first = rows.children[0] as HTMLElement;
      const last = rows.children[rows.children.length - 1] as HTMLElement;
      const top = first.offsetTop + first.offsetHeight / 2;
      const bottom = last.offsetTop + last.offsetHeight / 2;
      setLine({ top, height: Math.max(0, bottom - top) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (rowsRef.current) ro.observe(rowsRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  /* Fuse progress scoped to this section's scroll travel through the viewport */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start center", "end center"],
  });

  const fuseHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const fuseGlow = useTransform(
    scrollYProgress,
    [0, 0.38, 0.68, 1],
    [
      "0 0 8px 3px rgba(255,204,51,0.75)",
      "0 0 10px 3px rgba(58,158,158,0.75)",
      "0 0 10px 3px rgba(249,115,22,0.75)",
      "0 0 12px 4px rgba(212,64,48,0.80)",
    ]
  );

  return (
    <section
      id="roadmap"
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ background: "transparent" }}
    >
      {/* ── Section atmospheric glows ─────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 40% at 50% 0%,   rgba(255,204,51,0.06) 0%, transparent 55%),
            radial-gradient(ellipse 50% 35% at 5%  50%,  rgba(56,189,248,0.04) 0%, transparent 55%),
            radial-gradient(ellipse 45% 30% at 95% 70%,  rgba(168,85,247,0.04) 0%, transparent 55%),
            radial-gradient(ellipse 40% 30% at 75% 10%,  rgba(249,115,22,0.03) 0%, transparent 50%)
          `,
        }}
      />

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center pb-6 pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease }}
          className="mb-4 flex items-center gap-2.5 pixel-badge px-4 py-1.5"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: "#ffcc33" }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ background: "#ffcc33" }}
            />
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.55)" }}
          >
            BOMBERMEME · LAUNCH SEQUENCE
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 28, filter: "blur(14px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.85, ease, delay: 0.08 }}
          className="relative z-10 font-bold uppercase leading-none tracking-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(4rem, 14vw, 10rem)",
            color: "#fff",
            textShadow: "0 0 60px rgba(255,204,51,0.28), 0 0 120px rgba(255,204,51,0.10)",
          }}
        >
          ROADMAP
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease, delay: 0.22 }}
          className="mt-5 max-w-sm uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          From the drop · To global domination
        </motion.p>

        {/* Section divider cue */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 1 }}
          className="mt-12"
        >
          <motion.div
            animate={{ y: [0, 7, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                letterSpacing: "0.28em",
                color: "rgba(255,255,255,0.20)",
                textTransform: "uppercase",
              }}
            >
              scroll to detonate
            </span>
            <div
              className="h-10 w-px"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)",
              }}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <div ref={timelineRef} className="relative z-10 mx-auto max-w-5xl px-5 pb-20 pt-6 sm:px-8">
        {/* THE FUSE LINE — desktop only; spans first dot → last dot (measured) */}
        <div
          aria-hidden
          className="pointer-events-none absolute hidden -translate-x-1/2 md:block"
          style={{ left: "50%", width: 2, top: line.top, height: line.height }}
        >
          {/* Dim track */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
          {/* Burning fill — driven by section scroll progress */}
          <motion.div
            className="absolute inset-x-0 top-0 rounded-full"
            style={{
              height: fuseHeight,
              background:
                "linear-gradient(to bottom, #ffcc33 0%, #38bdf8 38%, #f97316 68%, #a855f7 100%)",
              boxShadow: fuseGlow,
            }}
          />
        </div>

        {/* Phase rows */}
        <div ref={rowsRef} className="flex flex-col gap-20 sm:gap-28">
          {PHASES.map((phase, i) => (
            <PhaseRow
              key={phase.number}
              phase={phase}
              index={i}
              progress={scrollYProgress}
              litAt={PHASES.length > 1 ? i / (PHASES.length - 1) : 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* Ramp that lights an element as the fuse fill arrives at its dot. */
function useLit(progress: MotionValue<number>, litAt: number): MotionValue<number> {
  const start = Math.max(0, litAt - 0.12);
  return useTransform(progress, [start, Math.max(start + 0.001, litAt)], [0, 1]);
}

/* ── Phase row: alternating left/right layout ───────────────────────────── */
function PhaseRow({ phase, index, progress, litAt }: { phase: Phase; index: number; progress: MotionValue<number>; litAt: number }) {
  const isLeft = phase.side === "left";

  return (
    <div className="relative grid grid-cols-1 items-center md:grid-cols-[1fr,56px,1fr]">
      {/* Desktop left slot */}
      <div className="hidden md:block md:pr-10">
        {isLeft ? <PhaseCard phase={phase} index={index} progress={progress} litAt={litAt} /> : null}
      </div>

      {/* Center fuse dot — desktop */}
      <div className="hidden justify-center md:flex">
        <FuseDot phase={phase} progress={progress} litAt={litAt} />
      </div>

      {/* Desktop right slot */}
      <div className="hidden md:block md:pl-10">
        {!isLeft ? <PhaseCard phase={phase} index={index} progress={progress} litAt={litAt} /> : null}
      </div>

      {/* Mobile: dot + card stacked */}
      <div className="flex flex-col items-center gap-5 md:hidden">
        <FuseDot phase={phase} progress={progress} litAt={litAt} />
        <PhaseCard phase={phase} index={index} progress={progress} litAt={litAt} />
      </div>
    </div>
  );
}

/* ── Glowing dot anchored on the fuse ───────────────────────────────────── */
function FuseDot({ phase, progress, litAt }: { phase: Phase; progress: MotionValue<number>; litAt: number }) {
  const lit = useLit(progress, litAt);
  const dotShadow = useTransform(lit, (v) => `0 0 ${10 + v * 16}px ${phase.accent}, 0 0 ${20 + v * 30}px ${phase.accent}60`);
  const dotBg = useTransform(lit, (v) => (v > 0.55 ? phase.accent : "transparent"));
  const pingOpacity = useTransform(lit, [0, 1], [0, 0.55]);
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="relative flex h-5 w-5 shrink-0 items-center justify-center"
    >
      <motion.span
        className="absolute h-full w-full animate-ping rounded-full"
        style={{ background: phase.accent, opacity: pingOpacity }}
      />
      <motion.span
        className="relative h-[14px] w-[14px] rounded-full border-2"
        style={{ background: dotBg, borderColor: phase.accent, boxShadow: dotShadow }}
      />
    </motion.div>
  );
}

/* ── Glassmorphism phase card ────────────────────────────────────────────── */
function PhaseCard({ phase, index, progress, litAt }: { phase: Phase; index: number; progress: MotionValue<number>; litAt: number }) {
  const lit = useLit(progress, litAt);
  return (
    <motion.article
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      className="relative w-full overflow-hidden pixel-panel p-8"
      style={{
        borderTop: `3px solid ${phase.accent}`,
        boxShadow: `4px 4px 0 rgba(0,0,0,0.45), 0 0 16px ${phase.accent}12`,
      }}
    >
      {/* Lit overlay — brightens as the fuse reaches this phase's dot */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: lit,
          borderTop: `2px solid ${phase.accent}`,
          boxShadow: `0 0 60px ${phase.accent}33, inset 0 0 60px ${phase.accent}12`,
          background: `linear-gradient(180deg, ${phase.accent}10 0%, transparent 40%)`,
        }}
      />

      {/* Content sits above the glow overlay */}
      <div className="relative">
      {/* Top row: phase number + status badge */}
      <div className="mb-5 flex items-center justify-between">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            letterSpacing: "0.24em",
            color: "rgba(255,255,255,0.22)",
            textTransform: "uppercase",
          }}
        >
          PHASE {phase.number}
        </span>
        <span
          className="pixel-inset px-3 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            background: `${phase.accent}18`,
            color: phase.accent,
            border: `1px solid ${phase.accent}44`,
          }}
        >
          {phase.status}
        </span>
      </div>

      {/* Icon + title */}
      <div className="mb-2 flex items-center gap-3">
        <span style={{ fontSize: "1.75rem", lineHeight: 1 }} aria-hidden>
          {phase.icon}
        </span>
        <h3
          className="font-bold uppercase leading-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.45rem, 4vw, 2rem)",
            color: "#fff",
            textShadow: `0 0 28px ${phase.accent}55`,
          }}
        >
          {phase.title}
        </h3>
      </div>

      {/* Category label */}
      <p
        className="mb-4 uppercase tracking-widest"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.62rem",
          letterSpacing: "0.2em",
          color: phase.accent,
          opacity: 0.75,
        }}
      >
        {phase.category}
      </p>

      {/* Body */}
      <p
        className="leading-relaxed"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.95rem",
          color: "rgba(255,255,255,0.48)",
        }}
      >
        {phase.text}
      </p>

      {/* Accent bottom rule */}
      <div
        className="mt-7 h-px w-full"
        style={{
          background: `linear-gradient(to right, ${phase.accent}30, transparent)`,
        }}
      />
      </div>
    </motion.article>
  );
}
