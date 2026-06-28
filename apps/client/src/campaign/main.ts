/**
 * BomberMeme World — Campaign Mode Entry Point
 *
 * Инициализация ECS движка, загрузка мира, game loop,
 * onboarding, pause menu, HUD обновление.
 *
 * Architecture:
 * - World (ECS) содержит все entities и systems
 * - ChunkManager загружает чанки в радиусе от игрока
 * - Camera следует за игроком
 * - Renderer рисует видимые чанки + entities
 * - InputManager обрабатывает WASD + мышь
 */

import {
  Entity,
  World as ECSWorld,
  MovementSystem,
  Camera,
  CampaignRenderer,
  InputManager,
  ChunkManager,
  TILE_PX,
  CHUNK_TILES,
  ZONE_COLORS,
  BiomeType,
  Direction,
  SpatialGrid,
  SpriteComponent,
  TransformComponent,
  VelocityComponent,
  ColliderComponent,
  PlayerControllerComponent,
  HealthComponent,
  ManaComponent,
  XPComponent,
  InventoryComponent,
  StatsComponent,
  CombatComponent,
} from "./engine/index.js";

import { HeroRegistry, HeroUnlockManager } from "./entities/HeroRegistry.js";
import { SkillRegistry } from "./combat/SkillRegistry.js";
import { CombatCalculator } from "./rpg/Attributes.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_ID = "campaign-canvas";
const MINIMAP_ID = "camp-minimap";
const LOADING_ID = "campaign-loading";
const ONBOARD_ID = "campaign-onboard";
const HUD_ID = "campaign-hud";
const PAUSE_ID = "campaign-pause";

const TICK_RATE = 1000 / 60; // 60 FPS client-side
const CHUNK_LOAD_RADIUS = 2;

// ─── Campaign State ──────────────────────────────────────────────────────────

interface CampaignState {
  world: ECSWorld | null;
  chunkManager: ChunkManager | null;
  camera: Camera | null;
  renderer: CampaignRenderer | null;
  input: InputManager | null;
  player: Entity | null;
  minimapCtx: CanvasRenderingContext2D | null;
  running: boolean;
  paused: boolean;
  onboarding: boolean;
  lastTime: number;
  animFrame: number;
}

const state: CampaignState = {
  world: null,
  chunkManager: null,
  camera: null,
  renderer: null,
  input: null,
  player: null,
  minimapCtx: null,
  running: false,
  paused: false,
  onboarding: false,
  lastTime: 0,
  animFrame: 0,
};

// ─── DOM Helpers ─────────────────────────────────────────────────────────────

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}
function show(id: string): void {
  $(id)?.classList.remove("hidden");
}
function hide(id: string): void {
  $(id)?.classList.add("hidden");
}
function isHidden(id: string): boolean {
  return $(id)?.classList.contains("hidden") ?? true;
}

// ─── Hero Selection ──────────────────────────────────────────────────────────

