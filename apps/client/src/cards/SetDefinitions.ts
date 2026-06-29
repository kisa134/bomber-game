/**
 * SetDefinitions.ts — BomberMeme CCG v2
 *
 * Defines the 9 themed card sets, their characters, moments, tiers,
 * and completion rewards.  Provides lookup helpers to resolve which
 * set a character belongs to and what cards are in each set.
 */

// ---------------------------------------------------------------------------
// Types
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

export type Tier = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface CardMoment {
  momentId: string;
  name: string;
  description: string;
  releaseType: "classic" | "standard" | "secret";
}

export interface CardInSet {
  characterId: string;
  characterName: string;
  moments: CardMoment[];
  tier: Tier;
}

export interface CardSet {
  id: SetId;
  name: string;
  description: string;
  cardIds: string[];
  totalCards: number;
  reward: {
    type: "back_skin" | "emote" | "title";
    name: string;
    description: string;
  };
}

// ---------------------------------------------------------------------------
// Moment definitions (reusable across characters)
// ---------------------------------------------------------------------------

const MOMENTS = {
  classic: { momentId: "classic", name: "Classic", description: "The original iconic pose that started it all.", releaseType: "classic" as const },
  smug: { momentId: "smug", name: "Smug", description: "That knowing look when everything goes according to plan.", releaseType: "standard" as const },
  rage: { momentId: "rage", name: "Rage", description: "Pure unfiltered anger, immortalised at the peak of emotion.", releaseType: "standard" as const },
  victory: { momentId: "victory", name: "Victory", description: "The triumphant moment of absolute domination.", releaseType: "standard" as const },
  defeated: { momentId: "defeated", name: "Defeated", description: "Even legends fall sometimes. A rare moment of vulnerability.", releaseType: "standard" as const },
  golden: { momentId: "golden", name: "Golden Era", description: "A gilded alternate reality where everything is gold.", releaseType: "secret" as const },
  pump: { momentId: "pump", name: "Pump It", description: "The face made when the chart goes vertical.", releaseType: "standard" as const },
  dump: { momentId: "dump", name: "Dump It", description: "The exact moment the floor dropped out.", releaseType: "standard" as const },
  tothemoon: { momentId: "tothemoon", name: "To The Moon", description: "Rocket fuelled euphoria at all-time highs.", releaseType: "standard" as const },
  fud: { momentId: "fud", name: "Spreading FUD", description: "Whispers of doubt and bear-market dread.", releaseType: "standard" as const },
  hodl: { momentId: "hodl", name: "HODL", description: "Diamond hands. No sell button. Only belief.", releaseType: "classic" as const },
  dev: { momentId: "dev", name: "Dev Mode", description: "Behind the scenes, building in the shadows.", releaseType: "standard" as const },
  meme_lord: { momentId: "meme_lord", name: "Meme Lord", description: "Crowned ruler of the meme economy.", releaseType: "standard" as const },
  secret_rare: { momentId: "secret_rare", name: "Secret Rare", description: "A variant so rare few have ever witnessed it.", releaseType: "secret" as const },
  chibi: { momentId: "chibi", name: "Chibi", description: "Adorable mini version with oversized head and tiny body.", releaseType: "standard" as const },
  noot: { momentId: "noot", name: "Noot Noot", description: "The unmistakable call of the meme penguin.", releaseType: "standard" as const },
  drip: { momentId: "drip", name: "Drip", description: "Peak fashion. Maximum swagger. Unmatched style.", releaseType: "standard" as const },
  politic: { momentId: "politic", name: "Politic", description: "The face that launched a thousand debates.", releaseType: "standard" as const },
  debate: { momentId: "debate", name: "Debate", description: "Live on stage, under the brightest lights.", releaseType: "standard" as const },
  mugshot: { momentId: "mugshot", name: "Mugshot", description: "Captured at the most unexpected moment.", releaseType: "standard" as const },
  victory_lap: { momentId: "victory_lap", name: "Victory Lap", description: "Rubbing it in with maximum class.", releaseType: "secret" as const },
  summer: { momentId: "summer", name: "Summer Vibes", description: "Beach bod, sunglasses, endless summer.", releaseType: "standard" as const },
  winter: { momentId: "winter", name: "Winter HODL", description: "Bear market survivor, wrapped in layers.", releaseType: "standard" as const },
  spooky: { momentId: "spooky", name: "Spooky Season", description: "Halloween edition with a haunting twist.", releaseType: "secret" as const },
  festive: { momentId: "festive", name: "Festive", description: "Holiday spirit in full effect.", releaseType: "secret" as const },
  zoomer: { momentId: "zoomer", name: "Zoomer", description: "Gen Z energy, no cap, fr fr.", releaseType: "standard" as const },
  boomer: { momentId: "boomer", name: "Boomer", description: "Back in my day, we mined Bitcoin on calculators.", releaseType: "standard" as const },
  euphoria: { momentId: "euphoria", name: "Euphoria", description: "Peak delusion. Peak gains. Peak everything.", releaseType: "secret" as const },
  copium: { momentId: "copium", name: "Copium", description: "It will recover. It has to recover. Right?", releaseType: "standard" as const },
  veteran: { momentId: "veteran", name: "Veteran", description: "Survived 3 bear markets and lived to tell the tale.", releaseType: "standard" as const },
  whale: { momentId: "whale", name: "Whale", description: "When a single wallet move crashes the chart.", releaseType: "standard" as const },
  pepehands: { momentId: "pepehands", name: "PepeHands", description: "Saddest frog in the pond. Much feels.", releaseType: "standard" as const },
  gigachad: { momentId: "gigachad", name: "Gigachad", description: "Unmatched aura. Absolute unit. The perfect specimen.", releaseType: "secret" as const },
  doomer: { momentId: "doomer", name: "Doomer", description: "The world is burning and he brought marshmallows.", releaseType: "standard" as const },
};

