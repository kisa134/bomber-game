"use client";

import { useEffect, useState } from "react";

export type EffectTier = "ultra" | "mid" | "lite" | "minimal";

/** Device / motion probing — conservative `mid` default for SSR (Effects spec §6.2). */
export function useEffectTier(): EffectTier {
  const [tier, setTier] = useState<EffectTier>("mid");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTier("minimal");
      return;
    }

    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
      deviceMemory?: number;
    };

    if (nav.connection?.saveData || nav.connection?.effectiveType === "2g") {
      setTier("lite");
      return;
    }
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      setTier("lite");
      return;
    }
    if ((nav.deviceMemory ?? 8) < 4) {
      setTier("lite");
      return;
    }

    let frames = 0;
    const start = performance.now();
    const probe = (now: number) => {
      frames++;
      if (now - start < 500) {
        requestAnimationFrame(probe);
      } else {
        const fps = frames / ((now - start) / 1000);
        setTier(fps >= 55 ? "ultra" : fps >= 45 ? "mid" : "lite");
      }
    };
    requestAnimationFrame(probe);
  }, []);

  return tier;
}
