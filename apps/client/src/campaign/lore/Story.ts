/**
 * Story.ts — BomberMeme World
 * Главная сюжетная линия кампании: 7 Актов.
 *
 * Каждый акт привязан к одному Царству, одной фракции и одному боссу.
 * Акт 1 — полностью расписан. Акты 2-7 — заглушки с кратким описанием.
 */

import { FactionId } from './Factions';

// ═══════════════════════════════════════════════
// Типы
// ═══════════════════════════════════════════════

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

// ═══════════════════════════════════════════════
// Вспомогательные функции
// ═══════════════════════════════════════════════

function makeObjective(
  id: string,
  type: Objective['type'],
  target: string,
  description: string,
  count: number = 1
): Objective {
  return { id, type, target, description, count, current: 0, completed: false };
}

function makeReward(
  experience: number,
  gold: number,
  items?: string[],
  unlockWorldId?: string,
  reputation?: { faction: FactionId; amount: number }[]
): Reward {
  return { experience, gold, items, unlockWorldId, reputation };
}

// ═══════════════════════════════════════════════
// АКТ I: Пробуждение (Grasslands / Дикий Круг)
// ═══════════════════════════════════════════════

const ACT_I: StoryAct = {
  actNumber: 1,
  title: 'Пробуждение',
  subtitle: 'Когда Искра загорается вновь',
  worldId: 'grass',
  worldName: 'Зелёные Земли',
  factionId: 'wild_circle',
  description:
    'Игрок просыпается в Зелёной Долине без памяти. На ладони — светящаяся Марка Искры, символ, не виданный миром 500 лет. Вайлд, странствующий друид, находит игрока и учит основам выживания. Вскоре Зелёные Земли атакованы теневыми существами — и игрок оказывается единственным, кто может остановить их.',
  levelRange: [1, 10],
  quests: [
    // ─── Главный квест Акта 1 ───
    {
      id: 'act1_main',
      title: 'Путь Искры',
      description:
        'Пробудитесь в новом мире, научитесь использовать бомбы, найдите союзников и остановите теневое нашествие, убив Пожирателя Корней — теневого босса, угрожающего Зелёным Землям.',
      type: 'main',
      levelRequired: 1,
      worldId: 'grass',
      objectives: [
        makeObjective('am1', 'explore', 'green_valley', 'Исследуйте Зелёную Долину, куда вы пробудились', 1),
        makeObjective('am2', 'talk', 'wild', 'Поговорите с Вайлдом — странствующим друидом, который нашёл вас', 1),
        makeObjective('am3', 'collect', 'spark_bomb', 'Найдите свою первую бомбу в Священной Роще', 1),
        makeObjective('am4', 'kill', 'shadow_blob', 'Уничтожьте 5 Теневых Блобов, проникших в Зелёные Земли', 5),
        makeObjective('am5', 'talk', 'vine_keeper', 'Поговорите со Хранителем Лоз — старейшиной Дикого Круга', 1),
        makeObjective('am6', 'explore', 'dead_grove', 'Исследуйте Мёртвую Рощу — место первого прорыва Пустоты', 1),
        makeObjective('am7', 'survive', 'shadow_wave', 'Выживите в волне теневых существ, атакующих деревню', 3),
        makeObjective('am8', 'kill', 'root_devourer', 'Убейте Пожирателя Корней — теневого босса, угрожающего Зелёным Землям', 1),
      ],
      rewards: makeReward(1000, 500, ['starter_pack', 'wild_circle_token'], 'sand', [
        { faction: 'wild_circle', amount: 50 },
      ]),
      dialogues: [
        {
          id: 'act1_opening',
          trigger: 'game_start',
          lines: [
            { speaker: 'Нарратор', text: 'Год 1000 от Великого Взрыва. Зелёные Земли засыпают под шёпот ветра...' },
            { speaker: 'Нарратор', text: 'Вы просыпаетесь. Не помните, кто вы. Не помните, откуда.' },
            { speaker: 'Игрок', text: '...где я?', emotion: 'sad' },
            { speaker: 'Нарратор', text: 'На вашей ладони пульсирует свет — Марка Искры, символ, не виданный миром пятьсот лет.' },
            { speaker: '???', text: 'Эй! Ты живой? Не часто встретишь кого-то без единой бомбы в кармане в этих краях.', emotion: 'surprised' },
          ],
        },
        {
          id: 'wild_first_meeting',
          trigger: 'meet_wild',
          lines: [
            { speaker: 'Вайлд', text: 'Имя мне Вайлд. Я — странствующий друид Дикого Круга. А ты...', emotion: 'neutral' },
            { speaker: 'Вайлд', text: 'Ты несёшь Марку Искры. Это... невозможно. Последний носитель погиб в Войну Пустоты.', emotion: 'surprised' },
            { speaker: 'Игрок', text: 'Я не понимаю. Что эта Марка? Почему она светится?', emotion: 'sad' },
            { speaker: 'Вайлд', text: 'Марка Искры выбирает своего носителя сама. Она — дар и проклятие. Даёт силу, но требует цену.', emotion: 'neutral' },
            { speaker: 'Вайлд', text: 'Слушай. Пока мы болтаем, Тени наступают. Мёртвая Роща чернеет, и скоро зараза достигнет деревни.', emotion: 'angry' },
            { speaker: 'Вайлд', text: 'Я научу тебя основам. Как ставить бомбу. Как убегать от взрыва. Как выживать.', emotion: 'neutral' },
            { speaker: 'Вайлд', text: 'А потом... потом ты сам решишь, кем быть. Но знай: если Марка выбрала тебя — мир скоро изменится.', emotion: 'sad' },
          ],
          choices: [
            { text: 'Научи меня. Я готов.', nextDialogueId: 'wild_tutorial_start' },
            { text: 'Я справлюсь сам.', nextDialogueId: 'wild_tutorial_skip' },
          ],
        },
        {
          id: 'wild_boss_hint',
          trigger: 'before_boss',
          lines: [
            { speaker: 'Вайлд', text: 'Вот оно. Сердце Мёртвой Рощи. Пожиратель Корней — теневое чудовище, питающееся жизненной силой растений.', emotion: 'threatening' },
            { speaker: 'Вайлд', text: 'Обычные бомбы бесполезны против него. Но твоя Марка... она может пробить его защиту.', emotion: 'neutral' },
            { speaker: 'Вайлд', text: 'Я прикрою тебя. Бомби быстро, бомби точно. Не давай ему касаться тебя — одно прикосновение Пустоты и...', emotion: 'angry' },
            { speaker: 'Вайлд', text: 'Просто не дай ему коснуться тебя. Удачи, носитель Искры.', emotion: 'neutral' },
          ],
        },
      ],
    },

    // ─── Side Quest 1: Убийство ───
    {
      id: 'act1_side_hunt',
      title: 'Охота на Теневых Грызунов',
      description:
        'Теневая энергия искажает живых существ. Обычные грызуны Зелёных Земель превратились в агрессивных чудовищ. Хранитель Лоз просит уничтожить их, пока зараза не распространилась дальше.',
      type: 'side',
      levelRequired: 2,
      worldId: 'grass',
      objectives: [
        makeObjective('as1_1', 'kill', 'shadow_rat', 'Уничтожьте 10 Теневых Грызунов в окрестностях деревни', 10),
        makeObjective('as1_2', 'collect', 'shadow_fang', 'Соберите 5 Теневых Клыков для исследований Хранителя Лоз', 5),
      ],
      rewards: makeReward(300, 150, ['shadow_fang_dagger']),
    },

    // ─── Side Quest 2: Сбор ───
    {
      id: 'act1_side_gather',
      title: 'Цветы Возрождения',
      description:
        'В Мёртвой Роще появились странные Белые Цветы — растения, способные расти на теневой почве. Друид Вайн считает их ключом к пониманию Пустоты. Соберите образцы для изучения.',
      type: 'side',
      levelRequired: 3,
      worldId: 'grass',
      objectives: [
        makeObjective('as2_1', 'explore', 'dead_grove_edge', 'Доберитесь до опушки Мёртвой Рощи', 1),
        makeObjective('as2_2', 'collect', 'white_flower', 'Соберите 8 Белых Цветов', 8),
        makeObjective('as2_3', 'survive', 'shadow_ambush', 'Выживите в теневой засаде при сборе цветов', 1),
      ],
      rewards: makeReward(250, 100, ['white_flower_potion'], undefined, [
        { faction: 'wild_circle', amount: 15 },
      ]),
    },

    // ─── Side Quest 3: Исследование ───
    {
      id: 'act1_side_explore',
      title: 'Тайны Древнего Алтаря',
      description:
        'Глубоко в лесу стоит заброшенный алтарь Прото-Героев. Местные жители избегают его, но странные свечения последние ночи привлекли внимание. Исследуйте алтарь и узнайте его секреты.',
      type: 'side',
      levelRequired: 4,
      worldId: 'grass',
      objectives: [
        makeObjective('as3_1', 'explore', 'ancient_altar', 'Найдите Древний Алтарь в глубине леса', 1),
        makeObjective('as3_2', 'talk', 'altar_ghost', 'Поговорите с духом Прото-Героя, обитающим у алтаря', 1),
        makeObjective('as3_3', 'collect', 'spark_fragment', 'Найдите осколок Искры, спрятанный в алтаре', 1),
      ],
      rewards: makeReward(400, 200, ['spark_fragment_amulet']),
    },

    // ─── Faction Quest: Дикий Круг ───
    {
      id: 'act1_faction_wild',
      title: 'Ритуал Великого Цикла',
      description:
        'Чтобы заслужить доверие Дикого Круга, вы должны пройти Ритуал Великого Цикла: посадить семя в Священной Роще, защитить его от врагов, а затем использовать бомбу, чтобы ускорить его рост. Для друидов взрыв — это не смерть, а перерождение.',
      type: 'faction',
      levelRequired: 5,
      worldId: 'grass',
      objectives: [
        makeObjective('af1_1', 'collect', 'sacred_seed', 'Получите Священное Семя у Великого Друида Вайна', 1),
        makeObjective('af1_2', 'explore', 'sacred_grove', 'Доберитесь до Священной Рощи', 1),
        makeObjective('af1_3', 'defend', 'sacred_seed', 'Защитите посаженное семя от 3 волн теневых существ', 3),
        makeObjective('af1_4', 'craft', 'growth_bomb', 'Создайте Бомбу Роста из собранных ингредиентов', 1),
        makeObjective('af1_5', 'survive', 'growth_ritual', 'Проведите ритуал: взорвите Бомбу Роста у семени и выживите', 1),
      ],
      rewards: makeReward(600, 300, ['wild_circle_robe', 'growth_bomb_recipe'], undefined, [
        { faction: 'wild_circle', amount: 100 },
      ]),
    },
  ],

  boss: {
    name: 'Пожиратель Корней',
    title: 'Теневой Узурпатор Зелени',
    description:
      'Гигантское существо из сплетённых теневых корней и чёрного огня. Пожиратель питается жизненной силой растений, превращая зелёные луга в мёртвую пустошь. Обычные бомбы не пробивают его корневую броню — лишь Марка Искры на ладони игрока может нанести ему урон.',
    health: 5000,
    abilities: [
      'Теневые Щупальца — бьют по области, отбрасывая игрока',
      'Поглощение Жизни — восстанавливает здоровье, если коснётся игрока',
      'Волна Пустоты — создаёт expanding ring of shadow damage',
      'Призыв Миньонов — порождает Теневых Блобов (фаза 2)',
      'Корневая Броня — получает 90% меньше урона без Марки Искры (пассивка)',
    ],
    dialogues: {
      intro: [
        { speaker: 'Пожиратель Корней', text: 'Ещё... один... носитель... Искры...', emotion: 'threatening' },
        { speaker: 'Пожиратель Корней', text: 'Пятьсот... лет... я ждал... пятьсот лет... голодал...', emotion: 'angry' },
        { speaker: 'Пожиратель Корней', text: 'Твоя Искра... будет моей... а Зелёные Земли... станут пустошью...', emotion: 'threatening' },
      ],
      phase2: [
        { speaker: 'Пожиратель Корней', text: 'БОЛЬНО! КАК... БОЛЬНО! Но голод сильнее боли!', emotion: 'angry' },
        { speaker: 'Пожиратель Корней', text: 'Мои дети! ПРОСНИТЕСЬ! ПОКОРМИТЕСЬ!', emotion: 'threatening' },
      ],
      defeat: [
        { speaker: 'Пожиратель Корней', text: 'Нет... НЕТ! Я был... так близко... к свободе...', emotion: 'sad' },
        { speaker: 'Пожиратель Корней', text: 'Ты... не понимаешь... что делаешь... Марка не дар... а цепь...', emotion: 'sad' },
        { speaker: 'Пожиратель Корней', text: 'Владыка... ждёт... тебя... в глубинах...', emotion: 'neutral' },
        { speaker: 'Нарратор', text: 'Пожиратель Корней рассыпается в чёрный пепел. Марка на вашей ладони ярко вспыхивает... и гаснет. Ненадолго.' },
      ],
    },
  },

  reward: makeReward(1000, 500, ['act1_completion_chest', 'portal_key_sand'], 'sand', [
    { faction: 'wild_circle', amount: 100 },
    { faction: 'sands_of_eternity', amount: 25 },
  ]),

  epilogue:
    'Пожиратель Корней повержен, но его последние слова эхом отдаются в вашем сознании. Марка Искры на мгновение ярко вспыхивает, указывая на юг — в сторону Песков Вечности. Вайлд молча кивает: путь лежит дальше. Портал в Sand Desert открыт.',
};