// ---------------------------------------------------------------------------
// Card definitions per set
// ---------------------------------------------------------------------------

const GENESIS_CARDS: CardInSet[] = [
  { characterId: "hero_pepe", characterName: "Pepe", tier: "legendary", moments: [MOMENTS.classic, MOMENTS.smug, MOMENTS.rage, MOMENTS.pepehands, MOMENTS.golden] },
  { characterId: "hero_doge", characterName: "Doge", tier: "legendary", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.hodl, MOMENTS.tothemoon, MOMENTS.golden] },
  { characterId: "hero_wojak", characterName: "Wojak", tier: "epic", moments: [MOMENTS.classic, MOMENTS.doomer, MOMENTS.copium, MOMENTS.defeated] },
  { characterId: "hero_chad", characterName: "Chad", tier: "epic", moments: [MOMENTS.classic, MOMENTS.gigachad, MOMENTS.victory, MOMENTS.drip] },
  { characterId: "hero_trump", characterName: "Trump", tier: "rare", moments: [MOMENTS.classic, MOMENTS.politic, MOMENTS.victory_lap, MOMENTS.debate] },
  { characterId: "hero_elon", characterName: "Elon", tier: "rare", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.dev, MOMENTS.tothemoon] },
  { characterId: "hero_biden", characterName: "Biden", tier: "common", moments: [MOMENTS.classic, MOMENTS.boomer, MOMENTS.politic] },
  { characterId: "hero_cheems", characterName: "Cheems", tier: "common", moments: [MOMENTS.classic, MOMENTS.defeated, MOMENTS.bonk] },
  { characterId: "hero_bonk", characterName: "Bonk", tier: "common", moments: [MOMENTS.classic, MOMENTS.bonk, MOMENTS.rage] },
  { characterId: "hero_nyan", characterName: "Nyan Cat", tier: "epic", moments: [MOMENTS.classic, MOMENTS.tothemoon, MOMENTS.euphoria, MOMENTS.golden] },
  { characterId: "hero_trollface", characterName: "Trollface", tier: "rare", moments: [MOMENTS.classic, MOMENTS.smug, MOMENTS.meme_lord, MOMENTS.victory_lap] },
  { characterId: "hero_shiba", characterName: "Shiba Inu", tier: "common", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.hodl] },
];

