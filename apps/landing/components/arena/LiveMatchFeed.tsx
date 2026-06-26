"use client";

/* ── Esports kill-feed marquee ─────────────────────────────────────────────
   Scrolling horizontal strip of recent match outcomes with character sprites,
   player handles, $BMB earnings, and MMR change chips.
   ────────────────────────────────────────────────────────────────────────── */

interface KillEvent {
  killerHandle: string;
  killerChar:   string;
  victimHandle: string;
  victimChar:   string;
  amount:       string;
  mmrDelta:     number;
  arena:        string;
}

/* ── Character sprite map — walk-cycle frame 0 for each character ───────── */
const SPRITE: Record<string, string> = {
  trump:   "/sprites/trump/new/skin_2_side_0.webp",
  elon:    "/sprites/elon/new/skin_3_side_0.webp",
  pepe:    "/sprites/pepe/new/skin_1_side_0.webp",
  shiba:   "/sprites/shiba/new/skin_0_side_0.webp",
  doge:    "/sprites/doge/skin_4_side_0.webp",
  pumpfun: "/sprites/pumpfun/skin_5_side_0.webp",
  vitalik: "/sprites/vitalik/skin_7_side_0.webp",
  mem:     "/sprites/mem/skin_8_side_0.webp",
};

const FEED: KillEvent[] = [
  { killerHandle: "fuse_killer",    killerChar: "pepe",    victimHandle: "DOGE #1102",    victimChar: "doge",    amount: "+$847",   mmrDelta: +23, arena: "ARENA A"   },
  { killerHandle: "elon_blast",     killerChar: "elon",    victimHandle: "wojak_sadboy",  victimChar: "shiba",   amount: "+$1,240", mmrDelta: +31, arena: "RANKED"    },
  { killerHandle: "trump_tnt",      killerChar: "trump",   victimHandle: "VITALIK #9021", victimChar: "vitalik", amount: "+$312",   mmrDelta: +12, arena: "RANKED"    },
  { killerHandle: "chad_bomber",    killerChar: "pumpfun", victimHandle: "PEPE #4821",    victimChar: "pepe",    amount: "+$2,100", mmrDelta: +44, arena: "THE INT."  },
  { killerHandle: "shiba_shock",    killerChar: "shiba",   victimHandle: "MEM #3309",     victimChar: "mem",     amount: "+$567",   mmrDelta: +18, arena: "ARENA B"   },
  { killerHandle: "vitalik_volt",   killerChar: "vitalik", victimHandle: "ELON #7734",    victimChar: "elon",    amount: "+$4,320", mmrDelta: +67, arena: "THE INT."  },
  { killerHandle: "sol_sniper",     killerChar: "doge",    victimHandle: "SHIBA #0044",   victimChar: "shiba",   amount: "+$891",   mmrDelta: +24, arena: "RANKED"    },
  { killerHandle: "mem_chaos",      killerChar: "mem",     victimHandle: "TRUMP #6610",   victimChar: "trump",   amount: "+$1,770", mmrDelta: +38, arena: "ARENA C"   },
  { killerHandle: "rug_survivor",   killerChar: "pumpfun", victimHandle: "CHAD #2211",    victimChar: "pumpfun", amount: "+$633",   mmrDelta: +19, arena: "CASUAL"    },
  { killerHandle: "doge_destroyer", killerChar: "doge",    victimHandle: "FUSE #8892",    victimChar: "pepe",    amount: "+$5,470", mmrDelta: +82, arena: "THE INT."  },
  { killerHandle: "pepe_pyro",      killerChar: "pepe",    victimHandle: "MEM #4401",     victimChar: "mem",     amount: "+$390",   mmrDelta: +14, arena: "ARENA A"   },
  { killerHandle: "0xNeuralLink",   killerChar: "elon",    victimHandle: "hopium_dealer", victimChar: "pepe",    amount: "+$8,920", mmrDelta: +97, arena: "THE INT."  },
];

/* ── Sprite chip ────────────────────────────────────────────────────────── */
function SpriteChip({ char, handle }: { char: string; handle: string }) {
  const src = SPRITE[char];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      {src && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={char}
          width={20}
          height={20}
          style={{
            objectFit:   "contain",
            imageRendering: "pixelated",
            filter:      "drop-shadow(0 0 4px rgba(245,200,66,0.4))",
            flexShrink:  0,
          }}
        />
      )}
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.72rem",
          fontWeight:    700,
          color:         "rgba(255,255,255,0.85)",
          letterSpacing: "0.02em",
          textTransform: "lowercase",
        }}
      >
        {handle}
      </span>
    </span>
  );
}

