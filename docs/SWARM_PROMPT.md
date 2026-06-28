# Swarm Prompt: BomberMeme World — Phase 1 "Пробуждение"

> **ИНСТРУКЦИЯ ДЛЯ ЗАПУСКА**: Скопируйте содержимое ниже и вставьте в **Кими → Режим Swarm**. Не забудьте прикрепить ссылку на репозиторий.

---

## Основная задача

Разработать **BomberMeme World** — новый MMO-режим для существующей игры BomberMeme. Это открытый мир с自由ным передвижением (WASD + мышь), 100 уникальными персонажами, 7 фракциями/мирами, кооперативом и закладкой под полноценную MMO.

## Репозиторий

- **URL**: `https://github.com/kisa134/bomber-game`
- **Ветка**: `feature/bombermeme-world`
- **Архитектура**: `docs/BOMBERMEME_WORLD_ARCH.md` (обязательно прочитать перед началом работы!)

## Критические правила

```
1. Существующий PvP код в apps/client/src/arena/ и apps/server/src/arena/ — НЕ ТРОГАТЬ
2. Все новые файлы ТОЛЬКО в:
   - apps/client/src/campaign/
   - apps/server/src/world/
   - packages/shared/src/campaign/
3. packages/shared — только добавлять новые типы, не ломать существующие
4. Константы арены (CLIENT_GRID_SIZE, GRID_WIDTH и т.д.) — не менять
5. Существующие спрайты (100 скинов, floor-текстуры, блоки) — переиспользовать
6. Canvas 2D — не подключать Phaser, Three.js, Pixi или другие фреймворки
7. Каждый агент работает в СВОЕЙ папке, конфликты между агентами — через shared/types
```

## Текущие ассеты (уже есть в репозитории)

```
100 персонажей: public/sprites/skin_0.webp ... skin_99.webp
  + анимации: skin_X_down_[0-2].webp, skin_X_up_[0-2].webp, skin_X_side_[0-2].webp
  + состояния: skin_X_hurt.webp, skin_X_victory.webp, skin_X_place_bomb.webp

7 floor-текстур: floor_neon.webp, floor_chappie.webp, floor_grass.webp,
                 floor_grate.webp, floor_industrial.webp, floor_sand.webp, floor_void.webp

Hard blocks: hard.webp, hard_blood.webp, hard_dmg_[1-5].webp, hard_gold.webp,
             hard_industrial.webp, hard_obsidian.webp, hard_sand.webp, hard_stone.webp

Soft blocks: soft.webp, soft_ammo.webp, soft_blood.webp, soft_chappie.webp,
             soft_cyberglass.webp, soft_meme.webp, soft_sand.webp, soft_tech.webp

Powerups: powerup_bomb.webp, powerup_fire.webp, powerup_health.webp,
          powerup_kick.webp, powerup_speed.webp, powerup_wall.webp
```

## Существующий стек

- Клиент: Vite + Canvas 2D + TypeScript (apps/client/)
- Сервер: uWebSockets.js + Node (apps/server/)
- Shared: TypeScript типы (packages/shared/)
- Монорепо: pnpm workspace

---

## МОДУЛЬ 1: ECS Engine Core (Agent 1)

**Приоритет**: КРИТИЧЕСКИЙ (блокирует всех остальных)
**Папка**: `apps/client/src/campaign/engine/`

### Задача
Создать Entity-Component-System движок с free-movement, чанками и камерой.

### Что создать

```typescript
// ECS.ts — базовые классы
class Entity {
  id: string;
  components: Map<string, Component>;
  addComponent(c: Component): void;
  getComponent<T>(name: string): T | undefined;
  removeComponent(name: string): void;
}

abstract class Component {
  readonly name: string;
}

abstract class System {
  readonly name: string;
  abstract update(entities: Entity[], dt: number): void;
  abstract componentsRequired: string[];
}

class World {
  entities: Map<string, Entity>;
  systems: System[];
  addEntity(e: Entity): void;
  removeEntity(id: string): void;
  addSystem(s: System): void;
  update(dt: number): void;
  getEntitiesWith(...components: string[]): Entity[];
}
```

```typescript
// ChunkManager.ts
// - Чанк = 256x256 тайлов
// - Загрузка чанков в радиусе 2 от игрока
// - Выгрузка чанков при удалении
// - Хранение: Map<string, ChunkData> где ключ = "worldId_chunkX_chunkY"

interface ChunkData {
  x: number;
  y: number;
  worldId: string;
  tiles: number[][]; // Layer 0 (ground) tile indices
  objects: GameObject[]; // Layer 1 (разрушаемые объекты)
  entities: string[]; // ID сущностей в чанке
}
```

```typescript
// Camera.ts
// - Следует за сущностью-игроком (плавно, с lerp)
// - Viewport: по размеру canvas
// - World-to-screen и screen-to-world координаты
// - Culling: возвращает видимую область (какие чанки/сущности видны)

class Camera {
  position: Vec2; // Центр камеры в world coords
  viewport: { width: number; height: number };
  zoom: number; // default 1.0
  follow(target: Entity, dt: number, lerp: number): void;
  worldToScreen(worldPos: Vec2): Vec2;
  screenToWorld(screenPos: Vec2): Vec2;
  getVisibleChunks(): { xStart: number; xEnd: number; yStart: number; yEnd: number };
  getVisibleArea(): { x: number; y: number; width: number; height: number };
}
```

