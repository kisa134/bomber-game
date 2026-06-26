"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { audioManager } from "@/lib/audioManager";

gsap.registerPlugin(ScrollTrigger);

const TARGET_VALUE = 1_247_830;
const TICK_MIN_MS  = 1_800;
const TICK_MAX_MS  = 4_500;
const INC_MIN      = 47;
const INC_MAX      = 312;

export function PrizePoolCounter() {
  const containerRef   = useRef<HTMLDivElement>(null);
  const numRef         = useRef<HTMLSpanElement>(null);
  const liveValRef     = useRef(TARGET_VALUE);
  const tickTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioGateRef   = useRef(0); // throttle gate timestamp

  useEffect(() => {
    const el        = numRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    /* Capture non-null reference so inner closures can access without re-checking */
    const elNode = el;
    const fmt = (n: number) => `$${Math.floor(n).toLocaleString("en-US")}`;
    const obj = { val: 0 };
    elNode.textContent = "$0";

    /* ── gsap.context for safe SSR cleanup ──────────────────────────────── */
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        val:      TARGET_VALUE,
        duration: 2.4,
        ease:     "power2.out",
        scrollTrigger: {
          id:      "prize-counter",
          trigger: container,
          start:   "top 85%",
          once:    true,
        },
        onUpdate() {
          elNode.textContent = fmt(obj.val);
          /* throttle audio to ≤1 tick per 90ms during the count-up */
          const now = Date.now();
          if (now - audioGateRef.current > 90) {
            audioGateRef.current = now;
            audioManager.playPrizeTick();
          }
        },
        onComplete: scheduleTick,
      });
    }, container);

    /* ── Live-tick: simulates prize pool growing in real-time ──────────── */
    function scheduleTick() {
      const delay = TICK_MIN_MS + Math.random() * (TICK_MAX_MS - TICK_MIN_MS);
      tickTimerRef.current = setTimeout(() => {
        const inc = Math.floor(INC_MIN + Math.random() * (INC_MAX - INC_MIN));
        liveValRef.current += inc;

        gsap.to(obj, {
          val:      liveValRef.current,
          duration: 0.5,
          ease:     "power1.out",
          onUpdate() { elNode.textContent = fmt(obj.val); },
          onComplete: scheduleTick,
        });
        audioManager.playPrizeTick();
      }, delay);
    }

    return () => {
      ctx.revert();
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
      ScrollTrigger.getById("prize-counter")?.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-2 text-center"
    >
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width:        "7px",
            height:       "7px",
            borderRadius: "50%",
            background:   "#7fd8ff",
            boxShadow:    "0 0 8px rgba(127,216,255,0.95)",
            display:      "inline-block",
            flexShrink:   0,
            animation:    "plasma-pulse 2.5s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.58rem",
            fontWeight:    700,
            letterSpacing: "0.24em",
            color:         "rgba(127,216,255,0.7)",
            textTransform: "uppercase",
          }}
        >
          Active Prize Pool
        </span>
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.52rem",
            letterSpacing: "0.12em",
            color:         "rgba(255,255,255,0.22)",
          }}
        >
          · Season 1
        </span>
      </div>

      {/* Main number */}
      <span
        ref={numRef}
        aria-live="polite"
        aria-atomic="true"
        aria-label="Active prize pool amount"
        style={{
          fontFamily:        "var(--font-hud)",
          fontSize:          "clamp(2.8rem, 8vw, 5.2rem)",
          fontWeight:        700,
          letterSpacing:     "-0.04em",
          lineHeight:        1,
          color:             "#7fd8ff",
          textShadow:
            "0 0 20px rgba(127,216,255,0.9), 0 0 50px rgba(127,216,255,0.5), 0 0 100px rgba(127,216,255,0.2)",
          fontVariantNumeric:"tabular-nums",
        }}
      >
        $0
      </span>

      {/* Sub-label */}
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.50rem",
          letterSpacing: "0.18em",
          color:         "rgba(255,255,255,0.22)",
          textTransform: "uppercase",
        }}
      >
        Smart Contract Escrow · Updated Live
      </span>
    </div>
  );
}
