# BomberMeme World — Архитектура MMO Режима

## Видение

BomberMeme World — это открытый MMO-мир в 2D-изометрии (top-down), вдохновленный Albion Online (зоны, экономика, PvP) и Elden Ring (глубокий лор, свобода билдов, уникальные скиллы).

Ключевые принципы:
- **Свободное движение** WASD + мышь (не grid-based как арена)
- **Открытый мир** из чанков (chunk-based, как Albion Online)
- **100 уникальных персонажей** с собственными скиллами и лором
- **7 фракций/миров** с уникальными биомами
- **Кооператив 2-4 игрока** на старте, закладка под полноценную MMO
- **Экономика** — крафт, торговля, аукцион, гильдейские территории
- **PvP** — зональная система (синие/желтые/красные зоны как в Albion)

---

## Физическая структура мира

### Chunk-based система

```
Мир = сетка чанков 256x256 тайлов каждый

Пример: Мир "Grasslands" = 20x20 чанков = 5120x5120 тайлов
        [0,0] [1,0] [2,0] ... [19,0]
        [0,1] [1,1] [2,1] ... [19,1]
        ...
        [0,19][1,19][2,19]... [19,19]

Клиент грузит чанки в радиусе 2 от игрока (5x5 = 25 чанков)
Сервер хранит состояние всех чанков (Neon Postgres + Redis для hot data)
```

### Тайловая система

| Слой | Назначение | Пример |
|------|-----------|--------|
| Layer 0 (Ground) | Пол/земля | floor_grass.webp, floor_neon.webp |
| Layer 1 (Objects) | Разрушаемые объекты | soft blocks, деревья, ящики |
| Layer 2 (Entities) | Динамические сущности | игроки, мобы, бомбы, предметы |
| Layer 3 (Overlay) | Эффекты, тени, погода | взрывы, туман, дождь |

### 7 Миров (Фракций)

| ID | Название | Тема | Floor-текстура | Фракция |
|----|----------|------|---------------|---------|
| neon | Неоновый Картель | Киберпанк-город | floor_neon.webp | Хакеры, техно-маги |
| chappie | Железная Церковь | Завод/Киборги | floor_chappie.webp | Киборги, танки |
| grass | Дикий Круг | Лес/Природа | floor_grass.webp | Друиды, природа |
| grate | Решетчатый Синдикат | Тюрьма/Подвал | floor_grate.webp | Торговцы, экономисты |
| industrial | Промышленный Клан | Фабрика | floor_industrial.webp | Крафтеры, инженеры |
| sand | Пески Вечности | Пустыня | floor_sand.webp | Наемники, скорость |
| void | Пустота | Космос/Бездна | floor_void.webp | Темная магия, боссы |

---

## Entity-Component-System (ECS)

### Core Entities

```typescript
interface Entity {
  id: string;                    // UUID
  type: 'player' | 'mob' | 'bomb' | 'item' | 'projectile' | 'resource';
  position: Vec2;                // Пиксельные координаты (float)
  chunkId: string;               // "world_x_y" для быстрого поиска
  components: Component[];
}
```

### Key Components

