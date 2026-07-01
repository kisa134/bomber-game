import type { FighterAsset } from "@/lib/rosterData";
import { AnimatedFighterSprite } from "./AnimatedFighterSprite";

const HOLO_TIERS = new Set(["rare", "epic", "legendary", "mythic"]);

export function CollectibleCardFront({ fighter, grainId }: { fighter: FighterAsset; grainId: string }) {
  const showHolo = HOLO_TIERS.has(fighter.cardTier);

  return (
    <div className="fc-front" style={{ background: fighter.cardBg }}>
      <div className="fc-base" style={{ background: fighter.cardBg }} />
      <div className="fc-metal" style={{ background: fighter.cardMetal }} aria-hidden />
      <div className="fc-rays" aria-hidden />
      <div className="fc-cloud" aria-hidden />
      <div className="fc-haze" aria-hidden />

      <svg className="fc-grain" aria-hidden>
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${grainId})`} opacity="0.35" />
      </svg>

      <AnimatedFighterSprite
        src={fighter.sprite}
        alt={fighter.name}
        className="fc-sprite"
        fps={16}
      />

      {showHolo && <div className="fc-holo" aria-hidden data-tier={fighter.cardTier} />}
      <div className="fc-scanlines" aria-hidden />
      <div className="fc-broadcast-badge" aria-hidden>LIVE</div>
      <div className="fc-gloss" aria-hidden />
      <div className="fc-sheen" aria-hidden />
      <div className="fc-light" aria-hidden />
      <div className="fc-frame" aria-hidden />
      <div className="fc-shadow-layer" aria-hidden />

      <div className="fc-info">
        <span className="fc-name">{fighter.name}</span>
        <span className="fc-tier-badge" data-tier={fighter.cardTier}>
          {fighter.rankTier}
        </span>
        <div className="fc-stats">
          <span>{fighter.role}</span>
          <span className="tabular-nums">{fighter.avgMMR.toLocaleString("en-US")} MMR</span>
        </div>
      </div>
    </div>
  );
}