```typescript
// InputManager.ts
// - WASD: вектор движения (normalized)
// - Мышь: позиция в world coords, aim direction
// - ЛКМ: бросок бомбы (заряд при удержании)
// - ПКМ: скилл
// - Клавиши 1-5: слоты скиллов
// - E: взаимодействие

interface InputState {
  moveDir: Vec2;           // (-1..1, -1..1) normalized
  aimWorldPos: Vec2;       // Позиция курсора в мировых координатах
  isAttacking: boolean;    // ЛКМ
  isCharging: boolean;     // ЛКМ удерживается (для заряда броска)
  chargeTime: number;      // Мс удержания ЛКМ
  isUsingSkill: boolean;   // ПКМ
  skillSlot: number;       // 1-5 или 0 если не нажато
  interact: boolean;       // E (one-shot)
  isRunning: boolean;      // Shift
  isDodging: boolean;      // Space (one-shot)
}
```

```typescript
// Renderer.ts
// - Рендерит видимые чанки
// - Слои: ground → objects → entities → effects
// - Sprite animation (directional: up/down/side с 3 кадрами)
// - Переиспользовать существующие спрайты из public/sprites/

class CampaignRenderer {
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  render(world: World, chunkManager: ChunkManager, camera: Camera): void;
  private renderLayer(tiles: number[][], layer: number): void;
  private renderEntities(entities: Entity[]): void;
  private renderEffects(): void;
  private drawSprite(spriteId: string, pos: Vec2, frame: number, direction: string): void;
}
```

```typescript
// CollisionSystem.ts
// - Пиксельная коллизия (круги для сущностей, AABB для тайлов)
// - QuadTree или spatial hash для оптимизации
// - Layer-based: entities коллайдят с solid тайлами и другими solid entities

class CollisionSystem extends System {
  checkEntityTerrain(entity: Entity, chunk: ChunkData): CollisionResult | null;
  checkEntityEntity(a: Entity, b: Entity): CollisionResult | null;
  resolveCollision(entity: Entity, result: CollisionResult): void;
}

interface CollisionResult {
  penetration: Vec2;
  normal: Vec2;
}
```

### Интерфейс для других агентов

```typescript
// Экспортируемые типы (добавить в packages/shared/src/campaign/types.ts)
export interface Vec2 { x: number; y: number; }
export interface GameObject { id: string; type: string; x: number; y: number; hp: number; }
export { Entity, Component, System, World } from './ECS';
export { ChunkData, ChunkManager } from './ChunkManager';
export { Camera } from './Camera';
export { InputState, InputManager } from './InputManager';
export { CampaignRenderer } from './Renderer';
export { CollisionSystem } from './CollisionSystem';
```

### Acceptance Criteria
- [ ] Entity добавляется/удаляется, компоненты работают
- [ ] System получает только entities с нужными компонентами
- [ ] Чанки загружаются в радиусе 2, выгружаются при удалении
- [ ] Камера следует за сущностью с плавностью
- [ ] WASD двигает entity, мышь дает aim direction
- [ ] Коллизия с solid тайлами работает (не проходим сквозь стены)
- [ ] Рендерер рисует спрайты с анимацией (3 кадра walk cycle)
- [ ] Видны только entities в радиусе камеры (culling)

---

## МОДУЛЬ 2: World Builder (Agent 2)

**Приоритет**: ВЫСОКИЙ (зависит от Agent 1 — ChunkManager интерфейса)
**Папка**: `apps/client/src/campaign/world/` + `packages/shared/src/campaign/`

### Задача
Создать систему миров из 7 биомов. Для Phase 1 — только мир Grass (остальные 6 подготовить).

### Что создать

```typescript
// Biome.ts — 7 биомов
enum BiomeType {
  NEON = 'neon',
  CHAPPIE = 'chappie',
  GRASS = 'grass',
  GRATE = 'grate',
  INDUSTRIAL = 'industrial',
  SAND = 'sand',
  VOID = 'void',
}

interface Biome {
  type: BiomeType;
  name: string;
  floorTexture: string;      // "floor_grass.webp"
  hardBlockTexture: string;  // "hard_stone.webp"
  softBlockTexture: string;  // "soft_*.webp"
  objects: string[];         // Дополнительные объекты биома
  music: string;
  ambientColor: string;      // Цветовая гамма
}

const BIOMES: Record<BiomeType, Biome> = { ... };
```

```typescript
// ChunkData.ts — данные чанка
interface TileData {
  tileId: number;      // Индекс в tileset
  solid: boolean;      // Блокирует проход?
  breakable: boolean;  // Можно разрушить?
  hp?: number;         // HP для breakable
  dropTable?: string[]; // Что выпадает при разрушении
}

interface ChunkData {
  x: number;
  y: number;
  biome: BiomeType;
  ground: number[][];   // 256x256, tile indices
  objects: Map<string, TileData>; // Ключ: "x,y" → объект
  entities: string[];   // Спавн-точки мобов/NPC
}
```

