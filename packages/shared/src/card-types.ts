// ============================================================================
// BomberMeme CCG v2 — Card Game API Contract Types
// ============================================================================
// TypeScript API contract types for client-server communication in the
// collectible card game system. These define the shape of all data exchanged
// between the card game client and the backend.
//
// IMPORT:  import type { CardInstance, OpenPackRequest } from "../shared/index.js";
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Core Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

/** Card rarity tier — determines drop rates, fusion paths, and visual frame. */
export type CardTier = "common" | "rare" | "epic" | "legendary" | "mythic";

/** Identifies one of the 9 themed card sets in the collection. */
export type CardSetId =
  | "genesis"
  | "crypto_degens"
  | "frog_dynasty"
  | "meme_pantheon"
  | "election_chaos"
  | "pump_circuit"
  | "animal_kingdom"
  | "crypto_twitter"
  | "seasonal_drop";

/** Type of card pack available for purchase/opening. */
export type PackType = "basic" | "premium" | "legendary";

/** Market UI tab identifiers. */
export type MarketTab = "primary" | "secondary" | "my_listings" | "history";

/** In-game currency used for transactions. */
export type CurrencyType = "chips" | "token";

// ─────────────────────────────────────────────────────────────────────────────
// Card Data Types
// ─────────────────────────────────────────────────────────────────────────────

/** Static card template — defines the base properties shared by all instances
 *  of a particular card. Populated server-side from the card database. */
export interface CardTemplate {
  cardTemplateId: number;
  characterId: string;
  characterName: string;
  momentId: string;
  momentName: string;
  tier: CardTier;
  setId: CardSetId;
  setName: string;
  setNumber: number;
  lore: string;
  maxSupply: number | null;
}

/** A concrete card instance owned by a player wallet. Each instance has a
 *  unique ID and tracks its own match history and visual attributes. */
export interface CardInstance {
  instanceId: string;
  wallet: string;
  cardTemplateId: number;
  isFoil: boolean;
  isGoldFrame: boolean;
  matchCount: number;
  generatedAt: string;
  source: string;
  serialNumber?: string;
}

/** Server-enriched card instance with joined template data. Used in inventory. */
export interface CardInstanceFull extends CardInstance {
  characterId: string;
  characterName: string;
  momentId: string;
  momentName: string;
  tier: CardTier;
  setId: CardSetId;
  setName: string;
  setNumber: number;
  lore: string;
  nickname?: string;
}

/** Mutable per-card metadata (nickname, serial number, custom notes). */
export interface CardMetadata {
  instanceId: string;
  nickname?: string;
  serialNumber?: string;
  notes?: Record<string, unknown>;
}

/** Card as shown in the collection grid — includes ownership status. */
export interface CollectionCard {
  characterId: string;
  characterName: string;
  tier: CardTier;
  setId: CardSetId;
  owned: boolean;
  ownedMoments: number;
  totalMoments: number;
  matchCount: number;
  isFoil: boolean;
  serial?: string;
}

