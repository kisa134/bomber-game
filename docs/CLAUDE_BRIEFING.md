# CLAUDE BRIEFING: BomberMeme Card System — Полная Картина

> Этот документ — единственный источник правды для тебя (Claude) о том, что мы строим, почему, и кто что делает. Читай перед любой работой по карточной системе.

---

## 1. ПРОЕКТ: Что мы строим

**BomberMeme.fun** — Bomberman Battle Royale в Telegram Mini App с:
- PvP-ареной (2-4 игрока, Battle Royale, за chips/tokens)
- Коллекционной карточной мета-системой (CCG)
- Открытым миром / Campaign Mode (в разработке)
- Токеномикой (SPL-токен на Solana)

**Карточная система** — это НЕ отдельная игра. Это **мета-слой поверх арены**, который даёт:
- Retention (собирать карты = возвращаться)
- Monetization (торговля, паки, фьюжн)
- Социальный флекс (делиться редкими картами, витрина в профиле)
- Мост к скинам (карта = разблокировка скина)

---

## 2. УТИЛИТИ-СТРАТЕГИЯ: Уже решено, не обсуждается

Мы выбрали **4 из 5 направлений одновременно**:

### 2.1 Карты = Скины (основная утилити)
- Владеешь картой персонажа → можешь играть этим скином в арене
- Ростер карт (85+ персонажей) постепенно срастается с `SKIN_COUNT` в игре
- Карта имеет поле `skinId` → маппится на игровой скин
- **Это НЕ замена существующей системе скинов** — это расширение. Существующие скины остаются. Карты дают ДОПОЛНИТЕЛЬНЫХ персонажей.

### 2.2 Карты за игру (retention)
- Выпадают за: матчи, достижения, уровни, первый вход, серия побед
- Ежедневный бесплатный пак (как в Clash Royale)
- Специальные награды за турниры, сезонные ивенты
- **Паки тратят валюту** (chips или tokens) — не бесплатные

### 2.3 Рынок за токены (монетизация)
- Shop в хабе ЗАМЕНЯЕТСЯ на Market (это решение принято)
- Primary market: покупка паков за chips/tokens
- Secondary market: P2P торговля картами за tokens (SPL-токен игры)
- Floor price, sparkline, история цен — всё как в NBA Top Shot
- **Рынок работает через сервер** (server-authoritative), не на клиенте

### 2.4 Социальный флекс
- Шеринг карты в соцсети (Telegram, Twitter/X)
- Витрина редких карт в профиле
- Коллекционные бейджи/ачивки за полные сеты
- Редкость = статус (Genesis, Mythic = flex)

### 2.5 Что НЕ делаем (Pay-to-Win)
- Карты НЕ дают боевых бонусов в арене
- Никаких перков, баффов, stat-модификаторов
- Только косметика (скины) + коллекция + торговля

---

## 3. ТЕКУЩЕЕ СОСТОЯНИЕ: Что сделали Kimi агенты

### 3.1 Что есть (4900 строк, 11 модулей)

| Модуль | Статус | Примечание |
|--------|--------|------------|
| **Data Layer** | ✅ | 350+ карт, 85 персонажей, 9 сетов, 5 тиров |
| **Collection** | ✅ | Экран коллекции с фильтрами, поиском, гридом |
| **Pack Opening** | ✅ | Церемония открытия с анимацией |
| **Inspect View** | ✅ | Осмотр карты с моментами |
| **Market UI** | ✅ | Primary/Secondary/My Listings/History |
| **Forge** | ✅ UI, ❌ логика | UI есть, но модель владения не поддерживает дубли |
| **Share Card** | ✅ | Шеринг в соцсети |
| **CardRenderer** | ⚠️ | 20+ слоёв написаны, НЕ подключены к `fighterCardHTML()` |
| **CardAging** | ⚠️ | 5 стадий написаны, `matchCount` всегда 0 |
| **CardBack** | ✅ | Guilloché weave, серийники, wax seal |

### 3.2 Архитектурные решения агентов

**Модель владения (сейчас):**
```typescript
// Текущая модель — ПРОБЛЕМА
type Ownership = Record<string, boolean>  // characterId → owns?
// Проблема: не знаем дублей → Forge невозможен
```