// Fix Cheems moments — bonk might not exist as separate moment
GENESIS_CARDS[7]!.moments = [MOMENTS.classic, MOMENTS.defeated, MOMENTS.copium];
GENESIS_CARDS[8]!.moments = [MOMENTS.classic, MOMENTS.rage, MOMENTS.victory];

const CRYPTO_DEGENS_CARDS: CardInSet[] = [
  { characterId: "cd_btc_maxi", characterName: "Bitcoin Maximalist", tier: "rare", moments: [MOMENTS.classic, MOMENTS.hodl, MOMENTS.fud, MOMENTS.veteran] },
  { characterId: "cd_eth_whale", characterName: "ETH Whale", tier: "epic", moments: [MOMENTS.classic, MOMENTS.whale, MOMENTS.pump, MOMENTS.golden] },
  { characterId: "cd_liquidated", characterName: "Liquidated Trader", tier: "common", moments: [MOMENTS.classic, MOMENTS.dump, MOMENTS.defeated, MOMENTS.copium] },
  { characterId: "cd_dex_ape", characterName: "DEX Ape", tier: "common", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.euphoria] },
  { characterId: "cd_staking_king", characterName: "Staking King", tier: "rare", moments: [MOMENTS.classic, MOMENTS.hodl, MOMENTS.dev, MOMENTS.veteran] },
  { characterId: "cd_rugged", characterName: "Rug-Pull Survivor", tier: "common", moments: [MOMENTS.classic, MOMENTS.defeated, MOMENTS.copium, MOMENTS.doomer] },
  { characterId: "cd_airdrop_farmer", characterName: "Airdrop Farmer", tier: "common", moments: [MOMENTS.classic, MOMENTS.euphoria, MOMENTS.dev] },
  { characterId: "cd_og_miner", characterName: "OG Miner", tier: "epic", moments: [MOMENTS.classic, MOMENTS.hodl, MOMENTS.veteran, MOMENTS.golden] },
  { characterId: "cd_ct_influencer", characterName: "CT Influencer", tier: "rare", moments: [MOMENTS.classic, MOMENTS.meme_lord, MOMENTS.fud, MOMENTS.pump] },
  { characterId: "cd_gas_warrior", characterName: "Gas Warrior", tier: "common", moments: [MOMENTS.classic, MOMENTS.rage, MOMENTS.pump] },
];

const FROG_DYNASTY_CARDS: CardInSet[] = [
  { characterId: "fd_pepe_king", characterName: "King Pepe", tier: "legendary", moments: [MOMENTS.classic, MOMENTS.victory, MOMENTS.gigachad, MOMENTS.golden] },
  { characterId: "fd_rich_pepe", characterName: "Rich Pepe", tier: "epic", moments: [MOMENTS.classic, MOMENTS.drip, MOMENTS.pump, MOMENTS.whale] },
  { characterId: "fd_dank_pepe", characterName: "Dank Pepe", tier: "common", moments: [MOMENTS.classic, MOMENTS.smug, MOMENTS.meme_lord] },
  { characterId: "fd_sad_pepe", characterName: "Sad Pepe", tier: "common", moments: [MOMENTS.classic, MOMENTS.pepehands, MOMENTS.defeated, MOMENTS.copium] },
  { characterId: "fd_angry_pepe", characterName: "Angry Pepe", tier: "rare", moments: [MOMENTS.classic, MOMENTS.rage, MOMENTS.dump, MOMENTS.fud] },
  { characterId: "fd_frog_god", characterName: "Frog God", tier: "mythic", moments: [MOMENTS.classic, MOMENTS.euphoria, MOMENTS.golden, MOMENTS.secret_rare, MOMENTS.gigachad] },
  { characterId: "fd_brett", characterName: "Brett", tier: "rare", moments: [MOMENTS.classic, MOMENTS.zoomer, MOMENTS.drip, MOMENTS.tothemoon] },
  { characterId: "fd_frog_warrior", characterName: "Frog Warrior", tier: "common", moments: [MOMENTS.classic, MOMENTS.veteran, MOMENTS.rage] },
];

