"use client";

import { motion } from "framer-motion";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

type State = "now" | "next" | "soon";

const PHASES: Array<{ no: string; name: string; state: State; body: string }> = [
  { no: "01", name: "The Drop",   state: "now",  body: "Fair launch, ranked seasons, Arena stakes, Telegram Mini App." },
  { no: "02", name: "The Swarm",  state: "next", body: "Spectator mode, tournaments, clan wars, real-yield staking + DAO." },
  { no: "03", name: "The Furnace",state: "soon", body: "Deflationary burn engine live, creator rev-share, live match betting." },
  { no: "04", name: "Global War", state: "soon", body: "Esports tier, Twitch/Kick integration, cross-region championships." },
];

const STATE_COLOR: Record<State, string> = { now: "#f5c842", next: "#3a9e9e", soon: "rgba(255,255,255,0.3)" };
const STATE_LABEL: Record<State, string> = { now: "NOW", next: "NEXT", soon: "SOON" };

export function RoadmapScene() {
  return (
    <section className="relative w-full" style={{ background: "var(--color-bg-2, #0b0a10)", paddingInline: "var(--section-px, 1.5rem)", paddingBlock: "clamp(4rem, 8vw, 7rem)" }}>
      <div className="mx-auto max-w-[1200px]">
        <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", color: "#f5c842", marginBottom: "0.75rem", letterSpacing: "0.04em" }}>THE ROADMAP</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 2.5rem" }}>
          From beta to global war.
        </h2>

        {/* timeline — horizontal on desktop, vertical on mobile */}
        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* connecting line (desktop) */}
          <div aria-hidden className="pointer-events-none absolute hidden md:block" style={{ top: 7, left: "12.5%", right: "12.5%", height: 1, background: "rgba(255,255,255,0.1)" }} />

          {PHASES.map((p, i) => {
            const color = STATE_COLOR[p.state];
            return (
              <motion.div
                key={p.no}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.55, ease, delay: i * 0.1 }}
                className="relative flex flex-col gap-3"
              >
                <span className="relative h-3.5 w-3.5 rounded-full" style={{ background: color, boxShadow: p.state === "now" ? `0 0 0 4px ${color}22, 0 0 16px ${color}` : "none" }} />
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", color }}>{p.no}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.16em", color, textTransform: "uppercase", border: `1px solid ${color}40`, borderRadius: 999, padding: "1px 7px" }}>{STATE_LABEL[p.state]}</span>
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl, 1.6rem)", lineHeight: 1, color: "#fff", margin: 0 }}>{p.name}</h3>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", lineHeight: 1.55, color: "rgba(255,255,255,0.42)", margin: 0 }}>{p.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