```typescript
// WorldGenerator.ts — генерация или загрузка
// Два режима:
// 1. Procedural generation (noise-based) для открытых зон
// 2. Static JSON загрузка для hand-crafted городов/данжей

class WorldGenerator {
  generateChunk(worldId: string, chunkX: number, chunkY: number, biome: BiomeType): ChunkData;
  loadChunkFromJSON(worldId: string, chunkX: number, chunkY: number): ChunkData;
  generateWorld(worldId: string, sizeX: number, sizeY: number, biome: BiomeType): void;
}

// Phase 1: Grass мир = 10x10 чанков (2560x2560 тайлов)
// Размер тайла: 64x64 пикселя (как CLIENT_GRID_SIZE)
```

```typescript
// MapLoader.ts
// - Загружает .json карты (формат Tiled-compatible или кастомный)
// - Конвертирует в ChunkData для ChunkManager
// - Формат хранения чанков: JSON файлы или в Neon DB

class MapLoader {
  loadFromTiled(path: string): ChunkData[];
  loadFromJSON(path: string): ChunkData[];
  saveChunk(chunk: ChunkData): void;
}
```

```typescript
// Данные миров (packages/shared/src/campaign/worlds.ts)
export const WORLDS = {
  grasslands: {
    id: 'grasslands',
    name: 'Дикие Земли',
    biome: BiomeType.GRASS,
    size: { x: 10, y: 10 }, // чанков
    spawnChunk: { x: 5, y: 5 },
    portals: [
      { to: 'neon_city', at: { x: 9, y: 5 }, requiredLevel: 5 },
      { to: 'sand_desert', at: { x: 0, y: 5 }, requiredLevel: 3 },
    ],
    zones: [
      { x: 0, y: 0, w: 10, h: 3, type: 'safe', name: 'Зеленая Долина' },
      { x: 0, y: 3, w: 10, h: 4, type: 'pvp', name: 'Кровавые Луга' },
      { x: 0, y: 7, w: 10, h: 3, type: 'dungeon', name: 'Логово Древних' },
    ],
  },
  // Остальные 6 миров — заглушки для Phase 1
  neon_city: { id: 'neon_city', name: 'Неоновый Город', biome: BiomeType.NEON, locked: true },
  chappie_factory: { id: 'chappie_factory', name: 'Заводы Храма', biome: BiomeType.CHAPPIE, locked: true },
  grate_prison: { id: 'grate_prison', name: 'Решетка', biome: BiomeType.GRATE, locked: true },
  industrial_zone: { id: 'industrial_zone', name: 'Промзона', biome: BiomeType.INDUSTRIAL, locked: true },
  sand_desert: { id: 'sand_desert', name: 'Пески Вечности', biome: BiomeType.SAND, locked: true },
  void_abyss: { id: 'void_abyss', name: 'Пропасть', biome: BiomeType.VOID, locked: true },
};
```

### Acceptance Criteria
- [ ] 7 биомов определены с текстурами из существующих ассетов
- [ ] Мир Grass: 10x10 чанков, procedural generation работает
- [ ] Solid тайлы блокируют движение (коллизия с движком Agent 1)
- [ ] Breakable объекты разрушаются и спавнят лут
- [ ] Порталы между мирами (заглушки для 6 других миров)
- [ ] Зоны: safe, pvp, dungeon (разные правила)
- [ ] ChunkData сериализуется/десериализуется в JSON

---

## МОДУЛЬ 3: Character RPG System (Agent 3)

**Приоритет**: ВЫСОКИЙ
**Папка**: `apps/client/src/campaign/entities/`, `apps/client/src/campaign/rpg/`

### Задача
Создать систему персонажей: 3 для Phase 1, архетипы + уникальные скиллы, прогрессия.

### Что создать

```typescript
// Hero.ts — игровой персонаж
class Hero extends Entity {
  constructor(heroId: string, skinId: number) {
    // Добавить компоненты: Sprite, Physics, Combat, RPG, Inventory
  }
  
  levelUp(): void;
  allocateAttribute(attr: 'str' | 'dex' | 'int' | 'vit' | 'luck'): void;
  learnTalent(talentId: string): void;
  equipBomb(bombType: BombType): void;
  getEffectiveStats(): { damage, speed, maxHp, maxMana, critChance };
}
```

