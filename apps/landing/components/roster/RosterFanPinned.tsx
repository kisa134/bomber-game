"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CardFan } from "./CardFan";
import { FIGHTER_ROSTER } from "@/lib/rosterData";

/** GSAP pin — scrub through the full roster fan while scrolling (Master spec). */
export function RosterFanPinned() {
  const pinRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const el = pinRef.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 768;
    if (reduce || mobile) return;

    const total = FIGHTER_ROSTER.length;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: `+=${Math.max(total * 18, 120)}%`,
        pin: true,
        scrub: 0.85,
        anticipatePin: 1,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const idx = Math.min(total - 1, Math.round(self.progress * (total - 1)));
          el.style.setProperty("--roster-scroll-index", String(idx));
          el.dispatchEvent(new CustomEvent("roster-scrub", { detail: { index: idx } }));
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pinRef} className="roster-pin-chamber relative min-h-[100svh] w-full" style={{ ["--roster-scroll-index" as string]: "0" }}>
      <CardFan fighters={FIGHTER_ROSTER} scrubContainerRef={pinRef} />
    </div>
  );
}
