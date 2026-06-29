// ============================================================================
// BomberMeme CCG v2 — Card Set Definitions
// ============================================================================
// 9 themed sets covering ~100 characters. Each character has 3-5 "Moments"
// (variant poses/expressions). Completion rewards unlock golden card backs,
// exclusive emotes, and prestige titles.
//
// IMPORT PATTERN:  import { SETS, getCharacterSet, getSetCharacters } from "../cards/SetDefinitions.js";
// ============================================================================

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
export type ReleaseType = "classic" | "standard" | "secret";

export interface CardMoment {
  momentId: string;
  name: string;
  description: string;
  releaseType: ReleaseType;
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
  cardIds: string[]; // character IDs in this set
  totalCards: number;
  reward: {
    type: "back_skin" | "emote" | "title";
    name: string;
    description: string;
  };
}

// ----------------------------------------------------------------------------
// Moment helpers — keeps definitions DRY
// ----------------------------------------------------------------------------
const classic = (name: string, desc: string): CardMoment => ({
  momentId: "classic",
  name,
  description: desc,
  releaseType: "classic",
});
const standard = (name: string, desc: string): CardMoment => ({
  momentId: name.toLowerCase().replace(/\s+/g, "_"),
  name,
  description: desc,
  releaseType: "standard",
});
const secret = (name: string, desc: string): CardMoment => ({
  momentId: name.toLowerCase().replace(/\s+/g, "_"),
  name,
  description: desc,
  releaseType: "secret",
});

// ----------------------------------------------------------------------------
// 9 Set Definitions — ~100 characters total
// ----------------------------------------------------------------------------

const GENESIS_CHARACTERS: CardInSet[] = [
  {
    characterId: "pepe",
    characterName: "Pepe",
    tier: "common",
    moments: [
      classic("Sad Frog", "The original sad frog that started it all"),
      standard("Smug Pepe", "That knowing grin when the trade prints"),
      standard("Apu Apustaja", "Childlike innocence in a cruel market"),
      secret("Eternal Pepe", "The frog that outlives every cycle"),
    ],
  },
  {
    characterId: "doge",
    characterName: "Doge",
    tier: "common",
    moments: [
      classic("Original Doge", "The Shiba that became a legend"),
      standard("Doge Bonk", "Wielding the bat of justice"),
      standard("Wise Doge", "Much wisdom, very knowledge"),
      secret("Cosmic Doge", "To the moon and beyond"),
    ],
  },
  {
    characterId: "wojak",
    characterName: "Wojak",
    tier: "common",
    moments: [
      classic("Feels Guy", "The everyman of the internet"),
      standard("Crying Wojak", "When the chart goes red"),
      standard("Soyjack", "The excited newcomer"),
      secret("Eternal Wojak", "He never leaves, he never wins"),
    ],
  },
  {
    characterId: "chad",
    characterName: "Chad",
    tier: "rare",
    moments: [
      classic("Gigachad", "The absolute apex of masculinity"),
      standard("Yes Chad", "Confident agreement personified"),
      standard("ChadStride", "Walking into the casino like he owns it"),
      secret("Titan Chad", "Mythical proportions, mythical gains"),
    ],
  },
  {
    characterId: "trump",
    characterName: "Trump",
    tier: "rare",
    moments: [
      classic("Campaign Trump", "Red cap, pointing, iconic"),
      standard("President Trump", "Oval Office backdrop"),
      standard("Mugshot Trump", "Georgia mugshot pose"),
      secret("Dawn Trump", "The comeback begins"),
    ],
  },
  {
    characterId: "musk",
    characterName: "Musk",
    tier: "rare",
    moments: [
      classic("Twitter Musk", "Chief Twit at the helm"),
      standard("Rocket Man", "Mars-bound and meme-pilled"),
      standard("Dogefather", "The one true Doge CEO"),
      secret("Mars Musk", "First meme lord of the red planet"),
    ],
  },
  {
    characterId: "sbf",
    characterName: "SBF",
    tier: "epic",
    moments: [
      classic("Effective Altruist", "For the greater good, allegedly"),
      standard("Jail SBF", "The fall from grace"),
      standard("Courtroom SBF", "Sorry, I was playing League"),
      secret("Rugpull SBF", "The art of the exit"),
    ],
  },
  {
    characterId: "cz",
    characterName: "CZ",
    tier: "epic",
    moments: [
      classic("Binance CZ", "The crypto emperor"),
      standard("Funds are SAFU", "The words that calmed a market"),
      standard("Bald CZ", "The chrome dome of destiny"),
      secret("Exile CZ", "The man who walked away"),
    ],
  },
  {
    characterId: "satoshi",
    characterName: "Satoshi",
    tier: "legendary",
    moments: [
      classic("Genesis Block", "The creator, unseen"),
      standard("Whitepaper Satoshi", "Nine pages that changed finance"),
      standard("Hal Finney", "Running bitcoin"),
      secret("Ghost of Satoshi", "Still watching, still holding"),
    ],
  },
  {
    characterId: "shiba",
    characterName: "Shiba",
    tier: "common",
    moments: [
      classic("Shiba Inu", "The face of a million memes"),
      standard("Cheems", "Bonk patrol captain"),
      standard("Buff Cheems", "Secretly jacked"),
      secret("Doge Killer", "The quiet contender"),
    ],
  },
];

