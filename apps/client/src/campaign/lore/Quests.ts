export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestReward;
  giver: string;
}

export interface QuestObjective {
  type: "kill" | "collect" | "reach" | "talk";
  target: string;
  count: number;
  current?: number;
}

export interface QuestReward {
  xp: number;
  currency: number;
  items?: string[];
}

export const QUESTS: Quest[] = [
  {
    id: "q1",
    title: "First Steps",
    description: "Explore Meme City and defeat 3 enemy bombers.",
    objectives: [{ type: "kill", target: "enemy_bomber", count: 3 }],
    rewards: { xp: 100, currency: 50 },
    giver: "tutorial_npc",
  },
  {
    id: "q2",
    title: "Cartel Trouble",
    description: "The Neon Cartel is causing trouble. Defeat 5 of their members.",
    objectives: [{ type: "kill", target: "neon_cartel_member", count: 5 }],
    rewards: { xp: 200, currency: 100 },
    giver: "meme_mafia_boss",
  },
];

export function getQuest(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}