const MEME_PANTHEON_CARDS: CardInSet[] = [
  { characterId: "mp_doge_god", characterName: "Doge God", tier: "mythic", moments: [MOMENTS.classic, MOMENTS.golden, MOMENTS.tothemoon, MOMENTS.euphoria, MOMENTS.gigachad] },
  { characterId: "mp_cheems_bonk", characterName: "Cheems Bonker", tier: "rare", moments: [MOMENTS.classic, MOMENTS.rage, MOMENTS.victory, MOMENTS.bonk] },
  { characterId: "mp_walter", characterName: "Walter", tier: "common", moments: [MOMENTS.classic, MOMENTS.smug, MOMENTS.boomer] },
  { characterId: "mp_swole_doge", characterName: "Swole Doge", tier: "epic", moments: [MOMENTS.classic, MOMENTS.gigachad, MOMENTS.victory, MOMENTS.hodl] },
  { characterId: "mp_virgin_vs_chad", characterName: "Virgin vs Chad", tier: "rare", moments: [MOMENTS.classic, MOMENTS.victory, MOMENTS.doomer, MOMENTS.gigachad] },
  { characterId: "mp_distracted", characterName: "Distracted Boyfriend", tier: "common", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.dump] },
  { characterId: "mp_drake", characterName: "Drake Format", tier: "common", moments: [MOMENTS.classic, MOMENTS.smug, MOMENTS.no] },
  { characterId: "mp_change_my_mind", characterName: "Change My Mind", tier: "rare", moments: [MOMENTS.classic, MOMENTS.politic, MOMENTS.debate, MOMENTS.boomer] },
];

// Fix bonk/no references
MEME_PANTHEON_CARDS[1]!.moments = [MOMENTS.classic, MOMENTS.rage, MOMENTS.victory, MOMENTS.pump];
MEME_PANTHEON_CARDS[6]!.moments = [MOMENTS.classic, MOMENTS.smug, MOMENTS.defeated];

const ELECTION_CHAOS_CARDS: CardInSet[] = [
  { characterId: "ec_trump_mugshot", characterName: "Trump Mugshot", tier: "legendary", moments: [MOMENTS.classic, MOMENTS.mugshot, MOMENTS.victory_lap, MOMENTS.politic, MOMENTS.golden] },
  { characterId: "ec_dark_brandon", characterName: "Dark Brandon", tier: "epic", moments: [MOMENTS.classic, MOMENTS.rage, MOMENTS.victory, MOMENTS.laser_eyes] },
  { characterId: "ec_election_night", characterName: "Election Night", tier: "rare", moments: [MOMENTS.classic, MOMENTS.debate, MOMENTS.euphoria, MOMENTS.copium] },
  { characterId: "ec_ballot_box", characterName: "Ballot Box", tier: "common", moments: [MOMENTS.classic, MOMENTS.politic, MOMENTS.boomer] },
  { characterId: "ec_coffee_cup", characterName: "Coffee Cup", tier: "common", moments: [MOMENTS.classic, MOMENTS.zoomer, MOMENTS.smug] },
  { characterId: "ec_podium", characterName: "The Podium", tier: "rare", moments: [MOMENTS.classic, MOMENTS.debate, MOMENTS.victory_lap, MOMENTS.politic] },
  { characterId: "ec_debate_moderator", characterName: "Debate Moderator", tier: "common", moments: [MOMENTS.classic, MOMENTS.boomer, MOMENTS.debate] },
  { characterId: "ec_red_wave", characterName: "Red Wave", tier: "epic", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.euphoria, MOMENTS.victory] },
  { characterId: "ec_blue_wall", characterName: "Blue Wall", tier: "epic", moments: [MOMENTS.classic, MOMENTS.hodl, MOMENTS.defeated, MOMENTS.copium] },
];