const CRYPTO_DEGENS_CHARACTERS: CardInSet[] = [
  {
    characterId: "bitcoin_maxi",
    characterName: "Bitcoin Maxi",
    tier: "common",
    moments: [
      classic("Orange Pill", "There is no second best"),
      standard("Laser Eyes", "Bitcoin at $100k — activated"),
      standard("Not Your Keys", "The hardware wallet sermon"),
    ],
  },
  {
    characterId: "eth_whale",
    characterName: "ETH Whale",
    tier: "rare",
    moments: [
      classic("Blue Chip", "Ethereum is ultrasound money"),
      standard("Validator", "32 ETH, infinite patience"),
      standard("DeFi Degen", "Yield farming at 3am"),
      secret("The Merge", "Proof of stake, proof of conviction"),
    ],
  },
  {
    characterId: "liquidated",
    characterName: "Liquidated Trader",
    tier: "common",
    moments: [
      classic("Margin Call", "It was a sure thing"),
      standard("Rekt", "-99.9% portfolio value"),
      standard("McDonald's", "Back to the grill"),
      secret("Phoenix", "Rising from the liquidation ashes"),
    ],
  },
  {
    characterId: "nft_flipper",
    characterName: "NFT Flipper",
    tier: "rare",
    moments: [
      classic("Mint Day", "Gas wars and glory"),
      standard("Paper Hands", "Sold at 0.5, now at 50"),
      standard("Diamond Hands", "Screenshot never sell"),
      secret("Rug Survivor", "Still holding the JPEG"),
    ],
  },
  {
    characterId: "airdrop_hunter",
    characterName: "Airdrop Hunter",
    tier: "common",
    moments: [
      classic("Sybil King", "42 wallets, one farmer"),
      standard("Dust Collector", "Another $3 airdrop"),
      standard("Eligibility Check", "Not available in your region"),
    ],
  },
  {
    characterId: "dao_voter",
    characterName: "DAO Voter",
    tier: "epic",
    moments: [
      classic("Governance", "One token, one vote"),
      standard("Proposal", "Should we buy a golf course?"),
      standard("Quorum", "Never enough voters"),
      secret("The Plot", "Behind-the-scenes governance attack"),
    ],
  },
  {
    characterId: "mEV_bot",
    characterName: "MEV Bot",
    tier: "legendary",
    moments: [
      classic("Front Run", "Your trade, their profit"),
      standard("Sandwich", "Caught in the bread"),
      standard("Arbitrage", "Same coin, different price"),
      secret("The Bundle", "Priority inclusion, maximum extract"),
    ],
  },
  {
    characterId: "staker",
    characterName: "The Staker",
    tier: "common",
    moments: [
      classic("4% APY", "Slow and steady wins the race"),
      standard("Restaking", "Yield on yield on yield"),
      standard("Slashing", "The validator's nightmare"),
    ],
  },
  {
    characterId: "bridger",
    characterName: "Bridger",
    tier: "rare",
    moments: [
      classic("Cross Chain", "From L1 to L2 and back"),
      standard("Bridge Hack", "Funds stuck in transit"),
      standard("Native Bridge", "Slow but SAFU"),
      secret("Wormhole", "Traveling through crypto space"),
    ],
  },
  {
    characterId: "oracle",
    characterName: "The Oracle",
    tier: "epic",
    moments: [
      classic("Price Feed", "The truth, on-chain"),
      standard("Flash Loan", "Borrowed wisdom"),
      standard("Data Provider", "Truth for hire"),
      secret("Omniscient", "Sees all, says little"),
    ],
  },
  {
    characterId: "miner",
    characterName: "Miner",
    tier: "common",
    moments: [
      classic("ASIC Life", "Heat and noise and hash"),
      standard("Solo Mine", "One block, one legend"),
      standard("Pool Share", "Small slice, steady drip"),
    ],
  },
];

