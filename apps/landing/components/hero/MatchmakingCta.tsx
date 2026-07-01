"use client";

import { usePlayUrl } from "@/lib/playUrl";
import { motion } from "framer-motion";
import { audioManager } from "@/lib/audioManager";
import { TOKEN_TICKER } from "@/lib/token";

interface MatchmakingCtaProps {
  /** Override the primary href — useful for future TMA deep-link */
  playHref?: string;
}

export function MatchmakingCta({ playHref }: MatchmakingCtaProps) {
  const defaultPlay = usePlayUrl();
  const href = playHref ?? defaultPlay;
  return (
    <div
      className="flex w-full flex-col items-stretch gap-3 px-4
                 sm:w-auto sm:flex-row sm:items-center sm:px-0"
    >
      {/* ── PRIMARY: FIND MATCH ─────────────────────────────────────────── */}
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="cta-yellow group relative overflow-hidden text-center"
        style={{
          padding:  "15px 44px",
          fontSize: "1.05rem",
          display:  "block",
        }}
        whileHover={{ scale: 1.04 }}
        whileTap={{   scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        onMouseEnter={() => {
          audioManager.unlock();
          audioManager.playHover();
        }}
        onClick={() => {
          audioManager.unlock();
          audioManager.playMatchFound();
        }}
        aria-label="Find Match — enter the arena"
      >
        {/* Shimmer sweep */}
        <span
          aria-hidden
          className="absolute inset-0 -translate-x-full skew-x-12 bg-white/25
                     transition-transform duration-500 group-hover:translate-x-[130%]"
        />
        <span className="relative z-10 flex items-center justify-center gap-2">
          {/* Animated pulse indicator */}
          <span
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              justifyContent:"center",
              width:        "18px",
              height:       "18px",
              borderRadius: "50%",
              border:       "2px solid rgba(4,8,6,0.5)",
              background:   "rgba(4,8,6,0.25)",
              flexShrink:   0,
            }}
          >
            <span
              style={{
                width:        "0",
                height:       "0",
                borderTop:    "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderLeft:   "8px solid rgba(4,8,6,0.8)",
                marginLeft:   "1px",
              }}
            />
          </span>
          FIND MATCH
        </span>
      </motion.a>

      {/* ── SECONDARY: ENTER RANKED ─────────────────────────────────────── */}
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="cta-ghost group relative overflow-hidden text-center"
        style={{
          padding:  "15px 36px",
          fontSize: "1.0rem",
          display:  "block",
        }}
        whileHover={{ scale: 1.04 }}
        whileTap={{   scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        onMouseEnter={() => {
          audioManager.unlock();
          audioManager.playHover();
        }}
        onClick={() => {
          audioManager.unlock();
          audioManager.playClick();
        }}
        aria-label="Enter Ranked mode"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          <span aria-hidden style={{ fontSize: "0.9em" }}>⚔</span>
          ENTER RANKED
        </span>
      </motion.a>

      {/* ── TERTIARY: Buy $BMB ───────────────────────────────────────────── */}
      <motion.a
        href="https://pump.fun/coin/2Lbnrt7iRx2RHGBXXXc3z8Do3bp3oZ9FtkAohLvxpump"
        target="_blank"
        rel="noopener noreferrer"
        className="cta-ghost text-center"
        style={{
          padding:  "15px 28px",
          fontSize: "0.92rem",
          display:  "block",
        }}
        whileHover={{ scale: 1.03 }}
        whileTap={{   scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        onMouseEnter={() => {
          audioManager.unlock();
          audioManager.playHover();
        }}
        onClick={() => {
          audioManager.unlock();
          audioManager.playClick();
        }}
        aria-label={`Buy $${TOKEN_TICKER} token on pump.fun`}
      >
        💎 Buy {`$${TOKEN_TICKER}`}
      </motion.a>
    </div>
  );
}
