"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MatrixCodeRain } from "@/components/effects/MatrixCodeRain";

type Depth = 0 | 1 | 2 | 3 | 4;

const BG: Record<Depth, string> = {
  0: "var(--color-bg-0)",
  1: "var(--color-bg-1)",
  2: "var(--color-bg-2)",
  3: "var(--color-bg-3)",
  4: "var(--color-bg-4)",
};

const PANEL_BLACK = "#000000";

export interface SplitDescendPinnedProps {
  outerDepth: Depth;
  innerDepth: Depth;
  innerContent: React.ReactNode;
  outerLeft?: React.ReactNode;
  outerRight?: React.ReactNode;
  className?: string;
  pinScrollMultiplier?: number;
}

/** GSAP SD-1 — black shutters split open into story chamber. */
export function SplitDescendPinned({
  innerDepth,
  innerContent,
  outerLeft,
  outerRight,
  className = "",
  pinScrollMultiplier = 3.2,
}: SplitDescendPinnedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const seamRef = useRef<HTMLDivElement>(null);
  const blastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const container = containerRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    const inner = innerRef.current;
    const glow = glowRef.current;
    const blast = blastRef.current;
    if (!container || !left || !right || !inner) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 768;

    if (reduce || mobile) {
      inner.style.opacity = "1";
      inner.style.transform = "none";
      left.style.display = "none";
      right.style.display = "none";
      return;
    }

    gsap.set([left, right], { willChange: "transform, opacity" });
    gsap.set(inner, { opacity: 0.45, scale: 0.96 });
    if (glow) gsap.set(glow, { opacity: 0.12 });
    if (blast) gsap.set(blast, { opacity: 0, scale: 0.4 });

    // Runners (Trump / Elon) live inside the panels; animate them from the parent
    // timeline so they can RUN toward the centre while the shutters stay shut.
    const runL = container.querySelector<HTMLElement>(".split-panel-runner-left");
    const runR = container.querySelector<HTMLElement>(".split-panel-runner-right");

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: `+=${pinScrollMultiplier * 100}%`,
          scrub: 1.1,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            container.style.setProperty("--split-progress", String(self.progress));
          },
        },
      });

      // ── ACT 1 — THE RUN (0 → 0.42): shutters CLOSED, Trump & Elon sprint toward
      //    the centre seam (facing each other), matrix rain intensifies.
      if (runL && runR) {
        gsap.set(runL, { xPercent: -90 });
        gsap.set(runR, { xPercent: 90 });
        tl.to(runL, { xPercent: 8, ease: "none", duration: 0.42 }, 0);
        tl.to(runR, { xPercent: -8, ease: "none", duration: 0.42 }, 0);
      }

      // ── ACT 2 — THE OPENING (0.42 → 0.78): shutters split, runners ride out + fade,
      //    seam light blooms.
      tl.to(left, { x: "-58%", ease: "none", duration: 0.36 }, 0.42);
      tl.to(right, { x: "58%", ease: "none", duration: 0.36 }, 0.42);
      if (runL && runR) {
        tl.to([runL, runR], { opacity: 0, ease: "none", duration: 0.18 }, 0.46);
      }

      // The blast blows the matrix apart — disperse + blur the rain canvases.
      const rains = container.querySelectorAll<HTMLCanvasElement>(".split-panel canvas");
      if (rains.length) {
        tl.to(rains, { opacity: 0, scale: 1.18, filter: "blur(7px)", ease: "power2.in", duration: 0.22 }, 0.47);
      }

      if (glow) {
        tl.fromTo(glow, { opacity: 0.08 }, { opacity: 1, ease: "none", duration: 0.4 }, 0.4);
        tl.to(glow, { opacity: 0.4, ease: "none", duration: 0.4 }, 0.78);
      }

      tl.fromTo(inner, { scale: 0.96, opacity: 0.45 }, { scale: 1, opacity: 1, ease: "none", duration: 0.5 }, 0.46);

      // ── ACT 3 — THE EXPLOSION (~0.5): blast burst at the parting seam.
      if (blast) {
        tl.to(blast, { opacity: 0.95, scale: 1.3, ease: "power2.out", duration: 0.1 }, 0.5);
        tl.to(blast, { opacity: 0, scale: 1.75, ease: "power2.in", duration: 0.26 }, 0.6);
      }

      if (seamRef.current) {
        tl.fromTo(seamRef.current, { opacity: 1 }, { opacity: 0, ease: "none", duration: 0.5 }, 0.42);
      }

      tl.to([left, right], { opacity: 0, ease: "none", duration: 0.2 }, 0.9);

      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "bottom top",
        onLeave: () => gsap.set([left, right], { willChange: "auto" }),
        onEnterBack: () => gsap.set([left, right], { willChange: "transform, opacity" }),
      });
    }, container);

    return () => ctx.revert();
  }, [pinScrollMultiplier]);

  return (
    <div
      ref={containerRef}
      className={`split-descend-pinned relative h-[100svh] w-full overflow-hidden ${className}`}
      style={{ ["--split-progress" as string]: "0" }}
    >
      <div
        ref={innerRef}
        className="absolute inset-0 z-[5] flex flex-col"
        style={{ background: BG[innerDepth] }}
      >
        {innerContent}
      </div>

      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background:
            "radial-gradient(ellipse 32% 70% at 50% 50%, rgba(245,200,66,0.5) 0%, rgba(58,158,158,0.18) 38%, transparent 68%)",
          mixBlendMode: "screen",
        }}
        aria-hidden
      />

      <div ref={blastRef} className="split-blast pointer-events-none absolute left-1/2 top-1/2 z-[9] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sprites/powerup_bomb.png" alt="" style={{ width: 72, imageRendering: "pixelated", opacity: 0.95 }} />
      </div>

      {/* Vertical seam light where the two curtains meet (the parting line). */}
      <div
        ref={seamRef}
        className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-[20] w-px -translate-x-px"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(245,200,66,0.9) 35%, rgba(255,255,255,0.95) 50%, rgba(245,200,66,0.9) 65%, transparent)",
          boxShadow: "0 0 26px 2px rgba(245,200,66,0.6), 0 0 70px 6px rgba(245,200,66,0.22)",
        }}
        aria-hidden
      />

      <div
        ref={leftRef}
        className="split-panel split-panel-left split-panel-black absolute inset-y-0 left-0 z-[10] w-1/2"
        style={{ background: PANEL_BLACK }}
      >
        <div className="split-panel-rim split-panel-rim-right" aria-hidden />
        <MatrixCodeRain className="absolute inset-0 z-[1] h-full w-full" speed={1.1} />
        <div className="relative z-[2] h-full overflow-hidden">{outerLeft}</div>
      </div>

      <div
        ref={rightRef}
        className="split-panel split-panel-right split-panel-black absolute inset-y-0 right-0 z-[10] w-1/2"
        style={{ background: PANEL_BLACK }}
      >
        <div className="split-panel-rim split-panel-rim-left" aria-hidden />
        <MatrixCodeRain className="absolute inset-0 z-[1] h-full w-full" speed={1.1} />
        <div className="relative z-[2] h-full overflow-hidden">{outerRight}</div>
      </div>
    </div>
  );
}

