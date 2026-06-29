// ============================================================================
// card-store.ts — BomberMeme CCG Card Data Access Layer
// ============================================================================
// PostgreSQL-backed store for all card-game operations:
//   - Card templates (master data)
//   - Player card instances (ownership)
//   - Pack opening (audit + generation)
//   - Fusion (consume + create)
//   - Marketplace (listings + sales)
//
// All DB access is parameterized (SQL-injection safe).
// ============================================================================

import type {
  CardInstanceFull,
  CardTemplate,
  RevealedCard,
  PackOpenRecord,
  FusionRecord,
  FusionRecipe,
  MarketListing,
  MarketSale,
  FloorData,
  SetProgress,
  CardSetId,
} from "@bomberpump/shared";

// Import the existing store to reuse the pool
import { store } from "./store.js";

// ── Tier numeric order (higher = rarer) ─────────────────────────────────────
const TIER_ORDER: Record<string, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4,
};

// ── Weighted drop tables per pack type ──────────────────────────────────────
const PACK_DROP_WEIGHTS: Record<string, Array<{ tier: string; weight: number }>> = {
  basic: [
    { tier: "common", weight: 55 },
    { tier: "rare", weight: 30 },
    { tier: "epic", weight: 12 },
    { tier: "legendary", weight: 3 },
    { tier: "mythic", weight: 0 },
  ],
  premium: [
    { tier: "common", weight: 30 },
    { tier: "rare", weight: 35 },
    { tier: "epic", weight: 25 },
    { tier: "legendary", weight: 9 },
    { tier: "mythic", weight: 1 },
  ],
  legendary: [
    { tier: "common", weight: 0 },
    { tier: "rare", weight: 0 },
    { tier: "epic", weight: 60 },
    { tier: "legendary", weight: 35 },
    { tier: "mythic", weight: 5 },
  ],
};

// ── UUID v4 helper ──────────────────────────────────────────────────────────
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Generate instance ID ────────────────────────────────────────────────────
function genInstanceId(): string {
  return `ci_${uuid()}`;
}

// ── Weighted random tier selector ───────────────────────────────────────────
function pickWeightedTier(packType: string): string {
  const weights = PACK_DROP_WEIGHTS[packType] || PACK_DROP_WEIGHTS.basic;
  const total = weights.reduce((s, w) => s + w.weight, 0);
  if (total === 0) return "common";
  let roll = Math.random() * total;
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.tier;
  }
  return weights[weights.length - 1]!.tier;
}

// ── Pick a tier guaranteeing minimum ────────────────────────────────────────
function pickTierWithMin(packType: string, minTier: string): string {
  const minOrder = TIER_ORDER[minTier] ?? 0;
  let tier = pickWeightedTier(packType);
  // Re-roll if below minimum (up to 10 attempts)
  for (let i = 0; i < 10 && (TIER_ORDER[tier] ?? 0) < minOrder; i++) {
    tier = pickWeightedTier(packType);
  }
  if ((TIER_ORDER[tier] ?? 0) < minOrder) {
    // Force minimum tier if all rolls failed
    tier = minTier;
  }
  return tier;
}

// ============================================================================
// CardStore — singleton data access layer
// ============================================================================