**Нужная модель:**
```typescript
// Целевая модель
interface CardInstance {
  instanceId: string;      // UUID экземпляра
  characterId: string;     // ak_grumpy_cat
  momentId: string;        // Classic / HODL / Pump / Rage
  tier: Tier;              // common..mythic
  setId: string;           // genesis_s1
  mintedAt: number;        // timestamp
  matchCount: number;      // для CardAging
  // ...
}
type Ownership = CardInstance[];
```

### 3.3 Интеграция в хаб
- Кнопка "🃏 Cards" рядом с Friends → открывает карточный экран
- Подключено в `lobby.ts`, `main.ts`, `index.html`
- **Отдельная вселенная** — не связана со скинами, не читает `ownedSkinMask`

---

## 4. ЧТО ДЕЛАЕТ КЛАУД (ты) — СЕЙЧАС

### 4.1 Приоритет 1: Клиентские фиксы (без бэкенда)

#### Задача A: CardLayers в рендер
**Что:** Подключить написанные 20+ CSS-слои карты к функции `fighterCardHTML()` в `main.ts`.

**Контекст:**
- В `main.ts` есть `fighterCardHTML(skin: number)` — она рендерит карту в хабе
- Агенты написали CardRenderer с layers: base art, rays, cloud, haze, grain, holo foil (5 finishes), scan lines, gloss, sheen sweep, cursor light, frame, corners, badge, stamp, edge sweep, stars, name, gems
- Эти слои НЕ встроены в `fighterCardHTML()` — карта выглядит "голой"

**Что делать:**
```
1. Найди функцию fighterCardHTML() в main.ts
2. Замени её тело на рендер из CardRenderer (файл агентов — cards/CardRenderer.ts)
3. Убедись, что CSS-переменные из CardRenderer импортированы в style.css
4. Проверь: открываешь хуб → карта fighter'а должна показывать все слои
```

**Файлы:** `main.ts`, `style.css`, `cards/CardRenderer.ts`

#### Задача B: CardAging matchCount
**Что:** Пробросить реальное количество матчей в систему старения карт.

**Контекст:**
- 5 стадий: Mint → Worn → Veteran → Battle-Scarred → Immortal
- Переход по порогам: 0, 10, 50, 100, 500 матчей
- Сейчас `matchCount` всегда 0 → все карты всегда Mint

**Что делать:**
```
1. Найди, где в main.ts считается количество матчей (переменная matches)
2. Принимай matchCount как пропс/параметр в CardRenderer
3. Вычисляй стадию старения из matchCount
4. Применяй CSS-класс aging-{stage} к карте
```

**Файлы:** `main.ts`, `cards/CardRenderer.ts`, `style.css`

#### Задача C: Мост Cards ↔ Skins
**Что:** Связать карточную коллекцию с существующей системой скинов.

**Контекст:**
- В игре: `SKIN_COUNT` скинов, `ownedSkinMask` (битмаска владения), `skinAvatar(n)`
- В картах: 85+ персонажей с полем `skinId?`
- Нужно: если у игрока есть карта с `skinId = 5` → скин 5 разблокирован

**Что делать:**
```
1. Добавь поле skinId в data layer карт (для персонажей, которые мапятся на скины)
2. При открытии пака/получении карты: если карта имеет skinId → обнови ownedSkinMask
3. При входе в арену: скины из карт должны быть доступны для выбора
4. Обратная связь: при покупке скина в магазине → выдать соответствующую карту (если есть маппинг)
```

**Файлы:** `main.ts`, `cards/data.ts`, `cards/Collection.ts`

#### Задача D: Модель владения на экземпляры
**Что:** Рефактор `bp_cards_owned` из `Record<string, boolean>` в `CardInstance[]`.

**Контекст:**
- Сейчас: `{ "ak_grumpy_cat": true, "pc_lambo": true }` — не знаем дублей
- Forge требует 3 копии одного персонажа → невозможно с текущей моделью
- Нужно: массив экземпляров с instanceId

**Что делать:**
```
1. Определи тип CardInstance (см. раздел 3.2)
2. Рефактор bp_cards_owned → bp_card_instances
3. Обнови Collection (считает дубли для Forge)
4. Обнови Pack Opening (создаёт CardInstance с instanceId)
5. Обнови Inspect (показывает конкретный экземпляр)
6. Сделай миграцию: старая модель → новая (при первом запуске)
```

**Файлы:** `cards/data.ts`, `cards/Collection.ts`, `cards/PackOpening.ts`, `cards/Inspect.ts`, `cards/Forge.ts`

