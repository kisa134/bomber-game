"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Roster data ───────────────────────────────────────────────────────── */
interface RosterChar {
  id:        string;
  name:      string;
  role:      string;
  roleColor: string;
  tier:      string;
  tierColor: string;
  sprite:    string;
  lore:      string;
  signature: string;
  specialty: string;
  winRate:   number;
  avgMMR:    number;
  pickRate:  number;
  locked:    boolean;
}

const ROSTER: RosterChar[] = [
  {
    id: "pepe", name: "PEPE", role: "TANK", roleColor: "#7fd8ff", tier: "S", tierColor: "#5ad27a",
    sprite: "/sprites/pepe/new/skin_1_side_0.webp",
    lore: "The Frog God of the Blockchain Arena. Unmovable, unbreakable.",
    signature: "BOMB CLUSTER", specialty: "AOE DENIAL", winRate: 61, avgMMR: 7_200, pickRate: 18, locked: false,
  },
  {
    id: "trump", name: "TRUMP", role: "ASSAULT", roleColor: "#f0a92a", tier: "S", tierColor: "#5ad27a",
    sprite: "/sprites/trump/new/skin_2_side_0.webp",
    lore: "The Alpha Blaster. MAGA till you're dead. Maximum aggression.",
    signature: "DEAL BREAKER", specialty: "BURST DAMAGE", winRate: 68, avgMMR: 7_840, pickRate: 14, locked: false,
  },
  {
    id: "elon", name: "ELON", role: "ASSASSIN", roleColor: "#ff5a4d", tier: "S+", tierColor: "#ff5a4d",
    sprite: "/sprites/elon/new/skin_3_side_0.webp",
    lore: "First-Principles Fragging. SpaceX-speed rotations. One-tap guaranteed.",
    signature: "NEURAL LINK BOMB", specialty: "SINGLE TARGET", winRate: 74, avgMMR: 8_420, pickRate: 9, locked: false,
  },
  {
    id: "vitalik", name: "VITALIK", role: "SUPPORT", roleColor: "#5ad27a", tier: "A", tierColor: "#7fd8ff",
    sprite: "/sprites/vitalik/skin_7_side_0.webp",
    lore: "Smart Contract Sage. Gasless kills. On-chain receipts for every frag.",
    signature: "L2 SPEEDRUN", specialty: "UTILITY CONTROL", winRate: 55, avgMMR: 6_100, pickRate: 22, locked: false,
  },
  {
    id: "doge", name: "DOGE", role: "BRUISER", roleColor: "#ffd700", tier: "A", tierColor: "#7fd8ff",
    sprite: "/sprites/doge/skin_4_side_0.webp",
    lore: "Much boom. Very dead. Such deathmatch. To the moon, then down.",
    signature: "MOON BOMB", specialty: "SUSTAINED DAMAGE", winRate: 57, avgMMR: 6_500, pickRate: 20, locked: false,
  },
  {
    id: "shiba", name: "SHIBA", role: "SUPPORT", roleColor: "#5ad27a", tier: "A", tierColor: "#7fd8ff",
    sprite: "/sprites/shiba/new/skin_0_side_0.webp",
    lore: "The loyal blade. Inu never dies alone. Zone control mastery.",
    signature: "SAMURAI SHIELD", specialty: "ZONE CONTROL", winRate: 59, avgMMR: 6_300, pickRate: 17, locked: false,
  },
  {
    id: "pumpfun", name: "PUMPFUN", role: "RANGED", roleColor: "#ffd700", tier: "B+", tierColor: "#f0a92a",
    sprite: "/sprites/pumpfun/skin_5_side_0.webp",
    lore: "Launches tokens and bombs from maximum distance. Rug incoming.",
    signature: "RUG PULL", specialty: "LONG RANGE", winRate: 53, avgMMR: 5_900, pickRate: 11, locked: false,
  },
  {
    id: "mem", name: "MEM", role: "WILDCARD", roleColor: "#f0a92a", tier: "B+", tierColor: "#f0a92a",
    sprite: "/sprites/mem/skin_8_side_0.webp",
    lore: "Chaos incarnate. Unpredictable. The meta-breaker. Nobody knows what's next.",
    signature: "CHAOS THEORY", specialty: "DISRUPTION", winRate: 50, avgMMR: 5_600, pickRate: 13, locked: false,
  },
  {
    id: "chad", name: "CHAD", role: "BRUISER", roleColor: "#ffd700", tier: "A+", tierColor: "#f0a92a",
    sprite: "/sprites/skin2/skin_10_side_0.webp",
    lore: "Gigachad energy. Absolute unit. Takes every hit, dishes out twice as much.",
    signature: "SIGMA STRIKE", specialty: "FRONTLINE BRAWL", winRate: 68, avgMMR: 7_800, pickRate: 10, locked: false,
  },
  {
    id: "bogdanoff", name: "BOGDANOFF", role: "MASTERMIND", roleColor: "#b44fff", tier: "S", tierColor: "#5ad27a",
    sprite: "/sprites/bogdanoff/skin_9_side_0.webp",
    lore: "Pulls strings from the shadows. Dump it. The market bows to Bogdanoff.",
    signature: "PUMP & DUMP", specialty: "MARKET CONTROL", winRate: 72, avgMMR: 8_100, pickRate: 8, locked: false,
  },
];

