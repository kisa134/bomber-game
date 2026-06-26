"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SESSION_KEY = "bmb_sticky_dismissed";

export function StickyCtaBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Respect user dismissal within the session
    if (sessionStorage.getItem(SESSION_KEY)) {
      setDismissed(true);
      return;
    }

    const threshold = typeof window !== "undefined" ? window.innerHeight * 0.9 : 600;

    const onScroll = () => {
      if (window.scrollY > threshold) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, "1");
  };

  return (
    /* Mobile-only — hidden on md+ */
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 block md:hidden">
      <AnimatePresence>
        {visible && !dismissed && (
          <motion.div
            key="sticky-cta"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="pointer-events-auto mx-3 mb-3 overflow-hidden rounded-2xl"
            style={{
              background: "rgba(10,12,18,0.92)",
              border: "1px solid rgba(255,204,51,0.22)",
              backdropFilter: "blur(20px) saturate(1.5)",
              WebkitBackdropFilter: "blur(20px) saturate(1.5)",
              boxShadow:
                "0 -4px 40px rgba(0,0,0,0.6), 0 0 60px rgba(255,204,51,0.08)",
              /* iOS safe area bottom padding */
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Top accent line */}
            <div
              style={{
                height: "2px",
                background: "linear-gradient(90deg, transparent, #ffcc33 30%, #ff9a3d 70%, transparent)",
              }}
            />

            <div className="flex items-center gap-3 p-4">
              {/* Icon */}
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>💣</span>

              {/* Text block */}
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                  }}
                >
                  PLAY NOW
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.58rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.38)",
                  }}
                >
                  Free Entry · Win SOL · No Download
                </span>
              </div>

              {/* CTA button */}
              <a
                href="http://bombermeme.fun/play"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary relative shrink-0 overflow-hidden rounded-xl px-5 py-2.5 text-center font-bold text-[#111] active:scale-95"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.85rem",
                  transition: "transform 0.08s ease",
                  whiteSpace: "nowrap",
                }}
              >
                <span className="relative z-10">⚡ Play</span>
              </a>

              {/* Dismiss */}
              <button
                onClick={handleDismiss}
                aria-label="Dismiss"
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.35)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