const FRAMES = {
  left: ["/sprites/trump/new/skin_2_side_0.webp", "/sprites/trump/new/skin_2_side_1.webp", "/sprites/trump/new/skin_2_side_2.webp"],
  right: ["/sprites/elon/new/skin_3_side_0.webp", "/sprites/elon/new/skin_3_side_1.webp", "/sprites/elon/new/skin_3_side_2.webp"],
} as const;

/** Trump & Elon run toward center — profile view, side run cycle. */
export function SplitPanelRunner({ side }: { side: "left" | "right" }) {
  const frames = FRAMES[side];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), 140);
    return () => clearInterval(id);
  }, [frames.length]);

  const rimClass = side === "left" ? "split-fighter-rim-left" : "split-fighter-rim-right";
  const runnerClass = side === "left" ? "split-panel-runner-left" : "split-panel-runner-right";

  return (
    <div className={`flex h-full items-end ${side === "left" ? "justify-end pr-[6%]" : "justify-start pl-[6%]"} pb-[10%] ${rimClass}`}>
      <div className={`split-panel-runner ${runnerClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frames[frame]}
          alt=""
          className={`split-panel-runner-sprite${side === "right" ? " split-panel-runner-sprite-flip" : ""}`}
          style={{
            height: "min(52vh, 460px)",
            width: "auto",
            imageRendering: "pixelated",
            filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.85))",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}

/** @deprecated use SplitPanelRunner */
export function SplitPanelArt(props: { side: "left" | "right" }) {
  return <SplitPanelRunner {...props} />;
}
