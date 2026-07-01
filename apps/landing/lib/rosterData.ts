import type { CSSProperties } from "react";

export type CardRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface FighterAsset {
  id: string;
  name: string;
  role: string;
  roleColor: string;
  rankTier: string;
  sprite: string;
  lore: string;
  signature: string;
  specialty: string;
  winRate: number;
  avgMMR: number;
  pickRate: number;
  locked: boolean;
  cardTier: CardRarity;
  serialNumber: string;
  /** Unique card face gradient (broadcast deck). */
  cardBg: string;
  cardMetal: string;
}

function rankToCardTier(rank: string): CardRarity {
  if (rank === "S+" || rank === "S") return "legendary";
  if (rank.startsWith("A")) return "epic";
  if (rank.startsWith("B")) return "rare";
  return "common";
}

const RAW = [
  { id: "pepe", name: "PEPE", role: "TANK", roleColor: "#7fd8ff", rankTier: "S", sprite: "/sprites/pepe/new/skin_1_side_0.webp", lore: "The Frog God of the Blockchain Arena. Unmovable, unbreakable.", signature: "BOMB CLUSTER", specialty: "AOE DENIAL", winRate: 61, avgMMR: 7200, pickRate: 18, locked: false },
  { id: "trump", name: "TRUMP", role: "ASSAULT", roleColor: "#f0a92a", rankTier: "S", sprite: "/sprites/trump/new/skin_2_side_0.webp", lore: "The Alpha Blaster. Maximum aggression.", signature: "DEAL BREAKER", specialty: "BURST DAMAGE", winRate: 68, avgMMR: 7840, pickRate: 14, locked: false },
  { id: "elon", name: "ELON", role: "ASSASSIN", roleColor: "#ff5a4d", rankTier: "S+", sprite: "/sprites/elon/new/skin_3_side_0.webp", lore: "First-Principles Fragging. One-tap guaranteed.", signature: "NEURAL LINK BOMB", specialty: "SINGLE TARGET", winRate: 74, avgMMR: 8420, pickRate: 9, locked: false },
  { id: "vitalik", name: "VITALIK", role: "SUPPORT", roleColor: "#f5c842", rankTier: "A", sprite: "/sprites/vitalik/skin_7_side_0.webp", lore: "Smart Contract Sage. On-chain receipts for every frag.", signature: "L2 SPEEDRUN", specialty: "UTILITY CONTROL", winRate: 55, avgMMR: 6100, pickRate: 22, locked: false },
  { id: "doge", name: "DOGE", role: "BRUISER", roleColor: "#ffd700", rankTier: "A", sprite: "/sprites/doge/skin_4_side_0.webp", lore: "Much boom. Very dead. Such deathmatch.", signature: "MOON BOMB", specialty: "SUSTAINED DAMAGE", winRate: 57, avgMMR: 6500, pickRate: 20, locked: false },
  { id: "shiba", name: "SHIBA", role: "SUPPORT", roleColor: "#f5c842", rankTier: "A", sprite: "/sprites/shiba/new/skin_0_side_0.webp", lore: "Zone control mastery.", signature: "SAMURAI SHIELD", specialty: "ZONE CONTROL", winRate: 59, avgMMR: 6300, pickRate: 17, locked: false },
  { id: "pumpfun", name: "PUMPFUN", role: "RANGED", roleColor: "#ffd700", rankTier: "B+", sprite: "/sprites/pumpfun/skin_5_side_0.webp", lore: "Launches tokens and bombs from maximum distance.", signature: "RUG PULL", specialty: "LONG RANGE", winRate: 53, avgMMR: 5900, pickRate: 11, locked: false },
  { id: "mem", name: "MEM", role: "WILDCARD", roleColor: "#f0a92a", rankTier: "B+", sprite: "/sprites/mem/skin_8_side_0.webp", lore: "Chaos incarnate. The meta-breaker.", signature: "CHAOS THEORY", specialty: "DISRUPTION", winRate: 50, avgMMR: 5600, pickRate: 13, locked: false },
  { id: "chad", name: "CHAD", role: "BRUISER", roleColor: "#ffd700", rankTier: "A+", sprite: "/sprites/skin2/skin_10_side_0.webp", lore: "Gigachad energy. Absolute unit.", signature: "SIGMA STRIKE", specialty: "FRONTLINE BRAWL", winRate: 68, avgMMR: 7800, pickRate: 10, locked: false },
  { id: "bogdanoff", name: "BOGDANOFF", role: "MASTERMIND", roleColor: "#f0a92a", rankTier: "S", sprite: "/sprites/bogdanoff/skin_9_side_0.webp", lore: "Pulls strings from the shadows.", signature: "PUMP & DUMP", specialty: "MARKET CONTROL", winRate: 72, avgMMR: 8100, pickRate: 8, locked: false },
  { id: "nyan", name: "NYAN", role: "SCOUT", roleColor: "#7fd8ff", rankTier: "B", sprite: "/sprites/skin_11_side_0.webp", lore: "Rainbow trail through the arena. Pop-tart speed.", signature: "NYAN DASH", specialty: "MOBILITY", winRate: 48, avgMMR: 5200, pickRate: 15, locked: false },
  { id: "grumpy", name: "GRUMPY", role: "DEFENDER", roleColor: "#9aa3b2", rankTier: "B+", sprite: "/sprites/skin_12_side_0.webp", lore: "Permanently unimpressed. Still wins.", signature: "NOPE BOMB", specialty: "ZONE DENIAL", winRate: 51, avgMMR: 5400, pickRate: 12, locked: false },
  { id: "harambe", name: "HARAMBE", role: "BRUISER", roleColor: "#6b8f71", rankTier: "A", sprite: "/sprites/skin_13_side_0.webp", lore: "Legend never dies. Gentle giant, heavy hits.", signature: "SILVERBACK SLAM", specialty: "FRONTLINE", winRate: 58, avgMMR: 6200, pickRate: 11, locked: false },
  { id: "ogre", name: "OGRE", role: "TANK", roleColor: "#4ade80", rankTier: "S", sprite: "/sprites/skin_14_side_0.webp", lore: "Swamp guardian. Layers of green fury.", signature: "SWAMP STOMP", specialty: "SUSTAINED PRESSURE", winRate: 62, avgMMR: 6800, pickRate: 9, locked: false },
  { id: "distracted", name: "DISTRACTED", role: "TRICKSTER", roleColor: "#f97316", rankTier: "S+", sprite: "/sprites/skin_15_side_0.webp", lore: "Looks away at the worst moment. Somehow clutches.", signature: "SIDE GLANCE", specialty: "MIND GAMES", winRate: 54, avgMMR: 6000, pickRate: 14, locked: false },
  { id: "finedog", name: "FINE DOG", role: "SUPPORT", roleColor: "#ffd84d", rankTier: "S", sprite: "/sprites/skin_16_side_0.webp", lore: "Everything is fine. The room is on fire.", signature: "THIS IS FINE", specialty: "CALM UNDER FIRE", winRate: 52, avgMMR: 5800, pickRate: 10, locked: false },
  { id: "wojak", name: "WOJAK", role: "WILDCARD", roleColor: "#e8dcc8", rankTier: "S+", sprite: "/sprites/skin_17_side_0.webp", lore: "Feels bad. Bombs anyway.", signature: "FEELS BAD BLAST", specialty: "CHAOS ENERGY", winRate: 49, avgMMR: 5500, pickRate: 16, locked: false },
  { id: "npc", name: "NPC", role: "GRINDER", roleColor: "#b0b0b0", rankTier: "B", sprite: "/sprites/skin_18_side_0.webp", lore: "Blank stare. Infinite grind.", signature: "NPC MODE", specialty: "CONSISTENCY", winRate: 47, avgMMR: 5100, pickRate: 13, locked: false },
  { id: "chadlite", name: "CHAD", role: "ASSAULT", roleColor: "#5a9fd4", rankTier: "B+", sprite: "/sprites/skin_19_side_0.webp", lore: "Confident jawline. Not Gigachad — the other one.", signature: "CHAD FLEX", specialty: "AGGRESSION", winRate: 56, avgMMR: 6400, pickRate: 11, locked: false },
  { id: "boomer", name: "BOOMER", role: "VETERAN", roleColor: "#c4a882", rankTier: "A", sprite: "/sprites/skin_20_side_0.webp", lore: "OK Boomer. Still top fragging.", signature: "BACK IN MY DAY", specialty: "EXPERIENCE", winRate: 55, avgMMR: 6000, pickRate: 9, locked: false },
] as const;

