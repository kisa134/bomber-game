/**
 * Quests.ts — BomberMeme World
 * Полная база квестов мира.
 *
 * Phase 1: Акт 1 — 1 главный квест + 3 side-квеста + 1 faction-квест
 * Акты 2-7: заглушки для будущего наполнения
 */

import { FactionId } from './Factions';
import { QuestType } from './Story';

// ═══════════════════════════════════════════════
// Типы
// ═══════════════════════════════════════════════

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

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  levelRequired: number;
  worldId: string;
  factionId?: FactionId;
  objectives: Objective[];
  rewards: Reward;
  prerequisites?: string[];
  nextQuestId?: string;
}

// ═══════════════════════════════════════════════
// Вспомогательные функции
// ═══════════════════════════════════════════════

function obj(
  id: string,
  type: Objective['type'],
  target: string,
  description: string,
  count: number = 1
): Objective {
  return { id, type, target, description, count, current: 0, completed: false };
}

function reward(
  xp: number,
  gold: number,
  items?: string[],
  unlockWorldId?: string,
  reputation?: { faction: FactionId; amount: number }[]
): Reward {
  return { experience: xp, gold, items, unlockWorldId, reputation };
}

// ═══════════════════════════════════════════════
// АКТ 1: Зелёные Земли (Grass)
// ═══════════════════════════════════════════════

/** Главный квест Акта 1: Путь Искры */
export const ACT1_MAIN_QUEST: Quest = {
  id: 'act1_main',
  title: 'Путь Искры',
  description:
    'Пробудитесь в новом мире, научитесь использовать бомбы, найдите союзников и остановите теневое нашествие, убив Пожирателя Корней — теневого босса, угрожающего Зелёным Землям.',
  type: 'main',
  levelRequired: 1,
  worldId: 'grass',
  objectives: [
    obj('a1m_01', 'explore', 'green_valley', 'Исследуйте Зелёную Долину, куда вы пробудились'),
    obj('a1m_02', 'talk', 'wild', 'Поговорите с Вайлдом — странствующим друидом, который нашёл вас'),
    obj('a1m_03', 'collect', 'spark_bomb', 'Найдите свою первую бомбу в Священной Роще'),
    obj('a1m_04', 'kill', 'shadow_blob', 'Уничтожьте 5 Теневых Блобов, проникших в Зелёные Земли', 5),
    obj('a1m_05', 'talk', 'vine_keeper', 'Поговорите со Хранителем Лоз — старейшиной Дикого Круга'),
    obj('a1m_06', 'explore', 'dead_grove', 'Исследуйте Мёртвую Рощу — место первого прорыва Пустоты'),
    obj('a1m_07', 'survive', 'shadow_wave', 'Выживите в волне теневых существ, атакующих деревню', 3),
    obj('a1m_08', 'kill', 'root_devourer', 'Убейте Пожирателя Корней — теневого босса, угрожающего Зелёным Землям'),
  ],
  rewards: reward(1000, 500, ['starter_pack', 'wild_circle_token'], 'sand', [
    { faction: 'wild_circle', amount: 50 },
  ]),
  nextQuestId: 'act2_main',
};

/** Side Quest 1: Охота на Теневых Грызунов */
export const ACT1_SIDE_HUNT: Quest = {
  id: 'act1_side_hunt',
  title: 'Охота на Теневых Грызунов',
  description:
    'Теневая энергия искажает живых существ. Обычные грызуны Зелёных Земель превратились в агрессивных чудовищ. Хранитель Лоз просит уничтожить их, пока зараза не распространилась дальше.',
  type: 'side',
  levelRequired: 2,
  worldId: 'grass',
  objectives: [
    obj('a1s1_01', 'kill', 'shadow_rat', 'Уничтожьте 10 Теневых Грызунов в окрестностях деревни', 10),
    obj('a1s1_02', 'collect', 'shadow_fang', 'Соберите 5 Теневых Клыков для исследований Хранителя Лоз', 5),
  ],
  rewards: reward(300, 150, ['shadow_fang_dagger']),
  prerequisites: ['act1_main'],
};

