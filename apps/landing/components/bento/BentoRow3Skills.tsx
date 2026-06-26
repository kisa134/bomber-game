"use client";

import { motion } from "framer-motion";
import { iFade } from "./BentoShared";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.42 } },
};

interface PillarCard {
  icon:     string;
  eyebrow:  string;
  title:    string;
  titleHl:  string;
  body:     string;
  color:    string;
  stats:    { value: string; label: string }[];
}

const PILLARS: PillarCard[] = [
  {
    icon:    "⚔",
    eyebrow: "Ranked Matchmaking",
    title:   "TRUE SKILL",
    titleHl: "NO LUCK",
    body:    "ELO-based MMR. Anti-smurf detection. Season leaderboards. Performance-based rank decay — only the consistently skilled climb.",
    color:   "#f5c842",
    stats:   [
      { value: "ELO + MMR", label: "RATING SYSTEM" },
      { value: "Anti-Smurf", label: "DETECTION" },
    ],
  },
  {
    icon:    "💰",
    eyebrow: "Smart Contract Economy",
    title:   "SMART",
    titleHl: "PRIZE POOLS",
    body:    "Every match pot is locked in a Solana escrow before the game starts. Winners receive 95% instantly, no trust required. The rake auto-burns, yields, and governs.",
    color:   "#ff5a4d",
    stats:   [
      { value: "95%", label: "WINNER SHARE" },
      { value: "0-TRUST", label: "ESCROW" },
    ],
  },
  {
    icon:    "📱",
    eyebrow: "Telegram Mini App",
    title:   "TMA",
    titleHl: "MATCHMAKING",
    body:    "Full esports lobby inside Telegram. Find ranked matches, spectate live games, manage your guild, and collect prize payouts — without ever leaving the app.",
    color:   "#7fd8ff",
    stats:   [
      { value: "Telegram", label: "NATIVE APP" },
      { value: "<0.5s", label: "QUEUE TIME" },
    ],
  },
];

export function BentoRow3Skills() {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {PILLARS.map((p) => (
        <motion.div
          key={p.title}
          variants={iFade}
          className="cyber-glass group relative overflow-hidden rounded-3xl p-4 lg:p-5"
          style={{
            borderColor:  `${p.color}18`,
            transition:   "border-color 0.25s ease, box-shadow 0.25s ease",
          }}
          whileHover={{
            borderColor: `${p.color}40`,
            boxShadow:   `0 24px 72px rgba(0,0,0,0.75), 0 0 32px ${p.color}12`,
          }}
        >
          {/* Accent top line */}
          <div
            aria-hidden
            style={{
              position: "absolute", top: 0, left: "20%", right: "20%",
              height: "2px",
              background: `linear-gradient(90deg, transparent, ${p.color}, transparent)`,
              opacity: 0.6,
            }}
          />

          {/* Corner glow on hover */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: `radial-gradient(ellipse 70% 60% at 50% 100%, ${p.color}10 0%, transparent 70%)`,
            }}
          />

          {/* Icon */}
          <div
            className="mb-3"
            style={{
              fontSize:   "1.6rem",
              lineHeight: 1,
              filter:     `drop-shadow(0 0 12px ${p.color}80)`,
            }}
          >
            {p.icon}
          </div>

          {/* Eyebrow */}
          <div
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "0.55rem",
              fontWeight:    700,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color:         `${p.color}80`,
              marginBottom:  "0.4rem",
            }}
          >
            {p.eyebrow}
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily:    "var(--font-heading)",
              fontWeight:    900,
              fontStyle:     "italic",
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
              lineHeight:    0.9,
              fontSize:      "clamp(1.1rem, 2.5vw, 1.4rem)",
              color:         "#fff",
              marginBottom:  "0.75rem",
            }}
          >
            {p.title}{" "}
            <span style={{ color: p.color, textShadow: `0 0 16px ${p.color}80` }}>
              {p.titleHl}
            </span>
          </h3>

          {/* Body */}
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize:   "0.65rem",
              lineHeight: 1.60,
              color:      "rgba(255,255,255,0.40)",
              marginBottom: "1rem",
            }}
          >
            {p.body}
          </p>

          {/* Stat chips */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {p.stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background:    `${p.color}10`,
                  border:        `1px solid ${p.color}25`,
                  borderRadius:  "6px",
                  padding:       "3px 8px",
                  display:       "flex",
                  flexDirection: "column",
                  alignItems:    "center",
                }}
              >
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", fontWeight: 700, color: p.color, textShadow: `0 0 8px ${p.color}60` }}>
                  {s.value}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.46rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.24)" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