**Важно:** Это breaking change. Старые данные в localStorage станут невалидны. Сделай миграцию или сброс.

### 4.2 Приоритет 2: Подготовка к бэкенду

#### Задача E: API-интерфейс (стабы)
**Что:** Создать типы и стаб-функции для API, которые Kimi агенты реализуют на сервере.

```typescript
// cards/api.ts — интерфейс между клиентом и сервером

interface CardsAPI {
  // Владение
  getCollection(wallet: string): Promise<CardInstance[]>;
  openPack(packType: string, wallet: string): Promise<CardInstance[]>;
  
  // Рынок
  getListings(filters: MarketFilters): Promise<MarketListing[]>;
  createListing(listing: NewListing): Promise<void>;
  buyListing(listingId: string, wallet: string): Promise<void>;
  getPriceHistory(cardId: string): Promise<PricePoint[]>;
  
  // Forge
  fuseCards(instanceIds: string[], wallet: string): Promise<CardInstance>;
  
  // Дропы за игру
  checkMatchDrops(wallet: string, matchId: string): Promise<CardDrop[]>;
}

// Стаб-реализация (пока нет сервера)
const cardsApi: CardsAPI = {
  getCollection: async () => loadFromLocalStorage(),
  openPack: async () => generatePackLocally(),
  // ... всё остальное тоже localStorage/mock
};
```

**Файлы:** Новый файл `cards/api.ts`

### 4.3 НЕ делай сейчас (это для Kimi swarm)

| Задача | Почему не ты | Кто |
|--------|-------------|-----|
| Бэкенд API | Серверный код | Kimi swarm |
| БД схема (Postgres) | Серверный код | Kimi swarm |
| Блокчейн-интеграция | Смарт-контракты | Kimi swarm |
| Anti-cheat (server-authoritative) | Серверный код | Kimi swarm |
| Реальная P2P торговля | Сервер + блокчейн | Kimi swarm |

---

## 5. ПРОМПТ ДЛЯ KIMI SWARM: Что агенты будут делать

> Этот промпт агенты получат ПОСЛЕ того, как ты закончишь клиентские фиксы. Не раньше.

### Phase 1: Бэкенд карточной системы

**Агент 1: API + БД схема**
```
Создать:
1. SQL миграцию: таблицы cards, card_instances, packs, pack_openings, 
   market_listings, price_history, forge_recipes
2. tRPC/Hono роуты:
   - cards.getCollection(wallet)
   - cards.openPack(packType, wallet) — server-authoritative рандом
   - cards.getListings(filters)
   - cards.createListing(cardInstanceId, price, wallet)
   - cards.buyListing(listingId, wallet)
   - cards.fuse(instanceIds, wallet)
   - cards.checkDrops(wallet, matchResult)
3. Drizzle ORM схемы
```

**Агент 2: Дропы за игру**
```
Создать:
1. Систему дропов карт за матчи (probabilistic, server-side)
2. Таблица drop_rates: редкость → шанс, модификаторы (win streak, first win, etc.)
3. Ежедневный бесплатный пак (cooldown 24h, server-tracked)
4. Сезонные/ивентовые дропы
5. Интеграция с match_end — автоматический чек дропа
```

**Агент 3: Рынок (торговая логика)**
```
Создать:
1. Server-side листинги (create, cancel, expire)
2. Система bids/offers (не только фикс прайс)
3. Floor price aggregation
4. Price history (sparkline data)
5. Торговые комиссии (rake → treasury)
6. Эскроу при покупке (атомарная транзакция)
```

**Агент 4: Экономика + Forge**
```
Создать:
1. Цены паков (chips/tokens) — конфиг
2. Стоимость фьюжна (3 common → 1 rare, etc.)
3. Burn механика (при фьюжне старые карты сжигаются)
4. Supply caps (max экземпляров per карта per set)
5. Deflationary механики (часть комиссий сжигается)
```

### Phase 2: Интеграция клиент ↔ сервер

**Агент 5: Мост (клиентский)**
```
1. Заменить localStorage-реализацию cardsApi на реальные HTTP/tRPC вызовы
2. Синхронизация коллекции при логине
3. Оффлайн-кеш + очередь (если связь пропала)
4. Wallet-based владение (коллекция привязана к wallet, не к браузеру)
```

---

## 6. ФАЗЫ РАБОТЫ: Когда что делать

