"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayLink } from "@/components/ui/PlayLink";

const SESSION_KEY = "bmb_sticky_dismissed";

export function StickyCtaBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setDismissed(true);
      return;
    }

    const threshold = typeof window !== "undefined" ? window.innerHeight * 0.9 : 600;

    const onScroll = () => {
      setVisible(window.scrollY > threshold);
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
    <div
      className="pointer-events-none fixed left-0 right-0 z-40 block md:hidden"
      style={{ bottom: "calc(52px + env(safe-area-inset-bottom, 0px))" }}
    >
      <AnimatePresence>
        {visible && !dismissed && (
          <motion.div
            key="sticky-cta"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="pointer-events-auto mx-3 overflow-hidden pixel-inset"
            style={{
              background: "rgba(10,12,18,0.96)",
              border: "2px solid rgba(245,200,66,0.28)",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.55), 0 0 40px rgba(245,200,66,0.06)",
            }}
          >
            <div
              style={{
                height: "2px",
                background: "linear-gradient(90deg, transparent, #f5c842 30%, #ff9a3d 70%, transparent)",
              }}
            />

            <div className="flex items-center gap-3 p-3">
              <span style={{ fontSize: "1.35rem", lineHeight: 1 }}>💣</span>

              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                  PLAY NOW
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                  Free · Win SOL · No download
                </span>
              </div>

              <PlayLink className="cta-yellow shrink-0 px-4" style={{ height: 40, fontSize: "0.78rem", display: "inline-flex", alignItems: "center" }}>
                ▶ Play
              </PlayLink>

              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss"
                className="shrink-0 flex h-7 w-7 items-center justify-center pixel-inset"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.7rem",
                  cursor: "pointer",
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