const FROG_DYNASTY_CHARACTERS: CardInSet[] = [
  {
    characterId: "pepe_frog",
    characterName: "Pepe",
    tier: "common",
    moments: [
      classic("Feels Bad Man", "The original sad frog"),
      standard("Feels Good Man", "Rare moment of happiness"),
      standard("Angry Pepe", "When the mempool is congested"),
      secret("Rare Pepe", "One of a kind, never duplicated"),
    ],
  },
  {
    characterId: "brett",
    characterName: "Brett",
    tier: "rare",
    moments: [
      classic("Base Brett", "The blue mascot with attitude"),
      standard("Gym Brett", "Swole and ready to pump"),
      standard("Chill Brett", "Just vibing on Base"),
      secret("Legendary Brett", "The face of a movement"),
    ],
  },
  {
    characterId: "rich_pepe",
    characterName: "Rich Pepe",
    tier: "epic",
    moments: [
      classic("WAGMI", "We all made it — especially him"),
      standard("Lambo Pepe", "Green candle, green car"),
      standard("Yacht Club", "Bored on a boat"),
      secret("Whale Pepe", "Market mover in disguise"),
    ],
  },
  {
    characterId: "dank_pepe",
    characterName: "Dank Pepe",
    tier: "common",
    moments: [
      classic("Rare Dank", "The dankest of them all"),
      standard("Stoned Pepe", "Higher than the market cap"),
      standard("Vibing Pepe", "Chill beats, chill gains"),
    ],
  },
  {
    characterId: "apu",
    characterName: "Apu Apustaja",
    tier: "common",
    moments: [
      classic("Helper", "Just trying to help fren"),
      standard("Comfy Apu", "Wrapped in blanket, holding bags"),
      standard("Scared Apu", "Market volatility detected"),
      secret("Eternal Apu", "Always helping, always hoping"),
    ],
  },
  {
    characterId: "peepo",
    characterName: "Peepo",
    tier: "rare",
    moments: [
      classic("Baby Pepe", "Small frog, big dreams"),
      standard("Dancing Peepo", "Celebrating every green candle"),
      standard("Crying Peepo", "Lost his first trade"),
      secret("Golden Peepo", "The chosen amphibian"),
    ],
  },
  {
    characterId: "pepehands",
    characterName: "PepeHands",
    tier: "common",
    moments: [
      classic("Crying Hands", "Visible despair"),
      standard("Praying Pepe", "Please let it pump"),
      standard("Clapping Pepe", "Slow, sarcastic applause"),
    ],
  },
  {
    characterId: "frog_warrior",
    characterName: "Frog Warrior",
    tier: "epic",
    moments: [
      classic("Battle Frog", "Armed and amphibious"),
      standard("Shield Pepe", "Defending the pond"),
      standard("Spear Frog", "First into the fray"),
      secret("Frog King", "Ruler of all ponds"),
    ],
  },
  {
    characterId: "toad",
    characterName: "Toad",
    tier: "common",
    moments: [
      classic("Regular Toad", "Not a frog, don't call him one"),
      standard("Mushroom Toad", "Questionable dietary choices"),
      standard("Wise Toad", "Older than the blockchain"),
    ],
  },
  {
    characterId: "tree_frog",
    characterName: "Tree Frog",
    tier: "rare",
    moments: [
      classic("Climber", "Hodling on for dear life"),
      standard("Color Shift", "Adapts to any market"),
      standard("Sticky Hands", "Never letting go"),
      secret("Rainforest King", "Lord of the canopy"),
    ],
  },
];

const MEME_PANTHEON_CHARACTERS: CardInSet[] = [
  {
    characterId: "doge_pantheon",
    characterName: "Doge",
    tier: "rare",
    moments: [
      classic("Such Wow", "Amaze, much legend"),
      standard("Doge of Wisdom", "Ancient meme knowledge"),
      standard("Nyan Doge", "Rainbow trail pioneer"),
      secret("Celestial Doge", "Ascended to meme heaven"),
    ],
  },
  {
    characterId: "cheems",
    characterName: "Cheems",
    tier: "common",
    moments: [
      classic("Bonk", "Go to horny jail"),
      standard("Buff Cheems", "Secretly ripped"),
      standard("Detective Cheems", "Investigating rugs"),
      secret("God of Bonk", "Supreme arbiter of justice"),
    ],
  },
  {
    characterId: "walter",
    characterName: "Walter",
    tier: "common",
    moments: [
      classic("I Like Fire Trucks", "Moster trucks too"),
      standard("Walter White", "The one who knocks"),
      standard("Serious Walter", "No more half measures"),
    ],
  },
  {
    characterId: "nyan",
    characterName: "Nyan Cat",
    tier: "epic",
    moments: [
      classic("Pop Tart", "Flying through space"),
      standard("Rainbow Trail", "Leaving colors behind"),
      standard("Pixel Nyan", "8-bit retro version"),
      secret("Cosmic Nyan", "Interdimensional traveler"),
    ],
  },
  {
    characterId: "grumpy",
    characterName: "Grumpy Cat",
    tier: "rare",
    moments: [
      classic("No", "The only answer"),
      standard("I Had Fun Once", "It was awful"),
      standard("Grumpy Billionaire", "Still not impressed"),
      secret("Eternal Grump", "The grump lives on"),
    ],
  },
  {
    characterId: "harambe",
    characterName: "Harambe",
    tier: "legendary",
    moments: [
      classic("Dicks Out", "Never forget"),
      standard("Zookeeper", "Guardian of the zoo"),
      standard("Ghost Harambe", "Watching from above"),
      secret("Saint Harambe", "Patron saint of memes"),
    ],
  },
  {
    characterId: "shrek",
    characterName: "Shrek",
    tier: "epic",
    moments: [
      classic("Ogre Mode", "What are you doing in my swamp"),
      standard("Onions", "Layers upon layers"),
      standard("Far Far Away", "The journey to the moon"),
      secret("All Star", "Somebody once told me..."),
    ],
  },
  {
    characterId: "trollface",
    characterName: "Trollface",
    tier: "common",
    moments: [
      classic("Problem?", "The original troublemaker"),
      standard("Troll Physics", "Defying logic daily"),
      standard("U Mad?", "Provocation level 9000"),
    ],
  },
  {
    characterId: "mlg",
    characterName: "MLG",
    tier: "rare",
    moments: [
      classic("Mountain Dew", "Fuel for gamers"),
      standard("Snoop Dogg", "Smoke weed everyday"),
      standard("Airhorn", "The sound of victory"),
      secret("360 No Scope", "Maximum MLG achievement"),
    ],
  },
  {
    characterId: "rickroll",
    characterName: "Rick Astley",
    tier: "epic",
    moments: [
      classic("Never Gonna", "Give you up"),
      standard("Let You Down", "The promise kept"),
      standard("Desert You", "Never, ever"),
      secret("Rickroll God", "Master of the bait and switch"),
    ],
  },
];

