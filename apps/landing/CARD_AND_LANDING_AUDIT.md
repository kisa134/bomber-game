# BomberMeme — Аудит карточной системы, персонажей и лендинга

> Документ-аудит реального состояния (по коду в репозитории kisa134/bomber-game). Не редизайн,
> не реализация. Маркеры: ✅ есть · ◐ частично · ❌ нет · ❓ не подтверждается по коду.
> Пара с: `SPEC.md` (библия лендинга), `DIRECTION.md` (визуальный язык/ассеты), `LANDING_MAP.md` (S1–S16).

---

## 1. Общая карта проекта
Монорепо (pnpm), три мира, слабо связанные:
- **Игра + хаб** — `apps/client` (Vite + Canvas2D + TS). Меню/магазин/карусель бойцов/матч.
- **Сервер** — `apps/server` (uWebSockets + Postgres/Supabase). Профиль, владение, экономика.
- **Лендинг** — `apps/landing` (Next 15, React 19, Tailwind v4, Framer, GSAP+Lenis). Промо-сайт.
- **Общее** — `packages/shared` (константы: `SKIN_COUNT`, цены, владение).

**Реальная граница game↔landing проходит по данным и по «карте»:** игра и лендинг используют
РАЗНЫЕ модели персонажа и РАЗНЫЕ карточные системы (см. §2–§5). Связи на уровне UI почти нет —
визуальный язык пересекается только палитрой/шрифтами, не компонентами.

## 2. Что есть сейчас в карточной системе
**Три параллельные, несинхронизированные «карточные» системы:**
1. **Магазин скинов (игра)** — грид с группировкой по редкости. Плоско: аватар+имя+тег+тир.
2. **Канвас-карты (игра, `admin/cards.ts`)** — карта на `<canvas>` с **вращающимся бойцом**
   (циклит направления — это «крутятся вокруг себя»). Share/admin-рендер, не основной магазин.
3. **`CollectibleCard` (лендинг)** — ⭐ **полноценная премиум-коллекционка**: лицо+рубашка,
   3D-тилт, holo по тиру, foil, serial, веер, glitch-reveal, lore/статы. Самая сильная из трёх.

Хаб игры имеет ещё **`#fighter-carousel`** — карусель «героя» (тоже спин через направления).

## 3. Где карточная система лежит в репозитории
| Часть | Путь |
|---|---|
| Грид магазина, клик, `rarityOf`/`EXT_RARITY` | `apps/client/src/main.ts` (`makeShopCard ~2551`, `renderShopGrid ~2601`, `rarityOf ~2484`) |
| CSS карточек магазина / аватара | `apps/client/src/style.css` (`.shop-card ~6064`, `.avatar ~455`, `.shop-grid ~6051`) |
| Аватар-рендер (статичный img) | `apps/client/src/game/renderer.ts` (`skinAvatar ~26`) |
| Канвас-карта + спин бойца | `apps/client/src/admin/cards.ts` (`SKIN_NAMES`, `rarityOf`, `drawSprite`, `SPIN_SEQ ~638`) |
| Цены/уровни/токен-цены/владение | `packages/shared/src/constants.ts` (`SKIN_COUNT`, `SKIN_PRICES`, `SKIN_UNLOCK_LEVEL`, `SKIN_TOKEN_PRICES`, `DEFAULT_SKINS`) |
| Хаб-карусель | `apps/client/src/main.ts` (`#fighter-carousel ~1697, ~2870`) |
| **Лендинг-карта (контейнер)** | `apps/landing/components/roster/CollectibleCard.tsx` |
| **Лицо карты (~15 слоёв)** | `apps/landing/components/roster/CollectibleCardFront.tsx` |
| **Рубашка карты** | `apps/landing/components/roster/CardBack.tsx` |
| Веер + инфо-панель + навигация | `apps/landing/components/roster/CardFan.tsx` |
| Pin/скраб веера | `apps/landing/components/roster/RosterFanPinned.tsx` |
| 3D-тилт | `apps/landing/lib/hooks/useCardTilt.ts` |
| **Данные бойцов (лендинг)** | `apps/landing/lib/rosterData.ts` (`FIGHTER_ROSTER`, `FAN_FIGHTERS`, `FighterAsset`) |

## 4. Как устроены карточки визуально
- **Магазин (игра):** грид `repeat(auto-fill, minmax(108,132px))`, подзаголовки тиров (COMMON…MYTHIC),
  карта = аватар 56px + имя + тег(цена/owned/locked) + лейбл редкости, рамка/glow цветом `--rarity`,
  hover `translateY(-2px)`. **Только лицо. Рубашки/флипа/тилта нет.**
  ⚠️ **Баг высоты:** аватар 56px + `object-fit:contain` ужимает фулл-боди 256px → «слипшиеся пилюли».
  ⚠️ **Баг снапа:** клик → `renderShopGrid()` пересобирает весь DOM → `scrollTop` сброс → «уезжает назад».
