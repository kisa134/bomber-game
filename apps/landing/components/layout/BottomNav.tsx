"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3Auth, fmtBalance, fmtMMR } from "@/lib/web3Auth";
import { audioManager } from "@/lib/audioManager";
import { TOKEN_TICKER } from "@/lib/token";
import type { ReactNode } from "react";

/* ── Icons ───────────────────────────────────────────────────────────────── */
function ArenaIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  );
}
function TournamentIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
function InventoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ── Tab config ──────────────────────────────────────────────────────────── */
interface NavTab {
  label:  string;
  href:   string;
  icon:   (active: boolean) => ReactNode;
  matchExact?: boolean;
}

const TABS: NavTab[] = [
  { label: "Arena",       href: "/",            icon: (a) => <ArenaIcon      active={a} />, matchExact: true },
  { label: "Tournaments", href: "/tournaments",  icon: (a) => <TournamentIcon active={a} /> },
  { label: "Inventory",   href: "/inventory",    icon: (a) => <InventoryIcon  active={a} /> },
  { label: "Profile",     href: "/dashboard",    icon: (a) => <ProfileIcon    active={a} /> },
];

/* ── Component ───────────────────────────────────────────────────────────── */
export function BottomNav() {
  const pathname = usePathname();
  const { status, bmbBalance, mmr } = useWeb3Auth();
  const isConnected = status === "connected";

  function isActive(tab: NavTab) {
    return tab.matchExact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  function handleTabClick() {
    audioManager.unlock();
    audioManager.playTabSwitch();
  }

  return (
    /* Only visible on mobile — hidden on md+ via Tailwind */
    <nav
      className="bottom-nav md:hidden"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Connected player stats bar — appears above nav when authenticated */}
      <AnimatePresence>
        {isConnected && bmbBalance !== null && mmr !== null && (
          <motion.div
            key="stats-bar"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{    y: 20, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position:       "absolute",
              top:            "-36px",
              left:           0,
              right:          0,
              height:         "36px",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            "16px",
              background:     "rgba(7,8,16,0.82)",
              borderTop:      "1px solid rgba(90,210,122,0.08)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              fontSize:       "0.58rem",
              fontFamily:     "var(--font-mono)",
              fontWeight:     700,
              letterSpacing:  "0.12em",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.35)" }}>{`$${TOKEN_TICKER}`}</span>
            <span style={{ color: "#5ad27a", textShadow: "0 0 8px rgba(90,210,122,0.6)" }}>
              {fmtBalance(bmbBalance)}
            </span>
            <span style={{ color: "rgba(255,255,255,0.18)" }}>|</span>
            <span style={{ color: "rgba(255,255,255,0.35)" }}>MMR</span>
            <span style={{ color: "#7fd8ff", textShadow: "0 0 8px rgba(127,216,255,0.6)" }}>
              {fmtMMR(mmr)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {TABS.map((tab) => {
        const active = isActive(tab);
        const isProfile = tab.href === "/dashboard";

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`bottom-nav-tab ${active ? "bottom-nav-tab-active" : ""}`}
            onClick={handleTabClick}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
          >
            {/* Profile badge — green dot when connected */}
            <span style={{ position: "relative", display: "inline-flex" }}>
              {tab.icon(active)}
              {isProfile && isConnected && (
                <span
                  style={{
                    position:     "absolute",
                    top:          "-2px",
                    right:        "-2px",
                    width:        "7px",
                    height:       "7px",
                    borderRadius: "50%",
                    background:   "#5ad27a",
                    border:       "1.5px solid #070810",
                    boxShadow:    "0 0 6px rgba(90,210,122,0.9)",
                  }}
                />
              )}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