const ELECTION_CHAOS_CHARACTERS: CardInSet[] = [
  {
    characterId: "biden",
    characterName: "Biden",
    tier: "rare",
    moments: [
      classic("Dark Brandon", "The alter ego emerges"),
      standard("Ice Cream", "Presidential treat"),
      standard("Blunder", "Speaking off the cuff"),
      secret("Time Traveler", "Been here before"),
    ],
  },
  {
    characterId: "obama",
    characterName: "Obama",
    tier: "epic",
    moments: [
      classic("Hope Poster", "The original meme president"),
      standard("Mic Drop", "Out with a bang"),
      standard("Thanks Obama", "Blame accepted"),
      secret("44th", "The forever president of memes"),
    ],
  },
  {
    characterId: "hillary",
    characterName: "Hillary",
    tier: "common",
    moments: [
      classic("Delete Emails", "With a cloth?"),
      standard("Pokemon Go", "To the polls"),
      standard("Chillin in Cedar Rapids", "Just chillin"),
    ],
  },
  {
    characterId: "bernie",
    characterName: "Bernie",
    tier: "rare",
    moments: [
      classic("Mittens", "The inauguration sit"),
      standard("I Am Once Again", "Asking for your support"),
      standard("Socialist", "Feel the Bern"),
      secret("Eternal Bernie", "Still asking in 3024"),
    ],
  },
  {
    characterId: "elon_political",
    characterName: "Political Elon",
    tier: "epic",
    moments: [
      classic("Free Speech", "The X factor"),
      standard("Mars Candidate", "First president of Mars"),
      standard("Meme Lord", "The ultimate shitposter"),
      secret("Iron Man", "The real life Tony Stark"),
    ],
  },
  {
    characterId: "zelensky",
    characterName: "Zelensky",
    tier: "legendary",
    moments: [
      classic("Comedian", "From stage to battlefield"),
      standard("Olive Green", "The uniform of defiance"),
      standard("Phone Call", "I need ammo, not a ride"),
      secret("Warrior President", "Leading from the front"),
    ],
  },
  {
    characterId: "putin",
    characterName: "Putin",
    tier: "epic",
    moments: [
      classic("Shirtless", "Riding bears bare-chested"),
      standard("Table Sitting", "Longest table in the world"),
      standard("KGB Eyes", "Cold stare, colder soul"),
      secret("Tsar Putin", "The eternal ruler"),
    ],
  },
  {
    characterId: "kim_jong",
    characterName: "Kim Jong Un",
    tier: "rare",
    moments: [
      classic("Supreme Leader", "Looking at things"),
      standard("Rocket Man", "Launching, always launching"),
      standard("Haircut", "The one true style"),
      secret("Intercontinental", "Reaching new distances"),
    ],
  },
  {
    characterId: "macron",
    characterName: "Macron",
    tier: "common",
    moments: [
      classic("Le President", "Vive la France"),
      standard("Yellow Vests", "Facing the backlash"),
      standard("EU Leader", "The diplomat"),
    ],
  },
];