- **Канвас-карта (игра):** боец крутится через цикл направлений (`SPIN_SEQ` down/side/up/flip). Зачаток inspect.
- **Лендинг `CollectibleCard`:** см. §5 — премиальная многослойная.

## 5. Как устроены карточки изнутри (анатомия)
**Магазин (игра)** — примитив: `<button>` → `skinAvatar(img)` + name + tag + rarity-label. 4 зоны, плоско.

**Лендинг `CollectibleCard`** — ⭐ настоящий «артефакт», `preserve-3d` (флип лицо↔рубашка):
- **Лицо (`CollectibleCardFront`, ~15 слоёв):** `fc-base`/`fc-metal`(металл per-fighter `cardMetal`) ·
  `fc-rays` · `fc-cloud` · `fc-haze` · `fc-grain`(SVG-шум, материал) · `fc-sprite`(арт) ·
  **`fc-holo`(голограмма по `data-tier`)** · `fc-scanlines` · `fc-broadcast-badge`("LIVE") ·
  `fc-gloss`/`fc-sheen`/`fc-light`(блики) · `fc-frame` · `fc-shadow-layer` · `fc-info`(`fc-name` + `fc-tier-badge`).
- **Рубашка (`CardBack`):** `fc-back-ring` · `fc-back-glyphs` · **`fc-back-foil`(фольга)** ·
  `fc-back-seal`(печать) · **`fc-back-serial`** (`fighter.serialNumber`).
- **Данные внутрь** (`FighterAsset`): id, name, role, roleColor, rankTier, **cardTier**(редкость),
  **serialNumber** (`BM-S01-0001`), sprite, lore, signature, specialty, winRate, avgMMR, pickRate, locked,
  **cardBg, cardMetal** (per-fighter материал/фон).
- **Универсальное:** все слои/рамка/holo/foil/scanlines. **Уникальное под персонажа:** sprite, name,
  cardBg, cardMetal, tier, serial, lore, статы, roleColor.
- **Состояния:** `is-active`/`not-active`/`is-adjacent` (веер), 3D-тилт по мыши, glitch-reveal при выборе,
  flip-готовность (`preserve-3d`, но автоматического флипа в UI не нашёл — рубашка есть в DOM). ◐

## 6. Как устроены персонажи
- **Игра:** персонаж = **индекс** 0..`SKIN_COUNT`-1. Арт: `skin_N_down_1.webp`(стенд) + опц.
  `skin_N_{down/up/side}_{0..2}` + `_place_bomb/_hurt/_victory`. Имена в `SKIN_NAMES` (дубль ×3).
  **Новые 11-50 = только `down`-кадры (3 одинаковых)** → не вращаются/не ходят, нет полного пака.
- **Лендинг:** персонаж = богатый **объект** `FighterAsset` (rosterData.ts) с лором/статами/тиром/serial.
- ❌ **Две вселенные:** игра (индекс+массивы) ≠ лендинг (объекты). `rosterData.ts` отстал (~20 бойцов).

## 7. Точный список текущих персонажей (51 в игре)
**Оригинал 0-10 (полные кадры, в карточной системе игры):** Shiba · Pepe · Trump · Musk · Doge ·
Pump · Durov · Vitalik · Troll · Bogdanoff · Gigachad.
**Новые 11-50 (только портрет/down, генерация→100):** Nyan · Grumpy · Harambe · Shrek · Fine Dog ·
Wojak · NPC · Chad · Doomer · Bloomer · Stonks · Satoshi · SBF · CZ · Laser Eyes · WAGMI · Diamond ·
Rich Pepe · Bonk · WIF · Popcat · Titan · Salt Bae · Harold · Paper Hands · Moonboy · Brett · Andy ·
GOAT · Pnut · Moodeng · MEW · Ponke · Sigma · Boomer · Zoomer · Chemist · Galaxy Brain · Cry Jordan · Disaster
(+ батч 6 51-58 в обработке: Leeroy · MLG · Keanu · Rick · Crewmate · Grogu · Voxel · Skibidi).
- **Реализованы+используются:** 0-50 (в магазине игры, по `SKIN_COUNT`). ✅
- **В assets, частично используются:** 11-50 без полных кадров (фолбэк на портрет). ◐
- **Лендинг:** `FIGHTER_ROSTER` ~20 (до Nyan-эпохи) — **новые 12-50 в карты лендинга НЕ заведены.** ❌