```typescript
// --- Рендеринг ---
interface SpriteComponent {
  type: 'sprite';
  spriteId: string;              // "skin_0", "bomb_basic", etc.
  animation: string;             // "idle", "walk", "hurt", "attack"
  frame: number;                 // Текущий кадр анимации
  direction: 'up' | 'down' | 'left' | 'right';  // Для directional спрайтов
  layer: 0 | 1 | 2 | 3;          // Тайловый слой
}

// --- Физика и коллизии ---
interface PhysicsComponent {
  type: 'physics';
  velocity: Vec2;
  speed: number;                 // Базовая скорость (пикселей/сек)
  radius: number;                // Хитбокс (круг)
  solid: boolean;                // Блокирует ли проход другим
}

// --- Боевая система ---
interface CombatComponent {
  type: 'combat';
  hp: number;
  maxHp: number;
  armor: number;
  damage: number;
  uniqueSkill: Skill;            // Уникальный скилл персонажа
  skills: Skill[];               // Обычные скиллы
  team: 'player' | 'enemy' | 'neutral';
  isAlive: boolean;
}

// --- Ввод ---
interface InputComponent {
  type: 'input';
  moveDir: Vec2;                 // WASD нормализованный вектор
  aimPos: Vec2;                  // Позиция курсора мыши (world coords)
  isAttacking: boolean;          // LMB зажата
  isUsingSkill: boolean;         // RMB зажата / клавиша скилла
  targetEntityId?: string;       // Наведение на сущность
}

// --- RPG ---
interface RPGComponent {
  type: 'rpg';
  level: number;
  xp: number;
  attributes: {
    str: number;                 // Сила — урон бомб, вес инвентаря
    dex: number;                 // Ловкость — скорость передвижения, каст скиллов
    int: number;                 // Интеллект — мана, магический урон
    vit: number;                 // Выносливость — HP, реген
    luck: number;                // Удача — крит, дроп, крафт
  };
  talentPoints: number;
  faction: FactionId;            // Принадлежность к фракции
}

// --- Инвентарь ---
interface InventoryComponent {
  type: 'inventory';
  maxSlots: number;
  items: Item[];
  bombs: BombType[];             // Доступные типы бомб
  currency: number;              // Монеты
}
```

### Systems (обрабатывают entities с нужными components)

| System | Компоненты | Что делит |
|--------|-----------|-----------|
| MovementSystem | physics + input | WASD движение с коллизиями |
| CameraSystem | sprite (player) | Следование камеры за игроком |
| RenderSystem | sprite | Отрисовка спрайтов по слоям |
| CombatSystem | combat + input | Урон, смерть, скиллы |
| BombSystem | (special) | Таймеры бомб, взрывы, цепные реакции |
| SkillSystem | combat + input | Активация скиллов, кулдауны |
| MobAISystem | combat + physics (mobs) | Поведение врагов |
| ChunkSystem | all | Загрузка/выгрузка чанков |
| AnimationSystem | sprite | Обновление кадров анимации |
| ItemDropSystem | — | Спавн лута, подбор предметов |
| ProgressionSystem | rpg | XP, leveling, таланты |
| NetworkingSystem | all | Синхронизация состояния (кооп) |

---

## Управление (Input)

```
WASD              — движение (360°, не 4 направления)
Мышь (курсор)     — направление взгляда/прицел
ЛКМ               — бросок базовой бомбы в направлении курсора
Зажать ЛКМ        — заряд броска (дальше = сильнее)
ПКМ               — уникальный скилл персонажа
1-5               — слоты скиллов/бомб
E                 — подбор предметов / взаимодействие
I                 — инвентарь
M                 — карта мира
Tab               — список игроков поблизости
Enter             — чат
Shift             — бег (расходует стамину)
Space             — рывок/уворот
```

---

## Боевая система

### Бомбы (основное оружие)

```typescript
interface BombType {
  id: string;
  name: string;
  damage: number;
  radius: number;           // Взрывной радиус в пикселях
  fuseTime: number;         // Мс до взрыва
  throwDistance: number;    // Макс дистанция броска
  trajectory: 'arc' | 'straight' | 'bounce';
  special?: string;         // Цепной взрыв, заморозка, отравление, etc.
}

// Базовые типы
- Basic Bomb:     стандартная бомба из арены
- Sticky Bomb:    прилипает к первой поверхности
- Bouncing Bomb:  отскакивает от стен
- Remote Bomb:    взрывается по нажатию клавиши
- Cluster Bomb:   разлетается на мелкие
```

### Уникальные скиллы (100 штук — по одному на персонажа)

Примеры:
```typescript
// skin_0 — "Цепной Мастер"
{ id: 'chain_reaction', name: 'Цепная реакция',
  description: 'Следующая бомба взорвет все бомбы в радиусе без таймера',
  cooldown: 8000, manaCost: 30, castTime: 0 }

// skin_42 — "Песочный Клон"
{ id: 'sand_clone', name: 'Песочный клон',
  description: 'Создает иллюзию, отвлекающую врагов на 5 сек',
  cooldown: 15000, manaCost: 40, castTime: 500 }

// skin_77 — "Хак Реальности"
{ id: 'reality_hack', name: 'Хак реальности',
  description: 'На 3 сек мир становится матрицей — скорость x2, враги замедлены',
  cooldown: 30000, manaCost: 60, castTime: 1000 }
```