// ═══════════════════════════════════════════════
// АКТ II: Пески Судьбы (Sand Desert / Пески Вечности)
// ═══════════════════════════════════════════════

const ACT_II: StoryAct = {
  actNumber: 2,
  title: 'Пески Судьбы',
  subtitle: 'В пустыне нет правил — лишь скорость решает',
  worldId: 'sand',
  worldName: 'Пески Вечности',
  factionId: 'sands_of_eternity',
  description:
    'Прибыв в Пески Вечности, игрок попадает в эпицентр заговора: фракция наёмников расколота на два лагеря. Одни верят, что Марка Искры — знак пришествия избранного. Другие считают игрока угрозой и хотят уничтожить. Игрок должен раскрыть заговор, найти союзников среди наёмников и остановить культ, пытающийся разрушить Песочные Часы.',
  levelRange: [10, 20],
  quests: [
    {
      id: 'act2_main_placeholder',
      title: 'Пески Предательства',
      description: '[Акт II — в разработке] Раскройте заговор в рядах наёмников и остановите культ разрушителей.',
      type: 'main',
      levelRequired: 10,
      worldId: 'sand',
      objectives: [makeObjective('a2m1', 'explore', 'sand_city', 'Доберитесь до Города Наёмников', 1)],
      rewards: makeReward(2000, 1000, [], 'chappie'),
    },
  ],
  boss: {
    name: 'Хроно-Скорпион',
    title: 'Повелитель Оазиса Времени',
    description: '[Акт II — в разработке] Гигантский механический скорпион, способный манипулировать временем в радиусе атаки.',
    health: 12000,
    abilities: ['[В разработке]'],
    dialogues: {
      intro: [{ speaker: 'Хроно-Скорпион', text: '[Акт II — в разработке]', emotion: 'neutral' }],
      phase2: [{ speaker: 'Хранитель Скорпионов', text: '[Акт II — в разработке]', emotion: 'neutral' }],
      defeat: [{ speaker: 'Хроно-Скорпион', text: '[Акт II — в разработке]', emotion: 'neutral' }],
    },
  },
  reward: makeReward(2000, 1000, ['portal_key_chappie'], 'chappie'),
  epilogue: '[Акт II — в разработке]',
};

