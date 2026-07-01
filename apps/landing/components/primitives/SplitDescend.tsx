"use client";

/* ── Signature spatial device: SPLIT / DESCEND ─────────────────────────────
   The page appears to split horizontally from the center and the viewer
   "descends" into a deeper, darker inner chamber. Implemented as the spec's
   lighter Variant B — a framer-motion scroll-linked clip-path slit reveal.

   - No scroll pinning → never breaks the scroll flow.
   - Degrades to a plain block under prefers-reduced-motion.
   - The wrapper background is the DEEPER level being descended into; it shows
     through the slit before the inner content fully opens.
   ────────────────────────────────────────────────────────────────────────── */

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

const DEBRIS_SPRITES = [
  { src: "/sprites/powerup_bomb.png", x: "14%", y: "44%", s: 26 },
  { src: "/sprites/powerup_fire.png", x: "78%", y: "40%", s: 22 },
  { src: "/sprites/powerup_speed.png", x: "62%", y: "56%", s: 20 },
  { src: "/sprites/skin_2.webp", x: "32%", y: "58%", s: 52, pixel: true },
  { src: "/sprites/skin_3.webp", x: "70%", y: "52%", s: 48, pixel: true },
] as const;

interface SplitDescendProps {
  children: React.ReactNode;
  /** Background of the deeper chamber being revealed (a bg-N token). */
  bg?: string;
  className?: string;
  /** Floating game sprites in the split seam (SD-2/3). */
  debris?: boolean;
}

export function SplitDescend({
  children,
  bg = "var(--color-bg-3, #090810)",
  className,
  debris = false,
}: SplitDescendProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Reveal runs from "section enters" to "section top reaches viewport center".
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start center"],
  });

  // Center slit (≈8% tall) opening to a full reveal. Percentages only — mixing
  // px and % in clip-path causes flicker.
  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    ["inset(46% 0% 46% 0%)", "inset(0% 0% 0% 0%)"]
  );
  // The two glowing seam lines fade out as the chamber opens.
  const seam = useTransform(scrollYProgress, [0, 0.85, 1], [0.55, 0.12, 0]);
  const debrisY = useTransform(scrollYProgress, [0, 1], [0, -48]);
  const debrisOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.55, 0.35, 0]);

  if (reduce) {
    return (
      <div className={className} style={{ background: bg }}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={{ position: "relative", background: bg }}>
      {debris && (
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden" aria-hidden>
          {DEBRIS_SPRITES.map((d) => (
            <motion.img
              key={`${d.src}-${d.x}`}
              src={d.src}
              alt=""
              className="absolute"
              style={{
                left: d.x,
                top: d.y,
                width: d.s,
                height: "auto",
                imageRendering: "pixel" in d && d.pixel ? "pixelated" : "auto",
                y: debrisY,
                opacity: debrisOpacity,
                filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.7))",
              }}
              initial={false}
            />
          ))}
        </div>
      )}
      {/* Glowing horizontal seam at the split line (fades as it opens) */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          transform: "translateY(-0.5px)",
          background:
            "linear-gradient(90deg, transparent, var(--color-yellow, #f5c842), transparent)",
          opacity: seam,
          zIndex: 2,
          pointerEvents: "none",
          filter: "blur(0.3px)",
        }}
      />
      <motion.div style={{ clipPath, willChange: "clip-path" }}>
        {children}
      </motion.div>
    </div>
  );
}
