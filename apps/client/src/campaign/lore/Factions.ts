export interface Faction {
  id: string;
  name: string;
  emoji: string;
  description: string;
  territory: string;
  color: string;
}

export const FACTIONS: Faction[] = [
  {
    id: "neon_cartel",
    name: "Neon Cartel",
    emoji: "🌃",
    description: "Tech-savvy hustlers who control the digital underground. Masters of traps and gadgets.",
    territory: "Neon Wastes",
    color: "#ff00ff",
  },
  {
    id: "wild_circle",
    name: "Wild Circle",
    emoji: "🌲",
    description: "Nature-bound warriors who fight with primal fury. Experts at ambushes.",
    territory: "Wild Forest",
    color: "#00ff88",
  },
  {
    id: "sands_eternal",
    name: "Sands of Eternity",
    emoji: "🏜️",
    description: "Desert nomads who've survived where others perished. Unmatched endurance.",
    territory: "Sand Dunes",
    color: "#ffaa00",
  },
  {
    id: "void_cult",
    name: "Void Cult",
    emoji: "🌑",
    description: "Mysterious followers of the void. They see patterns others miss.",
    territory: "Void Realm",
    color: "#6600ff",
  },
  {
    id: "frost_guard",
    name: "Frost Guard",
    emoji: "❄️",
    description: "Disciplined warriors from the frozen peaks. Ice-cold precision in combat.",
    territory: "Ice Peaks",
    color: "#00ccff",
  },
  {
    id: "meme_mafia",
    name: "Meme Mafia",
    emoji: "🎭",
    description: "The old guard of Meme City. They control the markets and the narrative.",
    territory: "Meme City Center",
    color: "#ffdd00",
  },
  {
    id: "rogue_pumpers",
    name: "Rogue Pumpers",
    emoji: "🚀",
    description: "Chaotic neutral traders who live for the pump. Unpredictable allies.",
    territory: "Trading Posts",
    color: "#ff4444",
  },
];

export function getFaction(id: string): Faction | undefined {
  return FACTIONS.find((f) => f.id === id);
}