const CARD_THEMES: Record<string, { cardBg: string; cardMetal: string }> = {
  pepe:      { cardBg: "radial-gradient(125% 95% at 50% 18%, #1a3a4a 0%, #0a1520 55%, #050810 100%)", cardMetal: "linear-gradient(135deg, rgba(127,216,255,0.35), transparent 55%)" },
  trump:     { cardBg: "radial-gradient(125% 95% at 50% 18%, #3a2810 0%, #1a1008 55%, #080604 100%)", cardMetal: "linear-gradient(135deg, rgba(240,169,42,0.4), transparent 55%)" },
  elon:      { cardBg: "radial-gradient(125% 95% at 50% 18%, #3a1010 0%, #180808 55%, #080404 100%)", cardMetal: "linear-gradient(135deg, rgba(255,90,77,0.38), transparent 55%)" },
  vitalik:   { cardBg: "radial-gradient(125% 95% at 50% 18%, #2a2410 0%, #121008 55%, #060604 100%)", cardMetal: "linear-gradient(135deg, rgba(245,200,66,0.32), transparent 55%)" },
  doge:      { cardBg: "radial-gradient(125% 95% at 50% 18%, #3a3010 0%, #1a1408 55%, #080604 100%)", cardMetal: "linear-gradient(135deg, rgba(255,215,0,0.35), transparent 55%)" },
  shiba:     { cardBg: "radial-gradient(125% 95% at 50% 18%, #1a2818 0%, #0c120c 55%, #040604 100%)", cardMetal: "linear-gradient(135deg, rgba(196,255,61,0.28), transparent 55%)" },
  pumpfun:   { cardBg: "radial-gradient(125% 95% at 50% 18%, #2a3010 0%, #121408 55%, #060604 100%)", cardMetal: "linear-gradient(135deg, rgba(255,215,0,0.3), transparent 55%)" },
  mem:       { cardBg: "radial-gradient(125% 95% at 50% 18%, #28183a 0%, #120c1a 55%, #060408 100%)", cardMetal: "linear-gradient(135deg, rgba(176,124,255,0.32), transparent 55%)" },
  chad:      { cardBg: "radial-gradient(125% 95% at 50% 18%, #102a3a 0%, #081218 55%, #040608 100%)", cardMetal: "linear-gradient(135deg, rgba(127,216,255,0.35), rgba(255,215,0,0.2) 60%)" },
  bogdanoff: { cardBg: "radial-gradient(125% 95% at 50% 18%, #2a1038 0%, #140818 55%, #060408 100%)", cardMetal: "linear-gradient(135deg, rgba(176,124,255,0.4), rgba(245,200,66,0.2) 60%)" },
  nyan:      { cardBg: "radial-gradient(125% 95% at 50% 18%, #1a2840 0%, #0c1420 55%, #040608 100%)", cardMetal: "linear-gradient(135deg, rgba(127,216,255,0.35), rgba(255,127,200,0.2) 60%)" },
  grumpy:    { cardBg: "radial-gradient(125% 95% at 50% 18%, #282828 0%, #141414 55%, #060606 100%)", cardMetal: "linear-gradient(135deg, rgba(154,163,178,0.35), transparent 55%)" },
  harambe:   { cardBg: "radial-gradient(125% 95% at 50% 18%, #1a2820 0%, #0c1410 55%, #040604 100%)", cardMetal: "linear-gradient(135deg, rgba(107,143,113,0.38), transparent 55%)" },
  ogre:      { cardBg: "radial-gradient(125% 95% at 50% 18%, #1a3020 0%, #0c1810 55%, #040804 100%)", cardMetal: "linear-gradient(135deg, rgba(74,222,128,0.35), transparent 55%)" },
  distracted:{ cardBg: "radial-gradient(125% 95% at 50% 18%, #3a2010 0%, #1a1008 55%, #080604 100%)", cardMetal: "linear-gradient(135deg, rgba(249,115,22,0.38), transparent 55%)" },
  finedog:   { cardBg: "radial-gradient(125% 95% at 50% 18%, #3a2810 0%, #1a1408 55%, #080604 100%)", cardMetal: "linear-gradient(135deg, rgba(255,216,77,0.35), rgba(255,90,77,0.15) 60%)" },
  wojak:     { cardBg: "radial-gradient(125% 95% at 50% 18%, #2a2820 0%, #141210 55%, #060604 100%)", cardMetal: "linear-gradient(135deg, rgba(232,220,200,0.32), transparent 55%)" },
  npc:       { cardBg: "radial-gradient(125% 95% at 50% 18%, #222228 0%, #101014 55%, #060608 100%)", cardMetal: "linear-gradient(135deg, rgba(176,176,176,0.3), transparent 55%)" },
  chadlite:  { cardBg: "radial-gradient(125% 95% at 50% 18%, #102838 0%, #081418 55%, #040608 100%)", cardMetal: "linear-gradient(135deg, rgba(90,159,212,0.38), transparent 55%)" },
  boomer:    { cardBg: "radial-gradient(125% 95% at 50% 18%, #2a2418 0%, #141008 55%, #060604 100%)", cardMetal: "linear-gradient(135deg, rgba(196,168,130,0.35), transparent 55%)" },
};

