/**
 * MarketTypes.ts — BomberMeme CCG v2
 *
 * Core type definitions for the card marketplace.
 * Includes listings, sales history, floor-price data, featured drops,
 * and the tab enumeration used by MarketView.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

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

export type MarketTab = "primary" | "secondary" | "my_listings" | "history";

export type ListingStatus = "active" | "expired" | "sold" | "cancelled";

// ---------------------------------------------------------------------------
// Marketplace listing (single card for sale)
// ---------------------------------------------------------------------------

export interface MarketListing {
  listingId: string;
  cardTemplateId: string;
  momentId: string;
  characterName: string;
  tier: Tier;
  setId: SetId;
  seller: string; // truncated address, e.g. "0x7a3f..."
  sellerFull?: string;
  price: number; // BM tokens
  serial?: string;
  listedAt: Date;
  expiresAt: Date;
  status: ListingStatus;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Historical sale record
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Floor-price aggregate data per card type
// ---------------------------------------------------------------------------

export interface FloorData {
  cardTemplateId: string;
  characterName: string;
  tier: Tier;
  setId: SetId;
  floorPrice: number;
  lastSale: number;
  change24h: number; // percentage
  volume24h: number;
  uniqueHolders: number;
  sparkline: number[]; // 7-day price history
}

// ---------------------------------------------------------------------------
// User's own listing
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Featured / promotional drop
// ---------------------------------------------------------------------------

export interface FeaturedDrop {
  dropId: string;
  name: string;
  description: string;
  cardTemplateId: string;
  characterName: string;
  tier: Tier;
  price: number;
  discount: number; // percentage off
  expiresAt: Date;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// New release (primary market)
// ---------------------------------------------------------------------------

export interface NewRelease {
  releaseId: string;
  cardTemplateId: string;
  characterName: string;
  tier: Tier;
  setId: SetId;
  price: number;
  releaseDate: Date;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Flash sale (time-limited)
// ---------------------------------------------------------------------------

export interface FlashSale {
  saleId: string;
  name: string;
  cardTemplateId: string;
  characterName: string;
  tier: Tier;
  originalPrice: number;
  salePrice: number;
  endsAt: Date;
  imageUrl?: string;
}
