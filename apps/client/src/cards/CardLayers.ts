/**
 * CardLayers.ts — BomberMeme CCG v2
 * Three new HTML layer generators for the fighter card system.
 * These are PURE functions that return HTML strings. They do NOT modify main.ts.
 *
 * Layer 21: Rarity Seal v2 — embossed SVG seal, unique shape per tier
 * Layer 22: Edition Mark — serial number plaque for limited editions
 * Layer 23: Set Badge — 16x16 SVG icon indicating card set membership
 *
 * Usage: Inject the returned HTML strings into fighterCardHTML() output.
 */

export type Tier = "common" | "rare" | "epic" | "legendary" | "mythic";

export type SetId =
  | "genesis"
  | "crypto_degens"
  | "frog_dynasty"
  | "meme_pantheon"
  | "election_chaos"
  | "pump_circuit"
  | "animal_kingdom"
  | "crypto_twitter"
  | "seasonal_drop";

// ---------------------------------------------------------------------------
// Tier metadata (colours map to existing CSS custom properties)
// ---------------------------------------------------------------------------

const TIER_META: Record<
  Tier,
  { color: string; glow: string; label: string }
> = {
  common:    { color: "#9aa3b2", glow: "rgba(154,163,178,0.35)", label: "COMMON" },
  rare:      { color: "#4aa3ff", glow: "rgba(74,163,255,0.40)", label: "RARE" },
  epic:      { color: "#c879ff", glow: "rgba(200,121,255,0.45)", label: "EPIC" },
  legendary: { color: "#ffcc33", glow: "rgba(255,204,51,0.50)",  label: "LEGENDARY" },
  mythic:    { color: "#ff5a5a", glow: "rgba(255,90,90,0.55)",  label: "MYTHIC" },
};

// ---------------------------------------------------------------------------
// Layer 21 — Rarity Seal v2 (embossed SVG seal, bottom-right)
// ---------------------------------------------------------------------------

/** Return an embossed SVG seal string for the given tier.
 *  Each tier has a unique geometric shape:
 *    Common = circle, Rare = shield, Epic = star burst,
 *    Legendary = crown, Mythic = phoenix/wings. */
export function raritySealSVG(tier: Tier): string {
  const m = TIER_META[tier];
  const shape = sealShape(tier, m.color);

  return (
    `<div class="fc-rarity-seal" aria-hidden="true" ` +
    `style="--seal-color:${m.color};--seal-glow:${m.glow};" ` +
    `title="${m.label}">` +
    `<svg viewBox="0 0 48 48" width="100%" height="100%" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<filter id="seal-emboss-${tier}" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="1" stdDeviation="0.5" ` +
    `flood-color="rgba(255,255,255,0.30)"/>` +
    `<feDropShadow dx="0" dy="-1" stdDeviation="0.5" ` +
    `flood-color="rgba(0,0,0,0.50)"/>` +
    `</filter>` +
    `<radialGradient id="seal-grad-${tier}" cx="35%" cy="30%">` +
    `<stop offset="0%" stop-color="rgba(255,255,255,0.25)"/>` +
    `<stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>` +
    `</radialGradient>` +
    `</defs>` +
    // Outer ring
    `<circle cx="24" cy="24" r="22" fill="none" ` +
    `stroke="${m.color}" stroke-width="1.2" opacity="0.6"/>` +
    // Inner ring (dashed)
    `<circle cx="24" cy="24" r="19" fill="none" ` +
    `stroke="${m.color}" stroke-width="0.6" ` +
    `stroke-dasharray="3 2" opacity="0.4"/>` +
    // Tier-specific shape
    `${shape}` +
    // Center label
    `<text x="24" y="25.5" text-anchor="middle" ` +
    `fill="${m.color}" font-size="7" font-weight="700" ` +
    `font-family="system-ui,sans-serif" letter-spacing="0.5" ` +
    `opacity="0.9">${m.label.charAt(0)}</text>` +
    `</svg></div>`
  );
}

