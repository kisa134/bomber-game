"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/Footer";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ── Intel Database (FAQ) ─────────────────────────────────────────────────── */
const faqData = [
  {
    category: "ROOKIE BRIEFING",
    icon: "🎯",
    questions: [
      {
        q: "What is BomberMeme.fun?",
        a: "BomberMeme.fun is a fast, real-time multiplayer bomber-arena game. Up to 4 players drop bombs on a grid, blow up blocks and each other, grab power-ups, and the last one standing wins. Play free vs bots, casual chip matches, or compete for real $BMB tokens.",
      },
      {
        q: "How do I start playing?",
        a: "1. Open the game in your browser (or inside Telegram). 2. Pick a callsign. 3. Hit Practice vs bots to learn the ropes, or Play Online to jump into live matches. 4. To play for real tokens, connect a Solana wallet and deposit $BMB.",
      },
      {
        q: "Do I need a wallet to play?",
        a: "No. Practice (vs bots) and Casual (free chips) require no wallet. You only need to connect a Solana wallet to play staked Arena matches for real $BMB tokens or to withdraw winnings.",
      },
      {
        q: "Is it free to play?",
        a: "Yes. Practice and casual chip matches are completely free. Real-token Arena matches require a stake you choose. Your risk, your reward.",
      },
    ],
  },
  {
    category: "FIELD MANUAL",
    icon: "🎮",
    questions: [
      {
        q: "How do I win a match?",
        a: "Be the last operative alive. Trap and eliminate opponents with bombs, push them into danger. If the clock hits zero, the match enters sudden death: the arena shrinks until only one stands.",
      },
      {
        q: "What are the controls?",
        a: "Desktop: Arrow keys or WASD to move, Space to drop a bomb. Mobile: on-screen joystick or D-pad to move, dedicated bomb button. Toggle between joystick and buttons in Settings.",
      },
      {
        q: "What are power-ups?",
        a: "Blowing up soft blocks can drop power-ups that make you stronger for the match — more simultaneous bombs, bigger blast radius, faster movement speed, and more. Grab them or let your enemy get them first. Your call.",
      },
      {
        q: "What is 'first blood'?",
        a: "The first player-on-player hit of the match earns a bonus — a big callout and an instant random power-up. Be aggressive early. Hesitation is a death sentence.",
      },
      {
        q: "What happens on a draw?",
        a: "If no single player survives (e.g. everyone dies simultaneously or time expires with multiple operatives alive), it's a draw. All stakes are refunded in full — the house takes nothing on a draw.",
      },
      {
        q: "Can I play on mobile?",
        a: "Affirmative. Mobile-first, runs inside Telegram. Landscape mode recommended — the board is wide, the game will prompt you to rotate.",
      },
    ],
  },
  {
    category: "OPERATION MODES",
    icon: "🏟️",
    questions: [
      {
        q: "What modes are there?",
        a: "Practice vs bots — solo training, choose difficulty and bot count. Casual — quick matches for free chips. The Arena — staked matches for real $BMB tokens; winner takes the pot. Create a lobby — open your own room, pick the stake, invite operatives with a room code.",
      },
      {
        q: "How do I play with my squad?",
        a: "Create a lobby and share the room code, or send your invite link. Operatives enter the code in the lobby browser to join your room.",
      },
      {
        q: "Can I watch live matches?",
        a: "Affirmative. Active matches appear in the lobby browser as LIVE — tap to spectate from the shadows.",
      },
      {
        q: "What is 'Quick Match'?",
        a: "One tap. Instantly matched into an open room at your chosen stake. Fastest route into the arena.",
      },
    ],
  },
  {
    category: "CREDIT SYSTEM",
    icon: "💰",
    questions: [
      {
        q: "Chips vs $BMB — what's the difference?",
        a: "Chips 🪙 are a free, in-game currency for casual play. They cannot be withdrawn and have no cash value — just for bragging rights. $BMB 💎 is the real Solana token. You deposit it, play staked matches for it, and can withdraw winnings to your wallet.",
      },
      {
        q: "How do I get chips?",
        a: "Chips are granted to your account automatically and earned through play. They cost nothing.",
      },
      {
        q: "Where does my $BMB balance live?",
        a: "When you deposit, tokens are held in the game's treasury and credited to your in-game balance (a custodial ledger). Withdraw back to your wallet at any time, subject to displayed limits.",
      },
    ],
  },
  {
    category: "STAKE & RAKE PROTOCOL",
    icon: "⚡",
    questions: [
      {
        q: "How do staked Arena matches work?",
        a: "Every operative puts up the same stake. All stakes form the pot. The winner takes the pot minus the house rake. On a draw, everyone is refunded. No house edge on ties.",
      },
      {
        q: "What is the house rake?",
        a: "A small commission taken from the pot of staked matches — the house's only fee. At 5% rake, the winner of a 100-token pot receives 95 tokens. Exact rake is shown in-game before you commit.",
      },
      {
        q: "Where does the rake go?",
        a: "Rake is split on-chain: 25% burned forever, 54% funds Ecosystem & Infrastructure (servers, anti-cheat AI, prize pools), 21% flows to Guild Yield (5-tier referral network). See the Tokenomics page for full breakdown.",
      },
      {
        q: "Can I lose tokens I didn't stake?",
        a: "Negative. You only risk the stake you choose per match. Zero is taken from your balance beyond the stake you agreed to.",
      },
      {
        q: "What if the match crashes mid-game?",
        a: "Stakes are protected. If a staked match is interrupted before settlement, all escrowed stakes are refunded. Funds are never stranded.",
      },
    ],
  },
  {
    category: "LOADOUT & FUNDING",
    icon: "🔐",
    questions: [
      {
        q: "Which wallets are supported?",
        a: "Any standard Solana wallet (Phantom, Solflare, Backpack, OKX, Coinbase Wallet, etc.) via the Solana Wallet Standard. Mobile uses wallet deeplinks; inside Telegram it connects through Phantom.",
      },
      {
        q: "How do I deposit $BMB?",
        a: "Connect your wallet, open the Bank, enter an amount, approve the transaction. Your tokens go to the treasury and your in-game balance is credited once the transfer confirms on-chain.",
      },
      {
        q: "My deposit hasn't appeared — what do I do?",
        a: "Deposits are usually credited within seconds. If delayed, claim it manually by its transaction signature in the Bank. The system prevents the same deposit from being credited twice.",
      },
      {
        q: "How do I withdraw?",
        a: "Open the Bank, request a withdrawal. Tokens are sent from the treasury to your connected wallet. Minimum and maximum withdrawal limits are shown in-app.",
      },
      {
        q: "Is my withdrawal safe if something goes wrong?",
        a: "Affirmative. Withdrawals are guarded — a transaction is never paid twice, your balance is never over-debited. If a withdrawal is sent but not yet confirmed, the game tells you to check your wallet before retrying.",
      },
    ],
  },
  {
    category: "GUILD NETWORK",
    icon: "🕸️",
    questions: [
      {
        q: "How does the referral network work?",
        a: "Share your operative link. Anyone who joins through it is permanently linked to your network. When your recruits play staked token matches, you earn a share of the rake — 5 tiers deep.",
      },
      {
        q: "How much do I earn per tier?",
        a: "Guild rewards flow from the rake across 5 tiers: Tier 1: 10% · Tier 2: 5% · Tier 3: 3% · Tier 4: 2% · Tier 5: 1% (of the rake). Stack your network deep.",
      },
      {
        q: "When do rewards hit my balance?",
        a: "Rewards are credited in real $BMB automatically when your network plays a staked token match that ends with a winner. Earnings are withdrawable immediately.",
      },
      {
        q: "Do free chip or practice games generate guild rewards?",
        a: "Negative. Guild rewards come from rake on real-token matches only.",
      },
      {
        q: "Can I refer myself or reassign a referrer?",
        a: "Negative. You cannot refer your own wallet. Once linked to a referrer, it is permanent. No exploits.",
      },
    ],
  },
  {
    category: "MMR RANKINGS",
    icon: "🏆",
    questions: [
      {
        q: "How does my MMR rating work?",
        a: "Every ranked match updates your global MMR using an Elo system. As your rating climbs you advance through leagues: Beginner → Advanced → Pro → Champion. Losses cost MMR. Wins earn it.",
      },
      {
        q: "What leaderboards exist?",
        a: "Three boards: MMR Ladder (skill rank), Tokens Won (lifetime real-token winnings), Chips Won (lifetime free-currency winnings).",
      },
      {
        q: "Do bot or practice games affect my MMR?",
        a: "Negative. Practice matches against bots have zero effect on your MMR or leaderboard standing.",
      },
    ],
  },
  {
    category: "ANTI-CHEAT PROTOCOL",
    icon: "🛡️",
    questions: [
      {
        q: "Are matches provably fair?",
        a: "Affirmative. The game map is provably fair: the server commits to a hashed random seed at the start of each match and reveals the seed at the end. Verify it yourself, on-chain.",
      },
      {
        q: "Is the game server-authoritative?",
        a: "Affirmative. All gameplay, stats, and balances are computed and stored on the server — they cannot be faked or inflated by a modified client. The server is the truth.",
      },
      {
        q: "Are my funds safe?",
        a: "Funds are held in a custodial treasury with an atomic ledger: balances cannot go negative, deposits cannot be double-credited, withdrawals cannot be double-paid. Atomic security.",
      },
    ],
  },
  {
    category: "TOKENOMICS INTEL",
    icon: "💎",
    questions: [
      {
        q: "What is $BMB?",
        a: "$BMB is the game's Solana token. It is used for Arena stakes, payouts, guild rewards, and withdrawals. It is also deflationary — 25% of every house rake is permanently burned.",
      },
      {
        q: "Is this a fair launch?",
        a: "Affirmative. Community-first launch on Solana. No private rounds, no hidden pre-sales, no VC bags. 88% to the free market. Zero team dump.",
      },
    ],
  },
  {
    category: "ERROR CODES",
    icon: "🔧",
    questions: [
      {
        q: "The game looks outdated after an update.",
        a: "Hard refresh: Ctrl/Cmd + Shift + R. The game is a PWA and may have cached an older version.",
      },
      {
        q: "I got disconnected mid-match — did I lose?",
        a: "If you reconnect within the short grace window, you are dropped right back into your match. Staked funds are protected regardless.",
      },
      {
        q: "'Server full' — what does that mean?",
        a: "At peak load the server temporarily stops opening new rooms to keep existing matches stable. Stand by and retry shortly.",
      },
      {
        q: "My callsign is taken.",
        a: "Callsigns are globally unique. Pick another operative identity.",
      },
      {
        q: "I connected a wallet but cannot join a token match.",
        a: "Ensure you have deposited enough $BMB to cover the stake. Open the Bank to check your in-game balance.",
      },
    ],
  },
] as const;

