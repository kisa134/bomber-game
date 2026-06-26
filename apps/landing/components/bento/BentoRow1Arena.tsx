"use client";

import { motion } from "framer-motion";
import { iFade, stagger, MiniStat } from "./BentoShared";

export function BentoRow1Arena() {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
      className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-4"
    >
      {/* Left — MMR Rank Card */}
      <motion.div variants={iFade} className="cyber-glass relative flex flex-col gap-3 overflow-hidden rounded-3xl p-4 lg:col-span-1">
        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, #f5c842, transparent)", opacity: 0.8 }} />

        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.22em", color: "rgba(245,200,66,0.6)", textTransform: "uppercase" }}>
          MMR System
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "-0.02em", color: "#fff" }}>
          TRUE SKILL<br />
          <span style={{ color: "#f5c842", textShadow: "0 0 14px rgba(245,200,66,0.7)" }}>RANKED LADDER</span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.55 }}>
          ELO-based rating. No pay-to-win. Season resets. Decay protection for active players.
        </p>

        {/* Tier chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "auto" }}>
          {["IRON", "BRONZE", "SILVER", "GOLD", "DIAMOND", "LEGEND"].map((tier, i) => {
            const colors = ["rgba(255,255,255,0.2)", "#f0a92a", "#8a90a0", "#ffd700", "#7fd8ff", "#ff5a4d"];
            return (
              <span
                key={tier}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.52rem", fontWeight: 700,
                  letterSpacing: "0.10em", padding: "2px 7px", borderRadius: "4px",
                  color: colors[i], background: `${colors[i]}18`, border: `1px solid ${colors[i]}35`,
                  textShadow: `0 0 6px ${colors[i]}60`,
                }}
              >
                {tier}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Centre — Live Gameplay Video */}
      <motion.div
        variants={iFade}
        className="cyber-glass relative overflow-hidden rounded-3xl p-4 lg:col-span-2 lg:p-5"
      >
        <div className="relative mb-3 flex items-center justify-between">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(245,200,66,0.6)" }}>
            LIVE ARENA
          </span>
          <span
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              borderRadius: "999px", border: "1px solid rgba(245,200,66,0.30)",
              background: "rgba(245,200,66,0.10)", padding: "2px 8px",
              fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700,
              color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.7)",
            }}
          >
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f5c842", boxShadow: "0 0 6px rgba(245,200,66,0.9)", animation: "neon-pulse 2s ease-in-out infinite", display: "inline-block" }} />
            LIVE
          </span>
        </div>

        <div className="grid grid-cols-1 items-center gap-4 xl:grid-cols-5 xl:gap-5">
          {/* Video */}
          <div className="relative xl:col-span-3">
            <div
              className="relative aspect-video overflow-hidden rounded-xl"
              style={{ border: "1px solid rgba(245,200,66,0.18)" }}
            >
              <video
                autoPlay loop muted playsInline
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: "brightness(0.85) saturate(1.2)" }}
              >
                <source src="/sprites/demo2.mp4" type="video/mp4" />
                {/* Fallback */}
                <img src="/sprites/web/gameplay-1.jpg" alt="Bombermeme gameplay" className="absolute inset-0 h-full w-full object-cover" />
              </video>

              {/* Dark vignette */}
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_48px_rgba(0,0,0,0.45)]" />

              {/* HUD corner brackets */}
              <span className="hud-bracket hud-bracket-tl" aria-hidden />
              <span className="hud-bracket hud-bracket-tr" aria-hidden />
              <span className="hud-bracket hud-bracket-bl" aria-hidden />
              <span className="hud-bracket hud-bracket-br" aria-hidden />

              {/* MMR overlay chip */}
              <div
                className="absolute bottom-2 left-2 z-10"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.08em",
                  color: "#7fd8ff", background: "rgba(0,0,0,0.65)", border: "1px solid rgba(127,216,255,0.30)",
                  backdropFilter: "blur(8px)", borderRadius: "6px", padding: "2px 8px",
                  textShadow: "0 0 8px rgba(127,216,255,0.7)",
                }}
              >
                ⚡ MMR 7,420
              </div>

              {/* Round timer */}
              <div
                className="absolute right-2 top-2 z-10"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700,
                  color: "#f0a92a", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,140,0,0.30)",
                  backdropFilter: "blur(8px)", borderRadius: "6px", padding: "2px 8px",
                  textShadow: "0 0 8px rgba(255,140,0,0.7)",
                }}
              >
                ⏱ 0:47
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 xl:col-span-2 xl:content-center">
            <MiniStat value="ELO" label="MMR SYSTEM" color="#f5c842" />
            <MiniStat value="S1"  label="RANKED SEASON" color="#7fd8ff" />
            <MiniStat value="2–8" label="PLAYERS" color="#ffd700" />
            <MiniStat value="ANTI-CHEAT" label="FAIR PLAY" mono color="#ff5a4d" />
          </div>
        </div>
      </motion.div>

      {/* Right — Smart Pools Card */}
      <motion.div variants={iFade} className="cyber-glass cyber-glass-pink relative flex flex-col gap-3 overflow-hidden rounded-3xl p-4 lg:col-span-1">
        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, #ff5a4d, transparent)", opacity: 0.8 }} />

        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.22em", color: "rgba(255,90,77,0.6)", textTransform: "uppercase" }}>
          Economy
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "-0.02em", color: "#fff" }}>
          SMART CONTRACT<br />
          <span style={{ color: "#ff5a4d", textShadow: "0 0 14px rgba(255,90,77,0.7)" }}>PRIZE POOLS</span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.55 }}>
          Funds locked in escrow. Winners paid instantly. 5% rake auto-splits: burn, yield, DAO.
        </p>

        {/* Rake breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "auto" }}>
          {[
            { label: "WINNER PAYOUT", pct: 95, color: "#f5c842" },
            { label: "BURN 🔥",        pct:  2, color: "#ff5a4d" },
            { label: "YIELD POOL",     pct: 1.5, color: "#7fd8ff" },
            { label: "DAO RESERVE",   pct: 1.5, color: "#ffd700" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ flex: 1, height: "3px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${row.pct}%`, background: row.color, borderRadius: "999px", boxShadow: `0 0 4px ${row.color}80` }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.50rem", color: row.color, minWidth: "28px", textAlign: "right", fontWeight: 700 }}>{row.pct}%</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.48rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", minWidth: "70px" }}>{row.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
