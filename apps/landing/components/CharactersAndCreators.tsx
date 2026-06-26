"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const CHARACTERS = [
  {
    src: "/sprites/skin_0.webp",
    name: "Doge",
    placeholder: "https://placehold.co/220x320/0e1018/ffcc33?text=DOGE",
    rarity: "COMMON",
    rarityColor: "#8a90a0",
    accentColor: "#ffcc33",
    stats: { winRate: "52%", kd: "1.2", rarity: "★★☆☆" },
    status: "EQUIPPED",
    duration: 3.8,
    delay: 0,
  },
  {
    src: "/sprites/skin_1.webp",
    name: "Pepe",
    placeholder: "https://placehold.co/220x320/0e1018/4ade80?text=PEPE",
    rarity: "RARE",
    rarityColor: "#f5c842",
    accentColor: "#f5c842",
    stats: { winRate: "61%", kd: "1.8", rarity: "★★★☆" },
    status: "EQUIPPED",
    duration: 4.4,
    delay: 0.6,
  },
  {
    src: "/sprites/skin_2.webp",
    name: "Trump",
    placeholder: "https://placehold.co/220x320/0e1018/ff5a5f?text=TRUMP",
    rarity: "EPIC",
    rarityColor: "#f97316",
    accentColor: "#f97316",
    stats: { winRate: "68%", kd: "2.4", rarity: "★★★★" },
    status: "LOCKED",
    duration: 4.0,
    delay: 1.1,
  },
  {
    src: "/sprites/skin_3.webp",
    name: "Elon",
    placeholder: "https://placehold.co/220x320/0e1018/a855f7?text=ELON",
    rarity: "LEGENDARY",
    rarityColor: "#a855f7",
    accentColor: "#a855f7",
    stats: { winRate: "74%", kd: "3.1", rarity: "★★★★" },
    status: "LOCKED",
    duration: 3.5,
    delay: 0.3,
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const cardFade = { hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0 } };

