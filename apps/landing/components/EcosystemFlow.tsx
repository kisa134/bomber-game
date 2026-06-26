"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

/* ── Node definition ──────────────────────────────────────────────────────── */
interface Node {
  cx: number; cy: number; w: number; h: number;
  label: string; sub?: string; color: string; icon: string;
  phase2?: boolean;
}

/**
 * Model B Layout (viewBox 0 0 1060 440):
 *
 *   PLAYERS (85,190) ──► MATCH POT (480,190)
 *                              │
 *                   ┌──────────┴──────────┐
 *                   │                     │
 *           WINNER (240,100)       5% RAKE (720,290)
 *                                         │
 *        ┌─────────┬──────────────────────┼──────────────┬──────────┐
 *        │         │                      │              │          │
 *     BURN(480) YIELD🔒(600)        ECOSYSTEM(720)  GUILD(840)  DAO🔒(960)
 *      active   phase 2                active         active    phase 2
 */
const NODES: Record<string, Node> = {
  players:   { cx: 85,  cy: 190, w: 140, h: 66,  label: "PLAYERS",       sub: "Entry Pool",    color: "#5ad27a", icon: "⚔",  phase2: false },
  pot:       { cx: 480, cy: 190, w: 160, h: 72,  label: "MATCH POT",     sub: "Smart Escrow",  color: "#7fd8ff", icon: "💰",  phase2: false },
  winner:    { cx: 240, cy: 100, w: 150, h: 58,  label: "WINNER",        sub: "95% payout",    color: "#5ad27a", icon: "🏆",  phase2: false },
  rake:      { cx: 720, cy: 290, w: 150, h: 58,  label: "5% RAKE",       sub: "Per match",     color: "#ff5a4d", icon: "⚡",  phase2: false },
  burn:      { cx: 480, cy: 390, w: 108, h: 52,  label: "BURN 🔥",       sub: "25% of rake",   color: "#ff5a4d", icon: "",    phase2: false },
  yield:     { cx: 600, cy: 390, w: 108, h: 52,  label: "REAL YIELD",    sub: "🔒 Phase 2",    color: "#7fd8ff", icon: "",    phase2: true  },
  ecosystem: { cx: 720, cy: 390, w: 108, h: 52,  label: "ECOSYSTEM",     sub: "54% of rake",   color: "#5ad27a", icon: "",    phase2: false },
  guild:     { cx: 840, cy: 390, w: 108, h: 52,  label: "GUILD YIELD",   sub: "21% of rake",   color: "#ffd700", icon: "",    phase2: false },
  dao:       { cx: 960, cy: 390, w: 108, h: 52,  label: "DAO IMPACT",    sub: "🔒 Phase 2",    color: "#a855f7", icon: "",    phase2: true  },
};

/* ── Animated path configs ────────────────────────────────────────────────── */
interface PathCfg { d: string; color: string; delay: number; width?: number; phase2?: boolean; }

const PATHS: PathCfg[] = [
  // Players → Match Pot (active)
  { d: "M 155 190 H 400",                              color: "#5ad27a", delay: 0.0,  width: 2   },
  // Match Pot → Winner (active)
  { d: "M 480 190 C 480 145 320 100 315 100",          color: "#5ad27a", delay: 0.4,  width: 2   },
  // Match Pot → Rake hub (active)
  { d: "M 560 190 C 640 190 720 240 720 261",          color: "#ff5a4d", delay: 0.4,  width: 2   },
  // Rake → Burn (ACTIVE — glowing)
  { d: "M 720 319 L 720 350 L 480 350 L 480 364",     color: "#ff5a4d", delay: 0.85, width: 1.8, phase2: false },
  // Rake → Real Yield (PHASE 2 — dim, sparse dash)
  { d: "M 720 319 L 720 350 L 600 350 L 600 364",     color: "#7fd8ff", delay: 0.92, width: 1.2, phase2: true  },
  // Rake → Ecosystem (ACTIVE — glowing)
  { d: "M 720 319 L 720 364",                          color: "#5ad27a", delay: 0.99, width: 1.8, phase2: false },
  // Rake → Guild Yield (ACTIVE — glowing)
  { d: "M 720 319 L 720 350 L 840 350 L 840 364",     color: "#ffd700", delay: 1.06, width: 1.8, phase2: false },
  // Rake → DAO (PHASE 2 — dim, sparse dash)
  { d: "M 720 319 L 720 350 L 960 350 L 960 364",     color: "#a855f7", delay: 1.13, width: 1.2, phase2: true  },
];

/* ── SVG marker defs ──────────────────────────────────────────────────────── */
const MARKER_DEFS = [
  { id: "eco-arrow-green",  color: "#5ad27a" },
  { id: "eco-arrow-pink",   color: "#ff5a4d" },
  { id: "eco-arrow-blue",   color: "#7fd8ff" },
  { id: "eco-arrow-gold",   color: "#ffd700" },
  { id: "eco-arrow-purple", color: "#a855f7" },
];

function markerIdForColor(color: string): string {
  if (color === "#5ad27a") return "url(#eco-arrow-green)";
  if (color === "#ff5a4d") return "url(#eco-arrow-pink)";
  if (color === "#7fd8ff") return "url(#eco-arrow-blue)";
  if (color === "#ffd700") return "url(#eco-arrow-gold)";
  return "url(#eco-arrow-purple)";
}

