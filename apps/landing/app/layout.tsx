import type { Metadata, Viewport } from "next";
import "./globals.css";
import SvgFilterDefs from "@/components/effects/SvgFilterDefs";
import { GSAPProvider } from "@/components/providers/GSAPProvider";
import { RefCapture } from "@/components/providers/RefCapture";
import { TopNav } from "@/components/TopNav";
import { StickyCtaBanner } from "@/components/StickyCtaBanner";
import { MobileNav } from "@/components/layout/MobileNav";
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
        <SvgFilterDefs />

        <div id="aria-live-polite" className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
        <div id="aria-live-assertive" className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" />

        <div className="site-bg" aria-hidden="true" />
        <Providers>
          <RefCapture />
          <TopNav />
          <GSAPProvider>{children}</GSAPProvider>
          <MobileNav />
          <StickyCtaBanner />
        </Providers>
      </body>
    </html>
  );
}