/* ── Single feed item ───────────────────────────────────────────────────── */
function FeedItem(ev: KillEvent) {
  const isInternational = ev.arena === "THE INT.";
  const mmrColor = ev.mmrDelta > 40 ? "#7fd8ff" : "#f5c842";

  return (
    <span className="mx-6 inline-flex items-center gap-2.5" style={{ flexShrink: 0 }}>
      {/* Killer */}
      <SpriteChip char={ev.killerChar} handle={ev.killerHandle} />

      {/* Eliminated label */}
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.60rem",
          letterSpacing: "0.14em",
          color:         "#ff5a4d",
          textTransform: "uppercase",
          textShadow:    "0 0 8px rgba(255,90,77,0.6)",
          fontWeight:    700,
        }}
      >
        ☠ ELIMINATED
      </span>

      {/* Victim */}
      <SpriteChip char={ev.victimChar} handle={ev.victimHandle} />

      {/* Separator */}
      <span style={{ color: "rgba(255,255,255,0.10)", fontSize: "0.5rem" }}>·</span>

      {/* Amount */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize:   "0.74rem",
          fontWeight: 700,
          color:      "#f5c842",
          textShadow: "0 0 10px rgba(245,200,66,0.7)",
        }}
      >
        {ev.amount}
      </span>

      {/* MMR chip */}
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "0.58rem",
          fontWeight:    700,
          color:         mmrColor,
          background:    `${mmrColor}15`,
          border:        `1px solid ${mmrColor}35`,
          borderRadius:  "4px",
          padding:       "1px 5px",
          textShadow:    `0 0 6px ${mmrColor}80`,
        }}
      >
        MMR +{ev.mmrDelta}
      </span>

      {/* Arena badge */}
      {isInternational ? (
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.52rem",
            fontWeight:    700,
            letterSpacing: "0.10em",
            color:         "#ffd700",
            background:    "rgba(255,215,0,0.10)",
            border:        "1px solid rgba(255,215,0,0.30)",
            borderRadius:  "4px",
            padding:       "1px 6px",
            textShadow:    "0 0 8px rgba(255,215,0,0.7)",
          }}
        >
          🏆 THE INT.
        </span>
      ) : (
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.52rem",
            letterSpacing: "0.10em",
            color:         "rgba(255,255,255,0.22)",
          }}
        >
          {ev.arena}
        </span>
      )}

      {/* Track dot divider */}
      <span style={{ color: "rgba(255,255,255,0.08)", fontSize: "0.5rem", marginLeft: "8px" }}>◆</span>
    </span>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function LiveMatchFeed() {
  /* Duplicate for seamless -50% loop */
  const doubled = [...FEED, ...FEED];

  return (
    <div
      className="marquee-mask relative z-10 w-full overflow-hidden border-y"
      style={{
        background:  "rgba(16,13,22,0.55)",
        backdropFilter: "blur(6px)",
        borderColor: "rgba(255,210,120,0.10)",
        padding:     "10px 0",
      }}
    >
      {/* Leading KILL FEED label */}
      <div
        className="absolute left-0 top-0 z-20 hidden h-full items-center gap-2 px-4 sm:flex"
        style={{
          background:    "linear-gradient(90deg, rgba(7,8,16,1) 55%, transparent)",
          paddingRight:  "32px",
        }}
      >
        <span
          className="animate-hud-blink"
          style={{
            color:      "#ff5a4d",
            fontSize:   "0.55rem",
            textShadow: "0 0 6px rgba(255,90,77,0.8)",
          }}
        >
          ●
        </span>
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "0.55rem",
            fontWeight:    700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color:         "rgba(255,255,255,0.35)",
          }}
        >
          Kill Feed
        </span>
      </div>

      {/* Scrolling track */}
      <div className="marquee-track">
        {doubled.map((ev, i) => (
          <FeedItem key={`${ev.killerHandle}-${i}`} {...ev} />
        ))}
      </div>
    </div>
  );
}
