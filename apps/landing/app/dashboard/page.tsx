"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";
import { fetchReferralStats, type ReferralStats } from "@/lib/gameApi";
import { PlayLink } from "@/components/ui/PlayLink";
import { TOKEN_TICKER } from "@/lib/token";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const TIER_NAMES = ["Direct (L1)", "Tier 2", "Tier 3", "Tier 4", "Tier 5"];
const TIER_COLORS = ["#f5c842", "#f0a92a", "#3a9e9e", "#7a8290", "#5a6270"];

export default function DashboardPage() {
  const [wallet, setWallet] = useState("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = wallet.trim();
    if (!w) return;
    setLoading(true);
    setError("");
    const s = await fetchReferralStats(w);
    setLoading(false);
    setSearched(true);
    if (!s) {
      setError("Could not reach the game server. Try again in a moment.");
      setStats(null);
      return;
    }
    setStats(s);
  };

  const totalNetwork = stats ? stats.network.reduce((a, b) => a + b, 0) : 0;

  return (
    <main className="relative min-h-screen w-full" style={{ background: "var(--color-bg-3, #090810)" }}>
      <div className="mx-auto max-w-[900px]" style={{ paddingInline: "var(--section-px,1.5rem)", paddingTop: "112px", paddingBottom: "64px" }}>

        {/* Hero */}
        <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", color: "#f5c842", marginBottom: "0.75rem" }}>GUILD COMMAND</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, color: "#fff", margin: 0 }}>Referral Dashboard</h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "rgba(255,255,255,0.5)", marginTop: "1rem", maxWidth: "54ch" }}>
          Look up any wallet&apos;s live referral network — real recruits, real earnings, straight from the game server.
        </p>

        {/* Lookup form */}
        <form onSubmit={lookup} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Paste your Solana wallet address…"
            spellCheck={false}
            style={{
              flex: 1, fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#fff",
              background: "var(--color-inset, rgba(0,0,0,0.3))", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10, padding: "14px 16px", outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#f5c842"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
          />
          <button type="submit" disabled={loading} className="cta-yellow inline-flex items-center justify-center px-8"
            style={{ height: 50, fontSize: "0.9rem", opacity: loading ? 0.6 : 1, cursor: loading ? "wait" : "pointer", border: "none" }}>
            {loading ? "Looking up…" : "Look up"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: "1rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#d44030", background: "rgba(212,64,48,0.08)", border: "1px solid rgba(212,64,48,0.25)", borderRadius: 8, padding: "10px 14px" }}>
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {stats && (
            <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease }} className="mt-12">

              {/* Headline stats */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="pixel-panel p-6">
                  <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.2rem", color: "#f5c842", lineHeight: 1 }}>{stats.earned.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginTop: 6 }}>${TOKEN_TICKER} earned</div>
                </div>
                <div className="pixel-panel p-6">
                  <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.2rem", color: "#fff", lineHeight: 1 }}>{stats.direct.toLocaleString()}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginTop: 6 }}>Direct recruits</div>
                </div>
                <div className="pixel-panel p-6">
                  <div className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.2rem", color: "#3a9e9e", lineHeight: 1 }}>{totalNetwork.toLocaleString()}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginTop: 6 }}>Total network</div>
                </div>
              </div>

              {/* Per-tier breakdown */}
              <div className="mt-8 pixel-panel p-6">
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.16em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: "1.25rem" }}>5-Tier Network · rake share per level</div>
                <div className="flex flex-col gap-3">
                  {stats.network.map((count, i) => {
                    const max = Math.max(1, ...stats.network);
                    const pct = stats.levels[i] ?? 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span style={{ width: 90, fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>{TIER_NAMES[i]}</span>
                        <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }} transition={{ duration: 0.7, ease, delay: i * 0.06 }}
                            style={{ height: "100%", borderRadius: 999, background: TIER_COLORS[i] }} />
                        </div>
                        <span className="tabular" style={{ width: 56, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>{count.toLocaleString()}</span>
                        <span style={{ width: 44, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: TIER_COLORS[i] }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                {stats.rakePct > 0 && (
                  <div style={{ marginTop: "1.25rem", fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>
                    House rake: <span style={{ color: "#f5c842" }}>{stats.rakePct}%</span> per staked match · referral share is funded entirely from collected rake.
                  </div>
                )}
              </div>

              {totalNetwork === 0 && (
                <div className="mt-8 pixel-panel p-8 text-center">
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", margin: "0 0 1.25rem" }}>
                    No referrals on this wallet yet. Share your link from inside the game to start building your network.
                  </p>
                  <PlayLink className="cta-yellow inline-flex items-center px-8" style={{ height: 48, fontSize: "0.9rem" }}>▶ Open the game</PlayLink>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!stats && !searched && (
          <div className="mt-12 pixel-panel p-6">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
              <span style={{ color: "#f5c842" }}>How it works:</span> every fighter you recruit is cryptographically bound to your wallet. You earn a share of the house rake on every staked match they — and everyone they recruit, five tiers deep — ever play. All numbers here are live from the game server.
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