// ═══════════════════════════════════════════════
// АКТ III: Железный Догмат (Iron Chapel / Железная Церковь)
// ═══════════════════════════════════════════════

const ACT_III: StoryAct = {
  actNumber: 3,
  title: 'Железный Догмат',
  subtitle: 'Машина не прощает сомнений',
  worldId: 'chappie',
  worldName: 'Железный Собор',
  factionId: 'iron_church',
  description:
    'Игрок проникает в Железный Собор и встречает Архимеханика Танка. Церковь предлагает игроку кибернетизацию в обмен на лояльность. Но в стенах Собора зреёт восстание — фракция радикалов хочет использовать Марку Искры как источник бесконечной энергии для Великой Машины.',
  levelRange: [20, 30],
  quests: [
    {
      id: 'act3_main_placeholder',
      title: 'Догма и Ересь',
      description: '[Акт III — в разработке] Проникните в Железный Собор, встретьтесь с Архимехаником Танком и раскройте заговор радикалов.',
      type: 'main',
      levelRequired: 20,
      worldId: 'chappie',
      objectives: [makeObjective('a3m1', 'explore', 'iron_chapel', 'Войдите в Железный Собор', 1)],
      rewards: makeReward(3500, 1750, [], 'neon'),
    },
  ],
  boss: {
    name: 'Ангел Стужи',
    title: 'Глава Радикалов Железной Церкви',
    description: '[Акт III — в разработке] Киборг-фанатик с крыльями из бомбических генераторов.',
    health: 25000,
    abilities: ['[В разработке]'],
    dialogues: {
      intro: [{ speaker: 'Ангел Стужи', text: '[Акт III — в разработке]', emotion: 'neutral' }],
      phase2: [{ speaker: 'Ангел Стужи', text: '[Акт III — в разработке]', emotion: 'neutral' }],
      defeat: [{ speaker: 'Ангел Стужи', text: '[Акт III — в разработке]', emotion: 'neutral' }],
    },
  },
  reward: makeReward(3500, 1750, ['portal_key_neon'], 'neon'),
  epilogue: '[Акт III — в разработке]',
};

