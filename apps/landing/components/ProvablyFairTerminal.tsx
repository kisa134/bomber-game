"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PixelGlassGlitch } from "@/components/effects/PixelGlassGlitch";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const TEAL = "#3a9e9e";
const RED = "#d44030";

const STEPS = [
  { title: "Server commits", body: "Before the match the server hashes a secret seed and publishes the commitment. It can never change the outcome after the fact." },
  { title: "You add entropy", body: "Your client seed is mixed in. Neither side can predict or bias the spawn layout, crate drops, or power-up order." },
  { title: "Reveal & verify", body: "When the match ends the seed is revealed. Re-hash it yourself — if it matches the commitment, the match was provably fair." },
];

/** Real SHA-256 in the browser — no server call, no mock. */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Status = "idle" | "computing" | "verified" | "mismatch";

export function ProvablyFairTerminal() {
  const [seed, setSeed] = useState("bombermeme:season1:match-0001");
  const [commit, setCommit] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Seed a self-consistent REAL example: commit = sha256(seed).
  useEffect(() => {
    let alive = true;
    void sha256Hex("bombermeme:season1:match-0001").then((h) => { if (alive) setCommit(h); });
    return () => { alive = false; };
  }, []);

  async function verify() {
    setStatus("computing");
    const h = await sha256Hex(seed);
    setStatus(h.trim().toLowerCase() === commit.trim().toLowerCase() ? "verified" : "mismatch");
  }

  const statusColor = status === "verified" ? TEAL : status === "mismatch" ? RED : "rgba(255,255,255,0.4)";

  return (
    <section
      className="relative w-full"
      style={{ background: "var(--color-bg-3, #090810)", paddingInline: "var(--section-px, 1.5rem)", paddingBlock: "clamp(4rem, 8vw, 7rem)" }}
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Left: explanation */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, ease }}
        >
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.6rem", color: TEAL, marginBottom: "1rem", letterSpacing: "0.04em" }}>
            PROVABLY FAIR
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 1.5rem" }}>
            Zero trust<br />required.
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-base,1rem)", lineHeight: 1.7, color: "rgba(255,255,255,0.5)", maxWidth: "46ch", marginBottom: "2rem" }}>
            No black boxes, no house edge on the RNG. The match outcome is committed before you play and revealed after — math you can run yourself, right here.
          </p>
          <ol className="flex flex-col gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 700, color: TEAL, background: "rgba(58,158,158,0.10)", border: `1px solid ${TEAL}40` }}>
                  {i + 1}
                </span>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem", color: "#fff", marginBottom: 2, textTransform: "uppercase" }}>{s.title}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", lineHeight: 1.55, color: "rgba(255,255,255,0.42)" }}>{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Right: REAL verifier terminal */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.75, ease, delay: 0.1 }}
        >
          <PixelGlassGlitch variant="cyan" mode="pulse" intensity={0.85}>
            <div style={{ background: "var(--color-inset, rgba(0,0,0,0.25))", overflow: "hidden" }}>
          {/* chrome */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
            <span className="terminal-dot" style={{ background: RED }} />
            <span className="terminal-dot" style={{ background: "#f0a92a" }} />
            <span className="terminal-dot" style={{ background: TEAL }} />
            <span className="ml-3" style={{ fontFamily: "var(--font-pixel)", fontSize: "0.5rem", color: "rgba(255,255,255,0.4)" }}>VERIFIER.SOL</span>
          </div>

          <div className="flex flex-col gap-4 px-5 py-5" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
            <Field label="SERVER COMMIT  (sha256 of seed)" value={commit} readOnly mono />
            <Field label="REVEALED SEED  (editable — change it to see a mismatch)" value={seed} onChange={(v) => { setSeed(v); setStatus("idle"); }} mono />

            <button
              onClick={verify}
              disabled={status === "computing"}
              style={{
                width: "100%", height: "46px", borderRadius: "var(--radius-sm,0.375rem)", cursor: "pointer",
                fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.9rem",
                color: "#06100f", background: TEAL, border: "none",
                boxShadow: "0 0 16px rgba(58,158,158,0.3)",
              }}
            >
              {status === "computing" ? "Hashing…" : "▶ Verify Now"}
            </button>

            {/* output */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <Line k="$ sha256(seed)" v={status === "idle" ? "— press verify —" : status === "computing" ? "computing…" : "" } />
              {(status === "verified" || status === "mismatch") && (
                <div className="inline-flex items-center gap-2 self-start rounded-md px-3 py-1.5"
                  style={{ background: `${statusColor}14`, border: `1px solid ${statusColor}40`, color: statusColor, fontWeight: 700, letterSpacing: "0.06em" }}>
                  {status === "verified" ? "✓ MATCH VERIFIED · 100% FAIR" : "✕ MISMATCH · seed ≠ commit"}
                </div>
              )}
              <Line k="// runs entirely in your browser" v="" dim />
            </div>
          </div>
            </div>
          </PixelGlassGlitch>
        </motion.div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, readOnly, mono }: { label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        style={{
          width: "100%", height: "40px", padding: "0 12px",
          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--radius-sm,0.375rem)",
          color: readOnly ? "rgba(255,255,255,0.55)" : "#fff", outline: "none",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-body)", fontSize: "0.74rem",
          textOverflow: "ellipsis",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(58,158,158,0.6)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
      />
    </label>
  );
}

function Line({ k, v, dim }: { k: string; v: string; dim?: boolean }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem", color: dim ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)" }}>
      <span style={{ color: dim ? "rgba(255,255,255,0.25)" : TEAL }}>{k}</span> {v}
    </div>
  );
}