### Phase 0: Сейчас (Claude)
- [ ] Задача A: CardLayers в рендер
- [ ] Задача B: CardAging matchCount
- [ ] Задача C: Мост Cards ↔ Skins
- [ ] Задача D: Модель владения на экземпляры
- [ ] Задача E: API-интерфейс (стабы)

**Результат:** Клиентская карточная система работает полностью. Collection, Pack Opening, Inspect, Forge (с дублями), CardAging — всё функционально. Всё на localStorage. **Это "альбом наклеек v2"** — красивый, рабочий, без сервера.

### Phase 1: Kimi swarm — бэкенд
- [ ] API + БД схема
- [ ] Дропы за игру
- [ ] Рынок (торговая логика)
- [ ] Экономика + Forge

**Результат:** Серверная инфраструктура. Wallet-based владение. Server-authoritative паки и торговля.

### Phase 2: Интеграция
- [ ] Клиент → сервер мост
- [ ] Shop → Market замена
- [ ] Карты = скины (полная интеграция)
- [ ] Блокчейн (опционально, позже)

---

## 7. КЛЮЧЕВЫЕ РЕШЕНИЯ (не менять без обсуждения)

| Решение | Статус |
|---------|--------|
| Shop ЗАМЕНЯЕТСЯ на Market | ✅ Принято |
| Карты = скины (не замена, расширение) | ✅ Принято |
| Нет Pay-to-Win (карты = косметика) | ✅ Принято |
| Server-authoritative (не клиент) | ✅ Принято |
| SPL-токен на Solana | ✅ Принято |
| 5 тиров + Genesis | ✅ Принято |
| Моменты (варианты карт) | ✅ Принято |

---

## 8. ССЫЛКИ НА ДОКУМЕНТЫ

| Документ | Что внутри |
|----------|-----------|
| `docs/CARD_SYSTEM_V2_SPEC.md` | Полная спецификация карточной системы (20+ слоёв, CardAging, Inspect, Collection Binder, Market UI, Pack Opening, Forge, Share) |
| `docs/CARD_SWARM_PROMPT.md` | Детальный промпт для 4 Kimi агентов (которые уже сделали клиент) |
| `docs/AUDIO_SYSTEM_V2_SPEC.md` | Спецификация аудио-системы (dynamic music, biome themes, voice lines) |
| `docs/AUDIO_SWARM_PROMPT.md` | Промпт для 4 аудио-агентов |
| `docs/BOMBERMEME_WORLD_ARCH.md` | Архитектура Campaign Mode / World |
| `docs/TOKENOMICS.md` | Токеномика игры |

---

## 9. FAQ: Почему так, а не иначе

**Q: Почему карты не заменяют скины полностью?**
A: У нас уже 20+ скинов с балансировкой, ценами, битмаской владения. Карты — это РАСШИРЕНИЕ ростера. Не ломаем работающее.

**Q: Почему Forge требует дубли?**
A: Это дефляционная механика. 3 Common → 1 Rare сжигает supply. Без дублей — нет сжигания → инфляция → цены падают.

**Q: Почему Shop → Market?**
A: Shop сейчас продаёт скины напрямую. Market — это P2P торговля + паки. Более интересная экономика, больше retention.

**Q: Почему нет Pay-to-Win?**
A: Карты дают только скины (косметика). Никаких боевых бонусов. Иначе убиваем фритуплей и competitive integrity.

**Q: Почему сначала клиент, потом сервер?**
A: Можно сразу показать/потестировать. Серверный код без клиента — просто API в вакууме. А клиент без сервера — уже "альбом наклеек", который работает.

---

## 10. ЧЕКЛИСТ: Готовность к запуску Kimi swarm

Прежде чем запускать бэкенд-агентов, убедись:

- [ ] CardLayers рендерятся в хабе (видны все эффекты)
- [ ] CardAging показывает правильную стадию
- [ ] Модель владения — экземпляры (CardInstance[])
- [ ] Forge можно открыть (даже если не работает — UI показывается)
- [ ] API-интерфейс создан (types + stubs)
- [ ] Нет TypeScript ошибок (`pnpm check` проходит)
- [ ] Билд проходит (`pnpm build` в apps/client)

**Когда всё галочки — показываешь этот документ Kimi, даёшь CARD_SWARM_PROMPT.md, запускаешь swarm на Phase 1.**