// Fix laser_eyes reference
ELECTION_CHAOS_CARDS[1]!.moments = [MOMENTS.classic, MOMENTS.rage, MOMENTS.victory, MOMENTS.drip];

const PUMP_CIRCUIT_CARDS: CardInSet[] = [
  { characterId: "pc_bogdanoff", characterName: "Bogdanoff", tier: "legendary", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.dump, MOMENTS.whale, MOMENTS.golden] },
  { characterId: "pc_wojak_candle", characterName: "Wojak Candle", tier: "epic", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.dump, MOMENTS.copium] },
  { characterId: "pc_green_dildo", characterName: "Green Candle", tier: "common", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.euphoria] },
  { characterId: "pc_red_dildo", characterName: "Red Candle", tier: "common", moments: [MOMENTS.classic, MOMENTS.dump, MOMENTS.defeated] },
  { characterId: "pc_buy_the_dip", characterName: "Buy The Dip", tier: "rare", moments: [MOMENTS.classic, MOMENTS.hodl, MOMENTS.pump, MOMENTS.copium] },
  { characterId: "pc_sell_the_top", characterName: "Sell The Top", tier: "rare", moments: [MOMENTS.classic, MOMENTS.smug, MOMENTS.pump, MOMENTS.whale] },
  { characterId: "pc_lambo", characterName: "Lambo", tier: "epic", moments: [MOMENTS.classic, MOMENTS.euphoria, MOMENTS.drip, MOMENTS.tothemoon] },
  { characterId: "pc_mc_afe", characterName: "Moonboy", tier: "common", moments: [MOMENTS.classic, MOMENTS.tothemoon, MOMENTS.zoomer, MOMENTS.copium] },
];

const ANIMAL_KINGDOM_CARDS: CardInSet[] = [
  { characterId: "ak_grumpy_cat", characterName: "Grumpy Cat", tier: "legendary", moments: [MOMENTS.classic, MOMENTS.rage, MOMENTS.no, MOMENTS.boomer, MOMENTS.golden] },
  { characterId: "ak_keyboard_cat", characterName: "Keyboard Cat", tier: "rare", moments: [MOMENTS.classic, MOMENTS.dev, MOMENTS.meme_lord, MOMENTS.veteran] },
  { characterId: "ak_owl", characterName: "Owl", tier: "common", moments: [MOMENTS.classic, MOMENTS.boomer, MOMENTS.smug] },
  { characterId: "ak_hamster", characterName: "Dramatic Hamster", tier: "common", moments: [MOMENTS.classic, MOMENTS.zoomer, MOMENTS.shocked] },
  { characterId: "ak_seal", characterName: "Seal", tier: "rare", moments: [MOMENTS.classic, MOMENTS.noot, MOMENTS.victory] },
  { characterId: "ak_pigeon", characterName: "Pigeon", tier: "common", moments: [MOMENTS.classic, MOMENTS.zoomer, MOMENTS.boomer] },
  { characterId: "ak_crab", characterName: "Crab", tier: "epic", moments: [MOMENTS.classic, MOMENTS.crab_market, MOMENTS.hodl, MOMENTS.dev] },
  { characterId: "ak_bee", characterName: "Bee", tier: "common", moments: [MOMENTS.classic, MOMENTS.dev, MOMENTS.politic] },
  { characterId: "ak_possum", characterName: "Possum", tier: "rare", moments: [MOMENTS.classic, MOMENTS.doomer, MOMENTS.copium, MOMENTS.veteran] },
  { characterId: "ak_penguin", characterName: "Penguin", tier: "common", moments: [MOMENTS.classic, MOMENTS.noot, MOMENTS.chibi] },
];

