"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const TRAILER_SRC = "/sprites/demo2.mp4";

export function VideoTrailerSection() {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    setPlaying(true);
    requestAnimationFrame(() => {
      void videoRef.current?.play();
    });
  };

  return (
    <section className="relative w-full px-5 py-16 sm:px-8">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease }}
        className="mb-8 flex flex-col items-center gap-2"
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#ff5a5f",
            textShadow: "0 0 10px rgba(255,90,95,0.55)",
          }}
        >
          🎬 Watch the Chaos
        </span>
        <h2
          className="detonate-heading text-3xl sm:text-4xl lg:text-5xl text-center"
          style={{
            background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.65) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          GAMEPLAY TRAILER
        </h2>
      </motion.div>

      {/* Video / placeholder container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
        whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.75, ease }}
        className="relative mx-auto max-w-4xl"
      >
        <PixelGlassGlitch variant="red" mode="hover" intensity={1}>
          <div className="relative aspect-video overflow-hidden" style={{ background: "#080a10" }}>
            <video
              ref={videoRef}
              src={TRAILER_SRC}
              poster="/sprites/web/gameplay-1.jpg"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: playing ? 1 : 0, transition: "opacity 0.4s ease" }}
              playsInline
              controls={playing}
              preload="metadata"
              onEnded={() => setPlaying(false)}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/web/gameplay-1.jpg"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: playing ? 0 : 1, transition: "opacity 0.4s ease", imageRendering: "auto" }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,90,95,0.08) 0%, transparent 70%)",
              }}
            />
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />

            <AnimatePresence>
              {!playing && (
                <motion.button
                  key="play-btn"
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.3, ease }}
                  onClick={handlePlay}
                  className="absolute inset-0 z-10 flex items-center justify-center border-0 bg-transparent p-0"
                  aria-label="Play trailer"
                >
                  <span
                    className="absolute h-20 w-20 animate-ping"
                    style={{ background: "rgba(255,204,51,0.1)", borderRadius: 0 }}
                    aria-hidden
                  />
                  <motion.span
                    className="cta-play-pixel"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#100e16" style={{ marginLeft: "3px" }}>
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </motion.span>
                </motion.button>
              )}
            </AnimatePresence>

            <div
              className="absolute right-3 top-3 z-20 px-3 py-1"
              style={{
                background: "rgba(0,0,0,0.75)",
                border: "2px solid rgba(255,204,51,0.35)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.52rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#ffcc33",
              }}
            >
              LIVE FOOTAGE
            </div>
          </div>
        </PixelGlassGlitch>

        {/* Sub-caption */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-4 text-center"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.62rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.22)",
          }}
        >
          In-engine footage · Real matches · No bots
        </motion.p>
      </motion.div>
    </section>
  );
}
