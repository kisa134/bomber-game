"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Footer } from "@/components/Footer";
import { fetchTournaments, type Tournament } from "@/lib/gameApi";
import { PlayLink } from "@/components/ui/PlayLink";
import { TOKEN_TICKER } from "@/lib/token";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── helpers ─────────────────────────────────────────────────────────────── */
function prizeLabel(t: Tournament): string {
  if (t.entryType === "buyin" && t.entryAmount) {
    return t.currency === 1 ? `${t.entryAmount.toLocaleString()} $${TOKEN_TICKER} buy-in` : `${t.entryAmount.toLocaleString()} chips buy-in`;
  }
  if (t.prizeUsd && t.prizeUsd > 0) return `$${t.prizeUsd.toLocaleString()}`;
  return "Free entry";
}
const STATUS: Record<Tournament["status"], { label: string; color: string }> = {
  reg_open: { label: "OPEN", color: "#f5c842" },
  checkin:  { label: "CHECK-IN", color: "#f0a92a" },
  live:     { label: "● LIVE", color: "#d44030" },
  done:     { label: "DONE", color: "#7a8290" },
};

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const r = Math.max(0, target - now);
  return {
    active: target > 0 && r > 0,
    d: Math.floor(r / 86_400_000),
    h: Math.floor((r % 86_400_000) / 3_600_000),
    m: Math.floor((r % 3_600_000) / 60_000),
    s: Math.floor((r % 60_000) / 1000),
  };
}

function CountBlock({ v, l }: { v: number; l: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.8rem,5vw,3.2rem)", lineHeight: 0.9, color: "#f5c842" }}>{String(v).padStart(2, "0")}</div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.2em", color: "rgba(245,200,66,0.45)", textTransform: "uppercase" }}>{l}</span>
    </div>
  );
}