/** Generate the tier-specific shape SVG path. */
function sealShape(tier: Tier, color: string): string {
  const fill = `url(#seal-grad-${tier})`;
  const stroke = color;

  switch (tier) {
    case "common": {
      // Simple filled circle
      return (
        `<circle cx="24" cy="24" r="14" fill="${fill}" ` +
        `stroke="${stroke}" stroke-width="1" opacity="0.85" ` +
        `filter="url(#seal-emboss-${tier})"/>`
      );
    }
    case "rare": {
      // Shield shape
      return (
        `<path d="M24 10 L36 14 L36 26 Q36 34 24 40 Q12 34 12 26 ` +
        `L12 14 Z" fill="${fill}" stroke="${stroke}" ` +
        `stroke-width="1" opacity="0.85" ` +
        `filter="url(#seal-emboss-${tier})"/>`
      );
    }
    case "epic": {
      // 8-point star burst
      return (
        `<polygon points="24,4 27.5,17 40,17 30,24.5 33.5,38 ` +
        `24,30 14.5,38 18,24.5 8,17 20.5,17" ` +
        `fill="${fill}" stroke="${stroke}" stroke-width="1" ` +
        `opacity="0.85" filter="url(#seal-emboss-${tier})"/>`
      );
    }
    case "legendary": {
      // Crown shape
      return (
        `<path d="M10 32 L10 18 L17 22 L24 12 L31 22 L38 18 ` +
        `L38 32 Q38 34 36 34 L12 34 Q10 34 10 32 Z" ` +
        `fill="${fill}" stroke="${stroke}" stroke-width="1" ` +
        `opacity="0.85" filter="url(#seal-emboss-${tier})"/>` +
        // Crown jewels
        `<circle cx="24" cy="20" r="2" fill="${color}" ` +
        `opacity="0.7"/>` +
        `<circle cx="14" cy="26" r="1.2" fill="${color}" ` +
        `opacity="0.5"/>` +
        `<circle cx="34" cy="26" r="1.2" fill="${color}" ` +
        `opacity="0.5"/>`
      );
    }
    case "mythic": {
      // Phoenix / winged silhouette
      return (
        `<path d="M24 36 Q18 30 12 24 Q16 26 20 24 Q14 18 10 12 ` +
        `Q18 16 22 20 Q24 10 24 6 Q24 10 26 20 Q30 16 38 12 ` +
        `Q34 18 28 24 Q32 26 36 24 Q30 30 24 36 Z" ` +
        `fill="${fill}" stroke="${stroke}" stroke-width="1" ` +
        `opacity="0.85" filter="url(#seal-emboss-${tier})"/>` +
        // Inner flame detail
        `<path d="M24 30 Q20 26 18 22 Q21 24 24 22 Q27 24 30 22 ` +
        `Q28 26 24 30 Z" fill="${color}" opacity="0.35"/>`
      );
    }
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Layer 22 — Edition Mark (serial number plaque)
// ---------------------------------------------------------------------------

/** Return an edition mark HTML string.
 *  Legendary: "BM-S01-XXXX / 1000"
 *  Mythic:    "BM-S01-XXXX / 100"
 *  Others:    "Unlimited" or empty if no serial provided. */
export function editionMarkHTML(serial: string | undefined, tier: Tier): string {
  const m = TIER_META[tier];
  let text: string;

  if (tier === "legendary") {
    text = serial ? `${serial} / 1000` : "LIMITED / 1000";
  } else if (tier === "mythic") {
    text = serial ? `${serial} / 100` : "LIMITED / 100";
  } else if (tier === "epic") {
    text = serial ? `${serial} / 500` : "LIMITED / 500";
  } else {
    // Common / Rare — unlimited edition, show nothing unless serial given
    text = serial ? `${serial} / \u221e` : "";
  }

  if (!text) return ""; // No markup for unlimited cards without serial

  return (
    `<div class="fc-edition-mark" style="--em-color:${m.color};" ` +
    `aria-label="Edition: ${text}">${text}</div>`
  );
}

// ---------------------------------------------------------------------------
// Layer 23 — Set Badge (16x16 SVG icon, top-right)
// ---------------------------------------------------------------------------

const SET_ICONS: Record<SetId, { name: string; svg: string }> = {
  genesis: {
    name: "Genesis Archive",
    svg: `<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" ` +
         `stroke-width="1.3"/><circle cx="8" cy="8" r="2.5" ` +
         `fill="currentColor" opacity="0.7"/><line x1="8" y1="2" ` +
         `x2="8" y2="5.5" stroke="currentColor" stroke-width="0.8"/>`,
  },
  crypto_degens: {
    name: "Crypto Degenerates",
    svg: `<circle cx="8" cy="8" r="6.5" fill="none" ` +
         `stroke="currentColor" stroke-width="1"/>` +
         `<text x="8" y="11.5" text-anchor="middle" ` +
         `fill="currentColor" font-size="7" font-weight="700">\u20bf</text>`,
  },
  frog_dynasty: {
    name: "Frog Dynasty",
    svg: `<ellipse cx="8" cy="9" rx="5" ry="4.5" fill="none" ` +
         `stroke="currentColor" stroke-width="1"/>` +
         `<circle cx="5.5" cy="6.5" r="1.2" fill="currentColor"/>` +
         `<circle cx="10.5" cy="6.5" r="1.2" fill="currentColor"/>` +
         `<path d="M6 10.5 Q8 12 10 10.5" fill="none" ` +
         `stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>`,
  },
  meme_pantheon: {
    name: "Meme Pantheon",
    svg: `<path d="M8 2 L14 6 L14 13 L8 15 L2 13 L2 6 Z" ` +
         `fill="none" stroke="currentColor" stroke-width="1" ` +
         `stroke-linejoin="round"/>` +
         `<circle cx="8" cy="9" r="2.5" fill="currentColor" ` +
         `opacity="0.6"/>`,
  },
  election_chaos: {
    name: "Election Chaos",
    svg: `<rect x="3" y="3" width="10" height="10" rx="1" ` +
         `fill="none" stroke="currentColor" stroke-width="1"/>` +
         `<line x1="3" y1="7" x2="13" y2="7" ` +
         `stroke="currentColor" stroke-width="0.7"/>` +
         `<line x1="6" y1="10" x2="10" y2="10" ` +
         `stroke="currentColor" stroke-width="0.7"/>`,
  },
  pump_circuit: {
    name: "Pump Circuit",
    svg: `<polyline points="2,12 5.5,6 8,10 10.5,4 14,8" ` +
         `fill="none" stroke="currentColor" stroke-width="1.2" ` +
         `stroke-linecap="round" stroke-linejoin="round"/>` +
         `<circle cx="14" cy="8" r="1.5" fill="currentColor"/>`,
  },
  animal_kingdom: {
    name: "Animal Kingdom",
    svg: `<circle cx="8" cy="8" r="5.5" fill="none" ` +
         `stroke="currentColor" stroke-width="1"/>` +
         `<circle cx="6" cy="7" r="1" fill="currentColor"/>` +
         `<circle cx="10" cy="7" r="1" fill="currentColor"/>` +
         `<path d="M5.5 4.5 Q8 2.5 10.5 4.5" fill="none" ` +
         `stroke="currentColor" stroke-width="0.9" ` +
         `stroke-linecap="round"/>`,
  },
  crypto_twitter: {
    name: "Crypto Twitter",
    svg: `<path d="M2 4.5 Q5 2 8 4.5 Q11 2 14 4.5 L14 10 ` +
         `Q11 8 8 10 Q5 8 2 10 Z" fill="none" ` +
         `stroke="currentColor" stroke-width="1" ` +
         `stroke-linejoin="round"/>` +
         `<circle cx="8" cy="13" r="1.2" fill="currentColor" ` +
         `opacity="0.6"/>`,
  },
  seasonal_drop: {
    name: "Seasonal Drop",
    svg: `<path d="M8 2 L9.5 6 L14 6.5 L10.5 9.5 L11.5 14 ` +
         `L8 11.5 L4.5 14 L5.5 9.5 L2 6.5 L6.5 6 Z" ` +
         `fill="none" stroke="currentColor" stroke-width="1" ` +
         `stroke-linejoin="round"/>`,
  },
};

/** Return a 16x16 SVG set badge HTML string.
 *  Displays a small icon representing the card's set membership. */
export function setBadgeSVG(setId: SetId): string {
  const setData = SET_ICONS[setId];
  if (!setData) return "";

  return (
    `<div class="fc-set-badge" title="${setData.name}" ` +
    `data-set="${setId}" aria-label="Set: ${setData.name}">` +
    `<svg viewBox="0 0 16 16" width="16" height="16" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `${setData.svg}` +
    `</svg></div>`
  );
}

// ---------------------------------------------------------------------------
// Tier helper — map numeric tier rank (0..4) to Tier string
// ---------------------------------------------------------------------------

const RANK_TO_TIER: Tier[] = ["common", "rare", "epic", "legendary", "mythic"];

/** Convert a numeric tier rank (0=common \u2026 4=mythic) to a Tier string. */
export function tierFromRank(rank: number): Tier {
  return RANK_TO_TIER[Math.max(0, Math.min(4, rank))] ?? "common";
}
