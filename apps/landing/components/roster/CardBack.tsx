import type { FighterAsset } from "@/lib/rosterData";

export function CardBack({ fighter }: { fighter: FighterAsset }) {
  return (
    <div className="fc-back" aria-hidden>
      <div className="fc-back-ring" />
      <div className="fc-back-glyphs" />
      <div className="fc-back-foil" />
      <div className="fc-back-seal" aria-hidden>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="rgba(245,200,66,0.35)" strokeWidth="2" />
          <path d="M24 10 L28 22 L40 24 L28 26 L24 38 L20 26 L8 24 L20 22 Z" fill="rgba(245,200,66,0.25)" />
        </svg>
      </div>
      <div className="fc-back-serial">{fighter.serialNumber}</div>
    </div>
  );
}
