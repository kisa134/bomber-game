"use client";

import { useEffect } from "react";
import { getLiteLevel } from "@/lib/liteMode";

const FF_COUNT = 8;

export function FireflyLayer({ parentRef }: { parentRef: React.RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (getLiteLevel() !== "full") return;

    const container = document.createElement("div");
    container.className = "bm-fireflies";
    container.setAttribute("aria-hidden", "true");

    for (let i = 0; i < FF_COUNT; i++) {
      const dot = document.createElement("span");
      dot.className = "bm-ff-dot";
      const size = 2 + Math.random() * 2;
      dot.style.setProperty("--ff-size", `${size}px`);
      dot.style.setProperty("--x0", `${10 + Math.random() * 80}%`);
      dot.style.setProperty("--x1", `${10 + Math.random() * 80}%`);
      dot.style.setProperty("--x2", `${10 + Math.random() * 80}%`);
      dot.style.setProperty("--y0", `${10 + Math.random() * 80}%`);
      dot.style.setProperty("--y1", `${10 + Math.random() * 80}%`);
      dot.style.setProperty("--ff-dur", `${2.5 + Math.random() * 3}s`);
      dot.style.setProperty("--ff-delay", `${-Math.random() * 5}s`);
      container.appendChild(dot);
    }

    parent.appendChild(container);
    return () => container.remove();
  }, [parentRef]);

  return null;
}
