"use client";

import { useEffect, type RefObject } from "react";

export function useFireflies(
  containerRef: RefObject<HTMLElement | null>,
  count = 5,
  enabled = true,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled || count === 0) return;

    if (!document.getElementById("ff-keyframes")) {
      const style = document.createElement("style");
      style.id = "ff-keyframes";
      style.textContent = `
        @keyframes ff-drift {
          0%   { transform: translate(var(--x0), var(--y0)) scale(1);   opacity: 0; }
          15%  { opacity: var(--ff-peak); }
          50%  { transform: translate(var(--x1), var(--y1)) scale(1.3); }
          85%  { opacity: var(--ff-peak); }
          100% { transform: translate(var(--x2), var(--y2)) scale(0.8); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const flies: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
      const ff = document.createElement("span");
      ff.className = "glass-firefly";
      ff.setAttribute("aria-hidden", "true");
      ff.style.left = `${rand(12, 88)}%`;
      ff.style.top = `${rand(18, 82)}%`;
      ff.style.setProperty("--x0", `${randPx(-40, 40)}`);
      ff.style.setProperty("--y0", `${randPx(-30, 30)}`);
      ff.style.setProperty("--x1", `${randPx(-45, 45)}`);
      ff.style.setProperty("--y1", `${randPx(-45, 45)}`);
      ff.style.setProperty("--x2", `${randPx(-40, 40)}`);
      ff.style.setProperty("--y2", `${randPx(-30, 30)}`);
      ff.style.setProperty("--ff-peak", (0.4 + Math.random() * 0.5).toFixed(2));
      ff.style.setProperty("--ff-dur", `${(4 + Math.random() * 4).toFixed(1)}s`);
      ff.style.setProperty("--ff-delay", `${(-Math.random() * 6).toFixed(1)}s`);
      container.appendChild(ff);
      flies.push(ff);
    }

    return () => {
      flies.forEach((f) => f.remove());
    };
  }, [containerRef, count, enabled]);
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}

function randPx(min: number, max: number) {
  return `${rand(min, max)}px`;
}
