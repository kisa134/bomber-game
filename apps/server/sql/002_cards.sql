-- =============================================================================
-- Migration: 002_cards.sql
-- Description: Core collectible card system for BomberMeme — card templates,
--              player card instances, pack openings, fusions, marketplace,
--              and collection tracking.
-- =============================================================================

-- =============================================================================
-- 1. CARD TEMPLATES — master data for every possible card variant
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.card_templates (
    card_template_id   SERIAL PRIMARY KEY,
    character_id       TEXT NOT NULL,                    -- e.g. "hero_pepe", "fd_frog_god"
    character_name     TEXT NOT NULL,                    -- display name: "Pepe", "Frog God"
    moment_id          TEXT NOT NULL,                    -- e.g. "classic", "golden"
    moment_name        TEXT NOT NULL,                    -- display name: "Classic", "Golden Era"
    tier               TEXT NOT NULL
                       CHECK (tier IN ('common','rare','epic','legendary','mythic')),
    set_id             TEXT NOT NULL,                    -- e.g. "genesis", "frog_dynasty"
    set_name           TEXT NOT NULL,                    -- display name: "Genesis Archive"
    set_number         INT NOT NULL,                     -- # within set, e.g. 1, 2, 3
    lore               TEXT,                            -- flavor text
    max_supply         INT,                            -- max supply for limited cards (NULL = unlimited)
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (character_id, moment_id)                    -- each character+moment combo is unique
);

COMMENT ON TABLE public.card_templates IS 'Master registry of all collectible card variants in BomberMeme. Each row defines a unique character + moment + tier combination.';

CREATE INDEX IF NOT EXISTS idx_card_templates_set_id
    ON public.card_templates (set_id);
CREATE INDEX IF NOT EXISTS idx_card_templates_tier
    ON public.card_templates (tier);
CREATE INDEX IF NOT EXISTS idx_card_templates_character_id
    ON public.card_templates (character_id);

