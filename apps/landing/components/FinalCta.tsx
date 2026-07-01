"use client";

import { motion } from "framer-motion";
import { usePlayUrl } from "@/lib/playUrl";
import { useMagnetic } from "@/lib/hooks/useMagnetic";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function FinalCta() {
  const playUrl = usePlayUrl();
  const magneticRef = useMagnetic<HTMLAnchorElement>(0.3);

  return (
    <section
      className="relative flex w-full items-center overflow-hidden"
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-4, #07060d)",
        paddingInline: "var(--section-px, 1.5rem)",
        paddingBlock: "clamp(4rem, 8vw, 8rem)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 45% at 30% 30%, rgba(245,200,66,0.04) 0%, transparent 60%)" }} />

      <motion.img
        src="/sprites/skin_3.webp"
        alt=""
        aria-hidden
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 0.4, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1, ease }}
        className="pointer-events-none absolute bottom-0 right-0 hidden lg:block"
        style={{ height: "82vh", width: "auto", objectFit: "contain", transform: "scaleX(-1)", imageRendering: "pixelated", filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.7))", zIndex: 1 }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />

      <div className="relative mx-auto w-full max-w-[1200px]" style={{ zIndex: 10 }}>
        <PixelGlassGlitch variant="gold" mode="idle" intensity={0.7} className="max-w-[760px] p-6 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
            className="flex flex-col items-start"
          >
            <span style={{ fontFamily: "var(--font-pixel)", fontSize: "0.6rem", letterSpacing: "0.06em", color: "rgba(245,200,66,0.85)", marginBottom: "1.5rem" }}>
              LAST CALL
            </span>

            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                textTransform: "uppercase",
                fontSize: "var(--text-hero, clamp(3.5rem, 8vw, 9rem))",
                lineHeight: 0.86,
                letterSpacing: "-0.01em",
                color: "#fff",
                margin: 0,
              }}
            >
              JOIN THE<br />ARENA.
            </h2>

            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-base, 1rem)", lineHeight: 1.6, color: "rgba(255,255,255,0.6)", margin: "1.5rem 0 2rem", maxWidth: "42ch" }}>
              Free to play, browser-native, provably fair. The next pot is already forming.
            </p>

            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto">
              <a
                ref={magneticRef}
                href={playUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-yellow inline-flex items-center justify-center px-9 transition-transform"
                style={{ height: "64px", fontSize: "1.05rem" }}
              >
                ▶ Play Now
              </a>
              <a href="/tournaments" className="cta-ghost inline-flex items-center justify-center px-9" style={{ height: "52px", fontSize: "0.9rem" }}>
                View Leaderboard
              </a>
            </div>
          </motion.div>
        </PixelGlassGlitch>
      </div>
    </section>
  );
}