export const cardStore = {
  // ── Card Templates ────────────────────────────────────────────────────────

  /** Get all card templates (master data). */
  async getAllTemplates(): Promise<CardTemplate[]> {
    const { rows } = await store.pool.query(
      `SELECT card_template_id, character_id, character_name, moment_id,
              moment_name, tier, set_id, set_name, set_number, lore, max_supply
       FROM card_templates ORDER BY set_id, set_number`
    );
    return rows.map(rowToTemplate);
  },

  /** Get templates by set. */
  async getTemplatesBySet(setId: CardSetId): Promise<CardTemplate[]> {
    const { rows } = await store.pool.query(
      `SELECT card_template_id, character_id, character_name, moment_id,
              moment_name, tier, set_id, set_name, set_number, lore, max_supply
       FROM card_templates WHERE set_id = $1 ORDER BY set_number`,
      [setId]
    );
    return rows.map(rowToTemplate);
  },

  /** Get single template by ID. */
  async getTemplate(cardTemplateId: number): Promise<CardTemplate | null> {
    const { rows } = await store.pool.query(
      `SELECT card_template_id, character_id, character_name, moment_id,
              moment_name, tier, set_id, set_name, set_number, lore, max_supply
       FROM card_templates WHERE card_template_id = $1`,
      [cardTemplateId]
    );
    return rows[0] ? rowToTemplate(rows[0]) : null;
  },

  /** Seed templates on first run (idempotent). */
  async seedTemplates(): Promise<void> {
    await store.pool.query(`SELECT public.seed_card_templates()`);
  },

  // ── Card Instances ────────────────────────────────────────────────────────

  /** Get all cards for a wallet (joined with templates). */
  async getPlayerCards(wallet: string): Promise<CardInstanceFull[]> {
    const { rows } = await store.pool.query(
      `SELECT ci.instance_id, ci.wallet, ci.card_template_id,
              ci.is_foil, ci.is_gold_frame, ci.match_count,
              ci.generated_at, ci.source,
              ct.character_id, ct.character_name, ct.moment_id,
              ct.moment_name, ct.tier, ct.set_id, ct.set_name,
              ct.set_number, ct.lore,
              cm.nickname, cm.serial_number
       FROM card_instances ci
       INNER JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
       LEFT JOIN card_metadata cm ON cm.instance_id = ci.instance_id
       WHERE ci.wallet = $1
       ORDER BY ct.set_id, ct.set_number, ci.generated_at DESC`,
      [wallet]
    );
    return rows.map(rowToInstanceFull);
  },

  /** Get a single card instance with full data. */
  async getCardInstance(instanceId: string): Promise<CardInstanceFull | null> {
    const { rows } = await store.pool.query(
      `SELECT ci.instance_id, ci.wallet, ci.card_template_id,
              ci.is_foil, ci.is_gold_frame, ci.match_count,
              ci.generated_at, ci.source,
              ct.character_id, ct.character_name, ct.moment_id,
              ct.moment_name, ct.tier, ct.set_id, ct.set_name,
              ct.set_number, ct.lore,
              cm.nickname, cm.serial_number
       FROM card_instances ci
       INNER JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
       LEFT JOIN card_metadata cm ON cm.instance_id = ci.instance_id
       WHERE ci.instance_id = $1`,
      [instanceId]
    );
    return rows[0] ? rowToInstanceFull(rows[0]) : null;
  },

  /** Create a new card instance (server-authoritative). */
  async createCardInstance(
    wallet: string,
    cardTemplateId: number,
    opts: { isFoil?: boolean; isGoldFrame?: boolean; source: string; serialNumber?: string }
  ): Promise<CardInstanceFull> {
    const id = genInstanceId();
    const foil = opts.isFoil ?? false;
    const gold = opts.isGoldFrame ?? false;

    await store.pool.query(
      `INSERT INTO card_instances
         (instance_id, wallet, card_template_id, is_foil, is_gold_frame, match_count, source)
       VALUES ($1, $2, $3, $4, $5, 0, $6)`,
      [id, wallet, cardTemplateId, foil, gold, opts.source]
    );

    if (opts.serialNumber) {
      await store.pool.query(
        `INSERT INTO card_metadata (instance_id, serial_number)
         VALUES ($1, $2)
         ON CONFLICT (instance_id) DO UPDATE SET serial_number = $2`,
        [id, opts.serialNumber]
      );
    }

    const instance = await this.getCardInstance(id);
    if (!instance) throw new Error("Failed to create card instance");
    return instance;
  },

  /** Increment match count for a card (aging). */
  async incrementMatchCount(instanceId: string): Promise<number> {
    const { rows } = await store.pool.query(
      `UPDATE card_instances SET match_count = match_count + 1
       WHERE instance_id = $1 RETURNING match_count`,
      [instanceId]
    );
    return rows[0]?.match_count ?? 0;
  },

  /** Check if wallet owns ALL of the given instance IDs. */
  async validateOwnership(wallet: string, instanceIds: string[]): Promise<boolean> {
    if (instanceIds.length === 0) return false;
    const { rows } = await store.pool.query(
      `SELECT COUNT(*)::int as cnt FROM card_instances
       WHERE wallet = $1 AND instance_id = ANY($2)`,
      [wallet, instanceIds]
    );
    return (rows[0]?.cnt ?? 0) === instanceIds.length;
  },

  /** Get collection progress per set. */
  async getCollectionProgress(wallet: string): Promise<SetProgress[]> {
    const { rows } = await store.pool.query(
      `SELECT * FROM public.get_player_collection_progress($1)`,
      [wallet]
    );
    return rows.map((r: Record<string, unknown>) => ({
      setId: r.set_id as CardSetId,
      setName: r.set_name as string,
      owned: Number(r.owned_unique ?? 0),
      total: Number(r.total_templates ?? 0),
      reward: { type: "back_skin" as const, name: `${r.set_name} Reward` },
    }));
  },

  // ── Pack Opening ──────────────────────────────────────────────────────────

  /** Generate random cards for a pack opening (SERVER-AUTHORITATIVE).
   *  Returns card templates that will be given to the player. */
  async getRandomCardsForPack(packType: string): Promise<CardTemplate[]> {
    const config = {
      basic: { count: 3, minTier: "common" },
      premium: { count: 5, minTier: "rare" },
      legendary: { count: 1, minTier: "epic" },
    }[packType] || { count: 3, minTier: "common" };

    // Get one random card per slot, respecting tier weights
    const results: CardTemplate[] = [];
    const usedIds = new Set<number>();

    for (let i = 0; i < config.count; i++) {
      const targetTier = i === 0 ? config.minTier : pickTierWithMin(packType, "common");
      const { rows } = await store.pool.query(
        `SELECT card_template_id, character_id, character_name, moment_id,
                moment_name, tier, set_id, set_name, set_number, lore, max_supply
         FROM card_templates
         WHERE tier = $1 AND card_template_id != ALL($2)
         ORDER BY RANDOM()
         LIMIT 1`,
        [targetTier, Array.from(usedIds).length ? Array.from(usedIds) : [0]]
      );
      if (rows[0]) {
        results.push(rowToTemplate(rows[0]));
        usedIds.add(rows[0].card_template_id);
      }
    }

    // Fill any missing slots with commons
    while (results.length < config.count) {
      const { rows } = await store.pool.query(
        `SELECT * FROM card_templates ORDER BY RANDOM() LIMIT 1`
      );
      if (rows[0] && !usedIds.has(rows[0].card_template_id)) {
        results.push(rowToTemplate(rows[0]));
        usedIds.add(rows[0].card_template_id);
      } else if (rows[0]) {
        results.push(rowToTemplate(rows[0]));
        break;
      }
    }

    return results;
  },

  /** Record a pack open in the audit log. */
  async recordPackOpen(
    wallet: string,
    packType: string,
    costCurrency: string,
    costAmount: number,
    cards: RevealedCard[]
  ): Promise<void> {
    const openId = `po_${uuid()}`;
    await store.pool.query(
      `INSERT INTO pack_opens (open_id, wallet, pack_type, cost_currency, cost_amount, cards_received)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [openId, wallet, packType, costCurrency, costAmount, JSON.stringify(cards)]
    );
  },

  /** Get pack open history for a wallet. */
  async getPackHistory(wallet: string, limit = 50): Promise<PackOpenRecord[]> {
    const { rows } = await store.pool.query(
      `SELECT open_id, wallet, pack_type, cost_currency, cost_amount,
              cards_received, opened_at
       FROM pack_opens WHERE wallet = $1 ORDER BY opened_at DESC LIMIT $2`,
      [wallet, limit]
    );
    return rows.map((r: Record<string, unknown>) => ({
      openId: r.open_id as string,
      wallet: r.wallet as string,
      packType: r.pack_type as string,
      costCurrency: r.cost_currency as string,
      costAmount: r.cost_amount as number,
      cardsReceived: (r.cards_received as unknown[]) as RevealedCard[],
      openedAt: (r.opened_at as Date).toISOString(),
    }));
  },

  // ── Fusion ────────────────────────────────────────────────────────────────

  /** Record a fusion + consume inputs + create output. */
  async recordFusion(
    wallet: string,
    inputIds: string[],
    outputId: string,
    recipe: FusionRecipe
  ): Promise<void> {
    const fusionId = `fu_${uuid()}`;
    await store.pool.query(
      `INSERT INTO fusion_history
         (fusion_id, wallet, input_instance_ids, output_instance_id, recipe_used, fee_paid)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fusionId, wallet, inputIds, outputId, JSON.stringify(recipe), recipe.fee]
    );
  },

  /** Get fusion history for a wallet. */
  async getFusionHistory(wallet: string, limit = 50): Promise<FusionRecord[]> {
    const { rows } = await store.pool.query(
      `SELECT fusion_id, wallet, input_instance_ids, output_instance_id,
              recipe_used, fee_paid, fused_at
       FROM fusion_history WHERE wallet = $1 ORDER BY fused_at DESC LIMIT $2`,
      [wallet, limit]
    );
    return rows.map((r: Record<string, unknown>) => ({
      fusionId: r.fusion_id as string,
      wallet: r.wallet as string,
      inputInstanceIds: r.input_instance_ids as string[],
      outputInstanceId: r.output_instance_id as string,
      recipeUsed: r.recipe_used as FusionRecipe,
      feePaid: r.fee_paid as number,
      fusedAt: (r.fused_at as Date).toISOString(),
    }));
  },

  /** Soft-delete consumed cards (set consumed flag via source field). */
  async consumeCards(instanceIds: string[]): Promise<void> {
    if (instanceIds.length === 0) return;
    await store.pool.query(
      `UPDATE card_instances SET source = 'consumed'
       WHERE instance_id = ANY($1)`,
      [instanceIds]
    );
  },

  // ── Marketplace ───────────────────────────────────────────────────────────

  /** Create a listing. */
  async createListing(wallet: string, instanceId: string, price: number): Promise<MarketListing> {
    const listingId = `lst_${uuid()}`;
    await store.pool.query(
      `INSERT INTO market_listings (listing_id, wallet, instance_id, price)
       VALUES ($1, $2, $3, $4)`,
      [listingId, wallet, instanceId, price]
    );
    // Get the listing with joined data
    const { rows } = await store.pool.query(
      `SELECT ml.listing_id, ml.wallet, ml.instance_id, ml.price,
              ml.status, ml.listed_at,
              ci.card_template_id,
              ct.character_name, ct.moment_name, ct.tier, ct.set_id,
              cm.serial_number
       FROM market_listings ml
       INNER JOIN card_instances ci ON ci.instance_id = ml.instance_id
       INNER JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
       LEFT JOIN card_metadata cm ON cm.instance_id = ci.instance_id
       WHERE ml.listing_id = $1`,
      [listingId]
    );
    return rowToListing(rows[0]!);
  },

  /** Get active listings with optional filters. */
  async getListings(opts: {
    tier?: string;
    setId?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ listings: MarketListing[]; total: number }> {
    const conditions = ["ml.status = 'active'"];
    const params: unknown[] = [];
    let pIdx = 1;

    if (opts.tier) {
      conditions.push(`ct.tier = $${pIdx++}`);
      params.push(opts.tier);
    }
    if (opts.setId) {
      conditions.push(`ct.set_id = $${pIdx++}`);
      params.push(opts.setId);
    }

    const whereClause = conditions.join(" AND ");
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;

    // Count total
    const countRes = await store.pool.query(
      `SELECT COUNT(*)::int as total
       FROM market_listings ml
       INNER JOIN card_instances ci ON ci.instance_id = ml.instance_id
       INNER JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
       WHERE ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total ?? 0;

    // Sort
    let orderBy = "ml.listed_at DESC";
    if (opts.sortBy === "price_asc") orderBy = "ml.price ASC";
    if (opts.sortBy === "price_desc") orderBy = "ml.price DESC";

    // Fetch listings
    const { rows } = await store.pool.query(
      `SELECT ml.listing_id, ml.wallet, ml.instance_id, ml.price,
              ml.status, ml.listed_at,
              ci.card_template_id,
              ct.character_name, ct.moment_name, ct.tier, ct.set_id,
              cm.serial_number
       FROM market_listings ml
       INNER JOIN card_instances ci ON ci.instance_id = ml.instance_id
       INNER JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
       LEFT JOIN card_metadata cm ON cm.instance_id = ci.instance_id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    return { listings: rows.map(rowToListing), total };
  },

  /** Get floor price data. */
  async getFloorData(cardTemplateId?: number): Promise<FloorData[]> {
    let whereClause = "";
    const params: unknown[] = [];
    if (cardTemplateId) {
      whereClause = "WHERE ct.card_template_id = $1";
      params.push(cardTemplateId);
    }

    const { rows } = await store.pool.query(
      `SELECT ct.card_template_id, ct.character_name, ct.tier,
              COALESCE(MIN(ml.price), 0) as floor_price,
              COALESCE(
                (SELECT price FROM market_sales_history
                 WHERE instance_id IN (
                   SELECT instance_id FROM card_instances
                   WHERE card_template_id = ct.card_template_id
                 )
                 ORDER BY sold_at DESC LIMIT 1), 0
              ) as last_sale,
              ct.character_name
       FROM card_templates ct
       LEFT JOIN market_listings ml ON ml.instance_id IN (
         SELECT instance_id FROM card_instances
         WHERE card_template_id = ct.card_template_id
       ) AND ml.status = 'active'
       ${whereClause}
       GROUP BY ct.card_template_id, ct.character_name, ct.tier
       ORDER BY ct.card_template_id`,
      params
    );

    return rows.map((r: Record<string, unknown>) => ({
      cardTemplateId: r.card_template_id as number,
      characterName: r.character_name as string,
      tier: r.tier as string,
      floorPrice: Number(r.floor_price ?? 0),
      lastSale: Number(r.last_sale ?? 0),
      change24h: 0, // TODO: compute from actual sales
      volume24h: 0, // TODO: compute from actual sales
      sparkline: [], // TODO: generate from sales history
    }));
  },

  /** Get sales history. */
  async getSalesHistory(opts: { cardTemplateId?: number; limit?: number }): Promise<MarketSale[]> {
    let whereClause = "";
    const params: unknown[] = [];

    if (opts.cardTemplateId) {
      // Need to join through card_instances to filter by template
      whereClause = `WHERE ci.card_template_id = $1`;
      params.push(opts.cardTemplateId);
    }

    const { rows } = await store.pool.query(
      `SELECT msh.sale_id, msh.listing_id, msh.seller_wallet, msh.buyer_wallet,
              msh.instance_id, msh.price, msh.sold_at
       FROM market_sales_history msh
       ${opts.cardTemplateId ? "INNER JOIN card_instances ci ON ci.instance_id = msh.instance_id" : ""}
       ${whereClause}
       ORDER BY msh.sold_at DESC
       LIMIT $${params.length + 1}`,
      [...params, opts.limit ?? 50]
    );

    return rows.map((r: Record<string, unknown>) => ({
      saleId: r.sale_id as string,
      listingId: r.listing_id as string,
      sellerWallet: r.seller_wallet as string,
      buyerWallet: r.buyer_wallet as string,
      instanceId: r.instance_id as string,
      price: r.price as number,
      soldAt: (r.sold_at as Date).toISOString(),
    }));
  },

  /** Get a player's own listings. */
  async getMyListings(wallet: string): Promise<MarketListing[]> {
    const { rows } = await store.pool.query(
      `SELECT ml.listing_id, ml.wallet, ml.instance_id, ml.price,
              ml.status, ml.listed_at,
              ci.card_template_id,
              ct.character_name, ct.moment_name, ct.tier, ct.set_id,
              cm.serial_number
       FROM market_listings ml
       INNER JOIN card_instances ci ON ci.instance_id = ml.instance_id
       INNER JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
       LEFT JOIN card_metadata cm ON cm.instance_id = ci.instance_id
       WHERE ml.wallet = $1
       ORDER BY ml.listed_at DESC`,
      [wallet]
    );
    return rows.map(rowToListing);
  },

  /** Mark a listing as sold. */
  async markListingSold(listingId: string, buyerWallet: string): Promise<void> {
    await store.pool.query(
      `UPDATE market_listings
       SET status = 'sold', sold_at = now(), buyer_wallet = $2
       WHERE listing_id = $1`,
      [listingId, buyerWallet]
    );
  },

  /** Cancel a listing (only if owned by wallet). */
  async cancelListing(listingId: string, wallet: string): Promise<boolean> {
    const { rowCount } = await store.pool.query(
      `UPDATE market_listings SET status = 'cancelled'
       WHERE listing_id = $1 AND wallet = $2 AND status = 'active'`,
      [listingId, wallet]
    );
    return (rowCount ?? 0) > 0;
  },

  /** Transfer card ownership (for marketplace buy). */
  async transferCardOwnership(
    instanceId: string,
    fromWallet: string,
    toWallet: string
  ): Promise<boolean> {
    const { rowCount } = await store.pool.query(
      `UPDATE card_instances SET wallet = $3
       WHERE instance_id = $1 AND wallet = $2`,
      [instanceId, fromWallet, toWallet]
    );
    return (rowCount ?? 0) > 0;
  },

  /** Record a completed sale in history. */
  async recordSale(
    listingId: string,
    sellerWallet: string,
    buyerWallet: string,
    instanceId: string,
    price: number
  ): Promise<void> {
    const saleId = `sl_${uuid()}`;
    await store.pool.query(
      `INSERT INTO market_sales_history
         (sale_id, listing_id, seller_wallet, buyer_wallet, instance_id, price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [saleId, listingId, sellerWallet, buyerWallet, instanceId, price]
    );
  },

  /** Get a listing by ID. */
  async getListing(listingId: string): Promise<MarketListing | null> {
    const { rows } = await store.pool.query(
      `SELECT ml.listing_id, ml.wallet, ml.instance_id, ml.price,
              ml.status, ml.listed_at,
              ci.card_template_id,
              ct.character_name, ct.moment_name, ct.tier, ct.set_id,
              cm.serial_number
       FROM market_listings ml
       INNER JOIN card_instances ci ON ci.instance_id = ml.instance_id
       INNER JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
       LEFT JOIN card_metadata cm ON cm.instance_id = ci.instance_id
       WHERE ml.listing_id = $1`,
      [listingId]
    );
    return rows[0] ? rowToListing(rows[0]) : null;
  },
};

// ============================================================================
// Row mappers — convert pg rows to typed objects
// ============================================================================

function rowToTemplate(row: Record<string, unknown>): CardTemplate {
  return {
    cardTemplateId: row.card_template_id as number,
    characterId: row.character_id as string,
    characterName: row.character_name as string,
    momentId: row.moment_id as string,
    momentName: row.moment_name as string,
    tier: row.tier as string,
    setId: row.set_id as CardSetId,
    setName: row.set_name as string,
    setNumber: row.set_number as number,
    lore: (row.lore as string) ?? "",
    maxSupply: row.max_supply as number | null,
  };
}

function rowToInstanceFull(row: Record<string, unknown>): CardInstanceFull {
  return {
    instanceId: row.instance_id as string,
    wallet: row.wallet as string,
    cardTemplateId: row.card_template_id as number,
    characterId: row.character_id as string,
    characterName: row.character_name as string,
    momentId: row.moment_id as string,
    momentName: row.moment_name as string,
    tier: row.tier as CardTier,
    setId: row.set_id as CardSetId,
    setName: row.set_name as string,
    setNumber: row.set_number as number,
    lore: (row.lore as string) ?? "",
    isFoil: row.is_foil as boolean,
    isGoldFrame: row.is_gold_frame as boolean,
    matchCount: row.match_count as number,
    generatedAt: (row.generated_at as Date).toISOString(),
    source: row.source as string,
    nickname: (row.nickname as string) ?? undefined,
    serialNumber: (row.serial_number as string) ?? undefined,
  };
}

function rowToListing(row: Record<string, unknown>): MarketListing {
  return {
    listingId: row.listing_id as string,
    wallet: row.wallet as string,
    instanceId: row.instance_id as string,
    cardTemplateId: row.card_template_id as number,
    characterName: row.character_name as string,
    momentName: row.moment_name as string,
    tier: row.tier as CardTier,
    setId: row.set_id as CardSetId,
    price: row.price as number,
    status: row.status as "active" | "cancelled" | "sold",
    listedAt: (row.listed_at as Date).toISOString(),
    serial: (row.serial_number as string) ?? undefined,
  };
}