## 8. Редкость / рубашки / коллекционная логика
- **Редкость:** ✅ игра (`rarityOf`+`EXT_RARITY`: Common/Rare/Epic/Legendary/Mythic — рамка+лейбл+группировка).
  ✅ лендинг (`cardTier` из `rankTier`). ⚠️ **Две разные шкалы**, не синхронизированы.
- **Рубашки:** ✅ **лендинг** (`CardBack`: foil+seal+serial). ❌ **игра** (магазин только лицо).
- **Serial/provenance:** ✅ лендинг (`BM-S01-0001`). ❌ игра.
- **Holo/foil/материал тира:** ✅ лендинг (`fc-holo` по тиру, `fc-back-foil`, `cardMetal`). ❌ игра.
- **Коллекционная петля (паки, reveal-церемония, прогресс сета, дубликаты, «осталось собрать N»):** ❌ нигде.
- **Inspect-режим (крупный осмотр):** ◐ зачатки (тилт на лендинге, спин на канвасе), полноценного нет.

## 9. Что есть сейчас в лендинге
Кинематографичный промо-сайт (Next), задуманный как «единое путешествие сквозь арену» (`SPEC.md`).
Стек: GSAP+ScrollTrigger (скролл-режиссура), Lenis (smooth), Framer (микро), Tailwind v4.
Вайб-карта по секциям (`DIRECTION.md`): стадион-броадкаст / колизей / казино-памп / матрица-деген.
Hero ❄️ заморожен (см. `DIRECTION.md §5a`) — к нему через полный reset.

## 10. Лендинг по блокам (S1–S16, статус из LANDING_MAP.md)
S1 Hero ✅ · S2 Curtain→«как играть» ✅ · S3 Story-chapters ✅ · S4 Live-Arena ✅ · S5 Pulse-тикер ✅ ·
S6 Bento ◐ · **S7 Ростер/карты ◐** · S8 Лидерборд ✅ · S9 Трейлер ✅ · S10 Roadmap ✅ ·
S11 Provably-Fair ✅ · S12 Экономика/печь ◐ · S13 Кланы/граф ⚠️тизер · S14 FAQ ✅ · S15 Final-CTA ◐ · S16 Footer ✅.
Переходы: `SplitDescend`/`SplitDescendPinned` (шторки/спуск). Глубина: 3 z-плана задумано (Hero реально многослойный).

## 11. Блок карточек на лендинге (S7) — полный разбор
`apps/landing/components/RosterSection.tsx` → `RosterFanPinned` (GSAP-pin, скролл скрабит индекс) →
`CardFan` (веер `CollectibleCard` + инфо-панель: role·serial·name·lore·WIN/MMR/PICK + ← pips → + CTA).
- **Композиция:** заголовок «Elite Roster» + фон-бойцы (параллакс, низкая прозрачность) + floor-props (паверапы) + веер по центру.
- **Визуал:** премиальный — многослойные карты (§5), 3D-тилт, glitch-reveal, holo по тиру, фон-арена.
- **Технически:** pin+scrub через индекс, событие `roster-scrub`, данные из `FAN_FIGHTERS` (подмножество ~20).
- **Связь с игрой:** ❌ только данными `rosterData.ts` (свои объекты), НЕ общая модель/ассеты игры; новые 12-50 не заведены.
- **Это мост в collectible-мир или showcase?** ◐ **Сильнейший зачаток моста** (реальная collectible-карта),
  но пока **showcase**: нельзя собрать/владеть/распаковать, нет связи с владением игрока, нет всех 51 персонажа.
- **Сильное:** анатомия карты, тилт, holo/foil/serial, веер-browse. **Слабое:** оторван от игры, неполный ростер, нет collectability-петли.

## 12. Какой визуальный язык реально сложился (по коду/ассетам)
- **База:** тёмный warm-black void (`#0b0a0e`), не cold-blue. Палитра: gold `#f5c842`, fire `#f0a92a→#ff8a3c`,
  money-green `#3ddcaf/#5fe08a`, plasma-cyan `#7fd8ff`, kill-red `#ff5a4d/#d44030` (см. `DIRECTION.md §2`).
- **Текстура:** чанки пиксель-арт, hard edges, CRT/scanlines, broadcast-HUD (LIVE/watching/таймер).
- **Шрифты:** Barlow Condensed (display) · IBM Plex Mono (HUD/body) · Press Start 2P (пиксель-акцент).
- **Каст:** 51 мем-архетип в едином стиле (big-head/small-body фигурки, чистый силуэт, фирменная аура).
- **«Ядро вкуса»:** мемкоин-пиксель-арена-броадкаст + материальная collectible-карта (лендинг).
- **Где цельно:** Hero (после слойной пересборки), `CollectibleCard`, ростер персонажей.
- **Где распадается:** игровой магазин (плоский) vs лендинг-карта (премиум); две шкалы редкости; S13/S12 недотягивают.

