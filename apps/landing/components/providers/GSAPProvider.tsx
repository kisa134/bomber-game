"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { rafManagerTick, resetRafManagerClock } from "@/lib/rafManager";
import { initLiteMode, stopLiteMode } from "@/lib/liteMode";

let lenisInstance: Lenis | null = null;

export function getLenis() {
  return lenisInstance;
}

/**
 * Canonical Lenis ⇄ GSAP ticker + shared rAF manager (spec §0.1, §1.2).
 * No component calls requestAnimationFrame directly.
 */
export function GSAPProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    initLiteMode();

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    lenisInstance = new Lenis({
      autoRaf: false,
      lerp: 0.1,
      syncTouch: true,
      duration: prefersReduced ? 0 : 1.1,
      smoothWheel: !prefersReduced,
    });

    lenisInstance.on("scroll", ScrollTrigger.update);

    resetRafManagerClock();
    const ticker = (time: number) => {
      lenisInstance?.raf(time * 1000);
      rafManagerTick(time);
    };
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    if (document.fonts?.ready) void document.fonts.ready.then(() => ScrollTrigger.refresh());

    return () => {
      gsap.ticker.remove(ticker);
      lenisInstance?.off("scroll", ScrollTrigger.update);
      lenisInstance?.destroy();
      lenisInstance = null;
      stopLiteMode();
      gsap.ticker.lagSmoothing(500);
    };
  }, []);

  return <>{children}</>;
}

/** @deprecated Use GSAPProvider — kept for existing imports. */
export const SmoothScroll = GSAPProvider;