// ═══════════════════════════════════════════════
// АКТ IV: Неоновая Ложь (Neon Horizon / Неоновый Картель)
// ═══════════════════════════════════════════════

const ACT_IV: StoryAct = {
  actNumber: 4,
  title: 'Неоновая Ложь',
  subtitle: 'В коде скрыта правда, которую нельзя увидеть',
  worldId: 'neon',
  worldName: 'Неоновый Горизонт',
  factionId: 'neon_cartel',
  description:
    'Игрок попадает в цифровой мир Неонового Горизонта. Картель приветствует носителя Марки Искры — но что-то не так. В ходе расследования игрок обнаруживает, что Картель скрывает существование "Багов" — существ, живущих в коде реальности. И среди них есть нечто, питающееся самой Маркой Искры.',
  levelRange: [30, 40],
  quests: [
    {
      id: 'act4_main_placeholder',
      title: 'Кодекс Истины',
      description: '[Акт IV — в разработке] Разоблачите тёмные секреты Неонового Картеля.',
      type: 'main',
      levelRequired: 30,
      worldId: 'neon',
      objectives: [makeObjective('a4m1', 'explore', 'neon_city', 'Войдите в Неоновый Горизонт', 1)],
      rewards: makeReward(5500, 2750, [], 'grate'),
    },
  ],
  boss: {
    name: 'Баг-Лорд 0xDEAD',
    title: 'Повелитель Глючной Реальности',
    description: '[Акт IV — в разработке] Существо, живущее в багах кода реальности.',
    health: 45000,
    abilities: ['[В разработке]'],
    dialogues: {
      intro: [{ speaker: '0xDEAD', text: '[Акт IV — в разработке]', emotion: 'neutral' }],
      phase2: [{ speaker: '0xDEAD', text: '[Акт IV — в разработке]', emotion: 'neutral' }],
      defeat: [{ speaker: '0xDEAD', text: '[Акт IV — в разработке]', emotion: 'neutral' }],
    },
  },
  reward: makeReward(5500, 2750, ['portal_key_grate'], 'grate'),
  epilogue: '[Акт IV — в разработке]',
};