export const FIGHTER_ROSTER: FighterAsset[] = RAW.map((f, i) => ({
  ...f,
  cardTier: rankToCardTier(f.rankTier),
  serialNumber: `BM-S01-${String(i + 1).padStart(4, "0")}`,
  cardBg: CARD_THEMES[f.id]?.cardBg ?? CARD_THEMES.pepe!.cardBg,
  cardMetal: CARD_THEMES[f.id]?.cardMetal ?? CARD_THEMES.pepe!.cardMetal,
}));

export const FAN_FIGHTERS = FIGHTER_ROSTER.filter((f) =>
  ["pepe", "trump", "elon", "chad", "bogdanoff"].includes(f.id),
);

export function computeFanLayout(index: number, total: number, activeIndex: number): CSSProperties {
  const spread = 22;
  const zOffset = 40;
  const center = (total - 1) / 2;
  const offset = index - center;
  return {
    ["--fan-ry" as string]: `${offset * (spread / Math.max(total - 1, 1))}deg`,
    ["--fan-rx" as string]: `${-Math.abs(offset) * 1.5}deg`,
    ["--fan-tz" as string]: `${index === activeIndex ? 80 : -Math.abs(offset) * zOffset}px`,
    ["--fan-scale" as string]: index === activeIndex ? "1.06" : "1",
  };
}
