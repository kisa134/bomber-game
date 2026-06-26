"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ══════════════════════════════════════════════════════════════════════════
   BRACKET DATA
══════════════════════════════════════════════════════════════════════════ */
interface BracketTeam {
  name:  string;
  char:  string;
  score: number;
  win:   boolean;
}
interface BracketMatch {
  id:     string;
  round:  "QF" | "SF" | "F";
  t1:     BracketTeam;
  t2:     BracketTeam;
  status: "completed" | "live" | "upcoming";
}

const CHAR_ICONS: Record<string, string> = {
  doge:    "🐕",
  pepe:    "🐸",
  trump:   "🦅",
  elon:    "🚀",
  shiba:   "🐾",
  vitalik: "◎",
  pumpfun: "📈",
  mem:     "💣",
};

const MATCHES: BracketMatch[] = [
  { id: "qf1", round: "QF", t1: { name: "Team Doge",    char: "doge",    score: 2, win: true  }, t2: { name: "Team Mem",     char: "mem",     score: 0, win: false }, status: "completed" },
  { id: "qf2", round: "QF", t1: { name: "Team Pepe",    char: "pepe",    score: 2, win: true  }, t2: { name: "Team Shiba",   char: "shiba",   score: 1, win: false }, status: "completed" },
  { id: "qf3", round: "QF", t1: { name: "Team Trump",   char: "trump",   score: 2, win: true  }, t2: { name: "Team Pumpfun", char: "pumpfun", score: 0, win: false }, status: "completed" },
  { id: "qf4", round: "QF", t1: { name: "Team Elon",    char: "elon",    score: 2, win: true  }, t2: { name: "Team Vitalik", char: "vitalik", score: 1, win: false }, status: "completed" },
  { id: "sf1", round: "SF", t1: { name: "Team Doge",    char: "doge",    score: 2, win: true  }, t2: { name: "Team Pepe",    char: "pepe",    score: 1, win: false }, status: "completed" },
  { id: "sf2", round: "SF", t1: { name: "Team Trump",   char: "trump",   score: 1, win: false }, t2: { name: "Team Elon",    char: "elon",    score: 2, win: true  }, status: "live"      },
  { id: "f1",  round: "F",  t1: { name: "Team Doge",    char: "doge",    score: 0, win: false }, t2: { name: "Team Elon",    char: "elon",    score: 0, win: false }, status: "upcoming"  },
];

