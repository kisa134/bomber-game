"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function VideoTrailerSection() {
  const [playing, setPlaying] = useState(false);

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
        <div
          className="relative aspect-video overflow-hidden rounded-3xl"
          style={{
            background: "#080a10",
            border: "1px solid rgba(255,90,95,0.18)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.7), 0 0 100px rgba(255,90,95,0.06)",
          }}
        >
          {/* Placeholder thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://placehold.co/1280x720/080a10/ff5a5f?text=GAMEPLAY+TRAILER+COMING+SOON"
            alt="Gameplay Trailer"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: playing ? 0 : 1, transition: "opacity 0.4s ease" }}
          />

          {/* Corner shimmer glows */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,90,95,0.08) 0%, transparent 70%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />

          {/* Play button */}
          <AnimatePresence>
            {!playing && (
              <motion.button
                key="play-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.3, ease }}
                onClick={() => setPlaying(true)}
                className="absolute inset-0 z-10 flex items-center justify-center"
                aria-label="Play trailer"
              >
                {/* Outer pulse ring */}
                <span
                  className="absolute h-24 w-24 animate-ping rounded-full"
                  style={{ background: "rgba(255,204,51,0.12)" }}
                />
                {/* Inner glow ring */}
                <span
                  className="absolute h-20 w-20 rounded-full"
                  style={{
                    background: "rgba(255,204,51,0.08)",
                    border: "1px solid rgba(255,204,51,0.35)",
                    boxShadow: "0 0 40px rgba(255,204,51,0.25)",
                  }}
                />
                {/* Play icon */}
                <motion.span
                  className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #ffe566 0%, #ffcc33 50%, #ff9a3d 100%)",
                    boxShadow: "0 0 30px rgba(255,204,51,0.5), 0 4px 20px rgba(0,0,0,0.5)",
                  }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="#111"
                    style={{ marginLeft: "3px" }}
                  >
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </motion.span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* "COMING SOON" badge */}
          <div
            className="absolute right-3 top-3 z-20 rounded-full px-3 py-1"
            style={{
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,204,51,0.25)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.52rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#ffcc33",
              }}
            >
              Full Trailer Coming Soon
            </span>
          </div>
        </div>

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
