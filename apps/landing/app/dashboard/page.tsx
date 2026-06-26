"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const DEMO_EMAIL = "admin@bombermeme.fun";
const DEMO_PASSWORD = "admin123";

/* ── Network rows ─────────────────────────────────────────────────────────── */
const NETWORK_ROWS = [
  { label: "Tier 1 (Direct)", value: "247",    color: "#ffcc33" },
  { label: "Tier 2",          value: "1,830",  color: "#ff9a3d" },
  { label: "Tier 3–5",        value: "12,441", color: "#c084fc" },
];

/* ── Attribution bars ────────────────────────────────────────────────────── */
const ATTRIBUTION = [
  { label: "Attributed (via link)",       value: 78, color: "#f5c842" },
  { label: "Unattached (organic core)",   value: 22, color: "#7fd8ff" },
];

/* ── Monthly stats ───────────────────────────────────────────────────────── */
const MONTHLY = [
  { label: "Volume",   val: "$24,100" },
  { label: "Rake",     val: "$1,205"  },
  { label: "Your Cut", val: "$120.5"  },
];

/* ── Top partners ────────────────────────────────────────────────────────── */
const TOP_PARTNERS = [
  { rank: 1, handle: "CryptoWave_TV", vol: "$18,420", color: "#ffcc33" },
  { rank: 2, handle: "0xPepe_GG",     vol: "$12,310", color: "#c0c0c0" },
  { rank: 3, handle: "BlockBomber",   vol: "$9,875",  color: "#cd7f32" },
  { rank: 4, handle: "SolanaShark",   vol: "$7,240",  color: "rgba(255,255,255,0.35)" },
  { rank: 5, handle: "MemeKing_EN",   vol: "$5,102",  color: "rgba(255,255,255,0.35)" },
];

/* ══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setError("Invalid credentials. Use the demo access below.");
      }
      setLoading(false);
    }, 600);
  };

  return (
    <main
      className="relative min-h-screen w-full flex items-center justify-center overflow-x-hidden"
      style={{ background: "transparent" }}
    >
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        background: `
          radial-gradient(ellipse 60% 50% at 50% 0%,   rgba(192,132,252,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 40% 60% at 90% 50%,  rgba(245,200,66,0.04) 0%, transparent 60%),
          radial-gradient(ellipse 40% 40% at 5%  70%,  rgba(74,163,255,0.04) 0%, transparent 60%)
        `,
      }} />

      <div className="relative z-10 w-full px-5 py-20 sm:px-8">

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease }}
          style={{ position: "fixed", top: "28px", left: "28px" }}
        >
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-mono)", fontSize: "0.72rem",
              letterSpacing: "0.15em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.30)", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: "8px",
              transition: "color 0.18s ease",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.70)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.30)")}
          >
            ← Arena
          </Link>
        </motion.div>

        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <LoginForm
              key="login"
              email={email}
              password={password}
              error={error}
              loading={loading}
              onEmail={setEmail}
              onPassword={setPassword}
              onSubmit={handleSignIn}
            />
          ) : (
            <DashboardUI key="dashboard" onSignOut={() => setIsAuthenticated(false)} />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LOGIN FORM                                                                 */
/* ══════════════════════════════════════════════════════════════════════════ */
function LoginForm({
  email, password, error, loading, onEmail, onPassword, onSubmit,
}: {
  email: string; password: string; error: string; loading: boolean;
  onEmail: (v: string) => void; onPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24, scale: 0.97 }}
      transition={{ duration: 0.6, ease }}
      style={{
        maxWidth: "420px", width: "100%", margin: "0 auto",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "32px",
      }}
    >
      {/* Logo / wordmark */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "10px",
          marginBottom: "20px",
        }}>
          <span style={{ fontSize: "2rem", lineHeight: 1 }}>💣</span>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem",
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #fff8c0 0%, #ffdf50 40%, #ffcc33 60%, #ff9a3d 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            BOMBERMEME
          </span>
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "1.9rem", letterSpacing: "-0.03em",
          color: "#fff", margin: "0 0 8px",
        }}>
          Partner Portal
        </h1>
        <p style={{
          fontFamily: "var(--font-display)", fontSize: "0.9rem",
          color: "rgba(255,255,255,0.38)", margin: 0,
        }}>
          Sign in to access your referral dashboard
        </p>
      </div>

      {/* Glass card */}
      <div style={{
        width: "100%",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(32px) saturate(1.4)",
        WebkitBackdropFilter: "blur(32px) saturate(1.4)",
        borderRadius: "20px",
        padding: "36px 32px",
        boxShadow: "0 8px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <LoginField
            label="Email Address"
            type="email"
            placeholder="admin@bombermeme.fun"
            value={email}
            onChange={onEmail}
          />
          <LoginField
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={onPassword}
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                fontFamily: "var(--font-mono)", fontSize: "0.65rem",
                letterSpacing: "0.10em", color: "#ff5a5f",
                background: "rgba(255,90,95,0.08)",
                border: "1px solid rgba(255,90,95,0.22)",
                borderRadius: "8px", padding: "8px 12px",
              }}
            >
              ⚠ {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "6px",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.02em",
              color: "#111",
              background: loading
                ? "rgba(255,204,51,0.4)"
                : "linear-gradient(135deg, #ffe066 0%, #ffcc33 40%, #ff9a3d 100%)",
              boxShadow: loading ? "none" : "0 0 24px rgba(255,204,51,0.35), 0 4px 12px rgba(0,0,0,0.3)",
              transition: "opacity 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(255,204,51,0.55), 0 4px 16px rgba(0,0,0,0.4)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(255,204,51,0.35), 0 4px 12px rgba(0,0,0,0.3)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }
            }}
          >
            {loading ? "Authenticating…" : "Sign In →"}
          </button>
        </form>
      </div>

      {/* Demo credentials hint */}
      <p style={{
        fontFamily: "var(--font-mono)", fontSize: "0.62rem",
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.22)", textAlign: "center",
        lineHeight: 1.8, margin: 0,
      }}>
        Demo Access:{" "}
        <span style={{ color: "rgba(255,255,255,0.42)" }}>admin@bombermeme.fun</span>
        {" "}/{" "}
        <span style={{ color: "rgba(255,255,255,0.42)" }}>admin123</span>
      </p>
    </motion.div>
  );
}