export function CharactersAndCreators() {
  return (
    <section className="w-full px-5 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* ── Column 1: Choose Your Fighter ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease }}
            className="bento-card relative overflow-hidden p-6 lg:p-8"
          >
            {/* Background glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 90%, rgba(255,204,51,0.05) 0%, transparent 70%)",
              }}
            />

            {/* Label + Title */}
            <div className="relative z-10 mb-5">
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#ffcc33",
                  textShadow: "0 0 10px rgba(255,204,51,0.55)",
                  marginBottom: "0.6rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "20px",
                    height: "1px",
                    background: "rgba(255,204,51,0.5)",
                  }}
                />
                Meme PvP
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  color: "#fff",
                  marginBottom: "0.5rem",
                }}
              >
                CHOOSE YOUR{" "}
                <span
                  style={{
                    background: "linear-gradient(170deg, #fff8c0 0%, #ffdf50 28%, #ffcc33 52%, #ff9a3d 78%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  FIGHTER
                </span>
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.38)",
                  lineHeight: 1.55,
                }}
              >
                Pure meme-PvP deathmatch. Each skin has unique stats.
              </p>
            </div>

            {/* Character art cards */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={stagger}
              className="relative z-10 grid grid-cols-4 gap-2.5"
            >
              {CHARACTERS.map((char) => (
                <CharacterCard key={char.name} char={char} />
              ))}
            </motion.div>
          </motion.div>

          {/* ── Column 2: For Streamers & Creators ────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease, delay: 0.12 }}
            className="relative overflow-hidden rounded-3xl p-8 lg:p-12 flex flex-col justify-between"
            style={{
              background: "rgba(16,19,34,0.72)",
              border: "1px solid rgba(245,200,66,0.18)",
              backdropFilter: "blur(14px) saturate(1.3)",
              WebkitBackdropFilter: "blur(14px) saturate(1.3)",
              boxShadow:
                "0 2px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.55), 0 0 60px rgba(245,200,66,0.06)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 55% at 50% 100%, rgba(245,200,66,0.07) 0%, transparent 70%)",
              }}
            />

            <div className="relative z-10">
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#f5c842",
                  textShadow: "0 0 10px rgba(245,200,66,0.55)",
                  marginBottom: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "24px",
                    height: "1px",
                    background: "rgba(245,200,66,0.5)",
                  }}
                />
                Creator Program
              </div>

              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  color: "#fff",
                  marginBottom: "1.25rem",
                }}
              >
                FOR STREAMERS
                <br />
                <span
                  style={{
                    color: "#f5c842",
                    textShadow: "0 0 18px rgba(245,200,66,0.7), 0 0 40px rgba(245,200,66,0.3)",
                  }}
                >
                  & CREATORS
                </span>
              </h2>

              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.95rem",
                  color: "rgba(255,255,255,0.48)",
                  lineHeight: 1.7,
                  marginBottom: "2rem",
                  maxWidth: "380px",
                }}
              >
                Turn your audience into{" "}
                <span style={{ color: "#f5c842" }}>real yield</span>. Earn up to{" "}
                <span
                  style={{
                    color: "#ffcc33",
                    fontWeight: 700,
                    textShadow: "0 0 10px rgba(255,204,51,0.5)",
                  }}
                >
                  21% of the house rake
                </span>{" "}
                through our provably fair, on-chain referral system.
              </p>

              <div className="flex gap-6 mb-8 flex-wrap">
                {[
                  { value: "5 Tiers", label: "Deep network" },
                  { value: "21%", label: "Max rake share" },
                  { value: "On-chain", label: "Guaranteed" },
                ].map((stat) => (
                  <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        color: "#f5c842",
                        textShadow: "0 0 12px rgba(245,200,66,0.6)",
                        lineHeight: 1,
                      }}
                    >
                      {stat.value}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.58rem",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.28)",
                      }}
                    >
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <Link
                href="/partners"
                className="group relative block w-full overflow-hidden rounded-2xl text-center font-bold"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.15rem",
                  letterSpacing: "0.02em",
                  color: "#0e1018",
                  background: "linear-gradient(170deg, #6ee7a0 0%, #f5c842 45%, #e0b633 100%)",
                  padding: "18px 32px",
                  textDecoration: "none",
                  boxShadow:
                    "0 4px 22px rgba(245,200,66,0.40), 0 0 60px rgba(245,200,66,0.14), inset 0 1px 0 rgba(255,255,255,0.25)",
                  transition: "box-shadow 0.18s ease, transform 0.1s ease",
                  display: "block",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 6px 32px rgba(245,200,66,0.58), 0 0 80px rgba(245,200,66,0.26), inset 0 1px 0 rgba(255,255,255,0.30)";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 4px 22px rgba(245,200,66,0.40), 0 0 60px rgba(245,200,66,0.14), inset 0 1px 0 rgba(255,255,255,0.25)";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              >
                <span className="relative z-10">Get My Link →</span>
                <span className="absolute inset-0 -translate-x-full skew-x-12 bg-white/20 transition-transform duration-500 group-hover:translate-x-[130%]" />
              </Link>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

/* ── Character Art Card ───────────────────────────────────────────────────── */

function CharacterCard({ char }: { char: (typeof CHARACTERS)[number] }) {
  const isLocked = char.status === "LOCKED";

  return (
    <motion.div
      variants={cardFade}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isLocked ? "rgba(255,255,255,0.07)" : `${char.accentColor}30`}`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: isLocked
          ? "none"
          : `0 0 20px ${char.accentColor}12`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {/* Art area */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "9/13" }}>
        {/* Placeholder full-art background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={char.placeholder}
          alt={`${char.name} character art`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: isLocked ? 0.35 : 0.6 }}
        />

        {/* Pixel sprite inset (bottom-left) */}
        <div className="absolute bottom-2 left-2 z-10">
          <Image
            src={char.src}
            alt={char.name}
            width={36}
            height={36}
            className="object-contain"
            style={{
              imageRendering: "pixelated",
              filter: `drop-shadow(0 0 6px ${char.accentColor}80)`,
              opacity: isLocked ? 0.4 : 1,
            }}
          />
        </div>

        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <span style={{ fontSize: "1.4rem", opacity: 0.6 }}>🔒</span>
          </div>
        )}

        {/* Rarity badge (top-right) */}
        <div
          className="absolute right-2 top-2 z-10 rounded-full px-2 py-0.5"
          style={{
            background: "rgba(0,0,0,0.65)",
            border: `1px solid ${char.rarityColor}40`,
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.48rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: char.rarityColor,
            }}
          >
            {char.rarity}
          </span>
        </div>

        {/* Bottom gradient fade */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/3"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
        />
      </div>

      {/* Card footer */}
      <div className="flex flex-col gap-1.5 p-2.5">
        {/* Name + status badge */}
        <div className="flex items-center justify-between gap-1">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: isLocked ? "rgba(255,255,255,0.35)" : "#fff",
            }}
          >
            {char.name}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 shrink-0"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.42rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: isLocked ? "rgba(255,255,255,0.25)" : char.accentColor,
              background: isLocked ? "rgba(255,255,255,0.05)" : `${char.accentColor}18`,
              border: `1px solid ${isLocked ? "rgba(255,255,255,0.08)" : `${char.accentColor}35`}`,
            }}
          >
            {char.status}
          </span>
        </div>

        {/* 3 mini stats */}
        <div className="grid grid-cols-3 gap-1">
          {[
            { label: "Win%", value: char.stats.winRate },
            { label: "K/D", value: char.stats.kd },
            { label: "Rank", value: char.stats.rarity },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center rounded-md py-1"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  color: isLocked ? "rgba(255,255,255,0.2)" : char.accentColor,
                  lineHeight: 1,
                }}
              >
                {s.value}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.4rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.22)",
                  marginTop: "1px",
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