```typescript
// HeroRegistry.ts — 100 персонажей (Phase 1: первые 3)
// Фракции: каждая фракция = 14-16 персонажей

interface HeroData {
  id: string;           // "hero_0"
  skinId: number;       // 0 — соответствует skin_0.webp
  name: string;
  faction: FactionId;   // "wild_circle", "neon_cartel", etc.
  uniqueSkill: Skill;
  baseAttributes: { str, dex, int, vit, luck };
  description: string;  // Краткая история
}

// Phase 1: 3 персонажа (по одному из разных фракций)
const STARTING_HEROES: HeroData[] = [
  {
    id: 'hero_0', skinId: 0, name: 'Зеро',
    faction: 'neon_cartel',
    uniqueSkill: {
      id: 'chain_reaction', name: 'Цепная Реакция',
      description: 'Следующая бомба мгновенно взрывает все бомбы в радиусе 200px',
      cooldown: 8000, manaCost: 30, castTime: 0,
      icon: 'skill_chain.png',
    },
    baseAttributes: { str: 8, dex: 10, int: 12, vit: 7, luck: 8 },
    description: 'Бывший корпоративный хакер, нашел способ "взламывать" реальность...',
  },
  {
    id: 'hero_28', skinId: 28, name: 'Вайлд',
    faction: 'wild_circle',
    uniqueSkill: {
      id: 'nature_wrath', name: 'Гнев Природы',
      description: 'Призывает 3 терновых ловушки вокруг себя',
      cooldown: 12000, manaCost: 40, castTime: 500,
      icon: 'skill_nature.png',
    },
    baseAttributes: { str: 10, dex: 8, int: 10, vit: 10, luck: 7 },
    description: 'Последний хранитель Зеленого Круга, говорит с духами леса...',
  },
  {
    id: 'hero_70', skinId: 70, name: 'Скорп',
    faction: 'sands_eternal',
    uniqueSkill: {
      id: 'sand_storm', name: 'Песчаная Буря',
      description: 'Создает песчаную бурю: враги в радиусе 300px замедлены на 50%, вы невидимы 3 сек',
      cooldown: 15000, manaCost: 45, castTime: 1000,
      icon: 'skill_sand.png',
    },
    baseAttributes: { str: 9, dex: 14, int: 6, vit: 8, luck: 10 },
    description: 'Наемник из Песков Вечности. Неизвестно, что скрывается под маской...',
  },
];

// Заглушки для остальных 97 (чтобы код мог ссылаться)
const ALL_HEROES: HeroData[] = [
  ...STARTING_HEROES,
  // 97 placeholder entries with faction assignments
  // Фракции распределены: neon(14), chappie(14), wild(14), grate(14), industrial(14), sand(14), void(16)
];
```

```typescript
// Attributes.ts
interface Attributes {
  str: number;   // Урон бомб, грузоподъемность
  dex: number;   // Скорость, скорость каста, уклонение
  int: number;   // Мана, магический урон, кулдаун-редукция
  vit: number;   // HP, регенерация, сопротивление урону
  luck: number;  // Крит-шанс, качество дропа, крафт
}

// Формулы (легко балансить)
function getMaxHp(vit: number, level: number): number { return 100 + vit * 10 + level * 5; }
function getMaxMana(int: number, level: number): number { return 50 + int * 8 + level * 3; }
function getMoveSpeed(dex: number): number { return 200 + dex * 5; } // px/sec
function getBombDamage(str: number, int: number): number { return 20 + str * 2 + int; }
function getCritChance(luck: number): number { return Math.min(5 + luck * 0.5, 50); } // %
```

```typescript
// TalentTree.ts
// Дерево талантов (общее для всех персонажей)

interface Talent {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  currentRank: number;
  requires?: string[];    // ID предшествующих талантов
  effect: TalentEffect;
}

// Ветки:
// - Bomber: +радиус, +типы бомб, +скорость взрыва
// - Warrior: +HP, +броня, +реген, +стамина
// - Mage: +мана, -кулдаун, +маг урон, + AoE
// - Shadow: +скорость, +крит, +уклон, +невидимость
// - Crafter: +крафт, +слоты, +эффективность ресурсов
```

```typescript
// Progression.ts
// XP система

const XP_TABLE: number[] = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, // 1-10
  4000, 5000, 6200, 7600, 9200, 11000, 13000, 15200, 17600, 20200, // 11-20
  // ... до 100
];

function getXpForLevel(level: number): number { return XP_TABLE[level] || 999999; }
function getLevelFromXp(xp: number): number { /* бинарный поиск по XP_TABLE */ }
```

```typescript
// Inventory.ts
interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'bomb';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stackable: boolean;
  maxStack: number;
  quantity: number;
  stats?: Partial<Attributes>;
  description: string;
}

class Inventory {
  slots: (Item | null)[];  // 30 слотов по умолчанию
  bombs: BombType[];       // Доступные типы бомб
  currency: number;
  addItem(item: Item): boolean;  // true если поместилось
  removeItem(slotIndex: number, quantity?: number): Item | null;
  equip(item: Item): void;
  canCraft(recipe: CraftRecipe): boolean;
}
```

### Acceptance Criteria
- [ ] 3 стартовых персонажа с уникальными скиллами
- [ ] Атрибуты (STR/DEX/INT/VIT/LUCK) влияют на статы
- [ ] XP → leveling работает (таблица до 100)
- [ ] Талант-дерево: 5 веток, таланты открываются очками
- [ ] Инвентарь: 30 слотов, стаки, бомбы отдельно
- [ ] 97 заглушек персонажей (можно ссылаться, не крашится)
- [ ] Каждый персонаж — faction alignment (7 фракций)

---

## МОДУЛЬ 4: Lore & Narrative (Agent 4)

**Приоритет**: СРЕДНИЙ (не блокирует код, но нужен для контента)
**Папка**: `docs/lore/`, `apps/client/src/campaign/lore/`

### Задача
Создать полный лор: история мира, 100 персонажей, 7 фракций, квесты.

### Что создать