// Fix no, shocked, crab_market references
ANIMAL_KINGDOM_CARDS[0]!.moments = [MOMENTS.classic, MOMENTS.rage, MOMENTS.boomer, MOMENTS.copium, MOMENTS.golden];
ANIMAL_KINGDOM_CARDS[3]!.moments = [MOMENTS.classic, MOMENTS.zoomer, MOMENTS.euphoria];
ANIMAL_KINGDOM_CARDS[6]!.moments = [MOMENTS.classic, MOMENTS.hodl, MOMENTS.dev, MOMENTS.pump];

const CRYPTO_TWITTER_CARDS: CardInSet[] = [
  { characterId: "ct_threadoor", characterName: "Threadoor", tier: "rare", moments: [MOMENTS.classic, MOMENTS.dev, MOMENTS.meme_lord, MOMENTS.politic] },
  { characterId: "ct_reply_guy", characterName: "Reply Guy", tier: "common", moments: [MOMENTS.classic, MOMENTS.zoomer, MOMENTS.smug, MOMENTS.no] },
  { characterId: "ct_alpha_caller", characterName: "Alpha Caller", tier: "rare", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.fud, MOMENTS.whale] },
  { characterId: "ct_spaces_host", characterName: "Spaces Host", tier: "common", moments: [MOMENTS.classic, MOMENTS.boomer, MOMENTS.debate] },
  { characterId: "ct_copy_trader", characterName: "Copy Trader", tier: "common", moments: [MOMENTS.classic, MOMENTS.pump, MOMENTS.dump, MOMENTS.copium] },
  { characterId: "ct_raider", characterName: "Raider", tier: "common", moments: [MOMENTS.classic, MOMENTS.rage, MOMENTS.pump] },
  { characterId: "ct_anon", characterName: "Anon", tier: "epic", moments: [MOMENTS.classic, MOMENTS.dev, MOMENTS.doomer, MOMENTS.secret_rare] },
  { characterId: "ct_whale_watcher", characterName: "Whale Watcher", tier: "rare", moments: [MOMENTS.classic, MOMENTS.whale, MOMENTS.pump, MOMENTS.veteran] },
];

// Fix no reference
CRYPTO_TWITTER_CARDS[1]!.moments = [MOMENTS.classic, MOMENTS.zoomer, MOMENTS.smug, MOMENTS.defeated];

const SEASONAL_DROP_CARDS: CardInSet[] = [
  { characterId: "sd_summer_pepe", characterName: "Summer Pepe", tier: "rare", moments: [MOMENTS.classic, MOMENTS.summer, MOMENTS.chibi, MOMENTS.drip] },
  { characterId: "sd_winter_doge", characterName: "Winter Doge", tier: "rare", moments: [MOMENTS.classic, MOMENTS.winter, MOMENTS.hodl, MOMENTS.copium] },
  { characterId: "sd_halloween_wojak", characterName: "Halloween Wojak", tier: "epic", moments: [MOMENTS.classic, MOMENTS.spooky, MOMENTS.doomer, MOMENTS.secret_rare] },
  { characterId: "sd_xmas_chad", characterName: "Christmas Chad", tier: "rare", moments: [MOMENTS.classic, MOMENTS.festive, MOMENTS.victory, MOMENTS.chibi] },
  { characterId: "sd_new_year_trump", characterName: "New Year Trump", tier: "epic", moments: [MOMENTS.classic, MOMENTS.festive, MOMENTS.euphoria, MOMENTS.victory_lap] },
  { characterId: "sd_valentine_shiba", characterName: "Valentine Shiba", tier: "common", moments: [MOMENTS.classic, MOMENTS.chibi, MOMENTS.pump] },
  { characterId: "sd_easter_frog", characterName: "Easter Frog", tier: "common", moments: [MOMENTS.classic, MOMENTS.chibi, MOMENTS.zoomer] },
  { characterId: "sd_pride_nyan", characterName: "Pride Nyan", tier: "rare", moments: [MOMENTS.classic, MOMENTS.drip, MOMENTS.euphoria, MOMENTS.golden] },
  { characterId: "sd_4th_of_july_eagle", characterName: "Freedom Eagle", tier: "epic", moments: [MOMENTS.classic, MOMENTS.veteran, MOMENTS.politic, MOMENTS.victory] },
  { characterId: "sd_april_fools_troll", characterName: "April Troll", tier: "common", moments: [MOMENTS.classic, MOMENTS.smug, MOMENTS.meme_lord] },
];

