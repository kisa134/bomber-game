/**
 * MarketMockData.ts — BomberMeme CCG v2
 *
 * Phase 1 mock data for marketplace development & testing.
 * All prices in BM (BomberMeme token). Dates are relative to now.
 */

import {
  type MarketListing,
  type MarketSale,
  type FloorData,
  type MyListing,
  type FeaturedDrop,
  type NewRelease,
  type FlashSale,
} from "./MarketTypes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = Date.now;
const d = (offsetMs: number): Date => new Date(now() + offsetMs);
const days = (n: number): number => n * 86400000;

// ---------------------------------------------------------------------------
// Mock listings (12 items)
// ---------------------------------------------------------------------------

export const MOCK_LISTINGS: MarketListing[] = [
  {
    listingId: "lst_001",
    cardTemplateId: "hero_pepe",
    momentId: "classic",
    characterName: "Pepe",
    tier: "legendary",
    setId: "genesis",
    seller: "0x7a3f...e2b1",
    sellerFull: "0x7a3f8c92d4e6b1f095c2a3d4e5f60718293a4b5c6d7e8f901234567890abcdef1",
    price: 17600,
    serial: "BM-S01-0007 / 1000",
    listedAt: d(-days(2)),
    expiresAt: d(days(5)),
    status: "active",
  },
  {
    listingId: "lst_002",
    cardTemplateId: "hero_trump",
    momentId: "mugshot",
    characterName: "Trump",
    tier: "rare",
    setId: "election_chaos",
    seller: "0x9e2b...c4d8",
    price: 4250,
    serial: "BM-S01-0042 / 1000",
    listedAt: d(-days(1)),
    expiresAt: d(days(6)),
    status: "active",
  },
  {
    listingId: "lst_003",
    cardTemplateId: "hero_doge",
    momentId: "tothemoon",
    characterName: "Doge",
    tier: "legendary",
    setId: "genesis",
    seller: "0x3f1a...b7c2",
    price: 22400,
    serial: "BM-S01-0001 / 1000",
    listedAt: d(-days(5)),
    expiresAt: d(days(2)),
    status: "active",
  },
  {
    listingId: "lst_004",
    cardTemplateId: "fd_frog_god",
    momentId: "classic",
    characterName: "Frog God",
    tier: "mythic",
    setId: "frog_dynasty",
    seller: "0xabcd...ef01",
    price: 89000,
    serial: "BM-S01-0003 / 100",
    listedAt: d(-days(3)),
    expiresAt: d(days(4)),
    status: "active",
  },
  {
    listingId: "lst_005",
    cardTemplateId: "cd_eth_whale",
    momentId: "whale",
    characterName: "ETH Whale",
    tier: "epic",
    setId: "crypto_degens",
    seller: "0xdead...beef",
    price: 8400,
    serial: "BM-S01-0147 / 500",
    listedAt: d(-days(1.5)),
    expiresAt: d(days(5.5)),
    status: "active",
  },
  {
    listingId: "lst_006",
    cardTemplateId: "pc_bogdanoff",
    momentId: "pump",
    characterName: "Bogdanoff",
    tier: "legendary",
    setId: "pump_circuit",
    seller: "0xf00d...ba12",
    price: 15600,
    serial: "BM-S01-0089 / 1000",
    listedAt: d(-days(4)),
    expiresAt: d(days(3)),
    status: "active",
  },
  {
    listingId: "lst_007",
    cardTemplateId: "ak_grumpy_cat",
    momentId: "classic",
    characterName: "Grumpy Cat",
    tier: "legendary",
    setId: "animal_kingdom",
    seller: "0x1337...c0de",
    price: 19800,
    serial: "BM-S01-0055 / 1000",
    listedAt: d(-days(6)),
    expiresAt: d(days(1)),
    status: "active",
  },
  {
    listingId: "lst_008",
    cardTemplateId: "hero_wojak",
    momentId: "copium",
    characterName: "Wojak",
    tier: "epic",
    setId: "genesis",
    seller: "0x4206...69ff",
    price: 5200,
    listedAt: d(-days(0.5)),
    expiresAt: d(days(6.5)),
    status: "active",
  },
  {
    listingId: "lst_009",
    cardTemplateId: "hero_chad",
    momentId: "victory",
    characterName: "Chad",
    tier: "epic",
    setId: "genesis",
    seller: "0xalpha...beta",
    price: 7800,
    serial: "BM-S01-0210 / 500",
    listedAt: d(-days(3)),
    expiresAt: d(days(4)),
    status: "active",
  },
  {
    listingId: "lst_010",
    cardTemplateId: "mp_doge_god",
    momentId: "golden",
    characterName: "Doge God",
    tier: "mythic",
    setId: "meme_pantheon",
    seller: "0xg0d...mode",
    price: 125000,
    serial: "BM-S01-0001 / 100",
    listedAt: d(-days(7)),
    expiresAt: d(days(0)),
    status: "active",
  },
  {
    listingId: "lst_011",
    cardTemplateId: "fd_rich_pepe",
    momentId: "drip",
    characterName: "Rich Pepe",
    tier: "epic",
    setId: "frog_dynasty",
    seller: "0xcash...money",
    price: 9500,
    serial: "BM-S01-0088 / 500",
    listedAt: d(-days(2.5)),
    expiresAt: d(days(4.5)),
    status: "active",
  },
  {
    listingId: "lst_012",
    cardTemplateId: "hero_shiba",
    momentId: "hodl",
    characterName: "Shiba Inu",
    tier: "common",
    setId: "genesis",
    seller: "0xshib...army",
    price: 850,
    listedAt: d(-days(1)),
    expiresAt: d(days(6)),
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Mock floor data (8 items)
// ---------------------------------------------------------------------------

export const MOCK_FLOOR_DATA: FloorData[] = [
  {
    cardTemplateId: "hero_pepe",
    characterName: "Pepe",
    tier: "legendary",
    setId: "genesis",
    floorPrice: 15000,
    lastSale: 17600,
    change24h: 5.2,
    volume24h: 2400000,
    uniqueHolders: 342,
    sparkline: [14200, 14500, 14800, 15200, 15000, 15500, 16000],
  },
  {
    cardTemplateId: "hero_doge",
    characterName: "Doge",
    tier: "legendary",
    setId: "genesis",
    floorPrice: 21000,
    lastSale: 22400,
    change24h: 8.1,
    volume24h: 1850000,
    uniqueHolders: 287,
    sparkline: [19500, 19800, 20400, 20100, 21000, 21800, 22400],
  },
  {
    cardTemplateId: "fd_frog_god",
    characterName: "Frog God",
    tier: "mythic",
    setId: "frog_dynasty",
    floorPrice: 82000,
    lastSale: 89000,
    change24h: -2.4,
    volume24h: 960000,
    uniqueHolders: 56,
    sparkline: [91000, 92000, 88000, 85000, 84000, 83000, 82000],
  },
  {
    cardTemplateId: "cd_eth_whale",
    characterName: "ETH Whale",
    tier: "epic",
    setId: "crypto_degens",
    floorPrice: 7200,
    lastSale: 8400,
    change24h: 3.7,
    volume24h: 580000,
    uniqueHolders: 128,
    sparkline: [7000, 7100, 7200, 7400, 7500, 7600, 7200],
  },
  {
    cardTemplateId: "pc_bogdanoff",
    characterName: "Bogdanoff",
    tier: "legendary",
    setId: "pump_circuit",
    floorPrice: 14200,
    lastSale: 15600,
    change24h: -1.8,
    volume24h: 420000,
    uniqueHolders: 189,
    sparkline: [14800, 15000, 14900, 14600, 14500, 14300, 14200],
  },
  {
    cardTemplateId: "ak_grumpy_cat",
    characterName: "Grumpy Cat",
    tier: "legendary",
    setId: "animal_kingdom",
    floorPrice: 18200,
    lastSale: 19800,
    change24h: 12.3,
    volume24h: 3100000,
    uniqueHolders: 401,
    sparkline: [16200, 16800, 17000, 17500, 17800, 18500, 18200],
  },
  {
    cardTemplateId: "hero_wojak",
    characterName: "Wojak",
    tier: "epic",
    setId: "genesis",
    floorPrice: 4600,
    lastSale: 5200,
    change24h: 6.5,
    volume24h: 750000,
    uniqueHolders: 215,
    sparkline: [4200, 4300, 4500, 4400, 4600, 4800, 4600],
  },
  {
    cardTemplateId: "hero_chad",
    characterName: "Chad",
    tier: "epic",
    setId: "genesis",
    floorPrice: 6800,
    lastSale: 7800,
    change24h: 4.1,
    volume24h: 620000,
    uniqueHolders: 176,
    sparkline: [6400, 6500, 6600, 6700, 6800, 7000, 6800],
  },
];

// ---------------------------------------------------------------------------
// Mock my listings (3 items)
// ---------------------------------------------------------------------------

export const MOCK_MY_LISTINGS: MyListing[] = [
  {
    listingId: "my_001",
    cardTemplateId: "hero_pepe",
    characterName: "Pepe",
    momentId: "classic",
    tier: "legendary",
    price: 25000,
    listedAt: d(-days(4)),
    expiresAt: d(days(3)),
    status: "active",
  },
  {
    listingId: "my_002",
    cardTemplateId: "hero_trump",
    characterName: "Trump",
    momentId: "politic",
    tier: "rare",
    price: 6000,
    listedAt: d(-days(10)),
    expiresAt: d(-days(3)),
    status: "expired",
  },
  {
    listingId: "my_003",
    cardTemplateId: "fd_frog_god",
    characterName: "Frog God",
    momentId: "classic",
    tier: "mythic",
    price: 120000,
    listedAt: d(-days(20)),
    expiresAt: d(-days(13)),
    status: "sold",
  },
];

// ---------------------------------------------------------------------------
// Mock history (6 items)
// ---------------------------------------------------------------------------

export const MOCK_HISTORY: MarketSale[] = [
  {
    saleId: "sale_001",
    cardTemplateId: "hero_pepe",
    characterName: "Pepe",
    momentId: "classic",
    tier: "legendary",
    price: 17600,
    buyer: "0xYou...babe",
    seller: "0x7a3f...e2b1",
    soldAt: d(-days(1)),
  },
  {
    saleId: "sale_002",
    cardTemplateId: "hero_doge",
    characterName: "Doge",
    momentId: "tothemoon",
    tier: "legendary",
    price: 21000,
    buyer: "0xMoon...boi",
    seller: "0xYou...babe",
    soldAt: d(-days(3)),
  },
  {
    saleId: "sale_003",
    cardTemplateId: "cd_btc_maxi",
    characterName: "Bitcoin Maxi",
    momentId: "hodl",
    tier: "rare",
    price: 3100,
    buyer: "0xHodl...gang",
    seller: "0xYou...babe",
    soldAt: d(-days(7)),
  },
  {
    saleId: "sale_004",
    cardTemplateId: "fd_rich_pepe",
    characterName: "Rich Pepe",
    momentId: "drip",
    tier: "epic",
    price: 9200,
    buyer: "0xYou...babe",
    seller: "0xDrip...king",
    soldAt: d(-days(2)),
  },
  {
    saleId: "sale_005",
    cardTemplateId: "hero_wojak",
    characterName: "Wojak",
    momentId: "copium",
    tier: "epic",
    price: 4800,
    buyer: "0xCopi...maxx",
    seller: "0xYou...babe",
    soldAt: d(-days(5)),
  },
  {
    saleId: "sale_006",
    cardTemplateId: "ec_trump_mugshot",
    characterName: "Trump Mugshot",
    momentId: "mugshot",
    tier: "legendary",
    price: 18200,
    buyer: "0xYou...babe",
    seller: "0xNews...feed",
    soldAt: d(-days(4)),
  },
];

// ---------------------------------------------------------------------------
// Featured drops (4 items)
// ---------------------------------------------------------------------------

export const MOCK_FEATURED_DROPS: FeaturedDrop[] = [
  {
    dropId: "drop_001",
    name: "Genesis Legendary Drop",
    description: "A guaranteed Legendary from the Genesis Archive set.",
    cardTemplateId: "hero_pepe",
    characterName: "Pepe",
    tier: "legendary",
    price: 15000,
    discount: 15,
    expiresAt: d(days(2)),
  },
  {
    dropId: "drop_002",
    name: "Frog Dynasty Bundle",
    description: "3-card bundle from the Frog Dynasty set.",
    cardTemplateId: "fd_pepe_king",
    characterName: "King Pepe",
    tier: "legendary",
    price: 12000,
    discount: 20,
    expiresAt: d(days(1)),
  },
  {
    dropId: "drop_003",
    name: "Mythic Mystery",
    description: "A 1% chance at a Mythic card. Guaranteed Epic minimum.",
    cardTemplateId: "fd_frog_god",
    characterName: "Frog God",
    tier: "mythic",
    price: 25000,
    discount: 0,
    expiresAt: d(days(3)),
  },
  {
    dropId: "drop_004",
    name: "Election Chaos Pack",
    description: "Political memes for the culturally engaged.",
    cardTemplateId: "ec_trump_mugshot",
    characterName: "Trump Mugshot",
    tier: "legendary",
    price: 18000,
    discount: 10,
    expiresAt: d(days(5)),
  },
];

// ---------------------------------------------------------------------------
// New releases (5 items)
// ---------------------------------------------------------------------------

export const MOCK_NEW_RELEASES: NewRelease[] = [
  {
    releaseId: "rel_001",
    cardTemplateId: "fd_brett",
    characterName: "Brett",
    tier: "rare",
    setId: "frog_dynasty",
    price: 3200,
    releaseDate: d(-days(1)),
  },
  {
    releaseId: "rel_002",
    cardTemplateId: "ak_crab",
    characterName: "Crab",
    tier: "epic",
    setId: "animal_kingdom",
    price: 5800,
    releaseDate: d(-days(2)),
  },
  {
    releaseId: "rel_003",
    cardTemplateId: "ct_anon",
    characterName: "Anon",
    tier: "epic",
    setId: "crypto_twitter",
    price: 5200,
    releaseDate: d(-days(3)),
  },
  {
    releaseId: "rel_004",
    cardTemplateId: "sd_halloween_wojak",
    characterName: "Halloween Wojak",
    tier: "epic",
    setId: "seasonal_drop",
    price: 7500,
    releaseDate: d(-days(0.5)),
  },
  {
    releaseId: "rel_005",
    cardTemplateId: "pc_lambo",
    characterName: "Lambo",
    tier: "epic",
    setId: "pump_circuit",
    price: 8200,
    releaseDate: d(-days(4)),
  },
];

// ---------------------------------------------------------------------------
// Flash sales (3 items)
// ---------------------------------------------------------------------------

export const MOCK_FLASH_SALES: FlashSale[] = [
  {
    saleId: "flash_001",
    name: "Doge Flash",
    cardTemplateId: "hero_doge",
    characterName: "Doge",
    tier: "legendary",
    originalPrice: 25000,
    salePrice: 18000,
    endsAt: d(hours(4)),
  },
  {
    saleId: "flash_002",
    name: "Pepe Flash",
    cardTemplateId: "hero_pepe",
    characterName: "Pepe",
    tier: "legendary",
    originalPrice: 20000,
    salePrice: 14500,
    endsAt: d(hours(2)),
  },
  {
    saleId: "flash_003",
    name: "Grumpy Cat Flash",
    cardTemplateId: "ak_grumpy_cat",
    characterName: "Grumpy Cat",
    tier: "legendary",
    originalPrice: 22000,
    salePrice: 16500,
    endsAt: d(hours(6)),
  },
];

function hours(n: number): number {
  return n * 3600000;
}