function LoginField({
  label, type, placeholder, value, onChange,
}: {
  label: string; type: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <label style={{
        fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700,
        letterSpacing: "0.20em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.35)",
      }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        style={{
          fontFamily: "var(--font-display)", fontSize: "0.95rem",
          color: "rgba(255,255,255,0.85)",
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "10px",
          padding: "12px 14px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(192,132,252,0.55)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(192,132,252,0.12)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* DASHBOARD UI                                                               */
/* ══════════════════════════════════════════════════════════════════════════ */
function DashboardUI({ onSignOut }: { onSignOut: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.65, ease }}
      style={{ maxWidth: "960px", width: "100%", margin: "0 auto" }}
    >
      {/* Page header */}
      <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: "#c084fc", textShadow: "0 0 10px rgba(192,132,252,0.5)",
            display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px",
          }}>
            <span style={{ display: "inline-block", width: "20px", height: "1px", background: "rgba(192,132,252,0.6)" }} />
            Referral Dashboard
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(1.6rem, 4vw, 2.4rem)", letterSpacing: "-0.03em",
            color: "#fff", margin: 0, lineHeight: 1.1,
          }}>
            Your Partner Network
          </h1>
        </div>
        <button
          onClick={onSignOut}
          style={{
            fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.30)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "999px", padding: "7px 16px",
            cursor: "pointer", transition: "color 0.18s ease, border-color 0.18s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,90,95,0.80)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,90,95,0.35)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.30)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Terminal window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease, delay: 0.1 }}
        style={{
          background: "rgba(0,0,0,0.40)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 4px 0 rgba(255,255,255,0.03) inset, 0 32px 80px rgba(0,0,0,0.7), 0 0 80px rgba(192,132,252,0.05)",
        }}
      >
        {/* Window chrome / title bar */}
        <div style={{
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 20px",
          display: "flex", alignItems: "center", gap: "8px",
          background: "rgba(0,0,0,0.35)",
        }}>
          {/* Mac dots */}
          {["#ff5a5f", "#ffcc33", "#f5c842"].map((c) => (
            <div key={c} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.75 }} />
          ))}

          {/* Path */}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.60rem",
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.22)", marginLeft: "8px",
            flex: 1, textAlign: "center",
          }}>
            BOMBERMEME.GG / DASHBOARD / REFERRAL-PYRAMID
          </span>

          {/* Live badge */}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.58rem",
            letterSpacing: "0.12em",
            color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.6)",
            background: "rgba(245,200,66,0.08)",
            border: "1px solid rgba(245,200,66,0.22)",
            borderRadius: "999px", padding: "2px 10px",
            flexShrink: 0,
          }}>
            • LIVE
          </span>
        </div>

        {/* 2×2 quadrant grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "1px",
            background: "rgba(255,255,255,0.05)",
          }}
          className="grid-cols-1 sm:grid-cols-2"
        >
          <QuadrantNetworkState />
          <QuadrantAttribution />
          <QuadrantLedger />
          <QuadrantTopPartners />
        </div>

        {/* Footer */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "11px 20px",
          background: "rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "8px",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.56rem",
            color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em",
          }}>
            Data is real-time on-chain · Solana · Provably Fair
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.56rem",
            color: "rgba(192,132,252,0.45)", letterSpacing: "0.10em",
          }}>
            PARTNER MODE
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Quadrant wrapper ─────────────────────────────────────────────────────── */
function Quad({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(14,16,24,0.88)", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <span style={{ fontSize: "1rem", lineHeight: 1 }}>{icon}</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.60rem", fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.28)",
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── Q1: Network State ────────────────────────────────────────────────────── */
function QuadrantNetworkState() {
  return (
    <Quad title="Your Network State" icon="🌐">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {NETWORK_ROWS.map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "0.66rem",
              color: "rgba(255,255,255,0.36)", letterSpacing: "0.10em",
            }}>
              {row.label}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.05rem",
              color: row.color, textShadow: `0 0 12px ${row.color}66`,
            }}>
              {row.value}
            </span>
          </div>
        ))}
        {/* Separator + total */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: "12px",
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.60rem",
            color: "rgba(255,255,255,0.22)", letterSpacing: "0.16em", textTransform: "uppercase",
          }}>
            Total
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.7rem",
            letterSpacing: "-0.03em", color: "#fff",
            textShadow: "0 0 20px rgba(255,255,255,0.18)",
          }}>
            14,518
          </span>
        </div>
      </div>
    </Quad>
  );
}

