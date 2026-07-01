"use client";

import { motion } from "framer-motion";
import { RosterFanPinned } from "@/components/roster/RosterFanPinned";
import { AnimatedFighterSprite } from "@/components/roster/AnimatedFighterSprite";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const BACKDROP_FIGHTERS = [
  { src: "/sprites/pepe/new/skin_1_side_0.webp", side: "left" as const, depth: 1, bottom: "0%", offset: "-4%", scale: 1, opacity: 0.22 },
  { src: "/sprites/trump/new/skin_2_side_0.webp", side: "left" as const, depth: 2, bottom: "2%", offset: "6%", scale: 0.78, opacity: 0.14 },
  { src: "/sprites/doge/skin_4_side_0.webp", side: "left" as const, depth: 3, bottom: "0%", offset: "16%", scale: 0.62, opacity: 0.1 },
  { src: "/sprites/elon/new/skin_3_side_0.webp", side: "right" as const, depth: 1, bottom: "0%", offset: "-4%", scale: 1, opacity: 0.22 },
  { src: "/sprites/bogdanoff/skin_9_side_0.webp", side: "right" as const, depth: 2, bottom: "2%", offset: "6%", scale: 0.76, opacity: 0.13 },
  { src: "/sprites/skin2/skin_10_side_0.webp", side: "right" as const, depth: 3, bottom: "0%", offset: "15%", scale: 0.6, opacity: 0.09 },
];

const FLOOR_PROPS = [
  { src: "/sprites/powerup_bomb.png", left: "8%", bottom: "6%", size: 36, layer: 1 },
  { src: "/sprites/powerup_fire.png", left: "18%", bottom: "4%", size: 28, layer: 2 },
  { src: "/sprites/powerup_wall.png", left: "28%", bottom: "5%", size: 32, layer: 1 },
  { src: "/sprites/powerup_speed.png", right: "10%", bottom: "5%", size: 30, layer: 1 },
  { src: "/sprites/powerup_kick.png", right: "22%", bottom: "3%", size: 26, layer: 2 },
  { src: "/sprites/powerup_bomb.png", right: "32%", bottom: "6%", size: 34, layer: 1 },
];

export function RosterSection() {
  return (
    <section
      className="roster-section relative overflow-hidden"
      style={{
        background: "var(--color-bg-1)",
        paddingBlock: "clamp(4rem, 8vw, 6rem)",
        paddingInline: "var(--section-px, 1.25rem)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {BACKDROP_FIGHTERS.map((f) => (
          <div
            key={`${f.src}-${f.depth}`}
            className="roster-backdrop-fighter absolute"
            style={{
              [f.side]: f.offset,
              bottom: f.bottom,
              transform: `scale(${f.scale}) ${f.side === "right" ? "scaleX(-1)" : ""}`,
              opacity: f.opacity,
              zIndex: f.depth,
              filter: `blur(${(3 - f.depth) * 0.5}px)`,
            }}
          >
            <AnimatedFighterSprite src={f.src} alt="" fps={10 + f.depth} style={{ height: "min(52vh, 440px)", width: "auto" }} />
          </div>
        ))}

        {FLOOR_PROPS.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={p.src}
            alt=""
            className="roster-floor-prop absolute"
            style={{
              left: "left" in p ? p.left : undefined,
              right: "right" in p ? p.right : undefined,
              bottom: p.bottom,
              width: p.size,
              height: "auto",
              imageRendering: "pixelated",
              opacity: 0.35 + p.layer * 0.12,
              zIndex: 4 + p.layer,
              filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.8))",
            }}
          />
        ))}

        <div className="roster-floor-plane absolute inset-x-0 bottom-0 h-[18%]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease }}
          className="mb-10 text-center"
        >
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.55rem",
              letterSpacing: "0.06em",
              color: "rgba(245,200,66,0.85)",
            }}
          >
            SEASON 1 · 10 FIGHTERS
          </span>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: "clamp(2.2rem, 6vw, 4rem)",
              lineHeight: 0.9,
              color: "#fff",
              margin: "0.75rem 0",
            }}
          >
            Elite{" "}
            <span style={{ color: "#f5c842", textShadow: "0 0 28px rgba(245,200,66,0.35)" }}>Roster</span>
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.28)",
            }}
          >
            Fan the deck · Pick your fighter · Climb MMR
          </p>
        </motion.div>

        <RosterFanPinned />
      </div>
    </section>
  );
}