/** Выбор героя при первом входе. Возвращает Promise с выбранным heroId. */
async function selectHero(): Promise<string> {
  return new Promise((resolve) => {
    // Если уже есть выбранный герой в localStorage — используем его
    const saved = localStorage.getItem("bp_campaign_hero");
    if (saved) {
      resolve(saved);
      return;
    }

    // Показываем UI выбора из 3 стартовых героев
    const heroes = [
      { id: "hero_0", name: "Зеро", title: "Хакер Реальности", skill: "Цепная Реакция", faction: "neon_cartel", desc: "Бывший корпоративный хакер. Уникальный скилл: бомбы цепляются друг за другом." },
      { id: "hero_28", name: "Вайлд", title: "Хранитель Круга", skill: "Гнев Природы", faction: "wild_circle", desc: "Последний хранитель Дикого Круга. Призывает терновые ловушки." },
      { id: "hero_70", name: "Скорп", title: "Призрак Песков", skill: "Песчаная Буря", faction: "sands_eternal", desc: "Наёмник из Песков Вечности. Создаёт бурю, замедляющую врагов." },
    ];

    // Создаём модальное окно выбора
    const modal = document.createElement("div");
    modal.id = "hero-select-modal";
    modal.className = "hero-select-modal";
    modal.innerHTML = `
      <div class="hero-select-card">
        <h2>Choose Your Hero</h2>
        <p class="hero-select-sub">Your journey begins. Pick your first fighter — you can unlock more later.</p>
        <div class="hero-select-grid">
          ${heroes.map(h => `
            <button class="hero-select-opt" data-hero="${h.id}">
              <img src="/sprites/${h.id.replace("hero_", "skin_")}_down_0.webp" alt="${h.name}" class="hero-select-img" />
              <div class="hero-select-name">${h.name}</div>
              <div class="hero-select-title">${h.title}</div>
              <div class="hero-select-skill">⚡ ${h.skill}</div>
              <div class="hero-select-faction ${h.faction}">${h.faction.replace("_", " ")}</div>
              <div class="hero-select-desc">${h.desc}</div>
            </button>
          `).join("")}
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Обработчики выбора
    modal.querySelectorAll<HTMLElement>(".hero-select-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const heroId = btn.dataset.hero!;
        localStorage.setItem("bp_campaign_hero", heroId);
        modal.remove();
        resolve(heroId);
      });
    });
  });
}

// ─── World Initialization ────────────────────────────────────────────────────

/** Создаёт ECS мир и инициализирует все системы. */
async function initWorld(heroId: string): Promise<void> {
  // 1. Создаём ECS World
  const world = new ECSWorld();
  world.registerSystem(new MovementSystem());
  state.world = world;

  // 2. Инициализируем ChunkManager (загружает мир Grasslands)
  const chunkMgr = new ChunkManager("grasslands", BiomeType.GRASS);
  state.chunkManager = chunkMgr;

  // 3. Создаём камеру
  const camera = new Camera(0, 0, window.innerWidth, window.innerHeight);
  camera.setZoom(1.0);
  state.camera = camera;

  // 4. Создаём renderer
  const canvas = $(CANVAS_ID) as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d")!;
  const renderer = new CampaignRenderer(ctx, camera);
  state.renderer = renderer;

  // 5. Инициализируем InputManager
  const input = new InputManager(canvas);
  state.input = input;

  // 6. Получаем данные героя и создаём player entity
  const registry = HeroRegistry.getInstance();
  const heroData = registry.getHeroById(heroId);
  const heroDef = registry.getHeroDefinition(heroId);
  if (!heroData || !heroDef) {
    throw new Error(`Hero ${heroId} not found in registry`);
  }

  const spawnChunk = { x: 5, y: 5 };
  const spawnPx = {
    x: (spawnChunk.x * CHUNK_TILES + CHUNK_TILES / 2) * TILE_PX,
    y: (spawnChunk.y * CHUNK_TILES + CHUNK_TILES / 2) * TILE_PX,
  };

  // Создаём player entity с полным набором компонентов
  const player = new Entity("player");
  player.addComponent(new TransformComponent(spawnPx.x, spawnPx.y));
  player.addComponent(new VelocityComponent(0, 0));
  player.addComponent(new SpriteComponent(heroDef.spriteId, 32, 48));
  player.addComponent(new ColliderComponent(16, 24)); // half-width, half-height
  player.addComponent(new PlayerControllerComponent());

  // RPG компоненты
  const baseStats = heroDef.baseAttributes;
  const maxHp = 100 + baseStats.vit * 10;
  const maxMana = 50 + baseStats.int * 8;
  const moveSpeed = 200 + baseStats.dex * 5;

  player.addComponent(new HealthComponent(maxHp, maxHp));
  player.addComponent(new ManaComponent(maxMana, maxMana));
  player.addComponent(new XPComponent(0, 100, 1));
  player.addComponent(new InventoryComponent(30));
  player.addComponent(new StatsComponent(baseStats, moveSpeed));

  // Combat
  const skillRegistry = SkillRegistry.getInstance();
  const uniqueSkill = skillRegistry.getSkill(heroDef.uniqueSkillId);
  const combat = new CombatComponent(
    baseStats,
    uniqueSkill ? [uniqueSkill] : [],
    moveSpeed,
    heroDef.faction,
  );
  player.addComponent(combat);

  world.addEntity(player);
  state.player = player;

  // Камера следует за игроком
  camera.follow(player);

  // 7. Загружаем стартовые чанки
  updateLoadingText("Generating world…");
  chunkMgr.updatePlayerPosition(spawnPx.x, spawnPx.y, CHUNK_LOAD_RADIUS);

  // 8. Инициализируем миникарту
  const minimapCanvas = $(MINIMAP_ID) as HTMLCanvasElement;
  state.minimapCtx = minimapCanvas.getContext("2d")!;

  // 9. Настройка обработчиков событий
  setupEventListeners();
}

// ─── Game Loop ───────────────────────────────────────────────────────────────

function gameLoop(timestamp: number): void {
  if (!state.running) return;

  const { world, chunkManager, camera, renderer, input, player, paused, minimapCtx } = state;
  if (!world || !chunkManager || !camera || !renderer || !input || !player) {
    state.animFrame = requestAnimationFrame(gameLoop);
    return;
  }

  if (paused) {
    state.animFrame = requestAnimationFrame(gameLoop);
    return;
  }

  // Delta time в секундах
  const dt = state.lastTime ? Math.min((timestamp - state.lastTime) / 1000, 0.05) : 0.016;
  state.lastTime = timestamp;

  // 1. Обновляем инпут
  input.update();

  // 2. Обновляем позицию игрока из инпута
  const inputState = input.getState();
  if (inputState.moveX !== 0 || inputState.moveY !== 0) {
    const stats = player.getComponent(StatsComponent);
    const speed = stats ? stats.moveSpeed : 200;
    const vx = inputState.moveX * speed;
    const vy = inputState.moveY * speed;
    player.getComponent(VelocityComponent)?.set(vx, vy);

    // Обновляем направление спрайта
    const sprite = player.getComponent(SpriteComponent);
    if (sprite) {
      if (Math.abs(inputState.moveX) > Math.abs(inputState.moveY)) {
        sprite.direction = inputState.moveX > 0 ? Direction.RIGHT : Direction.LEFT;
      } else {
        sprite.direction = inputState.moveY > 0 ? Direction.DOWN : Direction.UP;
      }
    }
  } else {
    player.getComponent(VelocityComponent)?.set(0, 0);
  }

  // 3. Обновляем чанки (загрузка/выгрузка)
  const transform = player.getComponent(TransformComponent);
  if (transform) {
    chunkManager.updatePlayerPosition(transform.x, transform.y, CHUNK_LOAD_RADIUS);
  }

  // 4. Обновляем ECS World (все systems)
  world.update(dt);

  // 5. Обновляем камеру
  camera.update(dt);

  // 6. Рендерим
  const loadedChunks = chunkManager.getLoadedChunks();
  renderer.render(world, loadedChunks, chunkManager.getCurrentBiome());

  // 7. Обновляем миникарту
  if (minimapCtx && transform) {
    renderMinimap(minimapCtx, loadedChunks, transform.x, transform.y);
  }

  // 8. Обновляем HUD
  updateHUD(player);

  state.animFrame = requestAnimationFrame(gameLoop);
}

// ─── Minimap ─────────────────────────────────────────────────────────────────

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  chunks: Array<{ x: number; y: number; tiles: number[][] }>,
  playerX: number,
  playerY: number,
): void {
  const size = 120;
  ctx.clearRect(0, 0, size, size);

  if (chunks.length === 0) return;

  // Находим границы загруженных чанков
  let minCX = Infinity, minCY = Infinity, maxCX = -Infinity, maxCY = -Infinity;
  for (const c of chunks) {
    minCX = Math.min(minCX, c.x);
    minCY = Math.min(minCY, c.y);
    maxCX = Math.max(maxCX, c.x);
    maxCY = Math.max(maxCY, c.y);
  }

  const rangeX = maxCX - minCX + 1;
  const rangeY = maxCY - minCY + 1;
  const scaleX = size / (rangeX * CHUNK_TILES);
  const scaleY = size / (rangeY * CHUNK_TILES);
  const scale = Math.min(scaleX, scaleY);

  // Рисуем тайлы (упрощённо — по типу биома)
  for (const chunk of chunks) {
    const offsetX = (chunk.x - minCX) * CHUNK_TILES * scale;
    const offsetY = (chunk.y - minCY) * CHUNK_TILES * scale;

    // Рисуем чанк цветом биома
    ctx.fillStyle = "#2d5a27"; // Grass base
    ctx.fillRect(offsetX, offsetY, CHUNK_TILES * scale, CHUNK_TILES * scale);

    // Solid тайлы — тёмнее
    ctx.fillStyle = "#1a3a17";
    for (let ty = 0; ty < Math.min(chunk.tiles.length, 16); ty += 4) {
      for (let tx = 0; tx < Math.min(chunk.tiles[ty]?.length ?? 0, 16); tx += 4) {
        if (chunk.tiles[ty]?.[tx] === 1) {
          ctx.fillRect(
            offsetX + tx * scale,
            offsetY + ty * scale,
            4 * scale,
            4 * scale,
          );
        }
      }
    }
  }

  // Рисуем игрока
  const px = ((playerX / TILE_PX) - minCX * CHUNK_TILES) * scale;
  const py = ((playerY / TILE_PX) - minCY * CHUNK_TILES) * scale;
  ctx.fillStyle = "#00ff88";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();

  // Граница
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeRect(0, 0, size, size);
}

// ─── HUD Update ──────────────────────────────────────────────────────────────

function updateHUD(player: Entity): void {
  const hp = player.getComponent(HealthComponent);
  const mana = player.getComponent(ManaComponent);
  const xp = player.getComponent(XPComponent);
  const inv = player.getComponent(InventoryComponent);

  if (hp) {
    const pct = (hp.current / hp.max) * 100;
    const fill = $("camp-hp-fill") as HTMLElement;
    const text = $("camp-hp-text");
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `${Math.ceil(hp.current)}/${hp.max}`;
  }

  if (mana) {
    const pct = (mana.current / mana.max) * 100;
    const fill = $("camp-mana-fill") as HTMLElement;
    const text = $("camp-mana-text");
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `${Math.ceil(mana.current)}/${mana.max}`;
  }

  if (xp) {
    const pct = (xp.current / xp.max) * 100;
    const fill = $("camp-xp-fill") as HTMLElement;
    const lvl = $("camp-level");
    if (fill) fill.style.width = `${pct}%`;
    if (lvl) lvl.textContent = String(xp.level);
  }

  if (inv) {
    const gold = $("camp-gold");
    if (gold) gold.textContent = String(inv.currency);
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

function setupEventListeners(): void {
  // Pause: ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (state.onboarding) return; // Не пауза во время onboarding
      togglePause();
    }
  });

  // Pause: кнопки
  $("camp-resume")?.addEventListener("click", () => setPause(false));
  $("camp-quit")?.addEventListener("click", quitToHub);

  // Onboarding
  $("camp-onboard-next")?.addEventListener("click", advanceOnboarding);

  // Game mode dropdown
  const dropdown = $("gamemode-dropdown");
  $("hub-gamemode")?.addEventListener("click", () => {
    dropdown?.classList.toggle("hidden");
  });

  // Выбор режима
  document.querySelectorAll<HTMLElement>(".gm-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "world") {
        startCampaign();
      } else {
        dropdown?.classList.add("hidden");
      }
    });
  });

  // Закрыть dropdown при клике вне
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".hb-mode") && !dropdown?.classList.contains("hidden")) {
      dropdown?.classList.add("hidden");
    }
  });

  // Resize
  window.addEventListener("resize", () => {
    const canvas = $(CANVAS_ID) as HTMLCanvasElement;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    state.camera?.setViewport(window.innerWidth, window.innerHeight);
  });
}

// ─── Pause ───────────────────────────────────────────────────────────────────

function togglePause(): void {
  setPause(!state.paused);
}

function setPause(paused: boolean): void {
  state.paused = paused;
  if (paused) {
    show(PAUSE_ID);
    hide(HUD_ID);
    document.body.style.cursor = "default";
  } else {
    hide(PAUSE_ID);
    show(HUD_ID);
    document.body.style.cursor = "crosshair";
    state.lastTime = 0; // Сброс dt чтобы не было скачка
  }
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

const ONBOARD_STEPS = [
  {
    title: "Welcome to BomberMeme World",
    body: `<p><b>WASD</b> to move freely — no grid, go anywhere you want!</p>
           <p>Explore the open world, fight enemies, and uncover the secrets of the Seven Factions.</p>`,
  },
  {
    title: "Combat Basics",
    body: `<p><b>LMB (hold)</b> to charge and throw a bomb toward your cursor.</p>
           <p>The longer you hold, the farther it flies. Release to throw!</p>
           <p>Bombs bounce off walls and chain-explode when near each other.</p>`,
  },
  {
    title: "Skills & Abilities",
    body: `<p><b>RMB</b> to use your hero's unique skill.</p>
           <p>Each of the 100 heroes has a different skill — experiment to find your playstyle!</p>
           <p>Skills cost mana and have cooldowns. Watch the skill bar at the bottom.</p>`,
  },
  {
    title: "Ready to Explore",
    body: `<p><b>I</b> — Inventory · <b>M</b> — World Map · <b>ESC</b> — Pause</p>
           <p>Complete quests, level up, and unlock all 100 heroes across 7 unique worlds.</p>
           <p>Good luck, bomber! 💣</p>`,
  },
];

let onboardStep = 0;

function startOnboarding(): void {
  state.onboarding = true;
  onboardStep = 0;
  show(ONBOARD_ID);
  showOnboardStep(0);
}

function showOnboardStep(step: number): void {
  const data = ONBOARD_STEPS[step];
  const title = $("camp-onboard-title");
  const body = $("camp-onboard-body");
  const dots = document.querySelectorAll(".camp-step-dot");
  const btn = $("camp-onboard-next") as HTMLButtonElement;

  if (title) title.textContent = data.title;
  if (body) body.innerHTML = data.body;

  dots.forEach((d, i) => d.classList.toggle("active", i === step));

  if (btn) {
    btn.textContent = step < ONBOARD_STEPS.length - 1 ? "Next →" : "Start Adventure!";
  }
}

function advanceOnboarding(): void {
  onboardStep++;
  if (onboardStep >= ONBOARD_STEPS.length) {
    state.onboarding = false;
    hide(ONBOARD_ID);
    show(HUD_ID);
    document.body.style.cursor = "crosshair";
    localStorage.setItem("bp_campaign_onboarded", "1");
    return;
  }
  showOnboardStep(onboardStep);
}

// ─── Loading Text ────────────────────────────────────────────────────────────

function updateLoadingText(text: string): void {
  const el = $("campaign-loading-text");
  if (el) el.textContent = text;
}

// ─── Quit ────────────────────────────────────────────────────────────────────

function quitToHub(): void {
  stopCampaign();
  // Возвращаемся в menu
  const { showScreen } = await import("../ui/lobby.js");
  showScreen("menu");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Запуск Campaign Mode (вызывается из main.ts). */
export async function startCampaign(): Promise<void> {
  if (state.running) return; // Уже запущено

  // Скрываем dropdown
  $("gamemode-dropdown")?.classList.add("hidden");

  // Показываем экран campaign
  const { showScreen } = await import("../ui/lobby.js");
  showScreen("campaign");

  // Показываем loading
  show(LOADING_ID);
  hide(HUD_ID);
  hide(PAUSE_ID);

  try {
    // Выбор героя (если первый раз)
    updateLoadingText("Choosing hero…");
    const heroId = await selectHero();

    // Инициализация мира
    updateLoadingText("Loading world…");
    await initWorld(heroId);

    // Скрываем loading
    hide(LOADING_ID);

    // Onboarding (если первый раз)
    const onboarded = localStorage.getItem("bp_campaign_onboarded");
    if (!onboarded) {
      startOnboarding();
    } else {
      show(HUD_ID);
      document.body.style.cursor = "crosshair";
    }

    // Запускаем game loop
    state.running = true;
    state.lastTime = 0;
    state.animFrame = requestAnimationFrame(gameLoop);

  } catch (err) {
    console.error("Failed to start campaign:", err);
    updateLoadingText("Error loading world. Check console.");
  }
}

/** Остановка Campaign Mode. */
export function stopCampaign(): void {
  state.running = false;
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = 0;
  }
  state.world = null;
  state.chunkManager = null;
  state.camera = null;
  state.renderer = null;
  state.input = null;
  state.player = null;
  document.body.style.cursor = "default";
}

/** Проверяет, запущен ли campaign. */
export function isCampaignRunning(): boolean {
  return state.running;
}
