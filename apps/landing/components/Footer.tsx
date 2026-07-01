import Link from "next/link";
import { TOKEN_TICKER, PUMP_URL } from "@/lib/token";
import { FooterPlayLink } from "@/components/FooterPlayLink";

const GROUPS: Array<{ title: string; links: Array<{ label: string; href: string; ext?: boolean; play?: boolean }> }> = [
  {
    title: "Game",
    links: [
      { label: "Play", href: "#", ext: true, play: true },
      { label: "Tournaments", href: "/tournaments" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "Tokenomics", href: "/tokenomics" },
      { label: "Guilds & Partners", href: "/partners" },
      { label: `Buy $${TOKEN_TICKER}`, href: PUMP_URL, ext: true },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X / Twitter", href: "https://x.com/BombermemeFun", ext: true },
      { label: "Telegram", href: "https://t.me/BombermemeFun", ext: true },
      { label: "Telegram App", href: "https://t.me/bombermeme_bot", ext: true },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="relative w-full"
      style={{ background: "var(--color-bg-4, #07060d)", borderTop: "1px solid rgba(255,255,255,0.07)", paddingInline: "var(--section-px, 1.5rem)" }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="flex flex-col gap-4">
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.01em", textTransform: "uppercase", color: "#fff" }}>
            BOMBER<span style={{ color: "#f5c842" }}>MEME</span>
          </span>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", lineHeight: 1.6, color: "rgba(255,255,255,0.4)", maxWidth: "26ch" }}>
            PvP bomber deathmatch on Solana. Skill only. Winner takes all.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,200,66,0.7)" }}>
              Built on Solana · Powered by pump.fun
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
              SHA-256 provably fair
            </span>
          </div>
        </div>

        {/* Link groups */}
        {GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-3">
            <span style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: "0.25rem" }}>
              {g.title.toUpperCase()}
            </span>
            {g.links.map((l) =>
              l.play ? (
                <FooterPlayLink key={l.label}>{l.label}</FooterPlayLink>
              ) : l.ext ? (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="footer-link">{l.label}</a>
              ) : (
                <Link key={l.label} href={l.href} className="footer-link">{l.label}</Link>
              )
            )}
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-[1200px]" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 py-6">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
            © 2026 BomberMeme · Crypto involves risk — only stake what you can afford to lose.
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.56rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,200,66,0.7)" }}>
            ◎ Solana
          </span>
        </div>
      </div>
    </footer>
  );
}
