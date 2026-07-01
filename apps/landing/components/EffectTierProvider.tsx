"use client";

import { useEffect } from "react";
import { useEffectTier } from "@/lib/hooks/useEffectTier";

/** Applies `data-effect-tier` + `.lite` on `<html>` after client probe (Effects spec §6). */
export function EffectTierProvider({ children }: { children: React.ReactNode }) {
  const tier = useEffectTier();

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.effectTier = tier;
    html.classList.toggle("lite", tier === "lite" || tier === "minimal");
    html.classList.toggle("ultra", tier === "ultra");
    return () => {
      html.classList.remove("lite", "ultra");
      delete html.dataset.effectTier;
    };
  }, [tier]);

  return <>{children}</>;
}