/* ── Featured tournament ─────────────────────────────────────────────────── */
function Featured({ t }: { t: Tournament }) {
  const cd = useCountdown(t.startAt ?? 0);
  const st = STATUS[t.status];
  return (
    <div className="pixel-panel p-8" style={{ borderColor: `${st.color}40`, boxShadow: `4px 4px 0 rgba(0,0,0,0.45), 0 0 24px ${st.color}15` }}>
      <div className="flex items-center gap-3" style={{ marginBottom: "0.75rem" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", color: st.color, textTransform: "uppercase", border: `1px solid ${st.color}40`, borderRadius: 5, padding: "2px 8px" }}>{st.label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.format === "bracket" ? "Bracket" : "Points race"} · {t.podSize ?? 4}-player pods</span>
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "clamp(1.8rem,5vw,3.5rem)", lineHeight: 0.92, color: "#fff", margin: 0 }}>{t.name}</h2>
      {t.description ? <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", margin: "0.75rem 0 0", maxWidth: "60ch" }}>{t.description}</p> : null}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3" style={{ margin: "1.75rem 0" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", color: "#f5c842" }}>{prizeLabel(t)}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.16em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginTop: 4 }}>Prize / Entry</div>
        </div>
        <div>
          <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", color: "#fff" }}>{t.registered ?? 0}<span style={{ color: "rgba(255,255,255,0.3)" }}>/{t.maxPlayers ?? "—"}</span></div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.16em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginTop: 4 }}>Registered</div>
        </div>
        <div>
          <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", color: "#3a9e9e" }}>{t.entryType === "buyin" ? "Buy-in" : "Free"}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.16em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginTop: 4 }}>Format</div>
        </div>
      </div>

      {cd.active && (
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.18em", color: "rgba(245,200,66,0.5)", textTransform: "uppercase", marginBottom: "0.75rem" }}>Starts in</div>
          <div className="inline-flex items-center gap-4 pixel-inset px-6 py-3" style={{ background: "rgba(0,0,0,0.3)", border: "2px solid rgba(245,200,66,0.18)" }}>
            <CountBlock v={cd.d} l="Days" /><span style={{ color: "rgba(245,200,66,0.25)", fontSize: "1.5rem" }}>:</span>
            <CountBlock v={cd.h} l="Hrs" /><span style={{ color: "rgba(245,200,66,0.25)", fontSize: "1.5rem" }}>:</span>
            <CountBlock v={cd.m} l="Min" /><span style={{ color: "rgba(245,200,66,0.25)", fontSize: "1.5rem" }}>:</span>
            <CountBlock v={cd.s} l="Sec" />
          </div>
        </div>
      )}

      <PlayLink className="cta-yellow inline-flex items-center px-8" style={{ height: 52, fontSize: "0.95rem" }}>
        {t.status === "live" ? "▶ Watch / Join" : "▶ Register in game"}
      </PlayLink>
    </div>
  );
}

/* ── Empty state (honest) ────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="pixel-panel p-12 text-center">
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: 0.6 }}>🏆</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "1.8rem", color: "#fff", margin: "0 0 0.75rem" }}>No live tournaments right now</h2>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", maxWidth: "46ch", margin: "0 auto 1.75rem" }}>
        The season system is live — bracket and points-race events drop straight into the game. Jump into ranked now, or check back for the next event.
      </p>
      <PlayLink className="cta-yellow inline-flex items-center px-8" style={{ height: 52, fontSize: "0.95rem" }}>▶ Play ranked now</PlayLink>
    </div>
  );
}

/* ── Modes (descriptive, real) ───────────────────────────────────────────── */
const MODES = [
  { name: "Casual", color: "#3a9e9e", desc: "Practice freely. No stakes, no MMR — open to every rank." },
  { name: "Ranked", color: "#f5c842", desc: "Skill-matched stakes. Win the pot, climb the Elo ladder, earn season points." },
  { name: "Tournament", color: "#d44030", desc: "Bracket & points-race events. Pods of 4, real prizes, organized seasons." },
] as const;

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function TournamentsPage() {
  const [tours, setTours] = useState<Tournament[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetchTournaments().then((t) => { if (alive) setTours(t); });
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const { featured, rest } = useMemo(() => {
    const list = tours ?? [];
    const order = (s: Tournament["status"]) => (s === "live" ? 0 : s === "checkin" ? 1 : s === "reg_open" ? 2 : 3);
    const sorted = [...list].sort((a, b) => order(a.status) - order(b.status) || (a.startAt ?? 0) - (b.startAt ?? 0));
    return { featured: sorted[0] ?? null, rest: sorted.slice(1) };
  }, [tours]);

  return (
    <main className="relative min-h-screen w-full" style={{ background: "var(--color-bg-2, #0c0c12)" }}>
      <div className="mx-auto max-w-[1100px]" style={{ paddingInline: "var(--section-px,1.5rem)", paddingTop: "112px", paddingBottom: "64px" }}>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", color: "#f5c842", marginBottom: "0.75rem" }}>SEASON ARENA</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, color: "#fff", margin: 0 }}>Tournaments</h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "rgba(255,255,255,0.5)", marginTop: "1rem", maxWidth: "52ch" }}>Organized competition, real prizes, provably-fair brackets. Live data straight from the game server.</p>
        </motion.div>

        {/* Featured / empty */}
        <section className="mt-12">
          {tours === null ? (
            <div className="pixel-panel" style={{ height: 360, opacity: 0.5 }} />
          ) : featured ? (
            <Featured t={featured} />
          ) : (
            <EmptyState />
          )}
        </section>

        {/* All tournaments table */}
        {rest.length > 0 && (
          <section className="mt-16">
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl,1.6rem)", color: "#fff", margin: "0 0 1.25rem" }}>All Events</h2>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["EVENT", "FORMAT", "PRIZE / ENTRY", "PLAYERS", "STATUS"].map((h, i) => (
                      <th key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", textAlign: i > 1 ? "right" : "left", padding: "0 12px 10px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rest.map((t) => {
                    const st = STATUS[t.status];
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "12px", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", fontSize: "0.95rem", color: "#fff" }}>{t.name}</td>
                        <td style={{ padding: "12px", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "rgba(255,255,255,0.45)" }}>{t.format === "bracket" ? "Bracket" : "Points"}</td>
                        <td className="tabular" style={{ padding: "12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#f5c842" }}>{prizeLabel(t)}</td>
                        <td className="tabular" style={{ padding: "12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>{t.registered ?? 0}/{t.maxPlayers ?? "—"}</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", color: st.color, border: `1px solid ${st.color}30`, borderRadius: 4, padding: "2px 8px" }}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Game modes */}
        <section className="mt-20">
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl,1.6rem)", color: "#fff", margin: "0 0 1.25rem" }}>How You Compete</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.name} className="pixel-panel p-6" style={{ borderTop: `3px solid ${m.color}` }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "1.2rem", color: m.color, marginBottom: "0.5rem" }}>{m.name}</div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