/* ── Q2: Attribution Split ───────────────────────────────────────────────── */
function QuadrantAttribution() {
  return (
    <Quad title="Attribution Split" icon="🎯">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {ATTRIBUTION.map((bar) => (
          <div key={bar.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "0.63rem",
                color: "rgba(255,255,255,0.38)", letterSpacing: "0.08em",
              }}>
                {bar.label}
              </span>
              <span style={{
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.88rem",
                color: bar.color, textShadow: `0 0 10px ${bar.color}66`,
              }}>
                {bar.value}%
              </span>
            </div>
            <div style={{
              height: "6px", borderRadius: "999px",
              background: "rgba(255,255,255,0.06)", overflow: "hidden",
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${bar.value}%` }}
                transition={{ duration: 1.1, ease, delay: 0.3 }}
                style={{
                  height: "100%", borderRadius: "999px",
                  background: `linear-gradient(90deg, ${bar.color}88, ${bar.color})`,
                  boxShadow: `0 0 8px ${bar.color}66`,
                }}
              />
            </div>
          </div>
        ))}
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: "0.60rem",
          color: "rgba(255,255,255,0.20)", letterSpacing: "0.08em",
          margin: 0, lineHeight: 1.6,
        }}>
          78% of your network volume is directly attributed to your referral links.
          The remaining 22% joined organically but are still locked to your root node.
        </p>
      </div>
    </Quad>
  );
}

/* ── Q3: Financial Ledger ────────────────────────────────────────────────── */
function QuadrantLedger() {
  return (
    <Quad title="Financial Ledger" icon="💰">
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "0.56rem",
            letterSpacing: "0.20em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.26)", marginBottom: "6px",
          }}>
            Total Referral Paid
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease, delay: 0.4 }}
            style={{
              fontFamily: "var(--font-mono)", fontWeight: 700,
              fontSize: "clamp(2rem, 5vw, 2.6rem)",
              letterSpacing: "-0.04em", lineHeight: 1,
              color: "#f5c842",
              textShadow: "0 0 16px rgba(245,200,66,0.8), 0 0 48px rgba(245,200,66,0.35)",
              filter: "drop-shadow(0 0 10px rgba(245,200,66,0.8))",
            }}
          >
            $8,342.50
          </motion.div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "0.58rem",
            color: "rgba(255,255,255,0.18)", marginTop: "5px", letterSpacing: "0.10em",
          }}>
            ≈ 51.2 SOL at current price
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "0.56rem",
            letterSpacing: "0.20em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.26)", marginBottom: "12px",
          }}>
            This Month
          </div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {MONTHLY.map((s) => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontWeight: 700,
                  fontSize: "0.95rem", color: "#fff",
                  letterSpacing: "-0.01em",
                }}>
                  {s.val}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.54rem",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.24)",
                }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Quad>
  );
}

/* ── Q4: Top Partners ────────────────────────────────────────────────────── */
function QuadrantTopPartners() {
  return (
    <Quad title="Top Partners" icon="🏆">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {TOP_PARTNERS.map((p, i) => (
          <motion.div
            key={p.rank}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.07 }}
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "0.65rem", fontWeight: 700,
              color: p.color, width: "16px", textAlign: "center",
              textShadow: p.rank <= 3 ? `0 0 8px ${p.color}88` : "none",
              flexShrink: 0,
            }}>
              {p.rank}
            </span>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: "0.86rem",
              color: "rgba(255,255,255,0.62)", flex: 1,
            }}>
              {p.handle}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.82rem",
              color: "#f5c842", textShadow: "0 0 8px rgba(245,200,66,0.5)",
            }}>
              {p.vol}
            </span>
          </motion.div>
        ))}
      </div>
    </Quad>
  );
}