// ═══════════════════════════════════════════════
// АКТ V: Решётка Интриг (Shadow Market / Решётчатый Синдикат)
// ═══════════════════════════════════════════════

const ACT_V: StoryAct = {
  actNumber: 5,
  title: 'Решётка Интриг',
  subtitle: 'Каждый ход — это сделка, каждая сделка — ловушка',
  worldId: 'grate',
  worldName: 'Теневой Рынок',
  factionId: 'grate_syndicate',
  description:
    'Игрок становится пешкой в игре Торгового Принца Мёрфи. Синдикат знает о существовании Семи Засовов больше, чем говорит. Игрок должен пройти через лабиринт двойных агентов, фальшивых сделок и предательств, чтобы узнать правду: Мёрфи лично подписал Теневой Договор с Владыкой Пустоты в Год 445.',
  levelRange: [40, 50],
  quests: [
    {
      id: 'act5_main_placeholder',
      title: 'Золотая Ловушка',
      description: '[Акт V — в разработке] Раскройте интриги Решётчатого Синдиката.',
      type: 'main',
      levelRequired: 40,
      worldId: 'grate',
      objectives: [makeObjective('a5m1', 'explore', 'shadow_market', 'Войдите в Теневой Рынок', 1)],
      rewards: makeReward(8000, 4000, [], 'industrial'),
    },
  ],
  boss: {
    name: 'Золотой Двойник',
    title: 'Теневая Копия Торгового Принца',
    description: '[Акт V — в разработке] Существо из Пустоты, принявшее облик Мёрфи.',
    health: 70000,
    abilities: ['[В разработке]'],
    dialogues: {
      intro: [{ speaker: 'Золотой Двойник', text: '[Акт V — в разработке]', emotion: 'neutral' }],
      phase2: [{ speaker: 'Золотой Двойник', text: '[Акт V — в разработке]', emotion: 'neutral' }],
      defeat: [{ speaker: 'Золотой Двойник', text: '[Акт V — в разработке]', emotion: 'neutral' }],
    },
  },
  reward: makeReward(8000, 4000, ['portal_key_industrial'], 'industrial'),
  epilogue: '[Акт V — в разработке]',
};

