"use client";

import { useEffect, useRef } from "react";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";

/** Center-window preview — visible through the split gap before full LiveArena opens. */
export function SplitArenaPeek() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    void v.play().catch(() => undefined);
  }, []);

  return (
    <div className="split-arena-peek pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      <div
        className="split-arena-peek-frame relative"
        style={{
          width: "min(42vw, 520px)",
          boxShadow: "0 0 80px rgba(245,200,66,0.35), 0 0 160px rgba(245,200,66,0.12)",
        }}
      >
        <PixelGlassGlitch variant="gold" mode="pulse" intensity={1.2}>
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            muted
            loop
            playsInline
            preload="auto"
            poster="/sprites/web/gameplay-1.jpg"
          >
            <source src="/sprites/demo2.mp4" type="video/mp4" />
          </video>
        </PixelGlassGlitch>
        <div
          className="absolute left-2 top-2 z-20 flex items-center gap-1.5 px-2 py-1"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "0.45rem",
            color: "#fff",
            background: "rgba(255,60,60,0.85)",
            letterSpacing: "0.08em",
          }}
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse bg-white" />
          LIVE
        </div>
      </div>
    </div>
  );
}
