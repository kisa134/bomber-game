"use client";

import { motion } from "framer-motion";
import { iFade } from "./BentoShared";
import { BentoRow1Arena } from "./BentoRow1Arena";
import { BentoRow2Powerups } from "./BentoRow2Powerups";
import { BentoRow3Skills } from "./BentoRow3Skills";
import { BentoRow4Roi } from "./BentoRow4Roi";
import { PlayLink } from "@/components/ui/PlayLink";

export function BentoSection() {
  return (
    <section
      id="features"
      className="relative z-10 px-4 py-12 sm:px-6 lg:py-14 lg:px-8"
      style={{ background: "transparent" }}
    >
      <div className="mx-auto w-[95%] max-w-[1600px]">
        {/* Section label */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={iFade}
          className="mb-6 flex flex-col items-center gap-1.5"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "#f5c842", boxShadow: "0 0 8px rgba(245,200,66,0.9)",
                display: "inline-block", animation: "neon-pulse 2s ease-in-out infinite",
              }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ fontFamily: "var(--font-mono)", color: "rgba(245,200,66,0.7)" }}
            >
              THE ARENA
            </span>
          </div>
          <h2
            className="esports-heading text-3xl sm:text-4xl lg:text-5xl"
            style={{
              background: "linear-gradient(170deg, #ffffff 0%, #f5c842 45%, #7fd8ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 30px rgba(245,200,66,0.25))",
            }}
          >
            BUILT DIFFERENT
          </h2>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.70rem",
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.30)",
            textTransform: "uppercase",
            marginTop: "4px",
          }}>
            True Skill · Smart Pools · TMA Matchmaking
          </p>
        </motion.div>

        <div className="flex flex-col gap-4">
          <BentoRow1Arena />
          <BentoRow2Powerups />
          <BentoRow3Skills />
          <BentoRow4Roi />
        </div>

        {/* Final CTA strip */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
          className="mt-6 flex flex-col items-center gap-4"
        >
          <motion.div variants={iFade}>
            <PlayLink
              className="cta-yellow inline-flex items-center px-12 py-4 text-lg lg:px-14 lg:py-5 lg:text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ▶ ENTER THE ARENA
            </PlayLink>
          </motion.div>
          <motion.p
            variants={iFade}
            className="text-[11px] text-white/30"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            No download · Browser-native · Telegram Mini App
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
