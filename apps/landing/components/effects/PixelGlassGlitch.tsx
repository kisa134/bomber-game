"use client";

import { useEffect, useRef, useState } from "react";
import { getLiteLevel } from "@/lib/liteMode";

type Variant = "gold" | "red" | "cyan";
type Mode = "idle" | "pulse" | "hover";

export interface PixelGlassGlitchProps {
  children: React.ReactNode;
  className?: string;
  /** Bevel rim colour family */
  variant?: Variant;
  /** idle = rare auto-bursts · pulse = steady rhythm · hover = glitch on hover */
  mode?: Mode;
  /** 0–1 overlay strength */
  intensity?: number;
}

export function PixelGlassGlitch({
  children,
  className = "",
  variant = "gold",
  mode = "pulse",
  intensity = 1,
}: PixelGlassGlitchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (mode === "hover" || getLiteLevel() !== "full") return;

    const el = rootRef.current;
    if (!el) return;

    if (mode === "idle") {
      const schedule = () => {
        const delay = 5000 + Math.random() * 7000;
        return window.setTimeout(() => {
          setBurst(true);
          window.setTimeout(() => setBurst(false), 380);
          timer = schedule();
        }, delay);
      };
      let timer = schedule();
      return () => clearTimeout(timer);
    }

    if (mode === "pulse") {
      const id = window.setInterval(() => {
        setBurst(true);
        window.setTimeout(() => setBurst(false), 320);
      }, 2800 + Math.random() * 1200);
      return () => clearInterval(id);
    }
  }, [mode]);

  const lite = getLiteLevel();
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      ref={rootRef}
      className={[
        "pxglass-root",
        `pxglass-root--${variant}`,
        `pxglass-root--${mode}`,
        burst && !reduced && lite === "full" ? "is-bursting" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ["--pxglass-i" as string]: intensity }}
      onMouseEnter={mode === "hover" && !reduced ? () => setBurst(true) : undefined}
      onMouseLeave={mode === "hover" ? () => setBurst(false) : undefined}
    >
      <div className="pxglass-refract" aria-hidden />
      <div className="pxglass-bevel" aria-hidden />
      <div className="pxglass-rgb pxglass-rgb-r" aria-hidden />
      <div className="pxglass-rgb pxglass-rgb-g" aria-hidden />
      <div className="pxglass-rgb pxglass-rgb-b" aria-hidden />
      <div className="pxglass-slices" aria-hidden />
      <div className="pxglass-scan bm-scanlines" aria-hidden />
      <div className="pxglass-content">{children}</div>
    </div>
  );
}