const PUMP_CIRCUIT_CHARACTERS: CardInSet[] = [
  {
    characterId: "wojak_trader",
    characterName: "Wojak Trader",
    tier: "common",
    moments: [
      classic("Pink Wojak", "The universal sign of loss"),
      standard("Bloomer Wojak", "It'll get better"),
      standard("Doomer Wojak", "It's all downhill"),
      secret("30k Wojak", "The breakout never comes"),
    ],
  },
  {
    characterId: "bogdanoff",
    characterName: "Bogdanoff",
    tier: "legendary",
    moments: [
      classic("He Bought?", "Pamp it"),
      standard("He Sold?", "Dump it"),
      standard("The Call", "Phone rings, market moves"),
      secret("Bog Gods", "Architects of price action"),
    ],
  },
  {
    characterId: "stonks",
    characterName: "Stonks Guy",
    tier: "rare",
    moments: [
      classic("Meme Man", "When the chart only goes up"),
      standard("Not Stonks", "The reverse card"),
      standard("Helth", "Numbers go up"),
      secret("Infinite Stonks", "The eternal bull"),
    ],
  },
  {
    characterId: "monke",
    characterName: "Monke",
    tier: "common",
    moments: [
      classic("Reject Humanity", "Return to monke"),
      standard("Banana", "The only currency that matters"),
      standard("Ooh Ooh", "Aah Aah"),
    ],
  },
  {
    characterId: "pablo",
    characterName: "Pablo Escobar",
    tier: "epic",
    moments: [
      classic("Narcos", "Plata o plomo"),
      standard("Sad Pablo", "Waiting for the pump"),
      standard("Kingpin", "Ruling the cartel"),
      secret("Ghost Pablo", "Still laundering"),
    ],
  },
  {
    characterId: "printer",
    characterName: "Money Printer",
    tier: "rare",
    moments: [
      classic("BRRR", "The sound of inflation"),
      standard("Infinite Cash", "Numbers go brrrr"),
      standard("Fed Chair", "The money magician"),
      secret("Hyperinflation", "Wheelbarrows of cash"),
    ],
  },
  {
    characterId: "bear",
    characterName: "Bear",
    tier: "common",
    moments: [
      classic("Bear Market", "Winter is coming"),
      standard("Hibernation", "Wake me at ATH"),
      standard("Bear Trap", "Fakeout move"),
    ],
  },
  {
    characterId: "bull",
    characterName: "Bull",
    tier: "common",
    moments: [
      classic("Bull Run", "Charge!"),
      standard("Bull Trap", "The fake pump"),
      standard("Raging Bull", "Unstoppable force"),
    ],
  },
  {
    characterId: "whale",
    characterName: "Whale",
    tier: "epic",
    moments: [
      classic("Market Move", "One trade, total chaos"),
      standard("Wallet Watch", "All eyes on the whale"),
      standard("Deep Sea", "Holding since 2011"),
      secret("Leviathan", "The market maker"),
    ],
  },
];

const ANIMAL_KINGDOM_CHARACTERS: CardInSet[] = [
  {
    characterId: "cat",
    characterName: "Cat",
    tier: "common",
    moments: [
      classic("Keyboard Cat", "Play him off"),
      standard("Grumpy Cat", "Still not happy"),
      standard("Nyan Cat", "Pop tart powered"),
      secret("Schrodinger's Cat", "Both alive and dead"),
    ],
  },
  {
    characterId: "owl",
    characterName: "Owl",
    tier: "rare",
    moments: [
      classic("Owo", "What's this?"),
      standard("Wise Owl", "200 IQ plays only"),
      standard("Night Owl", "Trading at 3am"),
      secret("Ancient Owl", "Wiser than the blockchain"),
    ],
  },
  {
    characterId: "penguin",
    characterName: "Penguin",
    tier: "common",
    moments: [
      classic("Socially Awkward", "Can I friend you?"),
      standard("Linux Penguin", "Open source gang"),
      standard("Sliding Penguin", "Wheeee"),
    ],
  },
  {
    characterId: "tiger",
    characterName: "Tiger King",
    tier: "rare",
    moments: [
      classic("Joe Exotic", "The mullet monarch"),
      standard("Carole Baskin", "Hey all you cool cats"),
      standard("Tiger", "Striped and dangerous"),
      secret("Zookeeper", "King of the cages"),
    ],
  },
  {
    characterId: "bee",
    characterName: "Bee",
    tier: "common",
    moments: [
      classic("Bee Movie", "Ya like jazz?"),
      standard("Hive Mind", "Collective intelligence"),
      standard("Buzz", "The sound of DeFi"),
    ],
  },
  {
    characterId: "gorilla",
    characterName: "Gorilla",
    tier: "epic",
    moments: [
      classic("Harambe", "Dicks out forever"),
      standard("Silverback", "The alpha ape"),
      standard("King Kong", "Climbing the charts"),
      secret("Ape Together", "Strong as one"),
    ],
  },
  {
    characterId: "crab",
    characterName: "Crab",
    tier: "common",
    moments: [
      classic("Sideways", "The eternal crab market"),
      standard("Pinch", "Catching falling knives"),
      standard("Shell", "Safe from all FUD"),
    ],
  },
  {
    characterId: "wolf",
    characterName: "Wolf",
    tier: "rare",
    moments: [
      classic("Lone Wolf", "Solo trader"),
      standard("Wolf Pack", "The collective hunt"),
      standard("Wolf of Wall St", "Sell me this pen"),
      secret("Alpha Wolf", "Leader of the pack"),
    ],
  },
  {
    characterId: "llama",
    characterName: "Llama",
    tier: "epic",
    moments: [
      classic("DeFi Llama", "TVL tracker extraordinaire"),
      standard("Alpaca", "Yield farming wool"),
      standard("Spit", "The ultimate diss"),
      secret("Lama Drama", "The soap opera of DeFi"),
    ],
  },
];