---

## 7 Фракций (Распределение 100 персонажей)

| Фракция | Мир | Концепт | Примерные скины | Количество |
|---------|-----|---------|-----------------|------------|
| **Неоновый Картель** | neon | Хакеры, техно-маги, скрытность | skin_0-13 | 14 |
| **Железная Церковь** | chappie | Киборги, танки, культ машин | skin_14-27 | 14 |
| **Дикий Круг** | grass | Друиды, природа, призыв | skin_28-41 | 14 |
| **Решетчатый Синдикат** | grate | Торговцы, петли, обман | skin_42-55 | 14 |
| **Промышленный Клан** | industrial | Крафтеры, мины, турели | skin_56-69 | 14 |
| **Пески Вечности** | sand | Наемники, скорость, песок | skin_70-83 | 14 |
| **Пустотные** | void | Темная магия, боссы, хаос | skin_84-99 | 16 |

---

## Прогрессия (как в Elden Ring)

```
Не жесткие классы! Свободная прокачка:

Уровень 1:   Талант-дерево открывается
Каждый уровень: +1 очко в любой атрибут (STR/DEX/INT/VIT/LUCK)
Каждые 5 уровней: +1 очко таланта

Таланты (общие для всех):
├── Бомбист:      +радиус бомб, +типы бомб
├── Боец:         +HP, +броня, +реген
├── Маг:          +мана, -кулдауны, +маг урон
├── Скрытность:   +скорость, +крит, +уклонение
└── Крафтер:      +эффективность крафта, +слоты

Уникальный скилл персонажа — нельзя изменить (это его душа)
```

---

## PvP система (зональная, как Albion)

```
Синие зоны    — безопасные, PvP запрещен, новички
Желтые зоны  — PvP возможен, но с наказанием за убийство (красный статус)
Красные зоны — полный PvP, высокий дроп, гильдейские войны
Черные зоны  — данжи/рейды, PvE + PvP одновременно
```

---

## Экономика (Albion-style)

```
- Все предметы создаются игроками (крафт)
- Ресурсы добываются в мире (руда, трава, эссенция)
- Аукционная площадка в каждом городе
- Гильдии захватывают территории с ресурсами
- Налоги с торговли идут владельцам территорий
```

---

## Технический стек

| Компонент | Технология |
|-----------|-----------|
| Клиент | Vite + Canvas 2D (существующий) |
| Сервер | uWebSockets.js (существующий) |
| База данных | Neon Postgres (мир, персонажи, инвентари) |
| Hot cache | Redis или in-memory (чанки, онлайн игроки) |
| ECS | Собственная реализация (новое) |
| Карты | Tiled (.tmx) или кастомный JSON формат |
| Ассеты | Существующие 100 скинов + floor-текстуры (переиспользуем) |

---

## Файловая структура (новые файлы)

