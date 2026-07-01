"use client";

import { motion } from "framer-motion";
import { EcosystemFlow } from "@/components/EcosystemFlow";
import { PlayLink } from "@/components/ui/PlayLink";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function GuildsTeaser() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        background: "var(--color-bg-4)",
        paddingInline: "var(--section-px, 1.5rem)",
        paddingBlock: "clamp(4rem, 8vw, 7rem)",
      }}
    >
      <div className="relative z-10 mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease }}
          className="mb-10 max-w-xl"
        >
          <span style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", letterSpacing: "0.06em", color: "rgba(245,200,66,0.85)" }}>
            GUILD NETWORK
          </span>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
              lineHeight: 0.92,
              color: "#fff",
              margin: "0.75rem 0",
            }}
          >
            Build a clan.<br />
            <span style={{ color: "#f5c842" }}>Earn from every match.</span>
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", lineHeight: 1.65, color: "rgba(255,255,255,0.5)" }}>
            Referral yield flows through five tiers — from direct recruits to deep network effects.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/partners" className="cta-yellow inline-flex items-center px-7" style={{ height: 48, fontSize: "0.88rem" }}>
              Become a guild
            </a>
            <PlayLink className="cta-ghost inline-flex items-center px-7" style={{ height: 48, fontSize: "0.85rem" }}>
              Play first match
            </PlayLink>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.75, ease, delay: 0.1 }}
          className="pixel-inset overflow-hidden p-4 sm:p-6"
          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.45)" }}
        >
          <EcosystemFlow />
        </motion.div>
      </div>
    </section>
  );
}