```typescript
// Story.ts — главная сюжетная линия
// 7 Актов (по одному на мир)

interface StoryAct {
  actNumber: number;
  title: string;
  worldId: string;
  description: string;
  quests: Quest[];
  boss: BossData;
  reward: Reward;
}

// Акт 1: "Пробуждение" (Grasslands)
// - Игрок просыпается в Зеленой Долине без памяти
// - Находит первую бомбу (tutorial)
// - Встречает Вайлда (hero_28) — учит основам
// - Финал: победа над "Пожирателем Корней" (босс акта)
// Награда: открывается portal в Sand Desert

// Акт 2-7: заглушки с кратким описанием
```

```typescript
// Quests.ts
interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side' | 'daily' | 'faction';
  objectives: Objective[];
  rewards: Reward;
  prerequisites?: string[]; // ID квестов
  levelRequired: number;
}

interface Objective {
  type: 'kill' | 'collect' | 'explore' | 'talk' | 'craft' | 'survive';
  target: string;
  count: number;
  current: number;
  completed: boolean;
}

// Phase 1: 1 главный квест (Акт 1) + 3 side-квеста + 1 faction-квест
```

```typescript
// Characters.ts — лор 100 персонажей

interface CharacterLore {
  heroId: string;       // "hero_0"
  name: string;
  faction: FactionId;
  title: string;        // "Хакер Реальности"
  backstory: string;    // 2-3 абзаца
  personality: string;  // Характер, манера речи
  relationships: { characterId: string; relation: 'ally' | 'enemy' | 'neutral' | 'family' }[];
  secrets: string[];    // Тайны, которые игрок может раскрыть
  dialogues: Dialogue[];
}

// Phase 1: 3 полных персонажа (hero_0, hero_28, hero_70) + 97 заглушек
// Phase 2-4: по 24-25 персонажей за фазу
```

```markdown
# docs/lore/WORLD_HISTORY.md

## Эпоха Создания
Когда-то мир был единым. Бомба — не оружие, а дар Богов, позволявший творить.
Но Семь Фракции раскололи мир, каждая утверждая что знает истинное предназначение Бомбы...

## Семь Фракций
[Подробное описание каждой фракции, их философия, лидеры, территории]

## Таймлайн
- Год 0: Великий Взрыв — рождение мира
- Год 247: Раскол — разделение на фракции
- Год 512: Война Пустоты — первое появление Void
- Год 1000: Настоящее время — игрок просыпается
```

### Acceptance Criteria
- [ ] Полная история мира (2-3 страницы)
- [ ] 7 фракций с описаниями, философией, лидерами
- [ ] 3 полных персонажа с бэкстори, характером, связями, тайнами
- [ ] Главный квест Акта 1 с диалогами
- [ ] 3 side-квеста (убийство, сбор, исследование)
- [ ] 97 заглушек персонажей (имя, фракция, короткое описание)
- [ ] Таймлайн мира (0-1000 год)

---

## МОДУЛЬ 5: Combat & Skills (Agent 5)

**Приоритет**: ВЫСОКИЙ (зависит от Agent 1 — Entity/Component/System)
**Папка**: `apps/client/src/campaign/combat/`

### Задача
Создать боевую систему: mouse aim, броски бомб, 3 уникальных скилла, Enemy AI.

### Что создать

```typescript
// CombatSystem.ts
class CombatSystem extends System {
  componentsRequired = ['combat', 'physics'];
  
  update(entities: Entity[], dt: number): void {
    // - Обработка урона
    // - HP/смерть
    // - Криты (учитывая LUCK)
    // - Комбо-система
  }
  
  applyDamage(target: Entity, damage: number, source?: Entity): void;
  heal(target: Entity, amount: number): void;
  isCritical(luck: number): boolean;
}
```

```typescript
// BombSystem.ts
// Бомбы как сущности в ECS

interface BombData {
  ownerId: string;       // Кто кинул
  bombType: BombType;
  position: Vec2;        // Текущая позиция (для бросков)
  velocity: Vec2;        // Для физики броска
  plantedAt: number;     // Timestamp
  fuseTime: number;      // Мс до взрыва
  radius: number;        // Взрывной радиус
  damage: number;
  isStuck: boolean;      // Прилипла?
}

class BombSystem extends System {
  // - Создание бомбы (ЛКМ)
  - Заряд броска (чем дольше ЛКМ, тем дальше)
  // - Траектория броска (дуга)
  // - Таймер взрыва
  // - AoE урон по entities
  // - Разрушение breakable objects
  // - Цепные взрывы (если бомбы рядом)
  
  throwBomb(owner: Entity, direction: Vec2, charge: number): Entity;
  detonate(bombEntity: Entity): void;
  getEntitiesInRadius(center: Vec2, radius: number): Entity[];
}

// Типы бомб:
const BOMB_TYPES: Record<string, BombType> = {
  basic:    { id: 'basic',    damage: 20, radius: 100, fuseTime: 2000, throwDistance: 300, trajectory: 'arc' },
  sticky:   { id: 'sticky',   damage: 25, radius: 100, fuseTime: 3000, throwDistance: 250, trajectory: 'straight' },
  bounce:   { id: 'bounce',   damage: 15, radius: 120, fuseTime: 2500, throwDistance: 400, trajectory: 'bounce' },
  remote:   { id: 'remote',   damage: 30, radius: 150, fuseTime: 999999, throwDistance: 200, trajectory: 'straight' },
  cluster:  { id: 'cluster',  damage: 10, radius: 80,  fuseTime: 2000, throwDistance: 200, trajectory: 'arc', special: 'cluster' },
};
```