```
apps/client/src/
├── arena/                    # СУЩЕСТВУЮЩИЙ PvP (НЕ ТРОГАТЬ)
└── campaign/
    ├── engine/
    │   ├── ECS.ts            # Entity, Component, System базовые классы
    │   ├── ChunkManager.ts   # Загрузка/выгрузка чанков
    │   ├── Camera.ts         # Viewport camera
    │   ├── InputManager.ts   # WASD + мышь
    │   ├── Renderer.ts       # Canvas 2D рендер по слоям
    │   └── CollisionSystem.ts # Пиксельная коллизия
    ├── world/
    │   ├── Biome.ts          # Биомы (7 типов)
    │   ├── ChunkData.ts      # Данные чанка (тайлы, объекты)
    │   ├── WorldGenerator.ts # Генерация/загрузка миров
    │   └── MapLoader.ts      # Загрузка .tmx или JSON
    ├── entities/
    │   ├── Player.ts         # Локальный игрок
    │   ├── RemotePlayer.ts   # Другие игроки (кооп)
    │   ├── Mob.ts            # AI враги
    │   ├── BombEntity.ts     # Бомба в мире
    │   └── ItemEntity.ts     # Предмет на земле
    ├── combat/
    │   ├── CombatSystem.ts   # Урон, смерть, комбо
    │   ├── BombSystem.ts     # Броски, таймеры, взрывы
    │   ├── SkillSystem.ts    # Уникальные скиллы, кулдауны
    │   └── SkillRegistry.ts  # 100 уникальных скиллов
    ├── rpg/
    │   ├── Attributes.ts     # STR/DEX/INT/VIT/LUCK
    │   ├── TalentTree.ts     # Дерево талантов
    │   ├── Progression.ts    # XP, leveling
    │   └── Inventory.ts      # Инвентарь + слоты
    ├── network/
    │   ├── CampaignClient.ts # WebSocket клиент для мира
    │   ├── EntitySync.ts     # Синхронизация сущностей
    │   └── CoopManager.ts    # Кооператив (2-4 игрока)
    ├── ui/
    │   ├── HUD.ts            # ХП, мана, скиллы, миникарта
    │   ├── InventoryUI.ts    # Окно инвентаря
    │   ├── SkillBar.ts       # Панель скиллов
    │   ├── MapUI.ts          # Карта мира
    │   └── DialogueUI.ts     # Диалоговое окно
    └── main.ts               # Точка входа (campaign mode)

apps/server/src/
├── arena/                    # СУЩЕСТВУЮЩИЙ (НЕ ТРОГАТЬ)
└── world/
    ├── WorldServer.ts        # Главный сервер мира
    ├── ChunkService.ts       # Хранение/выдача чанков
    ├── EntityService.ts      # Сущности в мире
    ├── PlayerService.ts      # Прогресс, инвентари
    ├── AuthService.ts        # Сессии, токены
    └── db/
        ├── schema.sql        # Таблицы мира
        └── migrations/       # Миграции

packages/shared/src/campaign/
    ├── types.ts              # Общие типы (Entity, Vec2, Chunk, etc.)
    ├── constants.ts          # Константы мира
    └── skills.ts             # 100 уникальных скиллов (data)
```

---

## Фазы разработки

### Фаза 1: "Пробуждение" (MVP)
- [ ] ECS движок (Agent 1)
- [ ] 1 мир (Grass) — 10x10 чанков (Agent 2)
- [ ] 3 стартовых персонажа (Agent 3)
- [ ] Боевая система: WASD + мышь + бомбы (Agent 5)
- [ ] Кооп 2-4 игрока (Agent 6)
- [ ] Главный квест + 3 side-квеста (Agent 4)
- [ ] Persistence (Neon) (Agent 6)

### Фаза 2: "Фракции"
- [ ] Все 7 миров с порталами
- [ ] 30 персонажей с уникальными скиллами
- [ ] PvP зоны
- [ ] Торговля между игроками

### Фаза 3: "Экономика"
- [ ] Крафтинг
- [ ] Аукцион
- [ ] Ресурсные территории
- [ ] 60 персонажей

### Фаза 4: "Полная MMO"
- [ ] 100 персонажей
- [ ] Глубокий лор через окружение
- [ ] Гильдейские войны
- [ ] Рейды/данжи

---

## Критические правила (НЕ НАРУШАТЬ)

1. **Существующий PvP код в `apps/client/src/arena/` и `apps/server/src/arena/` НЕ ИЗМЕНЯТЬ**
2. **Все новые файлы только в `campaign/` и `world/` директориях**
3. **packages/shared — только добавлять новые типы, не ломать старые**
4. **Константы арены (CLIENT_GRID_SIZE, GRID_WIDTH и т.д.) — не менять**
5. **Существующие спрайты переиспользовать, не дублировать**
6. **Canvas 2D — не подключать Phaser, Three.js и т.д.**

---

*Документ создан: 2026-06-29*
*Версия: 1.0*
*Ветка: feature/bombermeme-world*
