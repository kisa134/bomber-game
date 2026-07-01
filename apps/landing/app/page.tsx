import dynamic from "next/dynamic";

import { Hero } from "@/components/hero/Hero";
import { LivePulseStrip } from "@/components/LivePulseStrip";
import { LiveArenaStage } from "@/components/arena/LiveArenaStage";
import { SplitDescend } from "@/components/primitives/SplitDescend";
import {
  SplitDescendPinned,
  SplitPanelRunner,
} from "@/components/primitives/SplitDescendPinned";
import { ArenaStoryReveal } from "@/components/story/ArenaStoryReveal";

const ArenaStoryChapters   = dynamic(() => import("@/components/story/ArenaStoryChapters").then((m) => m.ArenaStoryChapters));
const BentoScene           = dynamic(() => import("@/components/BentoScene").then((m) => m.BentoScene));
const RosterSection        = dynamic(() => import("@/components/RosterSection").then((m) => m.RosterSection));
const LiveLeaderboard      = dynamic(() => import("@/components/arena/LiveLeaderboard").then((m) => m.LiveLeaderboard));
const VideoTrailerSection  = dynamic(() => import("@/components/VideoTrailerSection").then((m) => m.VideoTrailerSection));
const RoadmapScene         = dynamic(() => import("@/components/RoadmapSection").then((m) => m.RoadmapSection));
const ProvablyFairTerminal = dynamic(() => import("@/components/ProvablyFairTerminal").then((m) => m.ProvablyFairTerminal));
const EconomyScene         = dynamic(() => import("@/components/EconomyScene").then((m) => m.EconomyScene));
const GuildsTeaser         = dynamic(() => import("@/components/GuildsTeaser").then((m) => m.GuildsTeaser));
const HomeFaqAccordion     = dynamic(() => import("@/components/HomeFaqAccordion").then((m) => m.HomeFaqAccordion));
const FinalCta             = dynamic(() => import("@/components/FinalCta").then((m) => m.FinalCta));
const Footer               = dynamic(() => import("@/components/Footer").then((m) => m.Footer));

export default function Home() {
  return (
    <main className="relative">
      <Hero />

      {/* SD-1: black shutters → blast → how-to-play reveal */}
      <SplitDescendPinned
        outerDepth={1}
        innerDepth={1}
        outerLeft={<SplitPanelRunner side="left" />}
        outerRight={<SplitPanelRunner side="right" />}
        innerContent={<ArenaStoryReveal />}
      />

      <ArenaStoryChapters />
      <LiveArenaStage />

      {/* Phase B: merged broadcast ticker (was LiveStatsBar + LiveMatchFeed) */}
      <LivePulseStrip />

      <SplitDescend bg="var(--color-bg-2)" debris>
        <BentoScene />
      </SplitDescend>

      <RosterSection />

      <LiveLeaderboard />
      <VideoTrailerSection />
      <RoadmapScene />

      <SplitDescend bg="var(--color-bg-4)" className="mt-28" debris>
        <ProvablyFairTerminal />
      </SplitDescend>

      <SplitDescend bg="var(--color-bg-3)" debris>
        <EconomyScene />
      </SplitDescend>

      <GuildsTeaser />
      <HomeFaqAccordion />
      <FinalCta />
      <Footer />
    </main>
  );
}
