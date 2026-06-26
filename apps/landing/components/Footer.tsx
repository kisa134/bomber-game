"use client";

import { motion } from "framer-motion";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const NAV_LINKS = [
  { label: "Arena",       href: "http://bombermeme.fun/play" },
  { label: "Partners",    href: "/partners" },
  { label: "FAQ",         href: "/faq" },
  { label: "Tokenomics",  href: "/tokenomics" },
];

const SOCIALS = [
  { label: "X / Twitter",        href: "https://x.com/BombermemeFun",      glyph: "𝕏" },
  { label: "Telegram",           href: "https://t.me/BombermemeFun",       glyph: "✈" },
  { label: "Telegram Community", href: "https://t.me/Bombermeme_Fun",      glyph: "✈" },
  { label: "Telegram APP game",  href: "https://t.me/bombermeme_bot",      glyph: "🤖" },
  { label: "Pump.fun",           href: "https://pump.fun",                 glyph: "⚡" },
];

export function Footer() {
  return (
    <footer
      className="relative overflow-hidden"
      style={{ background: "transparent" }}
    >
      {/* ── Atmospheric bloom from phase-4 purple ──────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 35% at 50% 0%, rgba(168,85,247,0.09) 0%, transparent 65%)",
        }}
      />

      {/* ── Connecting fuse line (purple → cyan) ───────────────────────────── */}
      <div className="relative flex flex-col items-center">
        {/* Dim track — always visible, matches roadmap style */}
        <div
          aria-hidden
          className="pointer-events-none hidden md:block"
          style={{
            width: 2,
            height: 160,
            background: "rgba(255,255,255,0.06)",
          }}
        />

        {/* Animated glowing fill */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 hidden md:block"
          style={{ width: 2, height: 160, overflow: "hidden" }}
        >
          <motion.div
            initial={{ height: 0 }}
            whileInView={{ height: 160 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 1.1, ease }}
            style={{
              width: "100%",
              background: "linear-gradient(to bottom, #a855f7 0%, #22d3ee 100%)",
              boxShadow: "0 0 14px 3px rgba(168,85,247,0.65)",
            }}
          />
        </div>

        {/* Tip — glowing cyan dot */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ delay: 0.95, duration: 0.4, ease }}
          className="relative hidden h-3 w-3 items-center justify-center md:flex"
        >
          <span
            className="absolute h-full w-full animate-ping rounded-full"
            style={{ background: "#22d3ee", opacity: 0.55 }}
          />
          <span
            className="relative h-3 w-3 rounded-full"
            style={{
              background: "#22d3ee",
              boxShadow:
                "0 0 0 2px rgba(34,211,238,0.2), 0 0 18px 5px rgba(34,211,238,0.75)",
            }}
          />
        </motion.div>

        {/* "The fuse is lit" label */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ delay: 1.05, duration: 0.65, ease }}
          className="mt-3 text-center"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            letterSpacing: "0.24em",
            color: "rgba(34,211,238,0.6)",
            textTransform: "uppercase",
          }}
        >
          More phases incoming · The fuse is lit
        </motion.p>
      </div>

      {/* ── Footer grid ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.85, ease, delay: 0.1 }}
        className="relative z-10 mx-auto max-w-5xl px-5 sm:px-8"
        style={{ marginTop: "4.5rem" }}
      >
        {/* Divider */}
        <div
          className="mb-14"
          style={{
            height: 1,
            background:
              "linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)",
          }}
        />

        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[2fr,1fr,1fr]">

          {/* ── Brand ──────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Logo wordmark */}
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.45rem",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                  textShadow: "0 0 22px rgba(255,204,51,0.32)",
                }}
              >
                BOMBER
                <span style={{ color: "#ffcc33" }}>MEME</span>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.52rem",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#ffcc33",
                  background: "rgba(255,204,51,0.10)",
                  border: "1px solid rgba(255,204,51,0.22)",
                  borderRadius: "999px",
                  padding: "2px 8px",
                }}
              >
                Beta
              </span>
            </div>

            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1.65,
                maxWidth: "24ch",
              }}
            >
              Provably fair meme‑PvP on Solana. Blow up your friends. Winner takes the pot.
            </p>

            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.58rem",
                letterSpacing: "0.13em",
                color: "rgba(255,255,255,0.16)",
                textTransform: "uppercase",
                marginTop: "0.25rem",
              }}
            >
              © 2026 Bombermeme. All rights reserved.
            </p>
          </div>

          {/* ── Navigate ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3.5">
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.58rem",
                letterSpacing: "0.22em",
                color: "rgba(255,255,255,0.22)",
                textTransform: "uppercase",
                marginBottom: "0.15rem",
              }}
            >
              Navigate
            </p>
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="group w-fit"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.9rem",
                  color: "rgba(255,255,255,0.4)",
                  textDecoration: "none",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color = "#22d3ee")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(255,255,255,0.4)")
                }
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* ── Community ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3.5">
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.58rem",
                letterSpacing: "0.22em",
                color: "rgba(255,255,255,0.22)",
                textTransform: "uppercase",
                marginBottom: "0.15rem",
              }}
            >
              Community
            </p>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.9rem",
                  color: "rgba(255,255,255,0.4)",
                  textDecoration: "none",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color = "#22d3ee")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(255,255,255,0.4)")
                }
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.18)",
                    minWidth: "1rem",
                    textAlign: "center",
                  }}
                >
                  {s.glyph}
                </span>
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Bottom rule + legal strip ───────────────────────────────────── */}
        <div
          className="mt-16"
          style={{
            height: 1,
            background:
              "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)",
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 py-8">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.56rem",
              letterSpacing: "0.13em",
              color: "rgba(255,255,255,0.12)",
              textTransform: "uppercase",
            }}
          >
            Built on Solana · Powered by pump.fun · sha256 provably fair
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.56rem",
              letterSpacing: "0.13em",
              color: "rgba(255,255,255,0.12)",
              textTransform: "uppercase",
            }}
          >
            Risk: play only what you can lose
          </p>
        </div>
      </motion.div>
    </footer>
  );
}