## 13. Что уже сильное
- ✅ `CollectibleCard` (лендинг) — почти готовая премиум-коллекционка (лицо+рубашка+holo+foil+serial+тилт).
- ✅ Система редкости + экономика владения (битмаска, цены, уровни, токен-цены).
- ✅ 51 персонаж в едином пиксель-мем-стиле (растёт до 100) — большая коллекционная база.
- ✅ Зафиксированный визуальный язык (`DIRECTION.md`) + карта лендинга (`LANDING_MAP.md`) + библия (`SPEC.md`).
- ✅ Веер-browse (CardFan) + канвас-спин — зачатки приятного browse/inspect.
- ✅ Богатая модель `FighterAsset` (lore/signature/тир/serial) — каркас «карты с характером».

## 14. Что слабое / конфликтное
- ⚠️ Два бага магазина (снап-скролл + высота аватара) — базовый UX листания/просмотра.
- ❌ Игровой магазин плоский — «иконки», не «карты-артефакты»; не использует `CollectibleCard`.
- ❌ Две вселенные данных (игра-индексы vs лендинг-объекты) + две шкалы редкости.
- ❌ Дубли: `SKIN_NAMES` ×3, `rarityOf/EXT_RARITY` ×2 → рассинхрон-риск.
- ❌ Новые 11-50 без полных кадров (нет спина/ходьбы) и не заведены в лендинг-ростер.
- ❌ Нет коллекционной петли (паки/reveal/прогресс/дубликаты/сеты).

## 15. Что отсутствует полностью
- ❌ Единая карточная модель (один источник истины игра+лендинг).
- ❌ Collectability loop: открытие паков, reveal-церемония редкости, прогресс коллекции/сетов, дубликаты, обмен.
- ❌ Inspect-режим (крупный осмотр карты с тилтом/holo/звуком) в едином виде.
- ❌ Карточная система в ИГРЕ на уровне лендинг-карты (рубашки/serial/материал тира в магазине).
- ❌ Материальный «вес» тиров (фактура/частицы на тир, а не только цвет).

## 16. Что можно сохранить как основу
- ⭐ **`CollectibleCard` + Front/Back/useCardTilt/rosterData** — baseline будущей единой карты.
- ⭐ Модель `FighterAsset` (расширить до всех 51+, сделать общим источником в `packages/shared`).
- ⭐ Серийники `BM-S01-XXXX` (провенанс/сезоны) + `cardTier`/holo/foil — язык редкости.
- ⭐ Палитра/шрифты/визуальный язык (`DIRECTION.md`) — уже зафиксированы.
- ⭐ Экономика владения (битмаска+цены+уровни) — основа коллекционирования.

## 17. Что придётся серьёзно пересобирать
- Игровой магазин: из плоского грида → в систему на базе `CollectibleCard` (или общий компонент).
- Слияние данных: один источник персонажа (id, имя, серия, тир, материал, арт-слои) для игры И лендинга.
- Унификация редкости (одна шкала) + материализация тиров.
- Полные паки анимаций для 11-50 (для спина/ходьбы/состояний).
- Достройка collectability-петли (паки/reveal/прогресс/сеты) — её сейчас нет.

## 18. Неясности / дыры / техдолг / противоречия
- `SKIN_NAMES` дублируется (`admin/cards.ts`, `main.ts`, `landing/landing.ts`); `rarityOf/EXT_RARITY` ×2. Нужен единый источник в `packages/shared`. ❓
- Авто-флип лицо↔рубашка: рубашка есть в DOM (`preserve-3d`), но триггер флипа в UI не подтверждён. ❓
- `FAN_FIGHTERS` — подмножество `FIGHTER_ROSTER` по фильтру; точный размер/критерий уточнить по `rosterData.ts`. ❓
- Связь serial/тир лендинга ↔ владение игрока (сервер) — отсутствует. ❌
- Новые 11-50 в лендинг-ростере отсутствуют → лендинг показывает старый каст. ❌

---

## Зёрна сильной системы, которые уже есть
- **Collectible card DNA:** `CollectibleCard` (лицо 15 слоёв + рубашка foil/seal/serial + 3D-тилт + holo по тиру) —
  это уже премиум-артефакт, не PNG. Главное зерно.
- **Landing style DNA:** многослойный кинематографичный Hero + вайб-карта по секциям + зафиксированная палитра/шрифты.
- **Brand language DNA:** мемкоин-пиксель-арена-броадкаст, 51 персонаж-архетип в едином стиле, серийники `BM-S01`.
- **Связка hub/cards/landing:** пока СЛАБАЯ (общая только палитра/шрифты). Зерно связки = общая модель `FighterAsset`
  + общий компонент `CollectibleCard`, которые надо протянуть из лендинга в игру и в один источник данных.
