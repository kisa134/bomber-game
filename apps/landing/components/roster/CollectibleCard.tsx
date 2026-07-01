"use client";

import { useRef } from "react";
import { useCardTilt } from "@/lib/hooks/useCardTilt";
import { computeFanLayout, type FighterAsset } from "@/lib/rosterData";
import { CollectibleCardFront } from "./CollectibleCardFront";
import { CardBack } from "./CardBack";

interface CollectibleCardProps {
  fighter: FighterAsset;
  index: number;
  total: number;
  activeIndex: number;
  onActivate: () => void;
}

export function CollectibleCard({
  fighter,
  index,
  total,
  activeIndex,
  onActivate,
}: CollectibleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isActive = index === activeIndex;
  const fanAngle = (index - (total - 1) / 2) * (22 / Math.max(total - 1, 1));

  useCardTilt(cardRef, {
    key: fighter.id,
    fanAngle,
    isActive,
    enabled: !fighter.locked,
  });

  const layout = computeFanLayout(index, total, activeIndex);

  return (
    <div
      ref={cardRef}
      role="option"
      id={`card-${fighter.id}`}
      aria-selected={isActive}
      aria-label={`${fighter.name}, ${fighter.cardTier} tier fighter, rating ${fighter.avgMMR}`}
      tabIndex={-1}
      className={[
        "collectible-card",
        isActive ? "is-active" : "not-active",
        index === activeIndex - 1 ? "is-adjacent is-adjacent-prev" : "",
        index === activeIndex + 1 ? "is-adjacent is-adjacent-next" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={layout}
      data-tier={fighter.cardTier}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <div className="fc-outer" style={{ transformStyle: "preserve-3d" }}>
        <CollectibleCardFront fighter={fighter} grainId={`grain-${fighter.id}`} />
        <CardBack fighter={fighter} />
      </div>
    </div>
  );
}