const CRYPTO_TWITTER_CHARACTERS: CardInSet[] = [
  {
    characterId: "ansem",
    characterName: "Ansem",
    tier: "rare",
    moments: [
      classic("CT Caller", "The alpha dispenser"),
      standard("Chart Wizard", "Lines only go up"),
      standard("Threadooor", "10-tweet deep dives"),
      secret("The Signal", "First to know, first to tell"),
    ],
  },
  {
    characterId: "zhu_su",
    characterName: "Zhu Su",
    tier: "epic",
    moments: [
      classic("Supercycle", "The thesis that broke"),
      standard("3AC", "From billions to bust"),
      standard("Yacht Life", "Before the fall"),
      secret("Comeback Zhu", "The phoenix plan"),
    ],
  },
  {
    characterId: "cobie",
    characterName: "Cobie",
    tier: "legendary",
    moments: [
      classic("UpOnly", "The mindset of winners"),
      standard("CT Legend", "Tweets that move markets"),
      standard("Host", "The voice of crypto"),
      secret("Oracle Cobie", "Predicting the unpredictable"),
    ],
  },
  {
    characterId: "inversebrah",
    characterName: "Inversebrah",
    tier: "rare",
    moments: [
      classic("Inverse Cramer", "Do the opposite"),
      standard("Always Wrong", "Being wrong is an art"),
      standard("Contrarian", "Fighting the trend"),
    ],
  },
  {
    characterId: "fat_tony",
    characterName: "Fat Tony",
    tier: "common",
    moments: [
      classic("Mob Boss", "Fuggedaboutit"),
      standard("Wise Guy", "Street smarts"),
      standard("Capo", "Running the neighborhood"),
    ],
  },
  {
    characterId: "caughtin4k",
    characterName: "Caught in 4K",
    tier: "common",
    moments: [
      classic("Screenshot", "Evidence preserved"),
      standard("Receipts", "The proof is here"),
      standard("Exposed", "Caught red-handed"),
    ],
  },
  {
    characterId: "ser",
    characterName: "Ser",
    tier: "common",
    moments: [
      classic("Gm Ser", "The daily greeting"),
      standard("Wen Moon Ser", "The eternal question"),
      standard("Ty Ser", "Gratitude on-chain"),
    ],
  },
  {
    characterId: "fren",
    characterName: "Fren",
    tier: "common",
    moments: [
      classic("Gm Fren", "Good morning friend"),
      standard("Frenship", "Crypto bonds"),
      standard("No Fren", "The betrayal"),
      secret("Eternal Fren", "Friends forever on-chain"),
    ],
  },
  {
    characterId: "wagmi",
    characterName: "WAGMI",
    tier: "rare",
    moments: [
      classic("WAGMI", "We're all gonna make it"),
      standard("NGMI", "Not gonna make it"),
      standard("GMI", "Gonna make it"),
      secret("WAGMI Together", "Unity through memes"),
    ],
  },
];

const SEASONAL_DROP_CHARACTERS: CardInSet[] = [
  {
    characterId: "santa",
    characterName: "Santa",
    tier: "rare",
    moments: [
      classic("Christmas Santa", "Ho ho hodl"),
      standard("Crypto Santa", "Bringing sats, not coal"),
      standard("Bull Market Santa", "Green candles for everyone"),
      secret("Satoshi Claus", "The real gift giver"),
    ],
  },
  {
    characterId: "pumpkin",
    characterName: "Pumpkin",
    tier: "common",
    moments: [
      classic("Halloween", "Spooky season"),
      standard("Jack O Lantern", "Carved with care"),
      standard("Scarecrow", "Guarding the gains"),
    ],
  },
  {
    characterId: "bunny",
    characterName: "Easter Bunny",
    tier: "common",
    moments: [
      classic("Easter", "Egg hunts and gains"),
      standard("Chocolate", "Sweet rewards"),
      standard("Spring", "New beginnings"),
    ],
  },
  {
    characterId: "firework",
    characterName: "Firework",
    tier: "epic",
    moments: [
      classic("New Year", "New year, new ATH"),
      standard("Explosion", "Portfolio goes boom"),
      standard("Celebration", "Victory lap"),
      secret("Eternal Firework", "The pump never ends"),
    ],
  },
  {
    characterId: "cupid",
    characterName: "Cupid",
    tier: "rare",
    moments: [
      classic("Valentine", "Love is in the chain"),
      standard("Arrow", "Shot through the heart"),
      standard("Match Maker", "Pairing tokens"),
      secret("DeFi Cupid", "Liquidity pools of love"),
    ],
  },
  {
    characterId: "leprechaun",
    characterName: "Leprechaun",
    tier: "epic",
    moments: [
      classic("St Patrick", "Luck of the Irish"),
      standard("Pot of Gold", "At the end of the rainbow"),
      standard("Rainbow", "Seven colors of profit"),
      secret("Lucky Charm", "Always green"),
    ],
  },
  {
    characterId: "turkey",
    characterName: "Turkey",
    tier: "common",
    moments: [
      classic("Thanksgiving", "Grateful for gains"),
      standard("Feast", "Eating well this year"),
      standard("Black Friday", "Buy the dip"),
    ],
  },
  {
    characterId: "skeleton",
    characterName: "Skeleton",
    tier: "rare",
    moments: [
      classic("Spooky", "Doot doot"),
      standard("Mr Bones", "Wild ride forever"),
      standard("Spooky Scary", "Sending shivers down charts"),
      secret("Eternal Skeleton", "The ride never ends"),
    ],
  },
];

