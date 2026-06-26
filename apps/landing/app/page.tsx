import dynamic from "next/dynamic";

// Above-the-fold: load eagerly (Hero + light social proof + ticker).
import { Hero } from "@/components/hero/Hero";
import { LiveMatchFeed } from "@/components/arena/LiveMatchFeed";
import { LiveStatsBar } from "@/components/LiveStatsBar";

// Below-the-fold: code-split into separate chunks (still SSR'd for SEO),
// so the initial payload stays light. Nothing removed — just deferred.
const BentoSection       = dynamic(() => import("@/components/bento/BentoSection").then((m) => m.BentoSection));
const RosterSection      = dynamic(() => import("@/components/RosterSection").then((m) => m.RosterSection));
const LiveLeaderboard    = dynamic(() => import("@/components/arena/LiveLeaderboard").then((m) => m.LiveLeaderboard));
const VideoTrailerSection= dynamic(() => import("@/components/VideoTrailerSection").then((m) => m.VideoTrailerSection));
const RoadmapSection     = dynamic(() => import("@/components/RoadmapSection").then((m) => m.RoadmapSection));
const ProvablyFairTerminal = dynamic(() => import("@/components/ProvablyFairTerminal").then((m) => m.ProvablyFairTerminal));
const CompactTokenomics  = dynamic(() => import("@/components/CompactTokenomics").then((m) => m.CompactTokenomics));
const TokenWidget        = dynamic(() => import("@/components/TokenWidget").then((m) => m.TokenWidget));
const HomeFaqAccordion   = dynamic(() => import("@/components/HomeFaqAccordion").then((m) => m.HomeFaqAccordion));
const FinalCta           = dynamic(() => import("@/components/FinalCta").then((m) => m.FinalCta));
const Footer             = dynamic(() => import("@/components/Footer").then((m) => m.Footer));

export default function Home() {
  return (
    <main className="relative">
      {/* ═══ HOOK ─ grab attention, prove it's alive ═══════════════════════ */}
      <Hero />

      {/* light social proof right under the fold */}
      <div className="mt-10">
        <LiveStatsBar />
      </div>

      {/* running kill-feed ticker */}
      <div className="mt-16">
        <LiveMatchFeed />
      </div>

      {/* ═══ PRODUCT ─ what it is ══════════════════════════════════════════ */}
      <div className="mt-28">
        <BentoSection />
      </div>

      {/* the fighters — strongest visual hook */}
      <div className="mt-28">
        <RosterSection />
      </div>

      {/* ═══ PROOF ─ competition + gameplay ════════════════════════════════ */}
      <section className="mt-28">
        <LiveLeaderboard />
      </section>

      <div className="mt-28">
        <VideoTrailerSection />
      </div>

      {/* ═══ VISION ─ where it's going ═════════════════════════════════════ */}
      <div className="mt-28">
        <RoadmapSection />
      </div>

      {/* ═══ DETAILS ─ moved lower, spaced out (trust → token → faq) ════════ */}
      <div className="mt-28">
        <ProvablyFairTerminal />
      </div>

      <section id="token" className="mt-28 py-24 px-5">
        <div className="mx-auto max-w-5xl flex flex-col gap-10 items-center">
          <CompactTokenomics />
          <div className="flex justify-center">
            <TokenWidget />
          </div>
        </div>
      </section>

      <div className="mt-20">
        <HomeFaqAccordion />
      </div>

      {/* ═══ CONVERT ═══════════════════════════════════════════════════════ */}
      <FinalCta />
      <Footer />
    </main>
  );
}
