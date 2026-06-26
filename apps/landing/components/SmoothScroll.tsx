"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * App-wide buttery scroll + the canonical Lenis⇄GSAP handshake.
 *
 * GSAP's ticker is the single rAF source and drives Lenis; Lenis's scroll
 * event drives ScrollTrigger.update; lagSmoothing(0) keeps scroll-linked
 * timelines in lockstep. This MUST be the only place the loop is wired so
 * pinned split/descend transitions stay in sync. Respects reduced-motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    // Lenis → ScrollTrigger, and GSAP ticker → Lenis (one rAF source).
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Pinned triggers depend on layout; recompute once fonts settle.
    if (document.fonts?.ready) void document.fonts.ready.then(() => ScrollTrigger.refresh());

    return () => {
      gsap.ticker.remove(tick);
      lenis.off("scroll", ScrollTrigger.update);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