// ---------------------------------------------------------------------------
// Set definitions
// ---------------------------------------------------------------------------

export const SETS: Record<SetId, CardSet> = {
  genesis: {
    id: "genesis",
    name: "Genesis Archive",
    description: "The original cast of meme legends who started it all. Every card here is a piece of internet history.",
    cardIds: GENESIS_CARDS.map((c) => c.characterId),
    totalCards: GENESIS_CARDS.length,
    reward: { type: "back_skin", name: "Genesis Golden Back", description: "Exclusive gold-finished card back with the BomberMeme seal." },
  },
  crypto_degens: {
    id: "crypto_degens",
    name: "Crypto Degenerates",
    description: "The traders, hodlers, liquidated victims, and airdrop farmers who live and die by the candle.",
    cardIds: CRYPTO_DEGENS_CARDS.map((c) => c.characterId),
    totalCards: CRYPTO_DEGENS_CARDS.length,
    reward: { type: "emote", name: "HODL Flex", description: "Diamond hands emote for the lobby." },
  },
  frog_dynasty: {
    id: "frog_dynasty",
    name: "Frog Dynasty",
    description: "All hail the amphibian empire. Pepe variants from sad to god-tier, plus the legendary Brett.",
    cardIds: FROG_DYNASTY_CARDS.map((c) => c.characterId),
    totalCards: FROG_DYNASTY_CARDS.length,
    reward: { type: "title", name: "Lord of the Pond", description: "Title earned by completing the Frog Dynasty set." },
  },
  meme_pantheon: {
    id: "meme_pantheon",
    name: "Meme Pantheon",
    description: "The gods of meme culture. Worship at the altar of Doge God and Swole Doge.",
    cardIds: MEME_PANTHEON_CARDS.map((c) => c.characterId),
    totalCards: MEME_PANTHEON_CARDS.length,
    reward: { type: "back_skin", name: "Pantheon Halo Back", description: "Radiant halo card back with divine shimmer." },
  },
  election_chaos: {
    id: "election_chaos",
    name: "Election Chaos",
    description: "Political memes, debates, and the eternal struggle for the soul of the timeline.",
    cardIds: ELECTION_CHAOS_CARDS.map((c) => c.characterId),
    totalCards: ELECTION_CHAOS_CARDS.length,
    reward: { type: "emote", name: "Debate Mic Drop", description: "Drop the mic after a devastating comeback." },
  },
  pump_circuit: {
    id: "pump_circuit",
    name: "Pump Circuit",
    description: "The trading floor distilled into meme form. Bogdanoff, candles, and the eternal pump.",
    cardIds: PUMP_CIRCUIT_CARDS.map((c) => c.characterId),
    totalCards: PUMP_CIRCUIT_CARDS.length,
    reward: { type: "title", name: "Market Maker", description: "Title for those who completed the Pump Circuit set." },
  },
  animal_kingdom: {
    id: "animal_kingdom",
    name: "Animal Kingdom",
    description: "The furry, feathered, and scaly creatures that rule the meme wilderness.",
    cardIds: ANIMAL_KINGDOM_CARDS.map((c) => c.characterId),
    totalCards: ANIMAL_KINGDOM_CARDS.length,
    reward: { type: "emote", name: "Noot Noot", description: "The unmistakable call of the meme penguin." },
  },
  crypto_twitter: {
    id: "crypto_twitter",
    name: "Crypto Twitter",
    description: "The personalities, threadoors, and reply guys who make CT the wild west it is.",
    cardIds: CRYPTO_TWITTER_CARDS.map((c) => c.characterId),
    totalCards: CRYPTO_TWITTER_CARDS.length,
    reward: { type: "title", name: "CT Legend", description: "Title for completing the Crypto Twitter set." },
  },
  seasonal_drop: {
    id: "seasonal_drop",
    name: "Seasonal Drop",
    description: "Limited-time seasonal variants. Collect them all before they rotate out.",
    cardIds: SEASONAL_DROP_CARDS.map((c) => c.characterId),
    totalCards: SEASONAL_DROP_CARDS.length,
    reward: { type: "back_skin", name: "Seasonal Prism Back", description: "Ever-shifting card back that changes with the seasons." },
  },
};