// ----------------------------------------------------------------------------
// Character-to-Set lookup map
// ----------------------------------------------------------------------------
const CHARACTER_SET_MAP: Record<string, SetId> = {};

function indexSet(setId: SetId, characters: CardInSet[]): void {
  for (const c of characters) {
    CHARACTER_SET_MAP[c.characterId] = setId;
  }
}

indexSet("genesis", GENESIS_CHARACTERS);
indexSet("crypto_degens", CRYPTO_DEGENS_CHARACTERS);
indexSet("frog_dynasty", FROG_DYNASTY_CHARACTERS);
indexSet("meme_pantheon", MEME_PANTHEON_CHARACTERS);
indexSet("election_chaos", ELECTION_CHAOS_CHARACTERS);
indexSet("pump_circuit", PUMP_CIRCUIT_CHARACTERS);
indexSet("animal_kingdom", ANIMAL_KINGDOM_CHARACTERS);
indexSet("crypto_twitter", CRYPTO_TWITTER_CHARACTERS);
indexSet("seasonal_drop", SEASONAL_DROP_CHARACTERS);

// ----------------------------------------------------------------------------
// SETS Record — master collection
// ----------------------------------------------------------------------------
export const SETS: Record<SetId, CardSet> = {
  genesis: {
    id: "genesis",
    name: "Genesis Archive",
    description:
      "The foundational memes that built the internet. Pepe, Doge, Wojak, Chad — the classics that started it all and never faded.",
    cardIds: GENESIS_CHARACTERS.map((c) => c.characterId),
    totalCards: GENESIS_CHARACTERS.length,
    reward: {
      type: "back_skin",
      name: "Golden Genesis Back",
      description: "A gleaming gold card back reserved for true meme historians.",
    },
  },
  crypto_degens: {
    id: "crypto_degens",
    name: "Crypto Degenerates",
    description:
      "The wild world of crypto traders — from diamond-handed whales to liquidated degens. Every phase of the market cycle, immortalized.",
    cardIds: CRYPTO_DEGENS_CHARACTERS.map((c) => c.characterId),
    totalCards: CRYPTO_DEGENS_CHARACTERS.length,
    reward: {
      type: "emote",
      name: "BRRR Printer",
      description: "Money printer go brrrr — exclusive emote for set completion.",
    },
  },
  frog_dynasty: {
    id: "frog_dynasty",
    name: "Frog Dynasty",
    description:
      "All hail the amphibian empire. Pepe, Brett, Apu, and the full pond of frog royalty. The most extensive frog collection in existence.",
    cardIds: FROG_DYNASTY_CHARACTERS.map((c) => c.characterId),
    totalCards: FROG_DYNASTY_CHARACTERS.length,
    reward: {
      type: "back_skin",
      name: "Golden Frog Back",
      description: "An ornate lily pad design in 24-karat gold leaf.",
    },
  },
  meme_pantheon: {
    id: "meme_pantheon",
    name: "Meme Pantheon",
    description:
      "The gods of meme culture elevated to divine status. Nyan Cat, Grumpy Cat, Harambe — legends that transcended their origins.",
    cardIds: MEME_PANTHEON_CHARACTERS.map((c) => c.characterId),
    totalCards: MEME_PANTHEON_CHARACTERS.length,
    reward: {
      type: "title",
      name: "Meme God",
      description: "Prestigious title awarded to collectors of the Meme Pantheon.",
    },
  },
  election_chaos: {
    id: "election_chaos",
    name: "Election Chaos",
    description:
      "Political theater at its finest. From campaign trails to world stages, the characters that shaped the political meme landscape.",
    cardIds: ELECTION_CHAOS_CHARACTERS.map((c) => c.characterId),
    totalCards: ELECTION_CHAOS_CHARACTERS.length,
    reward: {
      type: "emote",
      name: "Dew It",
      description: "Political power move — exclusive emote.",
    },
  },
  pump_circuit: {
    id: "pump_circuit",
    name: "Pump Circuit",
    description:
      "The trading floor in all its glory. Bulls, bears, whales, and the Bogdanoff twins who control it all. Welcome to the casino.",
    cardIds: PUMP_CIRCUIT_CHARACTERS.map((c) => c.characterId),
    totalCards: PUMP_CIRCUIT_CHARACTERS.length,
    reward: {
      type: "back_skin",
      name: "Circuit Board Back",
      description: "Glowing neon circuit lines — the trader's ultimate card back.",
    },
  },
  animal_kingdom: {
    id: "animal_kingdom",
    name: "Animal Kingdom",
    description:
      "The internet's favorite animals, from keyboard cats to gorillas. Every creature that earned meme immortality.",
    cardIds: ANIMAL_KINGDOM_CHARACTERS.map((c) => c.characterId),
    totalCards: ANIMAL_KINGDOM_CHARACTERS.length,
    reward: {
      type: "title",
      name: "King of the Jungle",
      description: "Title earned by mastering the Animal Kingdom set.",
    },
  },
  crypto_twitter: {
    id: "crypto_twitter",
    name: "Crypto Twitter",
    description:
      "The voices that moved markets. From alpha callers to threadooors, the personalities that made CT the wildest place on the internet.",
    cardIds: CRYPTO_TWITTER_CHARACTERS.map((c) => c.characterId),
    totalCards: CRYPTO_TWITTER_CHARACTERS.length,
    reward: {
      type: "emote",
      name: "Gm Gm",
      description: "The legendary daily greeting — exclusive emote.",
    },
  },
  seasonal_drop: {
    id: "seasonal_drop",
    name: "Seasonal Drop",
    description:
      "Limited-time characters for holidays and special events. Collect them before they disappear — seasonal cards rotate throughout the year.",
    cardIds: SEASONAL_DROP_CHARACTERS.map((c) => c.characterId),
    totalCards: SEASONAL_DROP_CHARACTERS.length,
    reward: {
      type: "back_skin",
      name: "Seasonal Wreath Back",
      description: "A rotating seasonal card back that changes with real-world holidays.",
    },
  },
};

