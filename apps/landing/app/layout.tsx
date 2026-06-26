import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { TopNav } from "@/components/TopNav";
import { StickyCtaBanner } from "@/components/StickyCtaBanner";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Bombermeme · Esports High-Stakes Deathmatch",
  description:
    "Pure skill. Massive stakes. No luck. Enter the arena.",
  keywords: [
    "bombermeme",
    "web3 esports",
    "dota 2 style",
    "bomber arena",
    "telegram mini app",
    "mmr ranking",
    "tournament",
    "crypto gaming",
    "solana",
    "smart contract",
  ],
  openGraph: {
    title:       "Bombermeme — Esports Deathmatch",
    description: "Pure skill. Massive stakes. Enter the arena.",
    type:        "website",
  },
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  themeColor:   "#070810",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Unified site background — the same blurred game art + vignette as the
            in-game hub, fixed behind every page. */}
        <div className="site-bg" aria-hidden="true" />
        <Providers>
          <TopNav />
          <SmoothScroll>{children}</SmoothScroll>
          <StickyCtaBanner />
        </Providers>
      </body>
    </html>
  );
}