/* ── Types ───────────────────────────────────────────────────────────────── */
type Question = { q: string; a: string };
type Category = { category: string; icon: string; questions: readonly Question[] };

/* ── SearchIcon ──────────────────────────────────────────────────────────── */
function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

/* ── Terminal Accordion Item ─────────────────────────────────────────────── */
function AccordionItem({
  question, answer, index, categoryKey,
}: {
  question: string; answer: string; index: number; categoryKey: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease, delay: index * 0.04 }}
      style={{
        borderRadius: 12,
        border: open
          ? "1px solid rgba(90,210,122,0.22)"
          : "1px solid rgba(255,255,255,0.06)",
        background: open ? "rgba(7,8,16,0.97)" : "rgba(255,255,255,0.015)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        overflow: "hidden",
        transition: "border-color 0.22s ease, background 0.22s ease, box-shadow 0.22s ease",
        boxShadow: open
          ? "0 0 28px rgba(90,210,122,0.07), 0 6px 28px rgba(0,0,0,0.45)"
          : "0 2px 10px rgba(0,0,0,0.22)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 16,
          padding: "17px 20px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
        aria-expanded={open}
      >
        {/* Line number prefix */}
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.56rem",
          color: "rgba(90,210,122,0.28)", letterSpacing: "0.06em",
          flexShrink: 0, minWidth: 28,
        }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 600,
          fontSize: "clamp(0.88rem, 2.2vw, 1rem)",
          color: open ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.78)",
          lineHeight: 1.45, transition: "color 0.2s ease", flex: 1,
        }}>
          {question}
        </span>
        {/* Chevron */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.28, ease }}
          style={{
            color: open ? "#5ad27a" : "rgba(255,255,255,0.22)",
            transition: "color 0.22s ease", display: "inline-flex", flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.32, ease }, opacity: { duration: 0.22, ease } }}
            style={{ overflow: "hidden" }}
          >
            {/* Terminal block */}
            <div style={{ padding: "0 20px 18px 20px" }}>
              <div style={{
                background: "#050609",
                border: "1px solid rgba(90,210,122,0.12)",
                borderRadius: 10,
                padding: "14px 16px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                lineHeight: 1.8,
              }}>
                {/* Command line header */}
                <div style={{
                  color: "rgba(90,210,122,0.35)", fontSize: "0.58rem",
                  letterSpacing: "0.14em", marginBottom: 10,
                  borderBottom: "1px solid rgba(90,210,122,0.07)",
                  paddingBottom: 8,
                }}>
                  <span style={{ color: "#5ad27a" }}>~</span>
                  {" / "}
                  <span style={{ color: "rgba(90,210,122,0.55)" }}>intel</span>
                  {" "}
                  <span style={{ color: "rgba(255,255,255,0.22)" }}>--query &quot;{categoryKey}&quot;</span>
                </div>
                {/* Response */}
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{
                    color: "#5ad27a", flexShrink: 0,
                    textShadow: "0 0 6px rgba(90,210,122,0.7)",
                    fontSize: "0.80rem",
                  }}>{">"}</span>
                  <span style={{ color: "rgba(255,255,255,0.72)" }}>{answer}</span>
                </div>
                {/* Blinking cursor at end */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "rgba(90,210,122,0.4)", fontSize: "0.58rem" }}>$</span>
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: [0, 0, 1, 1] }}
                    style={{
                      display: "inline-block", width: 8, height: 14,
                      background: "#5ad27a", opacity: 0.7,
                      boxShadow: "0 0 6px rgba(90,210,122,0.8)",
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Category Section ────────────────────────────────────────────────────── */
function CategorySection({
  category, icon, questions, searchActive,
}: {
  category: string; icon: string; questions: readonly Question[]; searchActive: boolean;
}) {
  if (questions.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.38, ease }}
      style={{ marginBottom: 44 }}
    >
      {!searchActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{icon}</span>
          <h2 style={{
            fontFamily: "var(--font-mono)", fontWeight: 700,
            fontSize: "0.68rem", letterSpacing: "0.22em",
            color: "#5ad27a", margin: 0, textTransform: "uppercase",
            textShadow: "0 0 12px rgba(90,210,122,0.5)",
          }}>
            {category}
          </h2>
          <div style={{ flex: 1, height: 1, background: "rgba(90,210,122,0.08)", marginLeft: 6 }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.52rem",
            color: "rgba(90,210,122,0.35)", letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "rgba(90,210,122,0.04)",
            border: "1px solid rgba(90,210,122,0.12)",
            borderRadius: 999, padding: "2px 9px",
          }}>
            {questions.length} {questions.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <AnimatePresence mode="popLayout">
          {questions.map((item, i) => (
            <AccordionItem
              key={item.q}
              question={item.q}
              answer={item.a}
              index={i}
              categoryKey={category}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

/* ── Cmd+K Console Modal ─────────────────────────────────────────────────── */
function ConsoleModal({
  onClose, onSelectResult,
}: {
  onClose: () => void;
  onSelectResult: (term: string, category: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return faqData
      .flatMap((cat) =>
        cat.questions
          .filter(
            (item) =>
              item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
          )
          .slice(0, 3)
          .map((item) => ({ ...item, category: cat.category, icon: cat.icon }))
      )
      .slice(0, 7);
  }, [query]);

  return (
    <AnimatePresence>
      <motion.div
        key="console-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: "rgba(5,6,9,0.80)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex", alignItems: "flex-start",
          justifyContent: "center", paddingTop: "12vh",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -12 }}
          transition={{ duration: 0.22, ease }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "min(680px, 90vw)",
            background: "rgba(7,8,16,0.99)",
            border: "1px solid rgba(90,210,122,0.40)",
            borderRadius: 16,
            boxShadow:
              "0 0 0 1px rgba(90,210,122,0.06), " +
              "0 0 60px rgba(90,210,122,0.12), " +
              "0 32px 80px rgba(0,0,0,0.75)",
            overflow: "hidden",
          }}
        >
          {/* Console title bar */}
          <div style={{
            padding: "10px 18px",
            borderBottom: "1px solid rgba(90,210,122,0.10)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "0.54rem",
              letterSpacing: "0.20em", color: "rgba(90,210,122,0.38)",
              textTransform: "uppercase",
            }}>
              // BOMBERMEME · INTEL DATABASE v1.0
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "0.52rem",
              letterSpacing: "0.14em", color: "rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 4, padding: "2px 7px",
            }}>
              ESC to close
            </span>
          </div>

          {/* Prompt input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 18px",
            borderBottom: results.length > 0
              ? "1px solid rgba(90,210,122,0.08)"
              : "none",
          }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "1rem", flexShrink: 0,
              color: "#5ad27a", textShadow: "0 0 10px rgba(90,210,122,0.9)",
            }}>$</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search --intel"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontFamily: "var(--font-mono)", fontSize: "1rem",
                color: "#5ad27a", letterSpacing: "0.02em",
                caretColor: "#5ad27a",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  background: "rgba(90,210,122,0.06)", border: "1px solid rgba(90,210,122,0.14)",
                  borderRadius: 999, width: 22, height: 22, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(90,210,122,0.5)", fontSize: "0.75rem",
                }}
              >✕</button>
            )}
          </div>

          {/* Results */}
          <AnimatePresence>
            {results.length > 0 ? (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                style={{ overflow: "hidden" }}
              >
                {results.map((r, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => {
                      onSelectResult(query, r.category);
                      onClose();
                    }}
                    style={{
                      width: "100%", display: "flex", alignItems: "flex-start",
                      gap: 12, padding: "12px 18px", background: "none",
                      border: "none", borderBottom: "1px solid rgba(90,210,122,0.05)",
                      cursor: "pointer", textAlign: "left",
                      transition: "background 0.14s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(90,210,122,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "none";
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.56rem",
                        letterSpacing: "0.18em", color: "rgba(90,210,122,0.45)",
                        textTransform: "uppercase", marginBottom: 3,
                      }}>{r.category}</div>
                      <div style={{
                        fontFamily: "var(--font-display)", fontSize: "0.88rem",
                        color: "rgba(255,255,255,0.82)", lineHeight: 1.4,
                      }}>{r.q}</div>
                    </div>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.50rem",
                      color: "rgba(90,210,122,0.3)", letterSpacing: "0.08em",
                      flexShrink: 0, marginTop: 2,
                    }}>↵ select</span>
                  </motion.button>
                ))}
                <div style={{
                  padding: "8px 18px",
                  fontFamily: "var(--font-mono)", fontSize: "0.55rem",
                  letterSpacing: "0.14em", color: "rgba(255,255,255,0.18)",
                  textTransform: "uppercase",
                }}>
                  {results.length} result{results.length !== 1 ? "s" : ""} found
                </div>
              </motion.div>
            ) : query.trim() ? (
              <div style={{
                padding: "20px 18px",
                fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                color: "rgba(90,210,122,0.38)", letterSpacing: "0.08em",
              }}>
                <span style={{ color: "#5ad27a" }}>!</span> No intel found for &quot;{query}&quot;
              </div>
            ) : (
              <div style={{
                padding: "20px 18px",
                fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                color: "rgba(255,255,255,0.18)", lineHeight: 1.7,
              }}>
                <div>Available commands:</div>
                {faqData.map((cat) => (
                  <div key={cat.category} style={{ marginTop: 6, paddingLeft: 16, display: "flex", gap: 10 }}>
                    <span style={{ color: "rgba(90,210,122,0.40)" }}>{cat.icon}</span>
                    <span style={{ color: "rgba(90,210,122,0.55)", letterSpacing: "0.10em", textTransform: "uppercase", fontSize: "0.58rem" }}>
                      {cat.category}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.58rem" }}>
                      ({cat.questions.length} entries)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main FAQ Page ───────────────────────────────────────────────────────── */
export default function FAQPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = ["All", ...faqData.map((c) => c.category)];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return faqData
      .filter((cat) => activeCategory === "All" || cat.category === activeCategory)
      .map((cat) => ({
        ...cat,
        questions: cat.questions.filter(
          (item) => !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.questions.length > 0);
  }, [search, activeCategory]);

  const totalVisible = filtered.reduce((acc, c) => acc + c.questions.length, 0);
  const totalAll = faqData.reduce((acc, c) => acc + c.questions.length, 0);
  const isSearchActive = search.trim().length > 0;

  const handleModalResult = useCallback((term: string, category: string) => {
    setSearch(term);
    setActiveCategory(category);
  }, []);

  // Cmd+K → open console modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModalOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden" style={{ background: "transparent" }}>
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        zIndex: 0,
        background: `
          radial-gradient(ellipse 55% 35% at 50% 0%,   rgba(90,210,122,0.05)   0%, transparent 65%),
          radial-gradient(ellipse 35% 45% at 5%  40%,  rgba(255,90,77,0.022) 0%, transparent 60%),
          radial-gradient(ellipse 30% 45% at 95% 55%,  rgba(127,216,255,0.018)  0%, transparent 60%),
          radial-gradient(ellipse 50% 30% at 50% 98%,  rgba(168,85,247,0.02)  0%, transparent 60%)
        `,
      }} />

      {/* Cmd+K Console Modal */}
      <AnimatePresence>
        {modalOpen && (
          <ConsoleModal
            onClose={() => setModalOpen(false)}
            onSelectResult={handleModalResult}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8" style={{ paddingTop: 128, paddingBottom: 96 }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* ── Hero ─────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 48, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease }}
            style={{ textAlign: "center", marginBottom: 64 }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease, delay: 0.1 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: "rgba(90,210,122,0.05)",
                border: "1px solid rgba(90,210,122,0.18)",
                borderRadius: 999, padding: "6px 18px",
                fontFamily: "var(--font-mono)", fontSize: "0.58rem",
                letterSpacing: "0.26em", color: "rgba(90,210,122,0.65)",
                textTransform: "uppercase", marginBottom: 24,
              }}
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#5ad27a", boxShadow: "0 0 8px #5ad27a",
                  display: "inline-block",
                }}
              />
              Intel Database · {totalAll} Classified Entries
            </motion.div>

            {/* Title */}
            <h1 style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "clamp(4rem, 13vw, 9rem)",
              lineHeight: 0.88, letterSpacing: "-0.05em",
              background: "linear-gradient(170deg, #fff 0%, #c8ffc8 30%, #5ad27a 58%, #1aad00 85%)",
              WebkitBackgroundClip: "text", backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter:
                "drop-shadow(0 1px 0 rgba(90,210,122,0.9)) " +
                "drop-shadow(0 2px 0 rgba(20,140,0,0.7)) " +
                "drop-shadow(0 4px 0 rgba(10,80,0,0.5)) " +
                "drop-shadow(0 12px 40px rgba(90,210,122,0.22)) " +
                "drop-shadow(0 0 80px rgba(90,210,122,0.14))",
              marginBottom: 24,
            }}>
              INTEL
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{
                fontFamily: "var(--font-mono)", fontSize: "clamp(0.72rem, 2vw, 0.88rem)",
                color: "rgba(255,255,255,0.32)", maxWidth: 480,
                margin: "0 auto", lineHeight: 1.8, letterSpacing: "0.06em",
              }}
            >
              Classified field intel for arena operatives.{" "}
              <span style={{ color: "rgba(90,210,122,0.55)" }}>Read before you drop.</span>
            </motion.p>

            {/* Cmd+K hint */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.5 }}
              onClick={() => setModalOpen(true)}
              style={{
                marginTop: 28, display: "inline-flex", alignItems: "center", gap: 10,
                background: "rgba(90,210,122,0.04)",
                border: "1px solid rgba(90,210,122,0.18)",
                borderRadius: 10, padding: "9px 20px",
                cursor: "pointer", transition: "background 0.18s ease, box-shadow 0.18s ease",
              }}
              whileHover={{
                background: "rgba(90,210,122,0.07)",
                boxShadow: "0 0 20px rgba(90,210,122,0.10)",
              }}
            >
              <SearchIcon size={14} />
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "0.65rem",
                letterSpacing: "0.12em", color: "rgba(255,255,255,0.38)",
              }}>
                Search intel
              </span>
              <kbd style={{
                fontFamily: "var(--font-mono)", fontSize: "0.56rem",
                color: "rgba(90,210,122,0.50)", background: "rgba(90,210,122,0.06)",
                border: "1px solid rgba(90,210,122,0.16)", borderRadius: 5,
                padding: "2px 7px", letterSpacing: "0.08em",
              }}>⌘K</kbd>
            </motion.button>
          </motion.div>

          {/* ── Sticky Filters ─────────────────────────────────────────────── */}
          <div className="sticky top-20 z-50" style={{ marginBottom: 44 }}>
            <div aria-hidden style={{
              position: "absolute", inset: "-14px -20px",
              background: "rgba(7,8,16,0.78)",
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              borderRadius: 18, zIndex: -1,
            }} />

            {/* Inline search bar */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease, delay: 0.3 }}
              style={{ position: "relative", marginBottom: 12 }}
            >
              <div style={{
                position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                color: "rgba(90,210,122,0.40)", pointerEvents: "none",
                display: "flex", alignItems: "center",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem", marginRight: 8 }}>$</span>
                <SearchIcon size={15} />
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="search --intel"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", background: "rgba(7,8,16,0.85)",
                  border: "1px solid rgba(90,210,122,0.14)",
                  borderRadius: 10, padding: "14px 50px 14px 52px",
                  fontFamily: "var(--font-mono)", fontSize: "0.90rem",
                  color: "#5ad27a", letterSpacing: "0.02em",
                  outline: "none", caretColor: "#5ad27a",
                  backdropFilter: "blur(24px) saturate(1.3)",
                  WebkitBackdropFilter: "blur(24px) saturate(1.3)",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(90,210,122,0.35)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(90,210,122,0.06), 0 4px 20px rgba(0,0,0,0.3)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(90,210,122,0.14)";
                  e.target.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
                }}
                aria-label="Search intel database"
              />
              {!search && (
                <button
                  onClick={() => setModalOpen(true)}
                  style={{
                    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                    display: "flex", alignItems: "center", gap: 4,
                    background: "none", border: "none", cursor: "pointer",
                    pointerEvents: "auto",
                  }}
                >
                  <kbd style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.54rem",
                    color: "rgba(90,210,122,0.40)", background: "rgba(90,210,122,0.05)",
                    border: "1px solid rgba(90,210,122,0.12)", borderRadius: 5,
                    padding: "2px 7px", letterSpacing: "0.06em",
                  }}>⌘K</kbd>
                </button>
              )}
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                    background: "rgba(90,210,122,0.07)", border: "1px solid rgba(90,210,122,0.15)",
                    borderRadius: 999, width: 23, height: 23, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(90,210,122,0.55)", fontSize: "0.78rem",
                  }}
                  aria-label="Clear search"
                >✕</button>
              )}
            </motion.div>

            {/* Category filter pills */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.42 }}
              style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}
            >
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                const catData = faqData.find((c) => c.category === cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 14px", borderRadius: 999,
                      fontFamily: "var(--font-mono)", fontWeight: 700,
                      fontSize: "0.58rem", cursor: "pointer", whiteSpace: "nowrap",
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      border: isActive
                        ? "1px solid rgba(90,210,122,0.38)"
                        : "1px solid rgba(90,210,122,0.08)",
                      background: isActive
                        ? "rgba(90,210,122,0.10)"
                        : "rgba(90,210,122,0.02)",
                      color: isActive ? "#5ad27a" : "rgba(255,255,255,0.30)",
                      boxShadow: isActive
                        ? "0 0 14px rgba(90,210,122,0.14), inset 0 1px 0 rgba(90,210,122,0.10)"
                        : "none",
                      transition: "all 0.16s ease",
                    }}
                  >
                    {catData?.icon && <span style={{ fontSize: "0.78rem" }}>{catData.icon}</span>}
                    {cat}
                  </button>
                );
              })}
            </motion.div>
          </div>

          {/* ── Results count ──────────────────────────────────────────────── */}
          <AnimatePresence>
            {isSearchActive && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginBottom: 20, overflow: "hidden" }}
              >
                <p style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                  color: "rgba(90,210,122,0.40)", letterSpacing: "0.14em", textTransform: "uppercase",
                }}>
                  {totalVisible === 0
                    ? "! no intel found"
                    : `> ${totalVisible} entr${totalVisible === 1 ? "y" : "ies"} for "${search}"`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── FAQ Accordion List ─────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  textAlign: "center", padding: "72px 20px",
                  background: "rgba(90,210,122,0.02)",
                  border: "1px solid rgba(90,210,122,0.08)",
                  borderRadius: 16,
                }}
              >
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.70rem",
                  color: "#5ad27a", letterSpacing: "0.14em", marginBottom: 12,
                }}>! ERROR 404 — INTEL NOT FOUND</div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "rgba(255,255,255,0.28)" }}>
                  Try different keywords or{" "}
                  <button
                    onClick={() => { setSearch(""); setActiveCategory("All"); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#5ad27a", fontFamily: "var(--font-mono)", fontSize: "inherit",
                      textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
                    }}
                  >clear filters</button>
                </p>
              </motion.div>
            ) : (
              <motion.div key="results">
                <AnimatePresence mode="popLayout">
                  {filtered.map((cat) => (
                    <CategorySection
                      key={cat.category}
                      category={cat.category}
                      icon={cat.icon}
                      questions={cat.questions}
                      searchActive={isSearchActive}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease }}
            style={{
              marginTop: 72, textAlign: "center",
              background: "rgba(90,210,122,0.02)",
              border: "1px solid rgba(90,210,122,0.10)",
              borderRadius: 20, padding: "44px 32px",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.40), inset 0 1px 0 rgba(90,210,122,0.05)",
            }}
          >
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "0.60rem",
              letterSpacing: "0.20em", color: "rgba(90,210,122,0.40)",
              textTransform: "uppercase", marginBottom: 12,
            }}>// STILL NEED BACKUP?</div>
            <h3 style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
              color: "rgba(255,255,255,0.90)", letterSpacing: "-0.02em", marginBottom: 10,
            }}>
              Link Up With The Squad
            </h3>
            <p style={{
              fontFamily: "var(--font-display)", fontSize: "0.90rem",
              color: "rgba(255,255,255,0.35)", marginBottom: 28, lineHeight: 1.6,
            }}>
              Join the community. Get real answers from active operatives and the core team.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href="http://bombermeme.fun/play"
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 28px", borderRadius: 999,
                  background: "linear-gradient(135deg, #5fff3a 0%, #5ad27a 45%, #1fd600 100%)",
                  border: "1px solid rgba(90,210,122,0.5)",
                  color: "#030f01", fontFamily: "var(--font-display)",
                  fontWeight: 700, fontSize: "0.88rem", textDecoration: "none",
                  letterSpacing: "0.01em",
                  boxShadow: "0 4px 22px rgba(90,210,122,0.35), 0 0 60px rgba(90,210,122,0.12)",
                  transition: "box-shadow 0.2s ease, transform 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 32px rgba(90,210,122,0.55)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 22px rgba(90,210,122,0.35)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                }}
              >
                <span>🕹️</span> Enter Arena
              </a>
              <a
                href="https://t.me/Bombermeme_Fun" target="_blank" rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 24px", borderRadius: 999,
                  background: "rgba(127,216,255,0.07)", border: "1px solid rgba(127,216,255,0.20)",
                  color: "#7fd8ff", fontFamily: "var(--font-display)", fontWeight: 600,
                  fontSize: "0.88rem", textDecoration: "none",
                  transition: "background 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(127,216,255,0.13)";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 20px rgba(127,216,255,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(127,216,255,0.07)";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                }}
              >
                <span>✈️</span> Telegram Ops
              </a>
              <a
                href="https://x.com/BombermemeFun" target="_blank" rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 24px", borderRadius: 999,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)", fontWeight: 600,
                  fontSize: "0.88rem", textDecoration: "none",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)";
                }}
              >
                <span>𝕏</span> Follow Ops
              </a>
            </div>
          </motion.div>

        </div>
      </div>
      <Footer />
    </main>
  );
}