/** Side Quest 2: Цветы Возрождения */
export const ACT1_SIDE_GATHER: Quest = {
  id: 'act1_side_gather',
  title: 'Цветы Возрождения',
  description:
    'В Мёртвой Роще появились странные Белые Цветы — растения, способные расти на теневой почве. Друид Вайн считает их ключом к пониманию Пустоты. Соберите образцы для изучения.',
  type: 'side',
  levelRequired: 3,
  worldId: 'grass',
  objectives: [
    obj('a1s2_01', 'explore', 'dead_grove_edge', 'Доберитесь до опушки Мёртвой Рощи'),
    obj('a1s2_02', 'collect', 'white_flower', 'Соберите 8 Белых Цветов', 8),
    obj('a1s2_03', 'survive', 'shadow_ambush', 'Выживите в теневой засаде при сборе цветов'),
  ],
  rewards: reward(250, 100, ['white_flower_potion'], undefined, [
    { faction: 'wild_circle', amount: 15 },
  ]),
  prerequisites: ['act1_main'],
};

/** Side Quest 3: Тайны Древнего Алтаря */
export const ACT1_SIDE_EXPLORE: Quest = {
  id: 'act1_side_explore',
  title: 'Тайны Древнего Алтаря',
  description:
    'Глубоко в лесу стоит заброшенный алтарь Прото-Героев. Местные жители избегают его, но странные свечения последние ночи привлекли внимание. Исследуйте алтарь и узнайте его секреты.',
  type: 'side',
  levelRequired: 4,
  worldId: 'grass',
  objectives: [
    obj('a1s3_01', 'explore', 'ancient_altar', 'Найдите Древний Алтарь в глубине леса'),
    obj('a1s3_02', 'talk', 'altar_ghost', 'Поговорите с духом Прото-Героя, обитающим у алтаря'),
    obj('a1s3_03', 'collect', 'spark_fragment', 'Найдите осколок Искры, спрятанный в алтаре'),
  ],
  rewards: reward(400, 200, ['spark_fragment_amulet']),
  prerequisites: ['act1_main'],
};

/** Faction Quest: Ритуал Великого Цикла (Дикий Круг) */
export const ACT1_FACTION_WILD: Quest = {
  id: 'act1_faction_wild',
  title: 'Ритуал Великого Цикла',
  description:
    'Чтобы заслужить доверие Дикого Круга, вы должны пройти Ритуал Великого Цикла: посадить семя в Священной Роще, защитить его от врагов, а затем использовать бомбу, чтобы ускорить его рост. Для друидов взрыв — это не смерть, а перерождение.',
  type: 'faction',
  levelRequired: 5,
  worldId: 'grass',
  factionId: 'wild_circle',
  objectives: [
    obj('a1f1_01', 'collect', 'sacred_seed', 'Получите Священное Семя у Великого Друида Вайна'),
    obj('a1f1_02', 'explore', 'sacred_grove', 'Доберитесь до Священной Рощи'),
    obj('a1f1_03', 'defend', 'sacred_seed', 'Защитите посаженное семя от 3 волн теневых существ', 3),
    obj('a1f1_04', 'craft', 'growth_bomb', 'Создайте Бомбу Роста из собранных ингредиентов'),
    obj('a1f1_05', 'survive', 'growth_ritual', 'Проведите ритуал: взорвите Бомбу Роста у семени и выживите'),
  ],
  rewards: reward(600, 300, ['wild_circle_robe', 'growth_bomb_recipe'], undefined, [
    { faction: 'wild_circle', amount: 100 },
  ]),
  prerequisites: ['act1_side_gather'],
};

// ═══════════════════════════════════════════════
// Все квесты Акта 1
// ═══════════════════════════════════════════════

export const ACT1_QUESTS: Quest[] = [
  ACT1_MAIN_QUEST,
  ACT1_SIDE_HUNT,
  ACT1_SIDE_GATHER,
  ACT1_SIDE_EXPLORE,
  ACT1_FACTION_WILD,
];

// ═══════════════════════════════════════════════
// АКТ 2-7: Заглушки
// ═══════════════════════════════════════════════

