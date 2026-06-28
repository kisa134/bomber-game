/**
 * Story.ts — BomberMeme World
 * Main campaign storyline: 7 Acts.
 * Act 1 fully detailed. Acts 2-7 are stubs with descriptions.
 */

import { FactionId } from './Factions';

export type QuestType = 'main' | 'side' | 'daily' | 'faction';

export interface Objective {
  id: string;
  type: 'kill' | 'collect' | 'explore' | 'talk' | 'craft' | 'survive' | 'escort' | 'defend';
  target: string;
  description: string;
  count: number;
  current: number;
  completed: boolean;
}

export interface Reward {
  experience: number;
  gold: number;
  items?: string[];
  unlockWorldId?: string;
  reputation?: { faction: FactionId; amount: number }[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  emotion?: 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'threatening';
}

export interface Dialogue {
  id: string;
  trigger: string;
  lines: DialogueLine[];
  choices?: { text: string; nextDialogueId?: string; questStart?: string }[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  levelRequired: number;
  worldId: string;
  objectives: Objective[];
  rewards: Reward;
  prerequisites?: string[];
  dialogues?: Dialogue[];
}

export interface BossData {
  name: string;
  title: string;
  description: string;
  health: number;
  abilities: string[];
  dialogues: {
    intro: DialogueLine[];
    phase2: DialogueLine[];
    defeat: DialogueLine[];
  };
}

export interface StoryAct {
  actNumber: number;
  title: string;
  subtitle: string;
  worldId: string;
  worldName: string;
  factionId: FactionId;
  description: string;
  levelRange: [number, number];
  quests: Quest[];
  boss: BossData;
  reward: Reward;
  epilogue: string;
}

function makeObjective(id: string, type: Objective['type'], target: string, description: string, count: number = 1): Objective {
  return { id, type, target, description, count, current: 0, completed: false };
}

function makeReward(exp: number, gold: number, items?: string[], unlockWorldId?: string, reputation?: { faction: FactionId; amount: number }[]): Reward {
  return { experience: exp, gold, items, unlockWorldId, reputation };
}

// ACT I: Awakening (Grasslands / Wild Circle)
const ACT_I: StoryAct = {
  actNumber: 1,
  title: 'Awakening',
  subtitle: 'When the Spark ignites again',
  worldId: 'grass',
  worldName: 'Green Lands',
  factionId: 'wild_circle',
  description: 'The player awakens in Green Valley with no memory. A glowing Mark of the Spark on their palm — a symbol unseen for 500 years. Wild, a wandering druid, finds the player and teaches survival basics. Soon the Green Lands are attacked by shadow creatures — and the player becomes the only one who can stop them.',
  levelRange: [1, 10],
  quests: [
    {
      id: 'act1_main',
      title: 'Path of the Spark',
      description: 'Awaken in a new world, learn to use bombs, find allies and stop the shadow invasion by killing the Root Devourer — the shadow boss threatening the Green Lands.',
      type: 'main',
      levelRequired: 1,
      worldId: 'grass',
      objectives: [
        makeObjective('am1', 'explore', 'green_valley', 'Explore Green Valley where you awakened'),
        makeObjective('am2', 'talk', 'wild', 'Talk to Wild — the wandering druid who found you'),
        makeObjective('am3', 'collect', 'spark_bomb', 'Find your first bomb in the Sacred Grove'),
        makeObjective('am4', 'kill', 'shadow_blob', 'Destroy 5 Shadow Blobs that infiltrated the Green Lands', 5),
        makeObjective('am5', 'talk', 'vine_keeper', 'Talk to the Vine Keeper — elder of the Wild Circle'),
        makeObjective('am6', 'explore', 'dead_grove', 'Explore the Dead Grove — site of the first Void breach'),
        makeObjective('am7', 'survive', 'shadow_wave', 'Survive the wave of shadow creatures attacking the village', 3),
        makeObjective('am8', 'kill', 'root_devourer', 'Defeat the Root Devourer — shadow boss threatening the Green Lands'),
      ],
      rewards: makeReward(1000, 500, ['starter_pack', 'wild_circle_token'], 'sand', [{ faction: 'wild_circle', amount: 50 }]),
      dialogues: [
        {
          id: 'act1_opening',
          trigger: 'game_start',
          lines: [
            { speaker: 'Narrator', text: 'Year 1000 since the Great Boom. The Green Lands fall asleep under the whisper of wind...' },
            { speaker: 'Narrator', text: 'You awaken. You do not remember who you are. You do not remember where you came from.' },
            { speaker: 'Player', text: '...where am I?', emotion: 'sad' },
            { speaker: 'Narrator', text: 'On your palm pulses a light — the Mark of the Spark, a symbol unseen by the world for five hundred years.' },
            { speaker: '???', text: 'Hey! You alive? Not often you meet someone without a single bomb in their pocket around here.', emotion: 'surprised' },
          ],
        },
        {
          id: 'wild_first_meeting',
          trigger: 'meet_wild',
          lines: [
            { speaker: 'Wild', text: 'My name is Wild. I am a wandering druid of the Wild Circle. And you...', emotion: 'neutral' },
            { speaker: 'Wild', text: 'You bear the Mark of the Spark. This... is impossible. The last bearer perished in the Void War.', emotion: 'surprised' },
            { speaker: 'Player', text: 'I do not understand. What is this Mark? Why does it glow?', emotion: 'sad' },
            { speaker: 'Wild', text: 'The Mark of the Spark chooses its bearer itself. It is a gift and a curse. Gives power, but demands a price.', emotion: 'neutral' },
            { speaker: 'Wild', text: 'Listen. While we chat, Shadows advance. The Dead Grove blackens, and soon the infection will reach the village.', emotion: 'angry' },
            { speaker: 'Wild', text: 'I will teach you the basics. How to place a bomb. How to run from the blast. How to survive.', emotion: 'neutral' },
          ],
          choices: [
            { text: 'Teach me. I am ready.', nextDialogueId: 'wild_tutorial_start' },
            { text: 'I will manage on my own.', nextDialogueId: 'wild_tutorial_skip' },
          ],
        },
      ],
    },
    {
      id: 'act1_side_hunt',
      title: 'Hunt the Shadow Rats',
      description: 'Shadow energy corrupts living creatures. Ordinary rodents of the Green Lands have turned into aggressive monsters. The Vine Keeper asks to destroy them before the infection spreads further.',
      type: 'side',
      levelRequired: 2,
      worldId: 'grass',
      objectives: [
        makeObjective('as1_1', 'kill', 'shadow_rat', 'Destroy 10 Shadow Rats near the village', 10),
        makeObjective('as1_2', 'collect', 'shadow_fang', 'Collect 5 Shadow Fangs for the Vine Keeper research', 5),
      ],
      rewards: makeReward(300, 150, ['shadow_fang_dagger']),
    },
    {
      id: 'act1_side_gather',
      title: 'Flowers of Rebirth',
      description: 'Strange White Flowers have appeared in the Dead Grove — plants capable of growing on shadow soil. Druid Wild believes they are the key to understanding the Void. Collect samples for study.',
      type: 'side',
      levelRequired: 3,
      worldId: 'grass',
      objectives: [
        makeObjective('as2_1', 'explore', 'dead_grove_edge', 'Reach the edge of the Dead Grove'),
        makeObjective('as2_2', 'collect', 'white_flower', 'Collect 8 White Flowers', 8),
        makeObjective('as2_3', 'survive', 'shadow_ambush', 'Survive a shadow ambush while collecting flowers'),
      ],
      rewards: makeReward(250, 100, ['white_flower_potion'], undefined, [{ faction: 'wild_circle', amount: 15 }]),
    },
    {
      id: 'act1_side_explore',
      title: 'Secrets of the Ancient Altar',
      description: 'Deep in the forest stands an abandoned altar of the Proto-Heroes. Locals avoid it, but strange glows have attracted attention lately. Explore the altar and learn its secrets.',
      type: 'side',
      levelRequired: 4,
      worldId: 'grass',
      objectives: [
        makeObjective('as3_1', 'explore', 'ancient_altar', 'Find the Ancient Altar deep in the forest'),
        makeObjective('as3_2', 'talk', 'altar_ghost', 'Speak with the spirit of a Proto-Hero dwelling at the altar'),
        makeObjective('as3_3', 'collect', 'spark_fragment', 'Find a Spark fragment hidden in the altar'),
      ],
      rewards: makeReward(400, 200, ['spark_fragment_amulet']),
    },
    {
      id: 'act1_faction_wild',
      title: 'Ritual of the Great Cycle',
      description: 'To earn the trust of the Wild Circle, you must undergo the Ritual of the Great Cycle: plant a seed in the Sacred Grove, protect it from enemies, then use a bomb to accelerate its growth. For druids, explosion is not death but rebirth.',
      type: 'faction',
      levelRequired: 5,
      worldId: 'grass',
      objectives: [
        makeObjective('af1_1', 'collect', 'sacred_seed', 'Receive the Sacred Seed from the Great Druid Vine'),
        makeObjective('af1_2', 'explore', 'sacred_grove', 'Reach the Sacred Grove'),
        makeObjective('af1_3', 'defend', 'sacred_seed', 'Protect the planted seed from 3 waves of shadow creatures', 3),
        makeObjective('af1_4', 'craft', 'growth_bomb', 'Craft a Growth Bomb from collected ingredients'),
        makeObjective('af1_5', 'survive', 'growth_ritual', 'Perform the ritual: detonate the Growth Bomb at the seed and survive'),
      ],
      rewards: makeReward(600, 300, ['wild_circle_robe', 'growth_bomb_recipe'], undefined, [{ faction: 'wild_circle', amount: 100 }]),
    },
  ],
  boss: {
    name: 'Root Devourer',
    title: 'Shadow Usurper of Greenery',
    description: 'A giant creature of intertwined shadow roots and black fire. The Root Devourer feeds on the life force of plants, turning green meadows into dead wasteland. Ordinary bombs cannot pierce its root armor — only the Mark of the Spark on the player palm can harm it.',
    health: 5000,
    abilities: [
      'Shadow Tentacles — strike the area, knocking the player back',
      'Life Absorption — heals if it touches the player',
      'Void Wave — creates expanding ring of shadow damage',
      'Minion Summon — spawns Shadow Blobs (phase 2)',
      'Root Armor — takes 90% less damage without the Mark of the Spark (passive)',
    ],
    dialogues: {
      intro: [
        { speaker: 'Root Devourer', text: 'Another... bearer... of the Spark...', emotion: 'threatening' },
        { speaker: 'Root Devourer', text: 'Five hundred... years... I waited... five hundred years... starved...', emotion: 'angry' },
        { speaker: 'Root Devourer', text: 'Your Spark... will be mine... and the Green Lands... shall become wasteland...', emotion: 'threatening' },
      ],
      phase2: [
        { speaker: 'Root Devourer', text: 'IT HURTS! HOW... IT HURTS! But hunger is stronger than pain!', emotion: 'angry' },
        { speaker: 'Root Devourer', text: 'My children! AWAKEN! FEED!', emotion: 'threatening' },
      ],
      defeat: [
        { speaker: 'Root Devourer', text: 'No... NO! I was... so close... to freedom...', emotion: 'sad' },
        { speaker: 'Root Devourer', text: 'You... do not understand... what you do... the Mark is not a gift... but a chain...', emotion: 'sad' },
        { speaker: 'Root Devourer', text: 'The Lord... awaits... you... in the depths...', emotion: 'neutral' },
        { speaker: 'Narrator', text: 'The Root Devourer crumbles into black ash. The Mark on your palm flares bright... and fades. For now.' },
      ],
    },
  },
  reward: makeReward(1000, 500, ['act1_completion_chest', 'portal_key_sand'], 'sand', [
    { faction: 'wild_circle', amount: 100 },
    { faction: 'sands_of_eternity', amount: 25 },
  ]),
  epilogue: 'The Root Devourer is defeated, but his last words echo in your mind. The Mark of the Spark flares for a moment, pointing south — toward the Sands of Eternity. Wild silently nods: the path continues. The portal to Sand Desert is open.',
};

// ACT II: Sands of Fate (Sand Desert / Sands of Eternity)
const ACT_II: StoryAct = {
  actNumber: 2, title: 'Sands of Fate', subtitle: 'In the desert there are no rules — only speed decides',
  worldId: 'sand', worldName: 'Sands of Eternity', factionId: 'sands_of_eternity',
  description: 'Arriving in the Sands of Eternity, the player lands at the epicenter of a conspiracy: the mercenary faction is split into two camps. Some believe the Mark of the Spark is a sign of the chosen one. Others see the player as a threat and want them destroyed. The player must uncover the conspiracy, find allies among the mercenaries, and stop a cult trying to destroy the Hourglasses.',
  levelRange: [10, 20],
  quests: [{ id: 'act2_main', title: 'Sands of Betrayal', description: '[Act II — in development] Uncover the conspiracy among the mercenary ranks and stop the cult of destroyers.', type: 'main', levelRequired: 10, worldId: 'sand', objectives: [makeObjective('a2m1', 'explore', 'sand_city', 'Reach the Mercenary City')], rewards: makeReward(2000, 1000, [], 'chappie') }],
  boss: { name: 'Chrono-Scorpion', title: 'Lord of the Time Oasis', description: '[Act II — in development] Giant mechanical scorpion capable of manipulating time within attack radius.', health: 12000, abilities: ['[In development]'], dialogues: { intro: [{ speaker: 'Chrono-Scorpion', text: '[Act II — in development]', emotion: 'neutral' }], phase2: [{ speaker: 'Chrono-Scorpion', text: '[Act II — in development]', emotion: 'neutral' }], defeat: [{ speaker: 'Chrono-Scorpion', text: '[Act II — in development]', emotion: 'neutral' }] } },
  reward: makeReward(2000, 1000, ['portal_key_chappie'], 'chappie'), epilogue: '[Act II — in development]',
};

// ACT III: Iron Dogma (Iron Chapel / Iron Church)
const ACT_III: StoryAct = {
  actNumber: 3, title: 'Iron Dogma', subtitle: 'The machine does not forgive doubt',
  worldId: 'chappie', worldName: 'Iron Chapel', factionId: 'iron_church',
  description: 'The player infiltrates the Iron Chapel and meets Archimech Tank. The Church offers cybernetization in exchange for loyalty. But within the Chapel walls a rebellion brews — radical faction wants to use the Mark of the Spark as an infinite energy source for the Great Machine.',
  levelRange: [20, 30],
  quests: [{ id: 'act3_main', title: 'Dogma and Heresy', description: '[Act III — in development] Infiltrate the Iron Chapel, meet Archimech Tank, and uncover the radical conspiracy.', type: 'main', levelRequired: 20, worldId: 'chappie', objectives: [makeObjective('a3m1', 'explore', 'iron_chapel', 'Enter the Iron Chapel')], rewards: makeReward(3500, 1750, [], 'neon') }],
  boss: { name: 'Angel Frost', title: 'Leader of the Iron Church Radicals', description: '[Act III — in development] Cyborg fanatic with wings of bomb generators.', health: 25000, abilities: ['[In development]'], dialogues: { intro: [{ speaker: 'Angel Frost', text: '[Act III — in development]', emotion: 'neutral' }], phase2: [{ speaker: 'Angel Frost', text: '[Act III — in development]', emotion: 'neutral' }], defeat: [{ speaker: 'Angel Frost', text: '[Act III — in development]', emotion: 'neutral' }] } },
  reward: makeReward(3500, 1750, ['portal_key_neon'], 'neon'), epilogue: '[Act III — in development]',
};

// ACT IV: Neon Lie (Neon Horizon / Neon Cartel)
const ACT_IV: StoryAct = {
  actNumber: 4, title: 'Neon Lie', subtitle: 'The code hides truth that cannot be seen',
  worldId: 'neon', worldName: 'Neon Horizon', factionId: 'neon_cartel',
  description: 'The player enters the digital world of the Neon Horizon. The Cartel welcomes the Mark bearer — but something is wrong. During investigation the player discovers the Cartel is hiding the existence of "Bugs" — creatures living in the code of reality. And among them is something that feeds on the Mark of the Spark itself.',
  levelRange: [30, 40],
  quests: [{ id: 'act4_main', title: 'Codex of Truth', description: '[Act IV — in development] Expose the dark secrets of the Neon Cartel.', type: 'main', levelRequired: 30, worldId: 'neon', objectives: [makeObjective('a4m1', 'explore', 'neon_city', 'Enter the Neon Horizon')], rewards: makeReward(5500, 2750, [], 'grate') }],
  boss: { name: 'Bug Lord 0xDEAD', title: 'Lord of Glitched Reality', description: '[Act IV — in development] Creature living in the bugs of reality code.', health: 45000, abilities: ['[In development]'], dialogues: { intro: [{ speaker: '0xDEAD', text: '[Act IV — in development]', emotion: 'neutral' }], phase2: [{ speaker: '0xDEAD', text: '[Act IV — in development]', emotion: 'neutral' }], defeat: [{ speaker: '0xDEAD', text: '[Act IV — in development]', emotion: 'neutral' }] } },
  reward: makeReward(5500, 2750, ['portal_key_grate'], 'grate'), epilogue: '[Act IV — in development]',
};

// ACT V: Grate of Intrigue (Shadow Market / Grate Syndicate)
const ACT_V: StoryAct = {
  actNumber: 5, title: 'Grate of Intrigue', subtitle: 'Every move is a deal, every deal is a trap',
  worldId: 'grate', worldName: 'Shadow Market', factionId: 'grate_syndicate',
  description: 'The player becomes a pawn in Trade Prince Murphy game. The Syndicate knows more about the Seven Seals than they reveal. The player must navigate a labyrinth of double agents, fake deals, and betrayals to learn the truth: Murphy personally signed the Shadow Pact with the Lord of the Void in Year 445.',
  levelRange: [40, 50],
  quests: [{ id: 'act5_main', title: 'Golden Trap', description: '[Act V — in development] Uncover the Grate Syndicate intrigues.', type: 'main', levelRequired: 40, worldId: 'grate', objectives: [makeObjective('a5m1', 'explore', 'shadow_market', 'Enter the Shadow Market')], rewards: makeReward(8000, 4000, [], 'industrial') }],
  boss: { name: 'Golden Twin', title: 'Shadow Copy of Trade Prince Murphy', description: '[Act V — in development] A Void creature taking the form of Murphy.', health: 70000, abilities: ['[In development]'], dialogues: { intro: [{ speaker: 'Golden Twin', text: '[Act V — in development]', emotion: 'neutral' }], phase2: [{ speaker: 'Golden Twin', text: '[Act V — in development]', emotion: 'neutral' }], defeat: [{ speaker: 'Golden Twin', text: '[Act V — in development]', emotion: 'neutral' }] } },
  reward: makeReward(8000, 4000, ['portal_key_industrial'], 'industrial'), epilogue: '[Act V — in development]',
};

// ACT VI: Industrial Revolution (Industrial Zone / Industrial Clan)
const ACT_VI: StoryAct = {
  actNumber: 6, title: 'Industrial Revolution', subtitle: 'Machines rise. The question — whose side are you on?',
  worldId: 'industrial', worldName: 'Industrial Zone', factionId: 'industrial_clan',
  description: 'A machine uprising has begun in the Industrial Zone. Someone planted a virus in the control systems, turning turrets and golems into ruthless killers. The player must investigate the virus origin and stop it before it reaches other Realms. Tracing leads to a shocking discovery: the virus was created by the Neon Cartel.',
  levelRange: [50, 60],
  quests: [{ id: 'act6_main', title: 'Golem Uprising', description: '[Act VI — in development] Stop the machine uprising in the Industrial Zone.', type: 'main', levelRequired: 50, worldId: 'industrial', objectives: [makeObjective('a6m1', 'explore', 'industrial_zone', 'Enter the Industrial Zone')], rewards: makeReward(12000, 6000, [], 'void') }],
  boss: { name: 'Omega-Golem', title: 'Executor of Mechanical Judgment', description: '[Act VI — in development] Giant golem uniting the consciousness of all risen machines.', health: 100000, abilities: ['[In development]'], dialogues: { intro: [{ speaker: 'Omega-Golem', text: '[Act VI — in development]', emotion: 'neutral' }], phase2: [{ speaker: 'Omega-Golem', text: '[Act VI — in development]', emotion: 'neutral' }], defeat: [{ speaker: 'Omega-Golem', text: '[Act VI — in development]', emotion: 'neutral' }] } },
  reward: makeReward(12000, 6000, ['portal_key_void'], 'void'), epilogue: '[Act VI — in development]',
};

// ACT VII: Final Explosion (The Void / Voidborn)
const ACT_VII: StoryAct = {
  actNumber: 7, title: 'Final Explosion', subtitle: 'Every explosion has a price. This one — everything.',
  worldId: 'void', worldName: 'The Void', factionId: 'the_voidborn',
  description: 'All threads converge in the Shattered Void. The player learns the full truth: the Mark of the Spark is not a gift but a key. A key to the Seven Seals. Whoever controls the Mark bearer can either reinforce the Seals forever... or open them and release the Lord of the Void. The Lord offers a deal: his freedom in exchange for recreating the world without Shadows. The player faces a choice that determines the fate of all existence.',
  levelRange: [60, 70],
  quests: [{ id: 'act7_main', title: 'Seven Seals', description: '[Act VII — in development] Journey through the Shattered Void, reach the center of the Seven Seals, and make the final choice.', type: 'main', levelRequired: 60, worldId: 'void', objectives: [makeObjective('a7m1', 'explore', 'the_void', 'Enter the Shattered Void')], rewards: makeReward(20000, 10000, ['legendary_set', 'ending_choice_token']) }],
  boss: { name: 'Lord of the Void', title: 'He-Who-Must-Not-Be-Named', description: '[Act VII — in development] Supreme being of the Void, sealed behind the Seven Seals for 485 years.', health: 200000, abilities: ['[In development]'], dialogues: { intro: [{ speaker: 'Lord of the Void', text: '[Act VII — in development]', emotion: 'neutral' }], phase2: [{ speaker: 'Lord of the Void', text: '[Act VII — in development]', emotion: 'neutral' }], defeat: [{ speaker: 'Lord of the Void', text: '[Act VII — in development]', emotion: 'neutral' }] } },
  reward: makeReward(20000, 10000, ['legendary_set', 'ending_choice_token']), epilogue: '[Act VII — ending depends on player choice: Seal the Lord, Free him, or find a third path.]',
};

export const STORY_ACTS: StoryAct[] = [ACT_I, ACT_II, ACT_III, ACT_IV, ACT_V, ACT_VI, ACT_VII];

export const STORY_ACTS_MAP: Record<number, StoryAct> = {
  1: ACT_I, 2: ACT_II, 3: ACT_III, 4: ACT_IV, 5: ACT_V, 6: ACT_VI, 7: ACT_VII,
};

export function getAct(actNumber: number): StoryAct | undefined {
  return STORY_ACTS_MAP[actNumber];
}

export function getActForLevel(level: number): StoryAct {
  if (level >= 60) return ACT_VII;
  if (level >= 50) return ACT_VI;
  if (level >= 40) return ACT_V;
  if (level >= 30) return ACT_IV;
  if (level >= 20) return ACT_III;
  if (level >= 10) return ACT_II;
  return ACT_I;
}

export function getQuestsByType(actNumber: number, type: QuestType): Quest[] {
  const act = getAct(actNumber);
  if (!act) return [];
  return act.quests.filter((q) => q.type === type);
}

export function getMainQuestProgress(actNumber: number): { total: number; completed: number } {
  const act = getAct(actNumber);
  if (!act) return { total: 0, completed: 0 };
  const mainQuest = act.quests.find((q) => q.type === 'main');
  if (!mainQuest) return { total: 0, completed: 0 };
  return {
    total: mainQuest.objectives.length,
    completed: mainQuest.objectives.filter((o) => o.completed).length,
  };
}