```typescript
// SkillSystem.ts
// Уникальные скиллы персонажей

interface Skill {
  id: string;
  name: string;
  description: string;
  cooldown: number;      // Мс
  manaCost: number;
  castTime: number;      // Мс (0 = мгновенно)
  duration?: number;     // Мс эффекта
  icon: string;
  effect: SkillEffect;
}

// Phase 1: 3 уникальных скилла
const UNIQUE_SKILLS: Record<string, Skill> = {
  chain_reaction: {
    id: 'chain_reaction', name: 'Цепная Реакция',
    description: 'Следующая бомба мгновенно взрывает все бомбы в радиусе 200px',
    cooldown: 8000, manaCost: 30, castTime: 0, icon: 'skill_chain.png',
    effect: { type: 'chain', radius: 200, multiplier: 1.5 },
  },
  nature_wrath: {
    id: 'nature_wrath', name: 'Гнев Природы',
    description: 'Призывает 3 терновых ловушки вокруг себя',
    cooldown: 12000, manaCost: 40, castTime: 500, icon: 'skill_nature.png',
    effect: { type: 'summon', entityType: 'thorn_trap', count: 3, radius: 150 },
  },
  sand_storm: {
    id: 'sand_storm', name: 'Песчаная Буря',
    description: 'Враги в радиусе 300px замедлены на 50%, вы невидимы 3 сек',
    cooldown: 15000, manaCost: 45, castTime: 1000, duration: 3000, icon: 'skill_sand.png',
    effect: { type: 'aura', radius: 300, slowEnemy: 0.5, stealthSelf: true },
  },
};

class SkillSystem extends System {
  useSkill(user: Entity, skill: Skill): boolean; // false если на кулдауне/нет маны
  updateCooldowns(dt: number): void;
  getCooldownRemaining(entityId: string, skillId: string): number;
}
```

```typescript
// EnemyAI.ts
// AI врагов

interface MobData {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  aggroRange: number;    // На каком расстоянии замечает игрока
  attackRange: number;   // На каком расстоянии атакует
  behavior: 'passive' | 'aggressive' | 'territorial' | 'fleeing';
  drops: DropTable;
}

class MobAISystem extends System {
  // States: IDLE → PATROL → CHASE → ATTACK → FLEE → DEAD
  
  update(entities: Entity[], dt: number): void {
    // - Патрулирование (точки маршрута)
    // - Обнаружение игрока (дистанция aggroRange)
    // - Преследование (путь к игроку)
    // - Атака (в радиусе attackRange)
    // - Уклонение от бомб (если видит летящую)
    // - Побег если HP < 20%
  }
}

// Phase 1: 5 типов мобов для Grasslands
const MOBS: Record<string, MobData> = {
  slime:      { id: 'slime',      name: 'Бомбовый Слайм',   hp: 30,  damage: 5,  speed: 80,  aggroRange: 200, attackRange: 50,  behavior: 'passive' },
  boar:       { id: 'boar',       name: 'Взрывной Кабан',   hp: 60,  damage: 12, speed: 120, aggroRange: 250, attackRange: 60,  behavior: 'territorial' },
  bandit:     { id: 'bandit',     name: 'Бомбический Бандит', hp: 50, damage: 15, speed: 100, aggroRange: 300, attackRange: 100, behavior: 'aggressive' },
  treant:     { id: 'treant',     name: 'Бомбодрево',       hp: 120, damage: 20, speed: 60,  aggroRange: 150, attackRange: 80,  behavior: 'territorial' },
  boss_root:  { id: 'boss_root',  name: 'Пожиратель Корней', hp: 500, damage: 30, speed: 40,  aggroRange: 400, attackRange: 150, behavior: 'aggressive' },
};
```

### Acceptance Criteria
- [ ] Броски бомб с зарядом (ЛКМ зажать → дальше)
- [ ] AoE взрыв с уроном по мобам/игрокам
- [ ] Цепные взрывы (бомбы рядом взрываются друг за другом)
- [ ] 5 типов мобов с AI (patrol → aggro → chase → attack)
- [ ] 3 уникальных скилла работают (кулдауны, мана, эффекты)
- [ ] Криты от LUCK
- [ ] Мобы уклоняются от бомб (видят летящую)
- [ ] Босс Акта 1 (Пожиратель Корней) с фазами

---

## МОДУЛЬ 6: Co-op & MMO Server (Agent 6)

**Приоритет**: ВЫСОКИЙ (зависит от Agent 1 — Entity/System)
**Папка**: `apps/server/src/world/`, `apps/client/src/campaign/network/`

### Задача
Создать серверную часть: авторитарный сервер, синхронизация сущностей, persistence, кооп 2-4 игрока.

### Что создать