// All characters in one flat array for easy iteration
export const ALL_CHARACTERS: CardInSet[] = [
  ...GENESIS_CHARACTERS,
  ...CRYPTO_DEGENS_CHARACTERS,
  ...FROG_DYNASTY_CHARACTERS,
  ...MEME_PANTHEON_CHARACTERS,
  ...ELECTION_CHAOS_CHARACTERS,
  ...PUMP_CIRCUIT_CHARACTERS,
  ...ANIMAL_KINGDOM_CHARACTERS,
  ...CRYPTO_TWITTER_CHARACTERS,
  ...SEASONAL_DROP_CHARACTERS,
];

// Total card count across all sets
export const TOTAL_CARDS = ALL_CHARACTERS.length;

// ----------------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------------

/** Which set a character belongs to. Returns null if unknown. */
export function getCharacterSet(characterId: string): SetId | null {
  return CHARACTER_SET_MAP[characterId] ?? null;
}

/** Get all character definitions in a set, with their moment data. */
export function getSetCharacters(setId: SetId): CardInSet[] {
  const set = SETS[setId];
  if (!set) return [];
  return set.cardIds
    .map((id) => ALL_CHARACTERS.find((c) => c.characterId === id))
    .filter(Boolean) as CardInSet[];
}

/** Get all moments for a specific character. */
export function getCharacterMoments(characterId: string): CardMoment[] {
  const char = ALL_CHARACTERS.find((c) => c.characterId === characterId);
  return char?.moments ?? [];
}

/** Get a character definition by ID. */
export function getCharacter(characterId: string): CardInSet | undefined {
  return ALL_CHARACTERS.find((c) => c.characterId === characterId);
}

/** Tier rank for sorting: 0=common, 4=mythic. */
export function tierRank(tier: Tier): number {
  const ranks: Record<Tier, number> = {
    common: 0,
    rare: 1,
    epic: 2,
    legendary: 3,
    mythic: 4,
  };
  return ranks[tier] ?? 0;
}

/** Tier color mapping — matches existing rarity system. */
export function tierColor(tier: Tier): string {
  const colors: Record<Tier, string> = {
    common: "#9aa3b2",
    rare: "#4aa3ff",
    epic: "#c879ff",
    legendary: "#ffcc33",
    mythic: "#ff5a5a",
  };
  return colors[tier] ?? "#9aa3b2";
}

/** Format: "BM-S01-XXXX / YYYY" — placeholder for serial display. */
export function formatSerial(cardNumber: number, total: number): string {
  const pad = (n: number, len: number) => String(n).padStart(len, "0");
  return `BM-S01-${pad(cardNumber, 4)} / ${pad(total, 4)}`;
}
