-- BomberMeme World persistence schema (Issue #6)
-- Auto-created on WorldServer boot. Uses the same DATABASE_URL as store.ts.

CREATE TABLE IF NOT EXISTS world_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    auth_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS world_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES world_players(id) ON DELETE CASCADE,
    hero_id VARCHAR(32) NOT NULL,
    name VARCHAR(32) NOT NULL,
    level INTEGER DEFAULT 1 NOT NULL,
    xp INTEGER DEFAULT 0 NOT NULL,
    attributes JSONB DEFAULT '{"str":5,"dex":5,"int":5,"vit":5,"luck":5}' NOT NULL,
    talents JSONB DEFAULT '[]' NOT NULL,
    inventory JSONB DEFAULT '{"slots":[],"bombs":["basic"],"currency":0}' NOT NULL,
    equipped JSONB DEFAULT '{}' NOT NULL,
    current_world VARCHAR(32) DEFAULT 'grasslands' NOT NULL,
    position_x FLOAT DEFAULT 1280 NOT NULL,
    position_y FLOAT DEFAULT 1280 NOT NULL,
    quests_completed JSONB DEFAULT '[]' NOT NULL,
    zones_discovered JSONB DEFAULT '[]' NOT NULL,
    bosses_killed JSONB DEFAULT '[]' NOT NULL,
    total_kills INTEGER DEFAULT 0 NOT NULL,
    total_deaths INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_characters_player ON world_characters(player_id);

CREATE TABLE IF NOT EXISTS world_chunks (
    world_id VARCHAR(32) NOT NULL,
    chunk_x INTEGER NOT NULL,
    chunk_y INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    last_updated TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (world_id, chunk_x, chunk_y)
);

CREATE TABLE IF NOT EXISTS world_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    leader_id UUID REFERENCES world_characters(id) ON DELETE SET NULL,
    members UUID[] DEFAULT '{}',
    world_id VARCHAR(32) DEFAULT 'grasslands' NOT NULL,
    shared_progress JSONB DEFAULT '{"zonesDiscovered":[],"questsCompleted":[],"bossesKilled":[],"chestsOpened":[],"totalKills":0}' NOT NULL,
    loot_mode VARCHAR(16) DEFAULT 'free' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_parties_code ON world_parties(code);
CREATE INDEX IF NOT EXISTS idx_world_parties_leader ON world_parties(leader_id);