```typescript
// WorldServer.ts
// Сервер мира (отдельный от arena сервера)

class WorldServer {
  // WebSocket сервер на отдельном порту (или /world path)
  // Авторитарная модель: сервер = истина, клиент = предсказание
  
  port: number; // 9001 (arena на 9000)
  tickRate: number; // 20Hz (50ms)
  
  onPlayerConnect(ws: WebSocket, token: string): PlayerSession;
  onPlayerDisconnect(session: PlayerSession): void;
  onPlayerInput(session: PlayerSession, input: InputState): void;
  
  gameLoop(): void {
    // 1. Применить inputs от всех игроков
    // 2. Обновить все systems (physics, combat, AI)
    // 3. Расчитать коллизии
    // 4. Отправить state delta всем клиентам
  }
}

// State synchronization: delta compression
// Отправляем ТОЛЬКО изменения (position, hp, new/removed entities)
// Полный state snapshot каждые 5 секунд (на случай рассинхрона)
```

```typescript
// EntitySync.ts
// Синхронизация сущностей между клиентом и сервером

interface EntitySnapshot {
  id: string;
  type: string;
  position: Vec2;
  velocity: Vec2;
  hp?: number;
  animation?: string;
  frame?: number;
  direction?: string;
}

interface WorldStateDelta {
  tick: number;
  updated: EntitySnapshot[];  // Изменившиеся entities
  removed: string[];          // ID удаленных
  added: EntitySnapshot[];    // Новые entities
}

class EntitySync {
  // Client-side prediction:
  // - Клиент мгновенно применяет свой input
  // - Сервер подтверждает (или корректирует)
  // - При рассинхроне: interpolate к серверному state
  
  // Server-authoritative:
  // - Сервер валидирует все движения/действия
  // - Анти-чит: проверка скорости, кулдаунов, дистанций
  
  sendDelta(session: PlayerSession, delta: WorldStateDelta): void;
  applyDelta(client: CampaignClient, delta: WorldStateDelta): void;
  reconcile(client: CampaignClient, serverState: WorldStateDelta): void;
}
```

```typescript
// CoopManager.ts
// Кооператив 2-4 игрока

class CoopManager {
  // Party система:
  // - Лидер создает "мир" (сессию)
  // - Приглашает по коду / friend list
  // - Все игроки в одном мире
  // - Shared прогресс (квесты, открытые зоны)
  // - Лут: free-for-all или round-robin
  
  createParty(leaderId: string): Party;
  joinParty(partyCode: string, playerId: string): boolean;
  leaveParty(playerId: string): void;
  transferLeadership(partyId: string, newLeaderId: string): void;
  
  // Масштабирование:
  // - HP боссов × количество игроков
  // - Больше мобов
  // - Лучше дроп
}

interface Party {
  id: string;
  code: string;          // 6-значный код для входа
  leaderId: string;
  members: string[];     // max 4
  worldId: string;       // Текущий мир
  sharedProgress: SharedProgress;
  lootMode: 'free' | 'round_robin' | 'leader';
}
```

```sql
-- schema.sql — таблицы для persistence (Neon Postgres)

CREATE TABLE players (
    id UUID PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    auth_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE characters (
    id UUID PRIMARY KEY,
    player_id UUID REFERENCES players(id),
    hero_id VARCHAR(32) NOT NULL, -- "hero_0"
    name VARCHAR(32),
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    attributes JSONB DEFAULT '{"str":5,"dex":5,"int":5,"vit":5,"luck":5}',
    talents JSONB DEFAULT '[]',
    inventory JSONB DEFAULT '{"slots":[],"bombs":["basic"],"currency":0}',
    equipped JSONB DEFAULT '{}',
    current_world VARCHAR(32) DEFAULT 'grasslands',
    position_x FLOAT DEFAULT 1280, -- center of 5,5 chunk
    position_y FLOAT DEFAULT 1280,
    quests_completed JSONB DEFAULT '[]',
    zones_discovered JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE worlds_state (
    world_id VARCHAR(32),
    chunk_x INTEGER,
    chunk_y INTEGER,
    data JSONB, -- chunk data: objects destroyed, resources respawn timers
    last_updated TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (world_id, chunk_x, chunk_y)
);

CREATE TABLE parties (
    id UUID PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    leader_id UUID REFERENCES characters(id),
    members UUID[],
    world_id VARCHAR(32),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Acceptance Criteria
- [ ] Сервер запускается на отдельном порту
- [ ] 20Hz tick rate, стабильный game loop
- [ ] Delta-sync: клиент получает только изменения
- [ ] Client-side prediction + server reconciliation
- [ ] Persistence: персонаж сохраняется (уровень, инвентарь, позиция)
- [ ] Party: создание, вход по коду, 2-4 игрока
- [ ] Shared прогресс в party (квесты открываются всем)
- [ ] Масштабирование сложности под количество игроков
- [ ] Сервер валидирует движения (анти-чит: speed hack проверка)

---

## МОДУЛЬ 7: Economy & Crafting (Agent 7)

**Приоритет**: СРЕДНИЙ (Phase 2, можно начать когда Agent 3 и 6 готовы)
**Папка**: `apps/client/src/campaign/economy/`

### Задача
Экономика: ресурсы, крафтинг, торговля. Albion-style.

### Что создать

```typescript
// Resources.ts
// Ресурсы в мире (добываемые)