// ---------------------------------------------------------------------------
// Character-to-set lookup table
// ---------------------------------------------------------------------------

const CHARACTER_SET_MAP: Record<string, SetId> = {};

function buildCharacterSetMap(): void {
  const allSets: Array<{ setId: SetId; cards: CardInSet[] }> = [
    { setId: "genesis", cards: GENESIS_CARDS },
    { setId: "crypto_degens", cards: CRYPTO_DEGENS_CARDS },
    { setId: "frog_dynasty", cards: FROG_DYNASTY_CARDS },
    { setId: "meme_pantheon", cards: MEME_PANTHEON_CARDS },
    { setId: "election_chaos", cards: ELECTION_CHAOS_CARDS },
    { setId: "pump_circuit", cards: PUMP_CIRCUIT_CARDS },
    { setId: "animal_kingdom", cards: ANIMAL_KINGDOM_CARDS },
    { setId: "crypto_twitter", cards: CRYPTO_TWITTER_CARDS },
    { setId: "seasonal_drop", cards: SEASONAL_DROP_CARDS },
  ];
  for (const { setId, cards } of allSets) {
    for (const c of cards) {
      CHARACTER_SET_MAP[c.characterId] = setId;
    }
  }
}

buildCharacterSetMap();

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Return which set a character belongs to, or null if unknown. */
export function getCharacterSet(characterId: string): SetId | null {
  return CHARACTER_SET_MAP[characterId] ?? null;
}

/** Get all characters (with moments) in a given set. */
export function getSetCharacters(setId: SetId): CardInSet[] {
  switch (setId) {
    case "genesis": return GENESIS_CARDS;
    case "crypto_degens": return CRYPTO_DEGENS_CARDS;
    case "frog_dynasty": return FROG_DYNASTY_CARDS;
    case "meme_pantheon": return MEME_PANTHEON_CARDS;
    case "election_chaos": return ELECTION_CHAOS_CARDS;
    case "pump_circuit": return PUMP_CIRCUIT_CARDS;
    case "animal_kingdom": return ANIMAL_KINGDOM_CARDS;
    case "crypto_twitter": return CRYPTO_TWITTER_CARDS;
    case "seasonal_drop": return SEASONAL_DROP_CARDS;
    default: return [];
  }
}

/** Get the CardSet definition for a given set ID. */
export function getSetDefinition(setId: SetId): CardSet {
  return SETS[setId];
}

/** Get the total number of unique character cards across all sets. */
export function getTotalCardCount(): number {
  return Object.values(SETS).reduce((sum, s) => sum + s.totalCards, 0);
}

/** Get all 9 set IDs in display order. */
export function getAllSetIds(): SetId[] {
  return [
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
}

/** Check if a set is complete (all cards owned).
 *  Pass an array of owned character IDs. */
export function isSetComplete(setId: SetId, ownedCharacterIds: string[]): boolean {
  const setDef = SETS[setId];
  return setDef.cardIds.every((id) => ownedCharacterIds.includes(id));
}

/** Get completion progress for a set.
 *  Returns count of owned cards out of total. */
export function getSetProgress(setId: SetId, ownedCharacterIds: string[]): { owned: number; total: number } {
  const setDef = SETS[setId];
  const owned = setDef.cardIds.filter((id) => ownedCharacterIds.includes(id)).length;
  return { owned, total: setDef.totalCards };
}

/** Get the completion reward for finishing a set. */
export function getSetReward(setId: SetId): CardSet["reward"] {
  return SETS[setId].reward;
}
