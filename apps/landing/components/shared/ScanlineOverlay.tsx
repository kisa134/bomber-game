import type { CSSProperties } from "react";

interface ScanlineOverlayProps {
  /** 0–1 opacity of the scanline sweep gradient */
  intensity?: number;
  /** Color of the sweep (default neon green) */
  color?:     string;
  /** Animation duration in seconds */
  speed?:     number;
  className?: string;
  style?:     CSSProperties;
}

/**
 * ScanlineOverlay — places a full-cover, pointer-events-none div over its
 * parent that renders two layered effects:
 *
 * 1. A fast-moving luminous sweep line (GSAP-free, pure CSS).
 * 2. A static fine-line CRT texture at very low opacity.
 *
 * Parent must be `position: relative` (or any non-static positioning).
 */
export function ScanlineOverlay({
  intensity = 0.12,
  color     = "rgba(90,210,122,1)",
  speed     = 4.5,
  className = "",
  style,
}: ScanlineOverlayProps) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position:      "absolute",
        inset:         0,
        pointerEvents: "none",
        zIndex:        15,
        overflow:      "hidden",
        ...style,
      }}
    >
      {/* Sweep line */}
      <div
        style={{
          position:   "absolute",
          left:       0,
          right:      0,
          height:     "40%",
          background: `linear-gradient(to bottom, ${color.replace("1)", `${intensity})`)} 0%, transparent 100%)`,
          animation:  `scanline ${speed}s linear infinite`,
        }}
      />

      {/* CRT scanline texture */}
      <div
        style={{
          position:        "absolute",
          inset:           0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.06) 1px, rgba(0,0,0,0.06) 2px)",
          backgroundSize:  "100% 2px",
          mixBlendMode:    "overlay",
          opacity:         0.4,
        }}
      />
    </div>
  );
}
