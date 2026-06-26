"use client";

/* ── DETONATE live-feed ticker ──────────────────────────────────────────────
   Seamless horizontal marquee of fake live wins. The track holds TWO copies of
   the feed and translates -50%, so the loop is perfectly continuous. */

interface Win {
  player: string;
  amount: string;
}

const WINS: Win[] = [
  { player: "fuse_killer",   amount: "1.84 $BMB" },
  { player: "doge_destroyer",amount: "0.92 $BMB" },
  { player: "pepe_pyro",     amount: "3.10 $BMB" },
  { player: "elon_blast",    amount: "5.47 $BMB" },
  { player: "chad_bomber",   amount: "0.45 $BMB" },
  { player: "vitalik_volt",  amount: "2.21 $BMB" },
  { player: "wojak_wins",    amount: "1.07 $BMB" },
  { player: "sol_sniper",    amount: "8.92 $BMB" },
  { player: "meme_lord",     amount: "0.68 $BMB" },
  { player: "rug_survivor",  amount: "4.33 $BMB" },
  { player: "trump_tnt",     amount: "1.55 $BMB" },
  { player: "shiba_shock",   amount: "0.30 $BMB" },
];

function FeedItem({ player, amount }: Win) {
  return (
    <span
      className="mx-5 inline-flex items-center gap-2"
      style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.02em" }}
    >
      <span style={{ color: "#ff5a1f" }}>●</span>
      <span style={{ color: "rgba(255,255,255,0.78)" }}>{player}</span>
      <span style={{ color: "#6b7280" }}>won</span>
      <span style={{ color: "#b8ff35", fontWeight: 700 }}>{amount}</span>
      <span style={{ color: "rgba(255,255,255,0.10)" }}>·</span>
    </span>
  );
}

export function LiveFeedMarquee() {
  const feed = [...WINS, ...WINS]; // duplicated for seamless -50% loop

  return (
    <div
      className="marquee-mask relative z-10 w-full overflow-hidden border-y py-2.5"
      style={{
        background: "rgba(16,13,22,0.55)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Leading LIVE FEED tag */}
      <div
        className="absolute left-0 top-0 z-20 hidden h-full items-center gap-1.5 px-4 sm:flex"
        style={{
          background: "linear-gradient(90deg, #0a0b0e 70%, transparent)",
        }}
      >
        <span className="animate-hud-blink" style={{ color: "#ff5a1f", fontSize: "0.5rem" }}>
          ●
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.55rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Live Feed
        </span>
      </div>

      <div className="marquee-track">
        {feed.map((w, i) => (
          <FeedItem key={`${w.player}-${i}`} {...w} />
        ))}
      </div>
    </div>
  );
}