export const ACT2_QUESTS: Quest[] = [
  {
    id: 'act2_main',
    title: 'Пески Предательства',
    description: '[Акт II — в разработке] Раскройте заговор в рядах наёмников Песков Вечности.',
    type: 'main',
    levelRequired: 10,
    worldId: 'sand',
    objectives: [obj('a2m_01', 'explore', 'sand_city', 'Доберитесь до Города Наёмников')],
    rewards: reward(2000, 1000, [], 'chappie'),
  },
];

export const ACT3_QUESTS: Quest[] = [
  {
    id: 'act3_main',
    title: 'Догма и Ересь',
    description: '[Акт III — в разработке] Проникните в Железный Собор и раскройте заговор радикалов.',
    type: 'main',
    levelRequired: 20,
    worldId: 'chappie',
    objectives: [obj('a3m_01', 'explore', 'iron_chapel', 'Войдите в Железный Собор')],
    rewards: reward(3500, 1750, [], 'neon'),
  },
];

export const ACT4_QUESTS: Quest[] = [
  {
    id: 'act4_main',
    title: 'Кодекс Истины',
    description: '[Акт IV — в разработке] Разоблачите тёмные секреты Неонового Картеля.',
    type: 'main',
    levelRequired: 30,
    worldId: 'neon',
    objectives: [obj('a4m_01', 'explore', 'neon_city', 'Войдите в Неоновый Горизонт')],
    rewards: reward(5500, 2750, [], 'grate'),
  },
];

export const ACT5_QUESTS: Quest[] = [
  {
    id: 'act5_main',
    title: 'Золотая Ловушка',
    description: '[Акт V — в разработке] Раскройте интриги Решётчатого Синдиката.',
    type: 'main',
    levelRequired: 40,
    worldId: 'grate',
    objectives: [obj('a5m_01', 'explore', 'shadow_market', 'Войдите в Теневой Рынок')],
    rewards: reward(8000, 4000, [], 'industrial'),
  },
];

export const ACT6_QUESTS: Quest[] = [
  {
    id: 'act6_main',
    title: 'Восстание Големов',
    description: '[Акт VI — в разработке] Остановите восстание машин в Промышленной Зоне.',
    type: 'main',
    levelRequired: 50,
    worldId: 'industrial',
    objectives: [obj('a6m_01', 'explore', 'industrial_zone', 'Войдите в Промышленную Зону')],
    rewards: reward(12000, 6000, [], 'void'),
  },
];

export const ACT7_QUESTS: Quest[] = [
  {
    id: 'act7_main',
    title: 'Семь Засовов',
    description: '[Акт VII — в разработке] Сделайте финальный выбор в сердце Расколотой Пустоты.',
    type: 'main',
    levelRequired: 60,
    worldId: 'void',
    objectives: [obj('a7m_01', 'explore', 'the_void', 'Войдите в Расколотую Пустоту')],
    rewards: reward(20000, 10000, ['legendary_set', 'ending_choice_token']),
  },
];

// ═══════════════════════════════════════════════
// Все квесты всех актов
// ═══════════════════════════════════════════════

export const ALL_QUESTS: Quest[] = [
  ...ACT1_QUESTS,
  ...ACT2_QUESTS,
  ...ACT3_QUESTS,
  ...ACT4_QUESTS,
  ...ACT5_QUESTS,
  ...ACT6_QUESTS,
  ...ACT7_QUESTS,
];

/** Получить квест по ID */
export function getQuest(id: string): Quest | undefined {
  return ALL_QUESTS.find((q) => q.id === id);
}

/** Получить все квесты для мира */
export function getQuestsByWorld(worldId: string): Quest[] {
  return ALL_QUESTS.filter((q) => q.worldId === worldId);
}

/** Получить все квесты определённого типа */
export function getQuestsByType(type: QuestType): Quest[] {
  return ALL_QUESTS.filter((q) => q.type === type);
}

/** Получить квесты для фракции */
export function getQuestsByFaction(factionId: FactionId): Quest[] {
  return ALL_QUESTS.filter((q) => q.factionId === factionId);
}

/** Проверить, выполнены ли все prerequisites */
export function canStartQuest(questId: string, completedQuestIds: string[]): boolean {
  const quest = getQuest(questId);
  if (!quest) return false;
  if (!quest.prerequisites || quest.prerequisites.length === 0) return true;
  return quest.prerequisites.every((prereq) => completedQuestIds.includes(prereq));
}
