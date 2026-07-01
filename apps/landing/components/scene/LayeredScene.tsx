"use client";

/* LayeredScene — data-driven multi-plane animated scene assembler (SPEC depth system).
   Feed it a stack of generated/cut layers (bg env · subject · objects · fx · fg). It
   composites them with z-order + scroll PARALLAX (per-layer depth) + idle MOTION
   (drift / float / pulse) + FX blend modes. Desktop = full parallax; mobile /
   reduced-motion = static stack, atmosphere preserved.

   Each layer is a generated asset from tools/asset-gen (cutout PNGs for subject/fx/fg). */

import { useEffect, useRef, type CSSProperties } from "react";
import { motion, type TargetAndTransition } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export interface SceneLayer {
  /** image asset (webp/png cutout). Omit for a pure CSS layer via `style`. */
  src?: string;
  /** stacking order (0 back → 50 front). */
  z: number;
  /** parallax strength: negative = background (slow/opposite), positive = foreground (fast). 0 = locked. */
  depth?: number;
  /** idle animation while on screen. */
  motion?: "drift" | "float" | "pulse" | "none";
  /** compositing — e.g. "screen" / "plus-lighter" for additive FX (explosions, embers). */
  blend?: CSSProperties["mixBlendMode"];
  opacity?: number;
  pixel?: boolean;
  /** position/size overrides (absolute by default; full-bleed if omitted). */
  style?: CSSProperties;
  className?: string;
  alt?: string;
}

const IDLE: Record<NonNullable<SceneLayer["motion"]>, TargetAndTransition> = {
  drift: { x: [0, 8, 0, -6, 0], y: [0, -5, 0, 4, 0] },
  float: { y: [0, -10, 0] },
  pulse: { opacity: [1, 0.82, 1], scale: [1, 1.03, 1] },
  none: {},
};
const IDLE_DUR: Record<NonNullable<SceneLayer["motion"]>, number> = { drift: 14, float: 5, pulse: 3.2, none: 0 };

export function LayeredScene({
  layers,
  className = "",
  style,
}: {
  layers: SceneLayer[];
  className?: string;
  style?: CSSProperties;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 768) return; // mobile: static stack, no parallax
    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".scene-layer").forEach((node) => {
        const depth = Number(node.dataset.depth || 0);
        if (!depth) return;
        const shift = depth * 26; // % of travel; sign sets direction
        gsap.fromTo(
          node,
          { yPercent: shift },
          { yPercent: -shift, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 } },
        );
      });
    }, el);
    return () => ctx.revert();
  }, [layers]);

  return (
    <div ref={root} className={`relative overflow-hidden ${className}`} style={style} aria-hidden>
      {layers.map((l, i) => {
        const m = l.motion ?? "none";
        const base: CSSProperties = {
          position: "absolute",
          inset: 0,
          zIndex: l.z,
          opacity: l.opacity ?? 1,
          mixBlendMode: l.blend,
          objectFit: "cover",
          width: "100%",
          height: "100%",
          imageRendering: l.pixel ? "pixelated" : undefined,
          ...l.style,
        };
        const cls = `scene-layer pointer-events-none ${l.className ?? ""}`;
        const idle =
          m !== "none"
            ? { animate: IDLE[m], transition: { duration: IDLE_DUR[m], repeat: Infinity, ease: "easeInOut" as const } }
            : {};
        return l.src ? (
          // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
          <motion.img key={i} src={l.src} alt={l.alt ?? ""} className={cls} data-depth={l.depth ?? 0} style={base} {...idle} />
        ) : (
          <motion.div key={i} className={cls} data-depth={l.depth ?? 0} style={base} {...idle} />
        );
      })}
    </div>
  );
}
