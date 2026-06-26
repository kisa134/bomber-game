"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3Auth, fmtBalance, fmtMMR } from "@/lib/web3Auth";
import { audioManager } from "@/lib/audioManager";
import { TOKEN_TICKER } from "@/lib/token";

const NAV_LINKS = [
  { label: "Arena",       href: "/" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Partners",    href: "/partners" },
  { label: "Tokenomics",  href: "/tokenomics" },
  { label: "FAQ",         href: "/faq" },
];

/* ── Web3 auth widget ────────────────────────────────────────────────────── */
function AuthWidget() {
  const { status, address, bmbBalance, mmr, connect, disconnect } = useWeb3Auth();
  const [showMenu, setShowMenu] = useState(false);

  function handleConnect() {
    audioManager.unlock();
    connect();
  }

  if (status === "disconnected") {
    return (
      <button
        onClick={handleConnect}
        className="cta-connect"
        aria-label="Connect your wallet"
      >
        ◎ CONNECT
      </button>
    );
  }

  if (status === "connecting") {
    return (
      <div
        style={{
          display:       "flex",
          alignItems:    "center",
          gap:           "7px",
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.66rem",
          fontWeight:    700,
          letterSpacing: "0.10em",
          color:         "rgba(245,200,66,0.6)",
        }}
      >
        <span className="connecting-spinner" />
        LINKING...
      </div>
    );
  }

  /* ── Connected state ── */
  return (
    <div style={{ position: "relative" }}>
      <button
        className="auth-chip"
        onClick={() => {
          audioManager.playClick();
          setShowMenu((v) => !v);
        }}
        aria-label="Wallet connected — view account"
        aria-expanded={showMenu}
      >
        <span className="auth-chip-dot" />
        <span style={{ color: "rgba(255,255,255,0.45)" }}>{address}</span>
        <span
          style={{
            width:      "1px",
            height:     "10px",
            background: "rgba(255,255,255,0.12)",
            flexShrink: 0,
          }}
        />
        {bmbBalance !== null && (
          <span>
            <span className="auth-chip-bal">{fmtBalance(bmbBalance)}</span>
            <span style={{ color: "rgba(255,255,255,0.28)", marginLeft: "3px" }}>{`$${TOKEN_TICKER}`}</span>
          </span>
        )}
        <span
          style={{
            width:      "1px",
            height:     "10px",
            background: "rgba(255,255,255,0.12)",
            flexShrink: 0,
          }}
        />
        {mmr !== null && (
          <span>
            <span style={{ color: "rgba(255,255,255,0.28)" }}>MMR </span>
            <span className="auth-chip-mmr">⚡{fmtMMR(mmr)}</span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {showMenu && (
          <>
            {/* Backdrop dismiss */}
            <div
              style={{ position: "fixed", inset: 0, zIndex: 98 }}
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              key="wallet-menu"
              initial={{ opacity: 0, scale: 0.92, y: -8 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.92, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position:           "absolute",
                top:                "calc(100% + 10px)",
                right:              0,
                zIndex:             99,
                minWidth:           "180px",
                background:         "rgba(10,12,20,0.96)",
                border:             "1px solid rgba(245,200,66,0.20)",
                borderRadius:       "12px",
                backdropFilter:     "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow:          "0 16px 48px rgba(0,0,0,0.75), 0 0 24px rgba(245,200,66,0.06)",
                overflow:           "hidden",
              }}
            >
              <Link
                href="/dashboard"
                onClick={() => {
                  audioManager.playClick();
                  setShowMenu(false);
                }}
                style={{
                  display:       "flex",
                  alignItems:    "center",
                  gap:           "8px",
                  padding:       "11px 16px",
                  fontFamily:    "var(--font-mono)",
                  fontSize:      "0.68rem",
                  fontWeight:    700,
                  letterSpacing: "0.08em",
                  color:         "rgba(255,255,255,0.65)",
                  textDecoration:"none",
                  borderBottom:  "1px solid rgba(255,255,255,0.06)",
                  transition:    "color 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                📊 Guild Dashboard
              </Link>
              <button
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
                style={{
                  width:         "100%",
                  display:       "flex",
                  alignItems:    "center",
                  gap:           "8px",
                  padding:       "11px 16px",
                  fontFamily:    "var(--font-mono)",
                  fontSize:      "0.68rem",
                  fontWeight:    700,
                  letterSpacing: "0.08em",
                  color:         "rgba(255,90,77,0.7)",
                  background:    "transparent",
                  border:        "none",
                  cursor:        "pointer",
                  textAlign:     "left",
                  transition:    "color 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#ff5a4d";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,90,77,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,90,77,0.7)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                ⏏ Disconnect
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main nav ────────────────────────────────────────────────────────────── */
export function TopNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <motion.nav
      role="navigation"
      aria-label="Site navigation"
      className="fixed top-5 right-5 z-50 hidden md:flex"
      animate={{
        background: scrolled
          ? "rgba(7,8,16,0.92)"
          : "rgba(7,8,16,0.55)",
        borderColor: scrolled
          ? "rgba(245,200,66,0.18)"
          : "rgba(245,200,66,0.10)",
        boxShadow: scrolled
          ? "0 4px 40px rgba(0,0,0,0.75), 0 0 24px rgba(245,200,66,0.06), inset 0 1px 0 rgba(255,255,255,0.04)"
          : "0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      style={{
        backdropFilter:       "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        borderRadius:         "999px",
        borderWidth:          "1px",
        borderStyle:          "solid",
        padding:              "8px 18px",
        gap:                  "20px",
        alignItems:           "center",
      }}
    >
      {/* Logo / Home */}
      <Link
        href="/"
        aria-label="Bombermeme Home"
        onClick={() => { audioManager.unlock(); audioManager.playClick(); }}
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            "7px",
          textDecoration: "none",
          transition:     "opacity 0.18s ease",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.8")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
      >
        <span
          style={{
            fontFamily:    "var(--font-heading)",
            fontWeight:    900,
            fontStyle:     "italic",
            fontSize:      "0.78rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color:         pathname === "/" ? "#f5c842" : "rgba(255,255,255,0.75)",
            textShadow:    pathname === "/"
              ? "0 0 14px rgba(245,200,66,0.75), 0 0 30px rgba(245,200,66,0.3)"
              : "none",
            transition:    "color 0.18s ease, text-shadow 0.18s ease",
          }}
        >
          BOMBERMEME
        </span>
      </Link>

      {/* Divider */}
      <div
        aria-hidden
        style={{ width: "1px", height: "14px", background: "rgba(245,200,66,0.12)", flexShrink: 0 }}
      />

      {/* Nav links */}
      {NAV_LINKS.map(({ label, href }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => { audioManager.unlock(); audioManager.playClick(); }}
            style={{
              fontFamily:    "var(--font-display)",
              fontSize:      "0.82rem",
              fontWeight:    600,
              letterSpacing: "0.02em",
              textDecoration:"none",
              color:         active ? "#f5c842" : "rgba(255,255,255,0.55)",
              textShadow:    active
                ? "0 0 14px rgba(245,200,66,0.75), 0 0 30px rgba(245,200,66,0.3)"
                : "none",
              transition:    "color 0.18s ease, text-shadow 0.18s ease",
              position:      "relative",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.90)";
                (e.currentTarget as HTMLElement).style.textShadow = "0 0 10px rgba(255,255,255,0.25)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
                (e.currentTarget as HTMLElement).style.textShadow = "none";
              }
            }}
          >
            {label}
          </Link>
        );
      })}

      {/* Divider */}
      <div
        aria-hidden
        style={{ width: "1px", height: "14px", background: "rgba(245,200,66,0.12)", flexShrink: 0 }}
      />

      {/* Web3 Auth */}
      <AuthWidget />
    </motion.nav>
  );
}