/* ── Node box renderer ────────────────────────────────────────────────────── */
function FlowNode({ node, visible, delay }: { node: Node; visible: boolean; delay: number }) {
  const rx = node.cx - node.w / 2;
  const ry = node.cy - node.h / 2;
  const isPhase2 = node.phase2 ?? false;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={visible
        ? { opacity: isPhase2 ? 0.40 : 1, scale: 1 }
        : { opacity: 0, scale: 0.8 }
      }
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
    >
      {/* Glow — only for active nodes */}
      {!isPhase2 && (
        <rect
          x={rx - 6} y={ry - 6} width={node.w + 12} height={node.h + 12}
          rx={18} fill={node.color} opacity={0.06}
          style={{ filter: "blur(8px)" }}
        />
      )}

      {/* Box — dashed border for Phase 2 */}
      <rect
        x={rx} y={ry} width={node.w} height={node.h} rx={12}
        fill={isPhase2 ? "rgba(7,8,16,0.70)" : "rgba(7,8,16,0.92)"}
        stroke={node.color}
        strokeWidth={isPhase2 ? 1 : 1.5}
        strokeDasharray={isPhase2 ? "4 3" : undefined}
        strokeOpacity={isPhase2 ? 0.5 : 1}
        style={isPhase2 ? undefined : { filter: `drop-shadow(0 0 8px ${node.color}50)` }}
      />

      {/* Icon for main nodes */}
      {node.icon && (
        <text x={node.cx - node.w / 2 + 16} y={node.cy + 4}
          textAnchor="middle" dominantBaseline="central"
          fill={node.color} fontSize="15"
        >{node.icon}</text>
      )}

      {/* Label */}
      <text
        x={node.icon ? node.cx + 8 : node.cx}
        y={node.sub ? node.cy - 7 : node.cy + 1}
        textAnchor="middle" dominantBaseline="central"
        fill={isPhase2 ? `${node.color}88` : node.color}
        fontSize={node.w < 120 ? "9.5" : "11"}
        fontWeight="700"
        letterSpacing="0.06em"
        fontFamily="var(--font-mono)"
        style={isPhase2 ? undefined : {
          textTransform: "uppercase",
          filter: `drop-shadow(0 0 5px ${node.color}90)`,
        }}
      >
        {node.label}
      </text>

      {/* Sub-label */}
      {node.sub && (
        <text
          x={node.icon ? node.cx + 8 : node.cx}
          y={node.cy + 9}
          textAnchor="middle" dominantBaseline="central"
          fill={isPhase2 ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.30)"}
          fontSize="8.5"
          letterSpacing="0.10em"
          fontFamily="var(--font-mono)"
        >
          {node.sub}
        </text>
      )}
    </motion.g>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export function EcosystemFlow() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const nodeList = Object.values(NODES);

  return (
    <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <svg
        ref={ref}
        viewBox="0 0 1060 440"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", minWidth: "640px", display: "block", overflow: "visible" }}
        aria-label="Token ecosystem flow — Model B: Burn 25% + Ecosystem 54% + Guild 21% + Phase 2 locked"
      >
        <defs>
          <pattern id="ecoDots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.8" fill="rgba(90,210,122,0.07)" />
          </pattern>
          {MARKER_DEFS.map(({ id, color }) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity="0.75" />
            </marker>
          ))}
        </defs>

        <rect x="0" y="0" width="1060" height="440" fill="url(#ecoDots)" />

        {/* Animated paths */}
        {PATHS.map((p, i) => {
          const isPhase2Path = p.phase2 ?? false;
          return (
            <motion.path
              key={i}
              d={p.d}
              stroke={p.color}
              strokeWidth={p.width ?? 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              // Active: short dash-gap for animated travel; Phase 2: sparse/static dash
              strokeDasharray={isPhase2Path ? "3 7" : (i < 3 ? "6 4" : "5 3")}
              markerEnd={isPhase2Path ? undefined : markerIdForColor(p.color)}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView
                ? {
                    pathLength: isPhase2Path ? 0.85 : 1,
                    opacity: isPhase2Path ? 0.22 : 0.78,
                  }
                : { pathLength: 0, opacity: 0 }
              }
              transition={{
                duration: isPhase2Path ? 1.6 : 0.85,
                delay: p.delay,
                ease: "easeInOut",
              }}
              style={isPhase2Path
                ? undefined
                : { filter: `drop-shadow(0 0 4px ${p.color}80)` }
              }
            />
          );
        })}

        {/* Floating labels */}
        <motion.text x="295" y="175" textAnchor="middle"
          fill="rgba(90,210,122,0.38)" fontSize="8.5" letterSpacing="0.18em" fontFamily="var(--font-mono)"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >ROUND STARTS</motion.text>

        <motion.text x="610" y="175" textAnchor="middle"
          fill="rgba(255,255,255,0.20)" fontSize="8.5" letterSpacing="0.16em" fontFamily="var(--font-mono)"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >INSTANT SPLIT</motion.text>

        <motion.text x="720" y="338" textAnchor="middle"
          fill="rgba(255,90,77,0.42)" fontSize="8" letterSpacing="0.14em" fontFamily="var(--font-mono)"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >RAKE DISTRIBUTION</motion.text>

        {/* Phase 2 legend label */}
        <motion.text x="780" y="425" textAnchor="middle"
          fill="rgba(255,255,255,0.18)" fontSize="8" letterSpacing="0.14em" fontFamily="var(--font-mono)"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >🔒 PHASE 2 — ACTIVATES AT VOLUME MILESTONE</motion.text>

        {/* Nodes */}
        {nodeList.map((node) => (
          <FlowNode
            key={node.label}
            node={node}
            visible={inView}
            delay={
              node === NODES.players   ? 0.0
              : node === NODES.pot     ? 0.15
              : node === NODES.winner  ? 0.55
              : node === NODES.rake    ? 0.55
              : 1.1 + nodeList.indexOf(node) * 0.07
            }
          />
        ))}
      </svg>
    </div>
  );
}
