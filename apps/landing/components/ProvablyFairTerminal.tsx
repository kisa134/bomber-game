"use client";

import { motion } from "framer-motion";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const STEPS = [
  {
    title: "Server commits",
    body: "Before the match, the server hashes a secret seed and publishes the commitment. It can never change the outcome after the fact.",
  },
  {
    title: "You add entropy",
    body: "Your client seed is mixed in. Neither side can predict or bias the spawn layout, crate drops, or power-up order.",
  },
  {
    title: "Reveal & verify",
    body: "When the match ends, the seed is revealed. Re-hash it yourself — if it matches the commitment, the match was 100% fair.",
  },
];

/* Color-token helpers for the terminal code lines */
const C = {
  comment: "#5b6472",
  fn: "#3ba7ff",
  str: "#ff8a3c",
  ok: "#b8ff35",
  dim: "rgba(255,255,255,0.55)",
};

export function ProvablyFairTerminal() {
  return (
    <section className="relative w-full px-5 py-20 sm:px-8" style={{ background: "transparent" }}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">

        {/* ── Left: copy + numbered list ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
        >
          <div
            className="mb-4 flex items-center gap-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#b8ff35",
              textShadow: "0 0 10px rgba(184,255,53,0.5)",
            }}
          >
            <span style={{ display: "inline-block", width: 22, height: 1, background: "rgba(184,255,53,0.5)" }} />
            Provably Fair
          </div>

          <h2
            className="detonate-heading mb-5"
            style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", color: "#f2f0ea" }}
          >
            Every match,
            <br />
            <span style={{ color: "#b8ff35", textShadow: "0 0 24px rgba(184,255,53,0.35)" }}>
              verifiable.
            </span>
          </h2>

          <p
            className="mb-8 max-w-md"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.95rem",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            No black boxes. No house edge on the RNG. The entire match outcome is
            cryptographically committed before you play and revealed after — math you
            can check yourself.
          </p>

          <ol className="flex flex-col gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#b8ff35",
                    background: "rgba(184,255,53,0.10)",
                    border: "1px solid rgba(184,255,53,0.30)",
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: "#fff",
                      marginBottom: 3,
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.85rem",
                      lineHeight: 1.55,
                      color: "rgba(255,255,255,0.40)",
                    }}
                  >
                    {s.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* ── Right: dark terminal window ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.75, ease, delay: 0.1 }}
          className="terminal-window"
        >
          {/* Title bar with mac dots */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
          >
            <span className="terminal-dot" style={{ background: "#ff5f56" }} />
            <span className="terminal-dot" style={{ background: "#ffbd2e" }} />
            <span className="terminal-dot" style={{ background: "#27c93f" }} />
            <span
              className="ml-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.62rem",
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.30)",
              }}
            >
              verify.ts — bombermeme
            </span>
          </div>

          {/* Code body */}
          <div
            className="overflow-x-auto px-5 py-5"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: 1.85 }}
          >
            <CodeLine n={1}>
              <span style={{ color: C.comment }}>// 1. server commits before the match</span>
            </CodeLine>
            <CodeLine n={2}>
              <span style={{ color: C.dim }}>const</span>{" "}
              <span style={{ color: "#fff" }}>commit</span> ={" "}
              <span style={{ color: C.fn }}>sha256</span>
              <span style={{ color: C.dim }}>(</span>seed<span style={{ color: C.dim }}>)</span>;
            </CodeLine>
            <CodeLine n={3}>{""}</CodeLine>
            <CodeLine n={4}>
              <span style={{ color: C.comment }}>// 2. mix in your client seed</span>
            </CodeLine>
            <CodeLine n={5}>
              <span style={{ color: C.dim }}>const</span>{" "}
              <span style={{ color: "#fff" }}>roll</span> ={" "}
              <span style={{ color: C.fn }}>hmac</span>
              <span style={{ color: C.dim }}>(</span>seed, client
              <span style={{ color: C.dim }}>)</span>;
            </CodeLine>
            <CodeLine n={6}>{""}</CodeLine>
            <CodeLine n={7}>
              <span style={{ color: C.comment }}>// 3. reveal &amp; re-hash to verify</span>
            </CodeLine>
            <CodeLine n={8}>
              <span style={{ color: C.fn }}>assert</span>
              <span style={{ color: C.dim }}>(</span>
              <span style={{ color: C.fn }}>sha256</span>
              <span style={{ color: C.dim }}>(</span>seed<span style={{ color: C.dim }}>)</span> ==={" "}
              commit<span style={{ color: C.dim }}>)</span>;
            </CodeLine>
            <CodeLine n={9}>{""}</CodeLine>

            {/* Verified result */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-2 inline-flex items-center gap-2 rounded-md px-3 py-1.5"
              style={{
                background: "rgba(184,255,53,0.08)",
                border: "1px solid rgba(184,255,53,0.30)",
                color: "#b8ff35",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textShadow: "0 0 12px rgba(184,255,53,0.5)",
              }}
            >
              ✓ MATCH VERIFIED · 100% FAIR
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function CodeLine({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex">
      <span
        className="select-none pr-4 text-right"
        style={{ width: "2ch", color: "rgba(255,255,255,0.16)" }}
      >
        {n}
      </span>
      <span className="whitespace-pre">{children}</span>
    </div>
  );
}