-- =============================================================================
-- 2. CARD INSTANCES — individually owned cards
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.card_instances (
    instance_id        TEXT PRIMARY KEY,                -- "ci_<uuid>" format
    wallet             TEXT NOT NULL
                       REFERENCES public.profiles(wallet)
                       ON DELETE CASCADE,
    card_template_id   INT NOT NULL
                       REFERENCES public.card_templates(card_template_id)
                       ON DELETE RESTRICT,
    is_foil            BOOLEAN NOT NULL DEFAULT FALSE,
    is_gold_frame      BOOLEAN NOT NULL DEFAULT FALSE,
    match_count        INT NOT NULL DEFAULT 0,           -- for aging system
    generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    source             TEXT NOT NULL,                    -- "pack_open", "fusion", "purchase", "grant"
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.card_instances IS 'Individual card copies owned by players. Links to card_templates for static data; use card_metadata for mutable per-card state.';

CREATE INDEX IF NOT EXISTS idx_card_instances_wallet
    ON public.card_instances (wallet);
CREATE INDEX IF NOT EXISTS idx_card_instances_card_template_id
    ON public.card_instances (card_template_id);
CREATE INDEX IF NOT EXISTS idx_card_instances_generated_at
    ON public.card_instances (generated_at DESC);

-- =============================================================================
-- 3. PACK OPENS — audit log of booster pack openings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pack_opens (
    open_id            TEXT PRIMARY KEY,
    wallet             TEXT NOT NULL,
    pack_type          TEXT NOT NULL
                       CHECK (pack_type IN ('basic','premium','legendary')),
    cost_currency      TEXT NOT NULL,                    -- "chips" or "token"
    cost_amount        INT NOT NULL,
    cards_received     JSONB NOT NULL,                   -- [{cardTemplateId, tier, characterName}, ...]
    opened_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pack_opens IS 'Audit trail of every booster pack opened. cards_received stores the rolled card template IDs for verifiable randomness.';

CREATE INDEX IF NOT EXISTS idx_pack_opens_wallet
    ON public.pack_opens (wallet);
CREATE INDEX IF NOT EXISTS idx_pack_opens_opened_at
    ON public.pack_opens (opened_at DESC);

-- =============================================================================
-- 4. FUSION HISTORY — audit log of card fusions (3→1 upgrades)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fusion_history (
    fusion_id          TEXT PRIMARY KEY,
    wallet             TEXT NOT NULL,
    input_instance_ids TEXT[] NOT NULL,                  -- 3 card instance IDs consumed
    output_instance_id TEXT NOT NULL,                    -- new card instance ID created
    recipe_used        JSONB NOT NULL,                   -- {inputTier, outputTier, isFoil, isGoldFrame}
    fee_paid           INT NOT NULL DEFAULT 0,           -- BM/chips fee paid
    fused_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fusion_history IS 'Audit trail of card fusion events: 3 input cards consumed → 1 upgraded output card. Fee is burned on fusion.';

CREATE INDEX IF NOT EXISTS idx_fusion_history_wallet
    ON public.fusion_history (wallet);
CREATE INDEX IF NOT EXISTS idx_fusion_history_fused_at
    ON public.fusion_history (fused_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_history_output_instance
    ON public.fusion_history (output_instance_id);

-- =============================================================================
-- 5. MARKET LISTINGS — P2P marketplace active listings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.market_listings (
    listing_id         TEXT PRIMARY KEY,
    wallet             TEXT NOT NULL,                    -- seller wallet
    instance_id        TEXT NOT NULL UNIQUE,             -- card being sold
    price              INT NOT NULL,                     -- price in BM tokens
    status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','cancelled','sold')),
    listed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    sold_at            TIMESTAMPTZ,
    buyer_wallet       TEXT
);

COMMENT ON TABLE public.market_listings IS 'Active and historical P2P marketplace listings. When a listing sells, status flips to ''sold'' and buyer_wallet + sold_at are populated.';

CREATE INDEX IF NOT EXISTS idx_market_listings_status_price
    ON public.market_listings (status, price);
CREATE INDEX IF NOT EXISTS idx_market_listings_wallet
    ON public.market_listings (wallet);
CREATE INDEX IF NOT EXISTS idx_market_listings_listed_at
    ON public.market_listings (listed_at DESC);

-- =============================================================================
-- 6. MARKET SALES HISTORY — completed marketplace transactions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.market_sales_history (
    sale_id            TEXT PRIMARY KEY,
    listing_id         TEXT NOT NULL,
    seller_wallet      TEXT NOT NULL,
    buyer_wallet       TEXT NOT NULL,
    instance_id        TEXT NOT NULL,
    price              INT NOT NULL,
    sold_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.market_sales_history IS 'Immutable record of completed marketplace sales. Denormalised for fast historical lookups.';

CREATE INDEX IF NOT EXISTS idx_market_sales_seller
    ON public.market_sales_history (seller_wallet);
CREATE INDEX IF NOT EXISTS idx_market_sales_buyer
    ON public.market_sales_history (buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_market_sales_sold_at
    ON public.market_sales_history (sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_sales_instance_id
    ON public.market_sales_history (instance_id);

-- =============================================================================
-- 7. CARD METADATA — mutable per-card state (extensibility layer)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.card_metadata (
    instance_id        TEXT PRIMARY KEY
                       REFERENCES public.card_instances(instance_id)
                       ON DELETE CASCADE,
    nickname           TEXT,                            -- custom player-given name
    serial_number      TEXT,                            -- e.g. "BM-S01-0042 / 1000"
    notes              JSONB DEFAULT '{}',
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.card_metadata IS 'Mutable per-card attributes. Extensible JSONB notes field allows future features without schema changes.';

-- =============================================================================
-- UPDATED_AT trigger helper
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_card_templates_updated_at'
    ) THEN
        CREATE TRIGGER trg_card_templates_updated_at
            BEFORE UPDATE ON public.card_templates
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_card_instances_updated_at'
    ) THEN
        CREATE TRIGGER trg_card_instances_updated_at
            BEFORE UPDATE ON public.card_instances
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_card_metadata_updated_at'
    ) THEN
        CREATE TRIGGER trg_card_metadata_updated_at
            BEFORE UPDATE ON public.card_metadata
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- =============================================================================
-- FUNCTION: seed_card_templates()
-- Description: Seeds starter card templates if the table is empty.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_card_templates()
RETURNS VOID AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.card_templates LIMIT 1) THEN
        RETURN;
    END IF;

    INSERT INTO public.card_templates
        (character_id, character_name, moment_id, moment_name, tier,
         set_id, set_name, set_number, lore, max_supply)
    VALUES
        ('hero_pepe',        'Pepe',        'classic', 'Classic', 'common',
         'genesis', 'Genesis Archive', 1,
         'The original meme. Humble. Iconic. Slightly melancholic.', NULL),
        ('hero_doge',        'Doge',        'classic', 'Classic', 'common',
         'genesis', 'Genesis Archive', 2,
         'Much wow. Very card. So collectible.', NULL),
        ('hero_wojak',       'Wojak',       'classic', 'Classic', 'common',
         'genesis', 'Genesis Archive', 3,
         'He knows. He always knew.', NULL),
        ('hero_chad',        'Chad',        'classic', 'Classic', 'common',
         'genesis', 'Genesis Archive', 4, 'Yes.', NULL),
        ('hero_trump',       'Trump',       'classic', 'Classic', 'rare',
         'genesis', 'Genesis Archive', 5,
         'The art of the deal, now on-chain.', 10000),
        ('hero_elon',        'Elon',        'classic', 'Classic', 'rare',
         'genesis', 'Genesis Archive', 6,
         'Occupying Mars and your deck simultaneously.', 10000),
        ('hero_bonk',        'Bonk',        'classic', 'Classic', 'rare',
         'genesis', 'Genesis Archive', 7, 'One bonk. Instant regret.', 5000),
        ('hero_cheems',      'Cheems',      'classic', 'Classic', 'epic',
         'genesis', 'Genesis Archive', 8, 'He just wanted a borgar.', 5000),
        ('hero_nyan_cat',    'Nyan Cat',    'classic', 'Classic', 'epic',
         'genesis', 'Genesis Archive', 9,
         'Pop-tart powered rainbow engine. Maximum velocity.', 3000),
        ('hero_trollface',   'Trollface',   'classic', 'Classic', 'epic',
         'genesis', 'Genesis Archive', 10, 'Problem?', 3000),
        ('hero_shiba',       'Shiba',       'classic', 'Classic', 'legendary',
         'genesis', 'Genesis Archive', 11,
         'The very good boy that started it all.', 1000),
        ('hero_king_pepe',   'King Pepe',   'classic', 'Classic', 'legendary',
         'genesis', 'Genesis Archive', 12,
         'The sovereign of the swamp. All frogs bow before him.', 500),
        ('fd_frog_god',      'Frog God',    'classic', 'Classic', 'mythic',
         'genesis', 'Genesis Archive', 13,
         'Pepe ascended. The amphibian deity of chaos and fortune.', 100),
        ('fd_doge_god',      'Doge God',    'classic', 'Classic', 'mythic',
         'genesis', 'Genesis Archive', 14,
         'Doge transcended. Such omnipotence. Very universe.', 100),
        ('hero_bogdanoff',   'Bogdanoff',   'classic', 'Classic', 'legendary',
         'genesis', 'Genesis Archive', 15,
         'He bought? Pamp it. He sold? Damp it. The market maker.', 250);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: get_player_cards(p_wallet TEXT)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_player_cards(p_wallet TEXT)
RETURNS TABLE (
    instance_id        TEXT,
    card_template_id   INT,
    character_id       TEXT,
    character_name     TEXT,
    moment_id          TEXT,
    moment_name        TEXT,
    tier               TEXT,
    set_id             TEXT,
    set_name           TEXT,
    set_number         INT,
    lore               TEXT,
    is_foil            BOOLEAN,
    is_gold_frame      BOOLEAN,
    match_count        INT,
    nickname           TEXT,
    serial_number      TEXT,
    generated_at       TIMESTAMPTZ,
    source             TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ci.instance_id, ct.card_template_id, ct.character_id,
        ct.character_name, ct.moment_id, ct.moment_name, ct.tier,
        ct.set_id, ct.set_name, ct.set_number, ct.lore,
        ci.is_foil, ci.is_gold_frame, ci.match_count,
        cm.nickname, cm.serial_number, ci.generated_at, ci.source
    FROM public.card_instances ci
    INNER JOIN public.card_templates ct ON ct.card_template_id = ci.card_template_id
    LEFT JOIN public.card_metadata cm ON cm.instance_id = ci.instance_id
    WHERE ci.wallet = p_wallet
    ORDER BY ct.set_number, ct.tier, ci.generated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: get_player_collection_progress(p_wallet TEXT)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_player_collection_progress(p_wallet TEXT)
RETURNS TABLE (
    set_id             TEXT,
    set_name           TEXT,
    total_templates    BIGINT,
    owned_unique       BIGINT,
    owned_total        BIGINT,
    missing            BIGINT,
    by_tier            JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH set_templates AS (
        SELECT ct.set_id, ct.set_name, ct.card_template_id, ct.tier
        FROM public.card_templates ct
    ),
    player_cards AS (
        SELECT ci.card_template_id, ct2.set_id, ct2.tier
        FROM public.card_instances ci
        INNER JOIN public.card_templates ct2 ON ct2.card_template_id = ci.card_template_id
        WHERE ci.wallet = p_wallet
    ),
    per_set AS (
        SELECT
            st.set_id, st.set_name,
            COUNT(DISTINCT st.card_template_id) AS total_templates,
            COUNT(DISTINCT pc.card_template_id) AS owned_unique,
            COUNT(pc.card_template_id) AS owned_total
        FROM set_templates st
        LEFT JOIN player_cards pc ON pc.card_template_id = st.card_template_id
        GROUP BY st.set_id, st.set_name
    ),
    tier_breakdown AS (
        SELECT
            st.set_id,
            jsonb_object_agg(st.tier, COALESCE(tc.cnt, 0)) AS by_tier
        FROM (SELECT DISTINCT set_id, tier FROM set_templates) st
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS cnt FROM player_cards pc2
            WHERE pc2.set_id = st.set_id AND pc2.tier = st.tier
        ) tc ON true
        GROUP BY st.set_id
    )
    SELECT ps.set_id, ps.set_name, ps.total_templates, ps.owned_unique,
           ps.owned_total, (ps.total_templates - ps.owned_unique) AS missing,
           COALESCE(tb.by_tier, '{}'::jsonb) AS by_tier
    FROM per_set ps
    LEFT JOIN tier_breakdown tb ON tb.set_id = ps.set_id
    ORDER BY ps.set_id;
END;
$$ LANGUAGE plpgsql STABLE;
