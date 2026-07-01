"use client";

import { motion, AnimatePresence, useTransform, useScroll } from "framer-motion";
import { useState, useRef } from "react";
import { usePlayUrl } from "@/lib/playUrl";
import { useMagnetic } from "@/lib/hooks/useMagnetic";
import { PrizePoolCounter } from "@/components/hero/PrizePoolCounter";
import { HeroBroadcastHud } from "@/components/hero/HeroArenaScene";
import { HeroCrowdRun } from "@/components/hero/HeroCrowdRun";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const playUrl = usePlayUrl();
  const magneticRef = useMagnetic<HTMLAnchorElement>(0.32);
  const [flash, setFlash] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -72]);

  const detonate = () => { setFlash(true); setTimeout(() => setFlash(false), 650); };

  return (
    <section
      ref={sectionRef}
      className="hero-spec-bg relative flex min-h-[100svh] w-full items-center overflow-hidden"
      style={{ paddingTop: "88px", paddingBottom: "64px", paddingInline: "var(--section-px, 1.5rem)" }}
    >
      {/* ── z-0 · arena ENVIRONMENT — the whole hero lives inside one world (comp B) ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 0,
          backgroundImage: "url(/bg/hero-bg-arena.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.62,
          filter: "blur(1.5px) brightness(0.58) saturate(1.05)",
        }}
      />
      {/* left-side darken — keeps the headline the main typographic punch */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 0,
          background: "linear-gradient(90deg, rgba(5,5,9,0.85) 0%, rgba(5,5,9,0.52) 30%, rgba(5,5,9,0.12) 56%, transparent 72%)",
        }}
      />
      {/* ── the CROWD — our fighters stampede the camera; the living hero scene
             (random crowd each load, runs in the arena environment) ── */}
      <div className="absolute inset-0 hidden md:block" style={{ zIndex: 2 }} aria-hidden>
        <HeroCrowdRun />
      </div>

      {/* directional key light rising from the match (lower-right) up into the text zone —
          light/atmosphere is the ONLY thing that crosses left, never objects */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 3,
          background:
            "radial-gradient(95% 90% at 70% 72%, rgba(245,200,66,0.18) 0%, rgba(212,64,48,0.07) 28%, transparent 56%)",
        }}
      />

      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6, 0] }}
            transition={{ duration: 0.65, times: [0, 0.08, 0.35, 1], ease: "easeOut" }}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 30, background: "radial-gradient(ellipse 120% 100% at 35% 55%, rgba(245,200,66,0.10) 0%, rgba(212,64,48,0.22) 55%, transparent 100%)" }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-8 lg:grid-cols-12"
        style={{ zIndex: 10, opacity: heroOpacity, y: heroY }}
      >
        <div className="flex flex-col items-start gap-6 lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="pixel-badge inline-flex items-center gap-2 px-3 py-1.5"
          >
            <span className="hero-live-dot" />
            <span style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", letterSpacing: "0.06em", color: "rgba(245,200,66,0.9)" }}>
              SEASON 01
            </span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              Solana Deathmatch
            </span>
          </motion.div>

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
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease, delay: 0.1 + i * 0.1 }}
                style={{ display: "block" }}
              >
                {line}
              </motion.span>
            ))}
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.3 }}
              style={{ display: "block" }}
            >
              GET <span className="foil-paid">PAID.</span>
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-base, 1rem)", lineHeight: 1.6, color: "rgba(255,255,255,0.6)", maxWidth: "44ch" }}
          >
            No teams. No luck. No mercy.{" "}
            <span style={{ color: "#d44030" }}>Win or get wiped.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.55 }}
            className="flex flex-wrap items-center gap-3"
          >
            <a
              ref={magneticRef}
              href={playUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-yellow inline-flex items-center justify-center px-7 transition-transform"
              style={{ height: "52px", fontSize: "0.95rem" }}
            >
              ▶ Drop In
            </a>
            <a href="/faq" className="cta-ghost inline-flex items-center justify-center px-7" style={{ height: "52px", fontSize: "0.9rem" }}>
              The Rules
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.65 }}
            className="w-full max-w-md"
          >
            <PrizePoolCounter />
          </motion.div>
        </div>

        <div className="relative hidden items-start justify-end lg:col-span-5 lg:flex">
          <motion.div style={{ opacity: heroOpacity }}>
            <HeroBroadcastHud />
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1 }}
        className="absolute bottom-7 left-1/2 -translate-x-1/2"
        style={{ zIndex: 10, opacity: heroOpacity }}
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} className="flex flex-col items-center gap-1.5">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.28em", color: "rgba(245,200,66,0.35)", textTransform: "uppercase" }}>scroll</span>
          <div style={{ width: "1px", height: "34px", background: "linear-gradient(to bottom, rgba(245,200,66,0.4), transparent)" }} />
        </motion.div>
      </motion.div>

      {/* ── z-40 · foreground veil — thin cinematic glass over the WHOLE hero ── */}
      <div aria-hidden className="bm-scanlines pointer-events-none absolute inset-0" style={{ zIndex: 40, opacity: 0.1 }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 40,
          background: "radial-gradient(145% 125% at 50% 44%, transparent 62%, rgba(4,5,9,0.5) 100%)",
        }}
      />
    </section>
  );
}