/* ── Card component ─────────────────────────────────────────────────────── */
function RosterCard({ char }: { char: RosterChar }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="relative cursor-pointer select-none"
      style={{ borderRadius: "16px" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
    >
      {/* Card glass shell */}
      <motion.div
        style={{
          position:       "relative",
          background:     "rgba(7,8,16,0.85)",
          border:         `1px solid ${hovered ? char.roleColor + "50" : "rgba(255,255,255,0.07)"}`,
          borderRadius:   "16px",
          overflow:       "hidden",
          backdropFilter: "blur(16px) saturate(1.4)",
          boxShadow:      hovered
            ? `0 0 0 1px ${char.roleColor}25, 0 24px 64px rgba(0,0,0,0.9), 0 0 40px ${char.roleColor}14`
            : "0 8px 32px rgba(0,0,0,0.7)",
          transition:     "border-color 0.22s ease, box-shadow 0.22s ease",
        }}
      >
        {/* Role-colour accent line top */}
        <div
          style={{
            position:   "absolute",
            top:        0,
            left:       "15%",
            right:      "15%",
            height:     "2px",
            background: `linear-gradient(90deg, transparent, ${char.roleColor}, transparent)`,
            opacity:    hovered ? 1 : 0.5,
            transition: "opacity 0.22s ease",
          }}
        />

        {/* Ambient glow bloom */}
        <div
          aria-hidden
          style={{
            position:   "absolute",
            inset:      0,
            background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${char.roleColor}0e 0%, transparent 65%)`,
            opacity:    hovered ? 1 : 0,
            transition: "opacity 0.3s ease",
            pointerEvents: "none",
          }}
        />

        {/* Locked overlay */}
        {char.locked && (
          <div
            style={{
              position:       "absolute",
              inset:          0,
              background:     "rgba(7,8,16,0.55)",
              backdropFilter: "blur(3px)",
              zIndex:         10,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              borderRadius:   "16px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "1.4rem" }}>🔒</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
                Season 2
              </span>
            </div>
          </div>
        )}

        {/* Tier badge — top right */}
        <div
          style={{
            position:      "absolute",
            top:           "10px",
            right:         "10px",
            zIndex:        5,
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.52rem",
            fontWeight:    700,
            letterSpacing: "0.08em",
            color:         char.tierColor,
            background:    `${char.tierColor}18`,
            border:        `1px solid ${char.tierColor}35`,
            borderRadius:  "5px",
            padding:       "2px 7px",
            textShadow:    `0 0 8px ${char.tierColor}80`,
          }}
        >
          {char.tier}
        </div>

        {/* Sprite */}
        <div
          style={{
            padding:        "20px 12px 8px",
            display:        "flex",
            justifyContent: "center",
            minHeight:      "130px",
            alignItems:     "flex-end",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={char.sprite}
            alt={char.name}
            style={{
              imageRendering: "pixelated",
              height:         "96px",
              width:          "auto",
              objectFit:      "contain",
              filter:         hovered
                ? `drop-shadow(0 0 12px ${char.roleColor}90) brightness(1.15) saturate(1.3)`
                : "drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
              transition:     "filter 0.25s ease",
            }}
          />
        </div>

        {/* Name + Role row */}
        <div style={{ padding: "0 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily:    "var(--font-heading)",
              fontWeight:    900,
              fontStyle:     "italic",
              fontSize:      "0.88rem",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              color:         "#fff",
            }}
          >
            {char.name}
          </span>
          <span
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "0.46rem",
              fontWeight:    700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         char.roleColor,
              background:    `${char.roleColor}18`,
              border:        `1px solid ${char.roleColor}30`,
              borderRadius:  "4px",
              padding:       "1.5px 5px",
              textShadow:    `0 0 6px ${char.roleColor}70`,
            }}
          >
            {char.role}
          </span>
        </div>

        {/* Win Rate bar */}
        <div style={{ padding: "0 12px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.48rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.30)", textTransform: "uppercase" }}>
              Win Rate
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.54rem", fontWeight: 700, color: char.roleColor }}>
              {char.winRate}%
            </span>
          </div>
          <div style={{ height: "3px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${char.winRate}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              style={{
                height:       "100%",
                background:   char.roleColor,
                borderRadius: "999px",
                boxShadow:    `0 0 6px ${char.roleColor}70`,
              }}
            />
          </div>
        </div>

        {/* Avg MMR */}
        <div style={{ padding: "0 12px 12px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.48rem", letterSpacing: "0.10em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
            Avg MMR:{" "}
            <span style={{ color: "#7fd8ff", fontWeight: 700, fontSize: "0.52rem", textShadow: "0 0 6px rgba(127,216,255,0.6)" }}>
              {char.avgMMR.toLocaleString()}
            </span>
          </span>
        </div>

        {/* Expandable stats panel */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              key="stats"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  margin:      "0 10px 10px",
                  borderRadius: "10px",
                  background:  `${char.roleColor}0a`,
                  border:      `1px solid ${char.roleColor}20`,
                  padding:     "8px 10px",
                  display:     "flex",
                  flexDirection: "column",
                  gap:         "5px",
                }}
              >
                {[
                  { label: "SIGNATURE", value: char.signature },
                  { label: "SPECIALTY", value: char.specialty },
                  { label: "PICK RATE", value: `${char.pickRate}%` },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.46rem", letterSpacing: "0.10em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase" }}>
                      {row.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", fontWeight: 700, color: char.roleColor, textShadow: `0 0 6px ${char.roleColor}60`, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {row.value}
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: "4px", fontFamily: "var(--font-mono)", fontSize: "0.46rem", color: "rgba(255,255,255,0.22)", lineHeight: 1.5 }}>
                  {char.lore}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const cardFade = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0 } };

export function RosterSection() {
  return (
    <section
      style={{
        background: "transparent",
        paddingTop:    "64px",
        paddingBottom: "64px",
      }}
    >
      <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 1.25rem" }}>

        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: "40px" }}
        >
          {/* Eyebrow */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "10px" }}>
            <div style={{ flex: 1, maxWidth: "60px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(90,210,122,0.4))" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(90,210,122,0.6)" }}>
              Season 1 · 10 Fighters
            </span>
            <div style={{ flex: 1, maxWidth: "60px", height: "1px", background: "linear-gradient(90deg, rgba(90,210,122,0.4), transparent)" }} />
          </div>

          <h2
            style={{
              fontFamily:    "var(--font-heading)",
              fontWeight:    900,
              fontStyle:     "italic",
              textTransform: "uppercase",
              letterSpacing: "-0.04em",
              lineHeight:    0.9,
              fontSize:      "clamp(2rem, 6vw, 4rem)",
              color:         "#fff",
              marginBottom:  "12px",
            }}
          >
            ELITE{" "}
            <span
              style={{
                background:           "linear-gradient(170deg, #5ad27a 0%, #7fd8ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor:  "transparent",
                backgroundClip:       "text",
                filter:               "drop-shadow(0 0 24px rgba(90,210,122,0.3))",
              }}
            >
              ROSTER
            </span>
          </h2>

          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize:   "0.70rem",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color:      "rgba(255,255,255,0.28)",
            }}
          >
            Choose your fighter · Master their kit · Climb the MMR ladder
          </p>
        </motion.div>

        {/* Roster grid */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap:                 "14px",
          }}
        >
          {ROSTER.map((char) => (
            <motion.div key={char.id} variants={cardFade}>
              <RosterCard char={char} />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ marginTop: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}
        >
          <a
            href="http://bombermeme.fun/play"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:       "inline-flex",
              alignItems:    "center",
              gap:           "8px",
              fontFamily:    "var(--font-display)",
              fontWeight:    700,
              fontSize:      "0.9rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
              color:         "#111",
              background:    "linear-gradient(135deg, #5ad27a 0%, #7fd8ff 100%)",
              borderRadius:  "999px",
              padding:       "13px 32px",
              boxShadow:     "0 0 32px rgba(90,210,122,0.35), 0 8px 24px rgba(0,0,0,0.6)",
              transition:    "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 48px rgba(90,210,122,0.55), 0 12px 32px rgba(0,0,0,0.7)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 32px rgba(90,210,122,0.35), 0 8px 24px rgba(0,0,0,0.6)";
            }}
          >
            ⚔ SELECT YOUR FIGHTER
          </a>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
            10 characters available · Season 1
          </span>
        </motion.div>
      </div>
    </section>
  );
}