interface ResourceNode {
  id: string;
  type: ResourceType;
  position: Vec2;
  chunkId: string;
  hp: number;
  maxHp: number;
  respawnTime: number; // Мс
  drops: DropTable;
}

type ResourceType = 'herb' | 'ore' | 'wood' | 'essence' | 'crystal' | 'scrap';

// Ресурсы привязаны к биомам:
// Grass: herb, wood
// Industrial: ore, scrap
// Neon: essence, crystal
// Sand: crystal, herb
// etc.
```

```typescript
// Crafting.ts
// Крафтинг (всё создается игроками)

interface CraftRecipe {
  id: string;
  name: string;
  category: 'bomb' | 'armor' | 'consumable' | 'material';
  ingredients: { itemId: string; count: number }[];
  result: { itemId: string; count: number };
  requiredLevel: number;
  requiredStation?: string; // "workbench", "alchemy_table", etc.
  craftTime: number; // Мс
}

class CraftingSystem {
  recipes: CraftRecipe[];
  
  canCraft(inventory: Inventory, recipe: CraftRecipe): boolean;
  craft(inventory: Inventory, recipe: CraftRecipe): Item | null;
  getAvailableRecipes(inventory: Inventory, level: number): CraftRecipe[];
}

// Phase 1: 10 базовых рецептов (бомбы, зелья, простая броня)
// Phase 2-3: 50+ рецептов
```

```typescript
// Trading.ts
// Торговля между игроками + NPC торговцы

interface TradeOffer {
  sellerId: string;
  item: Item;
  price: number; // монет
  createdAt: number;
}

interface Merchant {
  id: string;
  name: string;
  faction: FactionId;
  inventory: Item[]; // Что продает
  buyMultiplier: number; // 0.6 = покупает за 60% цены
  sellMultiplier: number; // 1.2 = продает за 120% цены
}

// Аукцион (в городах)
// - Игрок выставляет лот (item + цена)
// - Другие игроки могут купить
// - Комиссия 5%
```

### Acceptance Criteria
- [ ] Ресурсные узлы в мире (добыча ЛКМ)
- [ ] 10 рецептов крафта
- [ ] NPC торговцы в безопасных зонах
- [ ] Обмен игрок-игрок (trade window)
- [ ] Респawn ресурсов через N секунд

---

## МОДУЛЬ 8: Guilds & PvP (Agent 8)

**Приоритет**: НИЗКИЙ (Phase 2, зависит от Agent 6 и 7)
**Папка**: `apps/server/src/world/guilds/`

### Задача
Гильдии, PvP зоны, территории, войны.

### Что создать

```typescript
// GuildSystem.ts

interface Guild {
  id: string;
  name: string;
  tag: string;              // [TAG]
  leaderId: string;
  members: GuildMember[];
  territories: string[];    // ID захваченных территорий
  treasury: number;
  level: number;
  reputation: Record<FactionId, number>;
}

interface GuildMember {
  characterId: string;
  rank: 'leader' | 'officer' | 'member' | 'recruit';
  joinedAt: number;
}

// Территории:
// - Ресурсные зоны можно захватить
// - Гильдия получает налог с добычи
// - Оборона: постройки, NPC гварды
// - Осада: другие гильдии могут атаковать
```

```typescript
// PvPSystem.ts
// Зональная PvP система (Albion-style)

enum PvPZone {
  SAFE = 'safe',       // PvP запрещен
  YELLOW = 'yellow',   // PvP возможен, репутация - при убийстве
  RED = 'red',         // Полный PvP, дроп лута
  BLACK = 'black',     // Данжи: PvP + PvE
}

interface PvPState {
  reputation: number;   // -10000 до +10000
  isCriminal: boolean;  // reputation < 0
  killHistory: KillRecord[];
}

// Баллы чести за убийство преступников
// Баллы бесчестия за убийство невинных
// Criminal = городские стражи атакуют, нельзя торговать
```

### Acceptance Criteria
- [ ] Создание гильдии, приглашение, ранги
- [ ] 4 типа PvP зон с разными правилами
- [ ] Репутация система (убийства → criminal status)
- [ ] Захват территорий (гильдия → налоги)
- [ ] Осады территорий

---

## Как запускать

### Порядок зависимостей:
```
Phase 1 (параллельно):
  Agent 1 (ECS Engine) ─┬→ Agent 2 (World)
                        ├→ Agent 3 (Characters)
                        ├→ Agent 5 (Combat)
                        └→ Agent 6 (Server)
  Agent 4 (Lore) — независим

Phase 2 (когда Phase 1 готова):
  Agent 7 (Economy)
  Agent 8 (Guilds PvP)
  Agent 2 + 3 (дополнительные миры/персонажи)
```

### Запуск агентов:
1. Agent 1 + Agent 4 + Agent 6 можно запустить параллельно сразу
2. Agent 2, 3, 5 ждут интерфейс от Agent 1 (или использовать shared/types)
3. После готовности Phase 1 — запускать Phase 2

### Тестирование:
- Каждый модуль должен иметь unit-тесты
- Интеграционные тесты после соединения модулей
- Ручное тестирование: открыть /campaign в браузере, проверить движение + бомбы