/** Collection set progress — how many cards the player owns in each set. */
export interface SetProgress {
  setId: CardSetId;
  setName: string;
  owned: number;
  total: number;
  reward: { type: "back_skin" | "emote" | "title"; name: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pack Opening Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single card revealed from a pack opening. */
export interface RevealedCard {
  cardTemplateId: number;
  instanceId: string;
  characterName: string;
  tier: CardTier;
  momentId: string;
  momentName: string;
  isNew: boolean;
  isFoil: boolean;
}

/** Configuration for a pack type — cost, card count, tier guarantees. */
export interface PackConfig {
  cardCount: number;
  guaranteedMinTier: CardTier;
  cost: number;
  costCurrency: CurrencyType;
  label: string;
}

/** Pack configurations for each pack type. Shared between client and server. */
export const PACK_CONFIGS: Record<PackType, PackConfig> = {
  basic:     { cardCount: 3, guaranteedMinTier: "rare",  cost: 500,   costCurrency: "chips", label: "Basic Pack" },
  premium:   { cardCount: 5, guaranteedMinTier: "rare",  cost: 2500,  costCurrency: "chips", label: "Premium Pack" },
  legendary: { cardCount: 1, guaranteedMinTier: "epic",  cost: 50000, costCurrency: "token", label: "Legendary Pack" },
};

/** Tier colour hex values for UI rendering. */
export const TIER_COLORS: Record<CardTier, string> = {
  common:    "#9aa3b2",
  rare:      "#4aa3ff",
  epic:      "#c879ff",
  legendary: "#ffcc33",
  mythic:    "#ff5a5a",
};

// ─────────────────────────────────────────────────────────────────────────────
// Fusion Types
// ─────────────────────────────────────────────────────────────────────────────

/** A fusion recipe defines how 3 input cards combine into 1 output card. */
export interface FusionRecipe {
  inputTier: CardTier;
  inputCount: number;
  requireFoil: boolean;
  requireSameCharacter: boolean;
  requireSameMoment: boolean;
  outputTier: CardTier;
  outputIsFoil: boolean;
  outputIsGoldFrame: boolean;
  fee: number;
  feeCurrency: CurrencyType;
}

/** All available fusion recipes. 3×Common→Foil, 3×FoilCommon→Rare Gold, etc. */
export const FUSION_RECIPES: FusionRecipe[] = [
  { inputTier: "common",  inputCount: 3, requireFoil: false, requireSameCharacter: true, requireSameMoment: true, outputTier: "common",  outputIsFoil: true,  outputIsGoldFrame: false, fee: 100,   feeCurrency: "chips" },
  { inputTier: "common",  inputCount: 3, requireFoil: true,  requireSameCharacter: true, requireSameMoment: true, outputTier: "rare",    outputIsFoil: false, outputIsGoldFrame: true,  fee: 500,   feeCurrency: "chips" },
  { inputTier: "rare",    inputCount: 3, requireFoil: false, requireSameCharacter: true, requireSameMoment: true, outputTier: "epic",    outputIsFoil: false, outputIsGoldFrame: true,  fee: 2000,  feeCurrency: "chips" },
  { inputTier: "epic",    inputCount: 3, requireFoil: false, requireSameCharacter: true, requireSameMoment: true, outputTier: "legendary", outputIsFoil: false, outputIsGoldFrame: true,  fee: 10000, feeCurrency: "token" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Market Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single marketplace listing — one card for sale by one seller. */
export interface MarketListing {
  listingId: string;
  wallet: string;
  instanceId: string;
  cardTemplateId: number;
  characterName: string;
  momentName: string;
  tier: CardTier;
  setId: CardSetId;
  price: number;
  status: "active" | "cancelled" | "sold";
  listedAt: string;
  serial?: string;
}

/** Floor price data for a card template — used in market UI sparklines. */
export interface FloorData {
  cardTemplateId: number;
  characterName: string;
  tier: CardTier;
  floorPrice: number;
  lastSale: number;
  change24h: number;
  volume24h: number;
  sparkline: number[];
}

/** A completed marketplace sale — immutable record. */
export interface MarketSale {
  saleId: string;
  listingId: string;
  sellerWallet: string;
  buyerWallet: string;
  instanceId: string;
  price: number;
  soldAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pack / Fusion Audit Records (server → client history)
// ─────────────────────────────────────────────────────────────────────────────

/** Record of a pack opening event. */
export interface PackOpenRecord {
  openId: string;
  wallet: string;
  packType: PackType;
  costCurrency: CurrencyType;
  costAmount: number;
  cardsReceived: RevealedCard[];
  openedAt: string;
}

/** Record of a card fusion event. */
export interface FusionRecord {
  fusionId: string;
  wallet: string;
  inputInstanceIds: string[];
  outputInstanceId: string;
  recipeUsed: FusionRecipe;
  feePaid: number;
  fusedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Request / Response Types — Client-Server Contract
// ─────────────────────────────────────────────────────────────────────────────

// --- Inventory ---
export interface GetInventoryRequest  { session: string; }
export interface GetInventoryResponse { cards: CardInstanceFull[]; progress: SetProgress[]; totalCards: number; }

// --- Pack Open ---
export interface OpenPackRequest  { session: string; packType: PackType; }
export interface OpenPackResponse { success: boolean; revealed: RevealedCard[]; packType: PackType; cost: number; newBalance: number; error?: string; }

// --- Fusion ---
export interface FuseCardsRequest  { session: string; instanceIds: [string, string, string]; }
export interface FuseCardsResponse { success: boolean; result?: CardInstanceFull; consumed: string[]; fee: number; error?: string; }

// --- Market: Browse ---
export interface GetListingsRequest  { tier?: CardTier; setId?: CardSetId; sortBy?: "price_asc" | "price_desc" | "recent"; }
export interface GetListingsResponse { listings: MarketListing[]; total: number; }

export interface GetFloorRequest  { cardTemplateId?: number; }
export interface GetFloorResponse { floors: FloorData[]; }

export interface GetHistoryRequest  { cardTemplateId?: number; limit?: number; }
export interface GetHistoryResponse { sales: MarketSale[]; }

// --- Market: Actions ---
export interface CreateListingRequest  { session: string; instanceId: string; price: number; }
export interface CreateListingResponse { success: boolean; listing?: MarketListing; error?: string; }

export interface BuyListingRequest  { session: string; listingId: string; }
export interface BuyListingResponse { success: boolean; sale?: MarketSale; newBalance: number; error?: string; }

export interface CancelListingRequest  { session: string; listingId: string; }
export interface CancelListingResponse { success: boolean; error?: string; }

export interface GetMyListingsRequest  { session: string; }
export interface GetMyListingsResponse { listings: MarketListing[]; }

// --- Templates ---
export interface GetTemplatesResponse { templates: CardTemplate[]; }

// --- Aging ---
export interface AgingStage {
  name: "Mint" | "Seasoned" | "Veteran" | "Legend" | "Immortal";
  minMatches: number;
  cssClass: string;
  description: string;
}

export const AGING_STAGES: AgingStage[] = [
  { name: "Mint",     minMatches: 0,   cssClass: "card-mint",     description: "Pristine condition." },
  { name: "Seasoned", minMatches: 10,  cssClass: "card-seasoned", description: "Golden patina on frame corners." },
  { name: "Veteran",  minMatches: 50,  cssClass: "card-veteran",  description: "Veteran emblem, faint scratches." },
  { name: "Legend",   minMatches: 100, cssClass: "card-legend",   description: "Soft gold aura, name glows." },
  { name: "Immortal", minMatches: 500, cssClass: "card-immortal", description: "Unique gold border, Immortal mark." },
];
