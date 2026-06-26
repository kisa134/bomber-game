"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const FAQS = [
  {
    q: "What is BomberMeme?",
    a: "BomberMeme is a provably fair, browser-native meme-PvP deathmatch on Solana. Up to 4 players enter an arena — styled after iconic meme tokens — plant bombs, collect powerups, and the last player standing wins the entire SOL pot. No download required.",
  },
  {
    q: "How does the prize pot work?",
    a: "Every match has an entry fee paid in SOL. All entry fees combine into a single pot. The last player standing wins up to +300% of their entry. A small platform fee is taken for sustainability and creator rewards. Everything is on-chain and verifiable via SHA-256.",
  },
  {
    q: "Do I need a crypto wallet to play?",
    a: "No wallet is required to play for free. For paid matches and skin ownership you'll need a Solana wallet — Phantom, Solflare, and Backpack are all supported via Sign-In With Solana (SIWS).",
  },
  {
    q: "What is the $BMB token used for?",
    a: "$BMB is the native token of the BomberMeme ecosystem. It powers in-game cosmetics, wallet-gated skins, creator reward boosts, and future governance. Token is live on pump.fun — no presale, fair launch.",
  },
  {
    q: "How is the game provably fair?",
    a: "Every match seed is committed on-chain before the game starts using SHA-256. After each match, players can independently verify the outcome using the published seed. The authoritative game server runs at 20 Hz using uWebSockets.js with client-side prediction for zero-latency feel.",
  },
];

export function HomeFaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="relative w-full px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease }}
          className="mb-10 flex flex-col items-center gap-2"
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#ffcc33",
              textShadow: "0 0 10px rgba(255,204,51,0.55)",
            }}
          >
            Got Questions?
          </span>
          <h2
            className="text-3xl font-bold sm:text-4xl text-center"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(180deg,#fff0c0,#ffcc33 55%,#ff9a3d)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.03em",
            }}
          >
            FAQ
          </h2>
        </motion.div>

        {/* Accordion items */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
          }}
          className="flex flex-col gap-3"
        >
          {FAQS.map((faq, i) => (
            <FaqItem
              key={i}
              faq={faq}
              index={i}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FaqItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: { q: string; a: string };
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl"
      style={{
        background: isOpen ? "rgba(255,204,51,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isOpen ? "rgba(255,204,51,0.20)" : "rgba(255,255,255,0.07)"}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* Question row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(0.9rem, 2.5vw, 1.05rem)",
            fontWeight: 600,
            color: isOpen ? "#ffcc33" : "rgba(255,255,255,0.82)",
            letterSpacing: "-0.01em",
            transition: "color 0.25s ease",
            textAlign: "left",
          }}
        >
          {faq.q}
        </span>

        {/* +/− icon */}
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: isOpen ? "rgba(255,204,51,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isOpen ? "rgba(255,204,51,0.35)" : "rgba(255,255,255,0.10)"}`,
            color: isOpen ? "#ffcc33" : "rgba(255,255,255,0.45)",
            fontSize: "1rem",
            lineHeight: 1,
            fontWeight: 300,
            transition: "background 0.25s ease, border-color 0.25s ease, color 0.25s ease",
          }}
        >
          +
        </motion.span>
      </button>

      {/* Answer — AnimatePresence height animation */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-5 pb-5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.82rem",
                lineHeight: 1.75,
                color: "rgba(255,255,255,0.48)",
              }}
            >
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
