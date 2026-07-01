import Link from "next/link";
import { TokenWidget } from "@/components/TokenWidget";
import { TheFurnace } from "@/components/TheFurnace";
import { RoiCalculator } from "@/components/RoiCalculator";
import {
  TOKEN_TICKER,
  TOTAL_SUPPLY,
  INITIAL_ALLOCATION_PCT,
  HOUSE_RAKE_BP_DEFAULT,
  RAKE_SPLIT_BPS,
} from "@/lib/token";

const RAKE_PCT = HOUSE_RAKE_BP_DEFAULT / 100;
const BURN_PCT = RAKE_SPLIT_BPS.burn / 100;
const GUILD_PCT = RAKE_SPLIT_BPS.referral / 100;
const ECO_PCT = RAKE_SPLIT_BPS.devTreasury / 100;

function fmtSupply(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString("en-US");
}

const CHIPS: Array<[string, string]> = [
  ["Total Supply", fmtSupply(TOTAL_SUPPLY)],
  ["House Rake", `${RAKE_PCT}%`],
  ["Token", `$${TOKEN_TICKER}`],
  ["Network", "Solana"],
];

export function EconomyScene() {
  return (
    <section
      id="token"
      className="relative w-full"
      style={{ background: "var(--color-bg-3, #090810)", paddingInline: "var(--section-px, 1.5rem)", paddingBlock: "clamp(4rem, 8vw, 7rem)" }}
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.6rem", color: "#f5c842", marginBottom: "1rem", letterSpacing: "0.04em" }}>
            THE MONEY MACHINE
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "var(--text-3xl, clamp(2.5rem,5vw,5rem))", lineHeight: 0.9, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 1.5rem" }}>
            Every token<br />pulls weight.
          </h2>

          <div className="flex flex-col gap-4" style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-base,1rem)", lineHeight: 1.7, color: "rgba(255,255,255,0.5)", maxWidth: "48ch" }}>
            <p>
              Fair launch on Solana — <span style={{ color: "#fff" }}>{INITIAL_ALLOCATION_PCT.freeMarket}% to the open market</span>, {INITIAL_ALLOCATION_PCT.gameTreasury}% game treasury, {INITIAL_ALLOCATION_PCT.marketingCex}% growth, {INITIAL_ALLOCATION_PCT.devTeam}% team (vested). No private rounds, no presale.
            </p>
            <p>
              Each staked match takes a <span style={{ color: "#fff" }}>{RAKE_PCT}% house rake</span>, split on-chain: <span style={{ color: "#d44030" }}>{BURN_PCT}% burned</span>, {GUILD_PCT}% to the guild network, {ECO_PCT}% to ecosystem &amp; infrastructure.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
            {CHIPS.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem", color: "#f5c842", lineHeight: 1 }}>{value}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.52rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)" }}>{label}</span>
              </div>
            ))}
          </div>

          <Link href="/tokenomics" className="group mt-8 inline-flex items-center gap-2"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,200,66,0.85)", textDecoration: "none" }}>
            Follow the money →
            <span style={{ transition: "transform 0.2s ease" }} className="group-hover:translate-x-1"></span>
          </Link>
        </div>

        <div className="flex justify-center lg:justify-end">
          <TokenWidget />
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-[1200px] space-y-12">
        <TheFurnace />
        <div className="pixel-inset p-5 sm:p-8" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.35)" }}>
          <RoiCalculator />
        </div>
      </div>
    </section>
  );
}