/* ── MatchCard ───────────────────────────────────────────────────────────── */
function MatchCard({ match, compact = false }: { match: BracketMatch; compact?: boolean }) {
  const [active, setActive] = useState(false);

  const statusColor = match.status === "live" ? "#5ad27a" : match.status === "completed" ? "#7fd8ff" : "rgba(255,255,255,0.25)";
  const statusLabel = match.status === "live" ? "● LIVE" : match.status === "completed" ? "DONE" : "SOON";

  return (
    <motion.div
      onClick={() => setActive(!active)}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      style={{
        background:    active ? "rgba(90,210,122,0.06)" : "rgba(7,8,16,0.85)",
        border:        `1px solid ${active ? "rgba(90,210,122,0.40)" : statusColor + "30"}`,
        borderRadius:  compact ? "8px" : "12px",
        padding:       compact ? "6px 10px" : "10px 14px",
        cursor:        "pointer",
        minWidth:      compact ? "148px" : "180px",
        backdropFilter: "blur(10px)",
        boxShadow:     match.status === "live" ? "0 0 16px rgba(90,210,122,0.10)" : "none",
        transition:    "border-color 0.2s, background 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Status badge */}
      <div style={{ marginBottom: compact ? "4px" : "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.44rem", letterSpacing: "0.16em", color: statusColor, textShadow: match.status === "live" ? `0 0 6px ${statusColor}` : "none", animation: match.status === "live" ? "neon-pulse 2s ease-in-out infinite" : "none" }}>
          {statusLabel}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.44rem", color: "rgba(255,255,255,0.20)", letterSpacing: "0.08em" }}>
          {match.id.toUpperCase()}
        </span>
      </div>

      {/* Teams */}
      {[match.t1, match.t2].map((team) => (
        <div
          key={team.name}
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            "6px",
            padding:        "3px 0",
            opacity:        match.status === "completed" && !team.win ? 0.4 : 1,
            transition:     "opacity 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}>
            <span style={{ fontSize: compact ? "0.7rem" : "0.8rem", lineHeight: 1 }}>{CHAR_ICONS[team.char] ?? "💣"}</span>
            <span
              style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      compact ? "0.52rem" : "0.58rem",
                fontWeight:    team.win ? 700 : 400,
                color:         team.win ? "#fff" : "rgba(255,255,255,0.45)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                overflow:      "hidden",
                whiteSpace:    "nowrap",
                textOverflow:  "ellipsis",
              }}
            >
              {team.name}
            </span>
          </div>
          <span
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      compact ? "0.62rem" : "0.72rem",
              fontWeight:    700,
              color:         team.win ? "#5ad27a" : "rgba(255,255,255,0.30)",
              textShadow:    team.win ? "0 0 6px rgba(90,210,122,0.6)" : "none",
              letterSpacing: "0.04em",
            }}
          >
            {match.status === "upcoming" ? "–" : team.score}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BRACKET VIEW
══════════════════════════════════════════════════════════════════════════ */
function BracketView() {
  const qf = MATCHES.filter((m) => m.round === "QF");
  const sf = MATCHES.filter((m) => m.round === "SF");
  const f  = MATCHES.filter((m) => m.round === "F");

  const CARD_H    = 90;
  const CARD_GAP  = 14;
  const COL_GAP   = 52;
  const CARD_W    = 180;
  const STROKE    = "#5ad27a";

  const qfPositions = qf.map((_, i) => (CARD_H + CARD_GAP) * i + CARD_H / 2);
  const sfPositions = [
    (qfPositions[0] + qfPositions[1]) / 2,
    (qfPositions[2] + qfPositions[3]) / 2,
  ];
  const fPosition = (sfPositions[0] + sfPositions[1]) / 2;

  const totalH = (CARD_H + CARD_GAP) * 4 - CARD_GAP;
  const col1X  = 0;
  const col2X  = CARD_W + COL_GAP;
  const col3X  = col2X + CARD_W + COL_GAP;
  const svgW   = col3X + CARD_W;

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ position: "relative", width: svgW, minHeight: totalH, margin: "0 auto" }}>
        {/* QF cards */}
        {qf.map((m, i) => (
          <div key={m.id} style={{ position: "absolute", left: col1X, top: (CARD_H + CARD_GAP) * i, width: CARD_W }}>
            <MatchCard match={m} compact />
          </div>
        ))}

        {/* SF cards */}
        {sf.map((m, i) => (
          <div key={m.id} style={{ position: "absolute", left: col2X, top: sfPositions[i] - CARD_H / 2, width: CARD_W }}>
            <MatchCard match={m} compact />
          </div>
        ))}

        {/* Final card */}
        {f.map((m) => (
          <div key={m.id} style={{ position: "absolute", left: col3X, top: fPosition - CARD_H / 2, width: CARD_W }}>
            <MatchCard match={m} compact />
          </div>
        ))}

        {/* SVG connecting lines */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          viewBox={`0 0 ${svgW} ${totalH}`}
          preserveAspectRatio="none"
        >
          {/* QF → SF */}
          {qfPositions.map((y, i) => {
            const sfY  = sfPositions[Math.floor(i / 2)];
            const midX = col1X + CARD_W + COL_GAP / 2;
            return (
              <path
                key={`qf-sf-${i}`}
                d={`M${col1X + CARD_W},${y} H${midX} V${sfY} H${col2X}`}
                stroke={STROKE}
                strokeWidth="1"
                fill="none"
                strokeOpacity="0.25"
                strokeDasharray="4 3"
              />
            );
          })}
          {/* SF → F */}
          {sfPositions.map((y, i) => {
            const midX = col2X + CARD_W + COL_GAP / 2;
            return (
              <path
                key={`sf-f-${i}`}
                d={`M${col2X + CARD_W},${y} H${midX} V${fPosition} H${col3X}`}
                stroke={STROKE}
                strokeWidth="1.5"
                fill="none"
                strokeOpacity="0.35"
                strokeDasharray="5 3"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   COUNTDOWN TIMER
══════════════════════════════════════════════════════════════════════════ */
function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const d  = Math.floor(remaining / 86_400_000);
  const h  = Math.floor((remaining % 86_400_000) / 3_600_000);
  const m  = Math.floor((remaining % 3_600_000) / 60_000);
  const s  = Math.floor((remaining % 60_000) / 1000);
  return { d, h, m, s };
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div
        style={{
          fontFamily:    "var(--font-heading)",
          fontWeight:    900,
          fontStyle:     "italic",
          fontSize:      "clamp(2rem, 6vw, 4.5rem)",
          letterSpacing: "-0.05em",
          lineHeight:    0.9,
          color:         "#5ad27a",
          textShadow:    "0 0 32px rgba(90,210,122,0.7), 0 0 64px rgba(90,210,122,0.3)",
          minWidth:      "2ch",
          textAlign:     "center",
        }}
      >
        {String(value).padStart(2, "0")}
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.50rem", letterSpacing: "0.20em", color: "rgba(90,210,122,0.45)", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STREAM EMBED
══════════════════════════════════════════════════════════════════════════ */
function StreamEmbed() {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(90,210,122,0.18)",
        background: "transparent",
        boxShadow: "0 24px 64px rgba(0,0,0,0.9), 0 0 48px rgba(90,210,122,0.06)",
      }}
    >
      {/* Placeholder stream frame */}
      <div style={{ position: "relative", aspectRatio: "16/9", background: "linear-gradient(135deg, #0a0c14 0%, #0e1020 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Scanlines */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(90,210,122,0.015) 3px, rgba(90,210,122,0.015) 4px)", pointerEvents: "none" }} />

        {/* Fake stream preview */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "3rem", filter: "drop-shadow(0 0 24px rgba(90,210,122,0.6))" }}>⚔</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1rem, 3vw, 2rem)", color: "#fff", textTransform: "uppercase", letterSpacing: "-0.03em" }}>
            GRAND FINALS STREAM
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.10em", textAlign: "center" }}>
            Team Doge vs Team Elon · $500,000 on the line
          </div>
          <a
            href="https://twitch.tv"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              fontFamily: "var(--font-mono)", fontSize: "0.66rem", fontWeight: 700,
              color: "#111", background: "#9146ff", borderRadius: "8px",
              padding: "8px 18px", textDecoration: "none", letterSpacing: "0.04em",
              textTransform: "uppercase",
              boxShadow: "0 0 24px rgba(145,70,255,0.5)",
            }}
          >
            ▶ Watch on Twitch
          </a>
        </div>
      </div>

      {/* LIVE badge overlay */}
      <div
        style={{
          position: "absolute", top: "14px", left: "14px",
          display: "flex", alignItems: "center", gap: "5px",
          fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: "#5ad27a", background: "rgba(0,0,0,0.75)",
          border: "1px solid rgba(90,210,122,0.40)",
          backdropFilter: "blur(8px)", borderRadius: "6px",
          padding: "4px 10px",
          textShadow: "0 0 8px rgba(90,210,122,0.8)",
          animation: "neon-pulse 2s ease-in-out infinite",
        }}
      >
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#5ad27a", boxShadow: "0 0 6px rgba(90,210,122,0.9)", display: "inline-block" }} />
        LIVE
      </div>

      {/* Viewer count */}
      <div
        style={{
          position: "absolute", top: "14px", right: "14px",
          fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700,
          color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(8px)", borderRadius: "6px",
          padding: "4px 10px", letterSpacing: "0.08em",
        }}
      >
        👁 24,183 viewers
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TMA MATCHMAKING LOBBY MOCK
══════════════════════════════════════════════════════════════════════════ */
type GameMode = "casual" | "ranked" | "tournament";

function MatchmakingLobby() {
  const [mode, setMode]       = useState<GameMode>("ranked");
  const [searching, setSearch] = useState(false);
  const [queueSize, setQueue] = useState(3);
  const [dots, setDots]       = useState("");

  useEffect(() => {
    if (!searching) return;
    const qi = setInterval(() => setQueue((q) => q + Math.floor(Math.random() * 3)), 4000);
    const di = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 500);
    return () => { clearInterval(qi); clearInterval(di); };
  }, [searching]);

  const MODE_CONFIG: Record<GameMode, { label: string; color: string; prize: string; desc: string }> = {
    casual:     { label: "CASUAL",     color: "#7fd8ff", prize: "No entry fee",  desc: "Practice mode · No MMR stakes · Open to all ranks" },
    ranked:     { label: "RANKED",     color: "#5ad27a", prize: "$5–$500 pool",  desc: "Skill-matched · MMR gains/losses · Season points" },
    tournament: { label: "TOURNAMENT", color: "#ff5a4d", prize: "$500,000 pool", desc: "Bracket entry · ELO required: 6,000+ · 8-team format" },
  };

  const cfg = MODE_CONFIG[mode];

  return (
    <div
      style={{
        maxWidth: "480px", margin: "0 auto",
        background: "rgba(7,8,16,0.92)", border: `1px solid ${cfg.color}25`,
        borderRadius: "20px", padding: "24px",
        backdropFilter: "blur(20px)",
        boxShadow: `0 24px 72px rgba(0,0,0,0.95), 0 0 40px ${cfg.color}08`,
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
      }}
    >
      {/* TMA Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <span style={{ fontSize: "1.1rem" }}>📱</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
          Telegram Mini App · Matchmaking
        </span>
      </div>

      {/* Mode selector */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.30)", textTransform: "uppercase", marginBottom: "8px" }}>
          Select Mode
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {(Object.keys(MODE_CONFIG) as GameMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSearch(false); }}
              style={{
                flex:          1,
                fontFamily:    "var(--font-mono)",
                fontSize:      "0.52rem",
                fontWeight:    700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color:         mode === m ? "#111" : MODE_CONFIG[m].color,
                background:    mode === m ? MODE_CONFIG[m].color : `${MODE_CONFIG[m].color}10`,
                border:        `1px solid ${MODE_CONFIG[m].color}${mode === m ? "ff" : "30"}`,
                borderRadius:  "8px",
                padding:       "8px 4px",
                cursor:        "pointer",
                textShadow:    mode === m ? "none" : `0 0 6px ${MODE_CONFIG[m].color}60`,
                boxShadow:     mode === m ? `0 0 16px ${MODE_CONFIG[m].color}50` : "none",
                transition:    "all 0.2s ease",
              }}
            >
              {MODE_CONFIG[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode info */}
      <div
        style={{
          background:    `${cfg.color}08`,
          border:        `1px solid ${cfg.color}18`,
          borderRadius:  "10px",
          padding:       "12px",
          marginBottom:  "20px",
          transition:    "all 0.3s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "1.1rem", color: "#fff", textTransform: "uppercase", letterSpacing: "-0.02em" }}>
            {cfg.label}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700, color: cfg.color, textShadow: `0 0 8px ${cfg.color}80`, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, borderRadius: "6px", padding: "2px 8px" }}>
            {cfg.prize}
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.5, letterSpacing: "0.04em" }}>
          {cfg.desc}
        </p>
      </div>

      {/* Searching UI */}
      <AnimatePresence mode="wait">
        {!searching ? (
          <motion.button
            key="find"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => setSearch(true)}
            style={{
              width:         "100%",
              fontFamily:    "var(--font-display)",
              fontWeight:    700,
              fontSize:      "0.95rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color:         "#111",
              background:    `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.color}cc 100%)`,
              border:        "none",
              borderRadius:  "12px",
              padding:       "14px",
              cursor:        "pointer",
              boxShadow:     `0 0 24px ${cfg.color}50, 0 8px 20px rgba(0,0,0,0.6)`,
              transition:    "transform 0.1s ease, box-shadow 0.1s ease",
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            ⚔ FIND MATCH
          </motion.button>
        ) : (
          <motion.div
            key="searching"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {/* Searching animation */}
            <div
              style={{
                border:        `1px solid ${cfg.color}30`,
                borderRadius:  "12px",
                padding:       "16px",
                background:    `${cfg.color}05`,
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           "8px",
              }}
            >
              {/* Spinning radar */}
              <div
                style={{
                  width:        "40px",
                  height:       "40px",
                  borderRadius: "50%",
                  border:       `2px solid ${cfg.color}30`,
                  borderTopColor: cfg.color,
                  animation:    "connecting-spin 1s linear infinite",
                  boxShadow:    `0 0 12px ${cfg.color}40`,
                }}
              />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.70rem", fontWeight: 700, color: cfg.color, textShadow: `0 0 8px ${cfg.color}80`, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                SEARCHING{dots}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
                {queueSize} players in queue · Est. 12s
              </div>
            </div>

            {/* Cancel */}
            <button
              onClick={() => { setSearch(false); setQueue(3); }}
              style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "0.58rem",
                fontWeight:    700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color:         "rgba(255,255,255,0.30)",
                background:    "transparent",
                border:        "1px solid rgba(255,255,255,0.08)",
                borderRadius:  "8px",
                padding:       "8px",
                cursor:        "pointer",
                transition:    "all 0.2s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ff5a4d"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,90,77,0.35)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.30)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              ✕ Cancel Search
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   UPCOMING TOURNAMENTS TABLE
══════════════════════════════════════════════════════════════════════════ */
const UPCOMING_TOURNAMENTS = [
  { name: "DAILY DEATHMATCH",      prize: "$1,000",    start: "Today 20:00 UTC",   slots: "32/32", status: "FULL",    color: "#ffd700" },
  { name: "WEEKLY RANKED CUP",     prize: "$10,000",   start: "Sat 14:00 UTC",     slots: "28/64", status: "OPEN",    color: "#5ad27a" },
  { name: "THE INTERNATIONAL S1",  prize: "$500,000",  start: "Jul 14 · 16:00 UTC",slots: "8/8",   status: "INVITE",  color: "#ff5a4d" },
  { name: "COMMUNITY BLAST",       prize: "$500",      start: "Tomorrow 18:00 UTC",slots: "12/32", status: "OPEN",    color: "#7fd8ff" },
];

function TournamentTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 6px" }}>
        <thead>
          <tr>
            {["TOURNAMENT", "PRIZE POOL", "STARTS", "SLOTS", "STATUS"].map((h) => (
              <th
                key={h}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.50rem", fontWeight: 700,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.25)", textAlign: "left",
                  padding: "0 12px 8px",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPCOMING_TOURNAMENTS.map((t) => (
            <motion.tr
              key={t.name}
              whileHover={{ scale: 1.01 }}
              style={{ cursor: "pointer" }}
            >
              {[
                <span key="n" style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "0.80rem", color: "#fff", textTransform: "uppercase", letterSpacing: "-0.01em" }}>{t.name}</span>,
                <span key="p" style={{ fontFamily: "var(--font-mono)", fontSize: "0.70rem", fontWeight: 700, color: t.color, textShadow: `0 0 8px ${t.color}80` }}>{t.prize}</span>,
                <span key="s" style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "rgba(255,255,255,0.45)" }}>{t.start}</span>,
                <span key="sl" style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", color: "rgba(255,255,255,0.40)" }}>{t.slots}</span>,
                <span key="st" style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: t.status === "FULL" ? "#ff5a4d" : t.status === "INVITE" ? "#f0a92a" : "#5ad27a", background: `${t.status === "FULL" ? "#ff5a4d" : t.status === "INVITE" ? "#f0a92a" : "#5ad27a"}18`, border: `1px solid ${t.status === "FULL" ? "#ff5a4d" : t.status === "INVITE" ? "#f0a92a" : "#5ad27a"}30`, borderRadius: "5px", padding: "2px 8px" }}>{t.status}</span>,
              ].map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding:       "10px 12px",
                    background:    ci === 0 ? "rgba(7,8,16,0.80)" : "rgba(7,8,16,0.70)",
                    borderTop:     "1px solid rgba(255,255,255,0.04)",
                    borderBottom:  "1px solid rgba(255,255,255,0.04)",
                    borderLeft:    ci === 0 ? `2px solid ${t.color}40` : "none",
                    borderRight:   "none",
                    borderRadius:  ci === 0 ? "8px 0 0 8px" : ci === 4 ? "0 8px 8px 0" : "0",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {cell}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function TournamentsPage() {
  const bannerRef = useRef<HTMLDivElement>(null);

  // Target: 3 days, 14h, 22m from now
  const TARGET_MS = Date.now() + (3 * 86_400_000 + 14 * 3_600_000 + 22 * 60_000);
  const { d, h, m, s } = useCountdown(TARGET_MS);

  useEffect(() => {
    if (!bannerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".banner-headline",
        { opacity: 0, y: 60, skewY: 3 },
        { opacity: 1, y: 0, skewY: 0, duration: 1.0, ease: "power4.out", stagger: 0.12, delay: 0.2 },
      );
      gsap.fromTo(
        ".banner-sub",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.6, stagger: 0.08 },
      );
    }, bannerRef);
    return () => ctx.revert();
  }, []);

  return (
    <main
      style={{
        minHeight:  "100vh",
        background: "transparent",
        paddingTop: "80px",
      }}
    >
      {/* ── HERO BANNER ────────────────────────────────────────────────── */}
      <section
        ref={bannerRef}
        style={{ position: "relative", overflow: "hidden", padding: "64px 24px 72px" }}
      >

        {/* Background ambience */}
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(90,210,122,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(90,210,122,0.25), transparent)" }} />

        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          {/* Eyebrow */}
          <div className="banner-sub" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ flex: 1, maxWidth: "80px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,90,77,0.5))" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,90,77,0.7)" }}>
              ● Season 1 · Grand Championship
            </span>
            <div style={{ flex: 1, maxWidth: "80px", height: "1px", background: "linear-gradient(90deg, rgba(255,90,77,0.5), transparent)" }} />
          </div>

          {/* Title */}
          <h1
            className="banner-headline"
            style={{
              fontFamily:    "var(--font-heading)",
              fontWeight:    900,
              fontStyle:     "italic",
              textTransform: "uppercase",
              letterSpacing: "-0.05em",
              lineHeight:    0.88,
              fontSize:      "clamp(2.2rem, 8vw, 6rem)",
              color:         "#fff",
              marginBottom:  "8px",
            }}
          >
            THE
            <br />
            <span
              style={{
                background:           "linear-gradient(170deg, #ff5a4d 0%, #f0a92a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor:  "transparent",
                backgroundClip:       "text",
                filter:               "drop-shadow(0 0 40px rgba(255,90,77,0.4))",
              }}
            >
              INTERNATIONAL
            </span>
          </h1>

          <div
            className="banner-headline"
            style={{
              fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "clamp(0.65rem, 2vw, 0.85rem)",
              letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
              marginBottom: "32px",
            }}
          >
            Season 1 · Prize Pool:{" "}
            <span style={{ color: "#ffd700", textShadow: "0 0 12px rgba(255,215,0,0.8)", fontWeight: 700 }}>$500,000</span>
          </div>

          {/* Countdown */}
          <div className="banner-sub" style={{ marginBottom: "32px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.18em", color: "rgba(90,210,122,0.5)", textTransform: "uppercase", marginBottom: "12px" }}>
              Bracket Locks In
            </div>
            <div
              style={{
                display:        "inline-flex",
                alignItems:     "center",
                gap:            "clamp(12px, 3vw, 32px)",
                background:     "rgba(7,8,16,0.85)",
                border:         "1px solid rgba(90,210,122,0.15)",
                borderRadius:   "16px",
                padding:        "16px 32px",
                backdropFilter: "blur(16px)",
                boxShadow:      "0 0 48px rgba(90,210,122,0.06), 0 24px 64px rgba(0,0,0,0.8)",
              }}
            >
              <CountdownBlock value={d} label="Days" />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.5rem, 4vw, 3rem)", color: "rgba(90,210,122,0.25)", lineHeight: 0.9 }}>:</span>
              <CountdownBlock value={h} label="Hours" />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.5rem, 4vw, 3rem)", color: "rgba(90,210,122,0.25)", lineHeight: 0.9 }}>:</span>
              <CountdownBlock value={m} label="Minutes" />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.5rem, 4vw, 3rem)", color: "rgba(90,210,122,0.25)", lineHeight: 0.9 }}>:</span>
              <CountdownBlock value={s} label="Seconds" />
            </div>
          </div>

          {/* CTAs */}
          <div className="banner-sub" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="http://bombermeme.fun/play"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.90rem",
                letterSpacing: "0.04em", textTransform: "uppercase",
                color: "#111", background: "linear-gradient(135deg, #ff5a4d 0%, #f0a92a 100%)",
                borderRadius: "999px", padding: "13px 28px", textDecoration: "none",
                boxShadow: "0 0 32px rgba(255,90,77,0.4), 0 8px 24px rgba(0,0,0,0.6)",
              }}
            >
              🏆 Register Team
            </a>
            <a
              href="#bracket"
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.90rem",
                letterSpacing: "0.04em", textTransform: "uppercase",
                color: "#5ad27a", background: "rgba(90,210,122,0.08)",
                border: "1px solid rgba(90,210,122,0.30)",
                borderRadius: "999px", padding: "13px 28px", textDecoration: "none",
                boxShadow: "0 0 16px rgba(90,210,122,0.10)",
              }}
            >
              ▶ View Bracket
            </a>
          </div>
        </div>
      </section>

      {/* ── CONTENT ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ── BRACKET ────────────────────────────────────────────────── */}
        <motion.div
          id="bracket"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: "64px" }}
        >
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", fontSize: "clamp(1.2rem, 3vw, 1.8rem)", letterSpacing: "-0.03em", color: "#fff" }}>
              LIVE{" "}
              <span style={{ color: "#5ad27a", textShadow: "0 0 16px rgba(90,210,122,0.7)" }}>BRACKET</span>
            </h2>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(90,210,122,0.3), transparent)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.50rem", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(90,210,122,0.6)", textTransform: "uppercase", background: "rgba(90,210,122,0.08)", border: "1px solid rgba(90,210,122,0.20)", borderRadius: "5px", padding: "3px 8px" }}>
              Double Elimination
            </span>
          </div>

          {/* Round labels */}
          <div style={{ display: "grid", gridTemplateColumns: "180px 52px 180px 52px 180px", marginBottom: "8px", opacity: 0.5 }}>
            {["QUARTER FINALS", "", "SEMI FINALS", "", "GRAND FINAL"].map((label, i) => (
              <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "0.46rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(90,210,122,0.55)", textAlign: i % 2 === 0 ? "center" : "center" }}>
                {label}
              </div>
            ))}
          </div>

          <div
            style={{
              background:     "rgba(7,8,16,0.70)",
              border:         "1px solid rgba(90,210,122,0.08)",
              borderRadius:   "16px",
              padding:        "24px",
              backdropFilter: "blur(12px)",
            }}
          >
            <BracketView />
          </div>
        </motion.div>

        {/* ── STREAM + MATCHMAKING (2 cols) ──────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px", marginBottom: "64px" }}>

          {/* Stream */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", fontSize: "clamp(1.2rem, 3vw, 1.6rem)", letterSpacing: "-0.03em", color: "#fff" }}>
                LIVE{" "}
                <span style={{ color: "#9146ff", textShadow: "0 0 16px rgba(145,70,255,0.7)" }}>STREAM</span>
              </h2>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(145,70,255,0.3), transparent)" }} />
            </div>
            <StreamEmbed />
          </motion.div>
        </div>

        {/* ── UPCOMING TOURNAMENTS ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: "64px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", fontSize: "clamp(1.2rem, 3vw, 1.6rem)", letterSpacing: "-0.03em", color: "#fff" }}>
              UPCOMING{" "}
              <span style={{ color: "#ffd700", textShadow: "0 0 16px rgba(255,215,0,0.7)" }}>EVENTS</span>
            </h2>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(255,215,0,0.3), transparent)" }} />
          </div>
          <div
            style={{
              background:     "rgba(7,8,16,0.70)",
              border:         "1px solid rgba(255,215,0,0.06)",
              borderRadius:   "16px",
              padding:        "20px",
              backdropFilter: "blur(12px)",
            }}
          >
            <TournamentTable />
          </div>
        </motion.div>

        {/* ── TMA MATCHMAKING LOBBY ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", justifyContent: "center" }}>
            <div style={{ flex: 1, maxWidth: "120px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(127,216,255,0.3))" }} />
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", fontSize: "clamp(1.2rem, 3vw, 1.6rem)", letterSpacing: "-0.03em", color: "#fff", textAlign: "center" }}>
              TMA{" "}
              <span style={{ color: "#7fd8ff", textShadow: "0 0 16px rgba(127,216,255,0.7)" }}>MATCHMAKING</span>
            </h2>
            <div style={{ flex: 1, maxWidth: "120px", height: "1px", background: "linear-gradient(90deg, rgba(127,216,255,0.3), transparent)" }} />
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em", textAlign: "center", marginBottom: "24px" }}>
            Full ranked matchmaking inside Telegram — no app switching required
          </p>
          <MatchmakingLobby />
        </motion.div>
      </div>
    </main>
  );
}
