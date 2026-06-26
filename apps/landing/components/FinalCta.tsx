"use client";

import { motion } from "framer-motion";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function FinalCta() {
  return (
    <section className="relative w-full px-5 py-20 sm:px-8" style={{ background: "transparent" }}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease }}
        className="relative mx-auto max-w-5xl overflow-hidden p-10 text-center sm:p-14 lg:p-16"
        style={{
          borderRadius: "22px",
          background: "linear-gradient(135deg, #ff5a1f 0%, #ff8a3c 100%)",
          boxShadow: "0 40px 120px rgba(255,90,31,0.30), inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        {/* Dot-matrix overlay */}
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden />

        {/* Soft top sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Eyebrow */}
          <span
            className="mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#0a0b0e",
              background: "rgba(0,0,0,0.18)",
              border: "1px solid rgba(0,0,0,0.20)",
            }}
          >
            ● Free to play · pump.fun arena
          </span>

          {/* Huge black heading */}
          <h2
            className="detonate-heading"
            style={{
              fontSize: "clamp(2.6rem, 9vw, 6rem)",
              color: "#0a0b0e",
              textShadow: "0 2px 0 rgba(255,255,255,0.18)",
            }}
          >
            Winner takes
            <br />
            the pot.
          </h2>

          <p
            className="mt-5 max-w-md"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              letterSpacing: "0.06em",
              lineHeight: 1.6,
              color: "rgba(10,11,14,0.72)",
            }}
          >
            Last bomber standing scoops the entire prize pool. No house edge on the
            outcome. Drop in, blow up your friends, walk away rich.
          </p>

          {/* CTA buttons */}
          <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
            <a
              href="http://bombermeme.fun/play"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-9 py-4 text-center transition-transform duration-150 hover:scale-[1.03] active:scale-95"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 900,
                fontStyle: "italic",
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                fontSize: "1.05rem",
                color: "#ff5a1f",
                background: "#0a0b0e",
                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              }}
            >
              ⚡ Play Now
            </a>
            <a
              href="https://pump.fun/coin/2Lbnrt7iRx2RHGBXXXc3z8Do3bp3oZ9FtkAohLvxpump"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-9 py-4 text-center transition-transform duration-150 hover:scale-[1.03] active:scale-95"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 900,
                fontStyle: "italic",
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                fontSize: "1.05rem",
                color: "#0a0b0e",
                background: "rgba(10,11,14,0.14)",
                border: "1px solid rgba(10,11,14,0.30)",
              }}
            >
              💎 Buy $BMB
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
