"use client";

import { useEffect, useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { TOKEN_TICKER } from "@/lib/token";

/* ── Real FAQ content (verbatim, ticker from shared) ─────────────────────── */
const faqData = [
  { category: "Rookie Briefing", questions: [
    { q: "What is BomberMeme?", a: "BomberMeme is a fast, real-time multiplayer bomber-arena game. Up to 4 players drop bombs on a grid, blow up blocks and each other, grab power-ups, and the last one standing wins. Play free vs bots, casual chip matches, or compete for real $BMB tokens." },
    { q: "How do I start playing?", a: "1. Open the game in your browser (or inside Telegram). 2. Pick a callsign. 3. Hit Practice vs bots to learn the ropes, or Play Online to jump into live matches. 4. To play for real tokens, connect a Solana wallet and deposit $BMB." },
    { q: "Do I need a wallet to play?", a: "No. Practice (vs bots) and Casual (free chips) require no wallet. You only need a Solana wallet to play staked Arena matches for real $BMB tokens or to withdraw winnings." },
    { q: "Is it free to play?", a: "Yes. Practice and casual chip matches are completely free. Real-token Arena matches require a stake you choose. Your risk, your reward." },
  ]},
  { category: "Field Manual", questions: [
    { q: "How do I win a match?", a: "Be the last operative alive. Trap and eliminate opponents with bombs, push them into danger. If the clock hits zero, the match enters sudden death: the arena shrinks until only one stands." },
    { q: "What are the controls?", a: "Desktop: Arrow keys or WASD to move, Space to drop a bomb. Mobile: on-screen joystick or D-pad to move, dedicated bomb button. Toggle between joystick and buttons in Settings." },
    { q: "What are power-ups?", a: "Blowing up soft blocks can drop power-ups that make you stronger for the match — more simultaneous bombs, bigger blast radius, faster movement speed, and more. Grab them or let your enemy get them first." },
    { q: "What is 'first blood'?", a: "The first player-on-player hit of the match earns a bonus — a big callout and an instant random power-up. Be aggressive early." },
    { q: "What happens on a draw?", a: "If no single player survives, it's a draw. All stakes are refunded in full — the house takes nothing on a draw." },
    { q: "Can I play on mobile?", a: "Affirmative. Mobile-first, runs inside Telegram. Landscape mode recommended — the board is wide, the game will prompt you to rotate." },
  ]},
  { category: "Operation Modes", questions: [
    { q: "What modes are there?", a: "Practice vs bots — solo training. Casual — quick matches for free chips. The Arena — staked matches for real $BMB tokens; winner takes the pot. Create a lobby — open your own room, pick the stake, invite operatives with a room code." },
    { q: "How do I play with my squad?", a: "Create a lobby and share the room code, or send your invite link. Operatives enter the code in the lobby browser to join your room." },
    { q: "Can I watch live matches?", a: "Affirmative. Active matches appear in the lobby browser as LIVE — tap to spectate." },
    { q: "What is 'Quick Match'?", a: "One tap. Instantly matched into an open room at your chosen stake. Fastest route into the arena." },
  ]},
  { category: "Credit System", questions: [
    { q: "Chips vs $BMB — what's the difference?", a: "Chips are a free, in-game currency for casual play. They cannot be withdrawn and have no cash value. $BMB is the real Solana token. You deposit it, play staked matches for it, and can withdraw winnings to your wallet." },
    { q: "How do I get chips?", a: "Chips are granted to your account automatically and earned through play. They cost nothing." },
    { q: "Where does my $BMB balance live?", a: "When you deposit, tokens are held in the game's treasury and credited to your in-game balance (a custodial ledger). Withdraw back to your wallet at any time, subject to displayed limits." },
  ]},
  { category: "Stake & Rake", questions: [
    { q: "How do staked Arena matches work?", a: "Every operative puts up the same stake. All stakes form the pot. The winner takes the pot minus the house rake. On a draw, everyone is refunded. No house edge on ties." },
    { q: "What is the house rake?", a: "A small commission taken from the pot of staked matches — the house's only fee. At 5% rake, the winner of a 100-token pot receives 95 tokens. Exact rake is shown in-game before you commit." },
    { q: "Where does the rake go?", a: "Rake is split on-chain: 25% burned forever, 54% funds Ecosystem & Infrastructure, 21% flows to the Guild network. See the Tokenomics page for the full breakdown." },
    { q: "Can I lose tokens I didn't stake?", a: "Negative. You only risk the stake you choose per match. Nothing is taken beyond the stake you agreed to." },
    { q: "What if the match crashes mid-game?", a: "Stakes are protected. If a staked match is interrupted before settlement, all escrowed stakes are refunded. Funds are never stranded." },
  ]},
  { category: "Wallets & Funding", questions: [
    { q: "Which wallets are supported?", a: "Any standard Solana wallet (Phantom, Solflare, Backpack, OKX, Coinbase Wallet, etc.) via the Solana Wallet Standard. Mobile uses wallet deeplinks; inside Telegram it connects through Phantom." },
    { q: "How do I deposit $BMB?", a: "Connect your wallet, open the Bank, enter an amount, approve the transaction. Your tokens go to the treasury and your in-game balance is credited once the transfer confirms on-chain." },
    { q: "My deposit hasn't appeared — what do I do?", a: "Deposits are usually credited within seconds. If delayed, claim it manually by its transaction signature in the Bank. The system prevents the same deposit from being credited twice." },
    { q: "How do I withdraw?", a: "Open the Bank, request a withdrawal. Tokens are sent from the treasury to your connected wallet. Minimum and maximum withdrawal limits are shown in-app." },
    { q: "Is my withdrawal safe if something goes wrong?", a: "Affirmative. Withdrawals are guarded — a transaction is never paid twice, your balance is never over-debited. If a withdrawal is sent but not yet confirmed, the game tells you to check your wallet before retrying." },
  ]},
  { category: "Guild Network", questions: [
    { q: "How does the referral network work?", a: "Share your operative link. Anyone who joins through it is permanently linked to your network. When your recruits play staked token matches, you earn a share of the rake — 5 tiers deep." },
    { q: "How much do I earn per tier?", a: "Guild rewards flow from the rake across 5 tiers: Tier 1: 10% · Tier 2: 5% · Tier 3: 3% · Tier 4: 2% · Tier 5: 1% (of the rake)." },
    { q: "When do rewards hit my balance?", a: "Rewards are credited in real $BMB automatically when your network plays a staked token match that ends with a winner. Earnings are withdrawable immediately." },
    { q: "Do free chip or practice games generate guild rewards?", a: "Negative. Guild rewards come from rake on real-token matches only." },
    { q: "Can I refer myself or reassign a referrer?", a: "Negative. You cannot refer your own wallet. Once linked to a referrer, it is permanent." },
  ]},
  { category: "MMR & Ranking", questions: [
    { q: "How does my MMR rating work?", a: "Every ranked match updates your global MMR using an Elo system. As your rating climbs you advance through leagues: Beginner → Advanced → Pro → Champion. Losses cost MMR. Wins earn it." },
    { q: "What leaderboards exist?", a: "Three boards: MMR Ladder (skill rank), Tokens Won (lifetime real-token winnings), Chips Won (lifetime free-currency winnings)." },
    { q: "Do bot or practice games affect my MMR?", a: "Negative. Practice matches against bots have zero effect on your MMR or leaderboard standing." },
  ]},
  { category: "Provably Fair", questions: [
    { q: "Are matches provably fair?", a: "Affirmative. The game map is provably fair: the server commits to a hashed random seed at the start of each match and reveals the seed at the end. Verify it yourself on the homepage verifier." },
    { q: "Is the game server-authoritative?", a: "Affirmative. All gameplay, stats, and balances are computed and stored on the server — they cannot be faked or inflated by a modified client. The server is the truth." },
    { q: "Are my funds safe?", a: "Funds are held in a custodial treasury with an atomic ledger: balances cannot go negative, deposits cannot be double-credited, withdrawals cannot be double-paid." },
  ]},
  { category: "Token & Economy", questions: [
    { q: "What is $BMB?", a: "$BMB is the game's Solana token. It is used for Arena stakes, payouts, guild rewards, and withdrawals. It is also deflationary — 25% of every house rake is permanently burned." },
    { q: "Is this a fair launch?", a: "Affirmative. Community-first launch on Solana. No private rounds, no hidden pre-sales, no VC bags. 88% to the free market. Zero team dump." },
  ]},
  { category: "Troubleshooting", questions: [
    { q: "The game looks outdated after an update.", a: "Hard refresh: Ctrl/Cmd + Shift + R. The game is a PWA and may have cached an older version." },
    { q: "I got disconnected mid-match — did I lose?", a: "If you reconnect within the short grace window, you are dropped right back into your match. Staked funds are protected regardless." },
    { q: "'Server full' — what does that mean?", a: "At peak load the server temporarily stops opening new rooms to keep existing matches stable. Stand by and retry shortly." },
    { q: "My callsign is taken.", a: "Callsigns are globally unique. Pick another operative identity." },
    { q: "I connected a wallet but cannot join a token match.", a: "Ensure you have deposited enough $BMB to cover the stake. Open the Bank to check your in-game balance." },
  ]},
] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const tick = (s: string) => s.replaceAll("$BMB", `$${TOKEN_TICKER}`);

/** Highlight the first match of `q` inside `text` (already ticker-normalized). */
function highlight(text: string, q: string) {
  const t = tick(text);
  if (!q) return t;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return t;
  return (<>{t.slice(0, i)}<mark className="faq-mark">{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>);
}

function Item({ q, a, query }: { q: string; a: string; query: string }) {
  const id = slug(q);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === `#${id}`) {
      setOpen(true);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "center" }), 60);
    }
  }, [id]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && typeof window !== "undefined") history.replaceState(null, "", `#${id}`);
  }

  return (
    <div id={id} className="faq-item">
      <button className="faq-q" onClick={toggle} aria-expanded={open}>
        <span className="faq-bomb" style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>◆</span>
        <span style={{ flex: 1 }}>{highlight(q, query)}</span>
      </button>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 280ms var(--ease-entry)" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <p className="faq-a">{highlight(a, query)}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqData.map((c) => ({ ...c, questions: [...c.questions] }));
    return faqData
      .map((c) => ({ ...c, questions: c.questions.filter((it) => (it.q + " " + it.a).toLowerCase().includes(q)) }))
      .filter((c) => c.questions.length > 0);
  }, [query]);

  return (
    <main className="relative min-h-screen w-full" style={{ background: "var(--color-bg-1, #0e0d13)" }}>
      <div className="mx-auto max-w-[1200px]" style={{ paddingInline: "var(--section-px, 1.5rem)", paddingTop: "112px", paddingBottom: "64px" }}>
        {/* Page hero */}
        <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-[1fr_40%]" style={{ minHeight: "30vh" }}>
          <div>
            <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", color: "#f5c842", marginBottom: "0.75rem", letterSpacing: "0.04em" }}>FAQ</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, letterSpacing: "-0.01em", color: "#fff", margin: 0 }}>
              Questions.
            </h1>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-base,1rem)", color: "rgba(255,255,255,0.5)", marginTop: "1rem" }}>
              Direct answers. No marketing copy.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            spellCheck={false}
            style={{ height: 48, width: "100%", padding: "0 16px", background: "var(--color-inset, rgba(0,0,0,0.25))", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--radius-md,0.5rem)", color: "#fff", outline: "none", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(245,200,66,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
          {/* Sticky sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky flex flex-col gap-2" style={{ top: "96px" }}>
              {faqData.map((c) => (
                <a key={c.category} href={`#cat-${slug(c.category)}`} className="faq-cat-link">{c.category}</a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex flex-col gap-10">
            {filtered.length === 0 ? (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>No matching questions.</p>
            ) : (
              filtered.map((c) => (
                <section key={c.category} id={`cat-${slug(c.category)}`} style={{ scrollMarginTop: "96px" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-xl,1.6rem)", color: "#fff", margin: "0 0 1rem" }}>{c.category}</h2>
                  <div className="flex flex-col">
                    {c.questions.map((it) => (
                      <Item key={it.q} q={it.q} a={it.a} query={query} />
                    ))}
                  </div>
                </section>
              ))
            )}

            {/* CTA */}
            <div className="mt-6 flex flex-col items-start gap-4 rounded-xl p-8" style={{ background: "var(--color-inset, rgba(0,0,0,0.25))", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "1.4rem", color: "#fff", margin: 0 }}>Still have questions?</h3>
              <div className="flex flex-wrap gap-3">
                <a href="https://t.me/BombermemeFun" target="_blank" rel="noopener noreferrer" className="cta-ghost inline-flex items-center rounded-md px-6" style={{ height: 46, fontSize: "0.85rem" }}>Telegram</a>
                <a href="https://x.com/BombermemeFun" target="_blank" rel="noopener noreferrer" className="cta-ghost inline-flex items-center rounded-md px-6" style={{ height: 46, fontSize: "0.85rem" }}>X / Twitter</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