// ═══════════════════════════════════════════════
// АКТ VI: Промышленная Революция (Industrial Zone / Промышленный Клан)
// ═══════════════════════════════════════════════

const ACT_VI: StoryAct = {
  actNumber: 6,
  title: 'Промышленная Революция',
  subtitle: 'Машины восстают. Вопрос — на чьей стороне ты?',
  worldId: 'industrial',
  worldName: 'Промышленная Зона',
  factionId: 'industrial_clan',
  description:
    'В Промышленной Зоне началось восстание машин. Кто-то внедрил в системы управления вирус, превращающий турели и големов в безжалостных убийц. Игрок должен расследовать происхождение вируса и остановить его — прежде чем он достигнет остальных Царств. Трейсинг приводит к шокирующему открытию: вирус создан Неоновым Картелем.',
  levelRange: [50, 60],
  quests: [
    {
      id: 'act6_main_placeholder',
      title: 'Восстание Големов',
      description: '[Акт VI — в разработке] Остановите восстание машин в Промышленной Зоне.',
      type: 'main',
      levelRequired: 50,
      worldId: 'industrial',
      objectives: [makeObjective('a6m1', 'explore', 'industrial_zone', 'Войдите в Промышленную Зону', 1)],
      rewards: makeReward(12000, 6000, [], 'void'),
    },
  ],
  boss: {
    name: 'Омега-Голем',
    title: 'Вершитель Механического Суда',
    description: '[Акт VI — в разработке] Гигантский голем, объединивший сознание всех восставших машин.',
    health: 100000,
    abilities: ['[В разработке]'],
    dialogues: {
      intro: [{ speaker: 'Омега-Голем', text: '[Акт VI — в разработке]', emotion: 'neutral' }],
      phase2: [{ speaker: 'Омега-Голем', text: '[Акт VI — в разработке]', emotion: 'neutral' }],
      defeat: [{ speaker: 'Омега-Голем', text: '[Акт VI — в разработке]', emotion: 'neutral' }],
    },
  },
  reward: makeReward(12000, 6000, ['portal_key_void'], 'void'),
  epilogue: '[Акт VI — в разработке]',
};

