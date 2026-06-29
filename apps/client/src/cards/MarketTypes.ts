/**
 * BomberMeme CCG v2 — Market Type Definitions
 *
 * Core types for the P2P trading marketplace: listings, sales, floor data,
 * and player-owned listings. Used by MarketView, MarketMockData, and
 * future blockchain integration layer.
 *
 * ESM (.js suffix imports) | TypeScript strict | ZERO dependencies
 */

// ---------------------------------------------------------------------------
// Tier system — matches existing card rarity (Common..Mythic)
// ---------------------------------------------------------------------------
export type Tier = "common" | "rare" | "epic" | "legendary" | "mythic";

/** Ordered tiers for sorting / dropdowns. */
export const TIER_ORDER: Tier[] = ["common", "rare", "epic", "legendary", "mythic"];

/** Human-readable tier labels. */
export const TIER_LABEL: Record<Tier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

/** Tier accent colours (used for badges, borders, sparklines). */
export const TIER_COLOR: Record<Tier, string> = {
  common: "#b0b8c8",
  rare: "#6ecfff",
  epic: "#ffb347",
  legendary: "#ff7ce5",
  mythic: "#ff5a5a",
};

// ---------------------------------------------------------------------------
// Set system — 9 thematic card sets
// ---------------------------------------------------------------------------
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

export const SET_ORDER: SetId[] = [
  "genesis",
  "crypto_degens",
  "frog_dynasty",
  "meme_pantheon",
  "election_chaos",
  "pump_circuit",
  "animal_kingdom",
  "crypto_twitter",
  "seasonal_drop",
];

export const SET_LABEL: Record<SetId, string> = {
  genesis: "Genesis Archive",
  crypto_degens: "Crypto Degenerates",
  frog_dynasty: "Frog Dynasty",
  meme_pantheon: "Meme Pantheon",
  election_chaos: "Election Chaos",
  pump_circuit: "Pump Circuit",
  animal_kingdom: "Animal Kingdom",
  crypto_twitter: "Crypto Twitter",
  seasonal_drop: "Seasonal Drop",
};

// ---------------------------------------------------------------------------
// Market tabs
// ---------------------------------------------------------------------------
export type MarketTab = "primary" | "secondary" | "my_listings" | "history";

export const MARKET_TABS: { id: MarketTab; label: string }[] = [
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "my_listings", label: "My Listings" },
  { id: "history", label: "History" },
];

// ---------------------------------------------------------------------------
// Sort options for the secondary market
// ---------------------------------------------------------------------------
export type SortOption =
  | "price_asc"
  | "price_desc"
  | "newest"
  | "oldest"
  | "tier_desc"
  | "tier_asc";

export const SORT_LABEL: Record<SortOption, string> = {
  price_asc: "Price: Low → High",
  price_desc: "Price: High → Low",
  newest: "Newest Listed",
  oldest: "Oldest Listed",
  tier_desc: "Tier: High → Low",
  tier_asc: "Tier: Low → High",
};

// ---------------------------------------------------------------------------
// Core data interfaces
// ---------------------------------------------------------------------------

/** A single P2P listing on the secondary market. */
export interface MarketListing {
  listingId: string;
  cardTemplateId: string;
  momentId: string;
  characterName: string;
  tier: Tier;
  setId: SetId;
  seller: string; // truncated address like "0x7a3f…"
  sellerFull?: string;
  price: number; // BM tokens
  serial?: string; // e.g. "BM-S01-0007"
  listedAt: Date;
  expiresAt: Date;
  imageUrl?: string;
}

/** A completed sale (appears in History tab). */
export interface MarketSale {
  saleId: string;
  cardTemplateId: string;
  characterName: string;
  momentId: string;
  tier: Tier;
  price: number;
  buyer: string;
  seller: string;
  soldAt: Date;
}

/** Floor-price analytics for a specific card template. */
export interface FloorData {
  cardTemplateId: string;
  characterName: string;
  tier: Tier;
  floorPrice: number;
  lastSale: number;
  change24h: number; // percentage
  volume24h: number;
  uniqueHolders: number;
  sparkline: number[]; // 7-day price history
}

/** A listing created by the current player. */
export interface MyListing {
  listingId: string;
  cardTemplateId: string;
  characterName: string;
  momentId: string;
  tier: Tier;
  price: number;
  listedAt: Date;
  expiresAt: Date;
  status: "active" | "expired" | "sold";
}

/** A featured drop / flash-sale item shown in the Primary tab. */
export interface FeaturedDrop {
  dropId: string;
  cardTemplateId: string;
  characterName: string;
  tier: Tier;
  setId: SetId;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  endsAt: Date;
  supplyTotal: number;
  supplyRemaining: number;
}

// ---------------------------------------------------------------------------
// Filter state (used by Secondary tab)
// ---------------------------------------------------------------------------
export interface MarketFilters {
  tier: Tier | "all";
  setId: SetId | "all";
  priceMin: number;
  priceMax: number;
  sort: SortOption;
  search: string;
}

export const DEFAULT_FILTERS: MarketFilters = {
  tier: "all",
  setId: "all",
  priceMin: 0,
  priceMax: 1_000_000,
  sort: "newest",
  search: "",
};