// ═══════════════════════════════════════════════
// АКТ VII: Финальный Взрыв (The Void / Пустотные)
// ═══════════════════════════════════════════════

const ACT_VII: StoryAct = {
  actNumber: 7,
  title: 'Финальный Взрыв',
  subtitle: 'Каждый взрыв имеет цену. Этот — всё.',
  worldId: 'void',
  worldName: 'Расколотая Пустота',
  factionId: 'the_voidborn',
  description:
    'Все нити сходятся в Расколотой Пустоте. Игрок узнаёт полную правду: Марка Искры — не дар, а ключ. Ключ к Семи Засовам. Кто владеет носителем Марки — тот может либо укрепить Засовы навеки... либо открыть их и выпустить Владыку Пустоты. Владыка предлагает сделку: его свобода в обмен на пересоздание мира без Теней. Игрок стоит перед выбором, определяющим судьбу всего сущего.',
  levelRange: [60, 70],
  quests: [
    {
      id: 'act7_main_placeholder',
      title: 'Семь Засовов',
      description: '[Акт VII — в разработке] Пройдите через Расколотую Пустоту, достигните центра Семи Засовов и сделайте финальный выбор.',
      type: 'main',
      levelRequired: 60,
      worldId: 'void',
      objectives: [makeObjective('a7m1', 'explore', 'the_void', 'Войдите в Расколотую Пустоту', 1)],
      rewards: makeReward(20000, 10000, ['legendary_set', 'ending_choice_token']),
    },
  ],
  boss: {
    name: 'Владыка Пустоты',
    title: 'Он-Кого-Не-Называют',
    description: '[Акт VII — в разработке] Верховное существо Пустоты, запертое за Семью Засовами 485 лет.',
    health: 200000,
    abilities: ['[В разработке]'],
    dialogues: {
      intro: [{ speaker: 'Владыка Пустоты', text: '[Акт VII — в разработке]', emotion: 'neutral' }],
      phase2: [{ speaker: 'Владыка Пустоты', text: '[Акт VII — в разработке]', emotion: 'neutral' }],
      defeat: [{ speaker: 'Владыка Пустоты', text: '[Акт VII — в разработке]', emotion: 'neutral' }],
    },
  },
  reward: makeReward(20000, 10000, ['legendary_set', 'ending_choice_token']),
  epilogue:
    '[Акт VII — в разработке] Эпилог зависит от выбора игрока: Запечатать Владыка, Освободить его, или найти третий путь.',
};

// ═══════════════════════════════════════════════
// Экспорт
// ═══════════════════════════════════════════════

export const STORY_ACTS: StoryAct[] = [ACT_I, ACT_II, ACT_III, ACT_IV, ACT_V, ACT_VI, ACT_VII];

export const STORY_ACTS_MAP: Record<number, StoryAct> = {
  1: ACT_I,
  2: ACT_II,
  3: ACT_III,
  4: ACT_IV,
  5: ACT_V,
  6: ACT_VI,
  7: ACT_VII,
};

/** Получить акт по номеру */
export function getAct(actNumber: number): StoryAct | undefined {
  return STORY_ACTS_MAP[actNumber];
}

/** Получить текущий акт игрока по уровню */
export function getActForLevel(level: number): StoryAct {
  if (level >= 60) return ACT_VII;
  if (level >= 50) return ACT_VI;
  if (level >= 40) return ACT_V;
  if (level >= 30) return ACT_IV;
  if (level >= 20) return ACT_III;
  if (level >= 10) return ACT_II;
  return ACT_I;
}

/** Получить все квесты акт определённого типа */
export function getQuestsByType(actNumber: number, type: QuestType): Quest[] {
  const act = getAct(actNumber);
  if (!act) return [];
  return act.quests.filter((q) => q.type === type);
}

/** Получить прогресс главного квеста */
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
