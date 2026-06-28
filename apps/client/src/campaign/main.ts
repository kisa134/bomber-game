/**
 * BomberMeme World — Campaign Mode Entry Point
 *
 * Инициализация ECS движка, загрузка мира, game loop,
 * onboarding, pause menu, HUD обновление.
 */

import "./campaign.css";

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
  BiomeType,
  Direction,
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

import { HeroRegistry } from "./entities/HeroRegistry.js";
import { SkillRegistry } from "./combat/SkillRegistry.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_ID = "campaign-canvas";
const MINIMAP_ID = "camp-minimap";
const LOADING_ID = "campaign-loading";
const ONBOARD_ID = "campaign-onboard";
const HUD_ID = "campaign-hud";
const PAUSE_ID = "campaign-pause";

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

function $(id: string): HTMLElement | null { return document.getElementById(id); }
function show(id: string): void { $(id)?.classList.remove("hidden"); }
function hide(id: string): void { $(id)?.classList.add("hidden"); }

// ─── Hero Selection ──────────────────────────────────────────────────────────

async function selectHero(): Promise<string> {
  return new Promise((resolve) => {
    const saved = localStorage.getItem("bp_campaign_hero");
    if (saved) { resolve(saved); return; }

    const heroes = [
      { id: "hero_0", name: "Zero", title: "Reality Hacker", skill: "Chain Reaction", faction: "neon_cartel", desc: "Former corporate hacker. Bombs chain-link to each other." },
      { id: "hero_28", name: "Wild", title: "Circle Keeper", skill: "Nature's Wrath", faction: "wild_circle", desc: "Last keeper of the Wild Circle. Summons thorn traps." },
      { id: "hero_70", name: "Scorp", title: "Ghost of Sands", skill: "Sand Storm", faction: "sands_eternal", desc: "Mercenary from the Sands of Eternity. Creates a slowing storm." },
    ];

    const modal = document.createElement("div");
    modal.id = "hero-select-modal";
    modal.className = "hero-select-modal";
    modal.innerHTML = `
      <div class="hero-select-card">
        <h2>Choose Your Hero</h2>
        <p class="hero-select-sub">Your journey begins. Pick your first fighter — unlock more later.</p>
        <div class="hero-select-grid">
          ${heroes.map(h => `
            <button class="hero-select-opt" data-hero="${h.id}">
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

async function initWorld(heroId: string): Promise<void> {
  const world = new ECSWorld();
  world.registerSystem(new MovementSystem());
  state.world = world;

  const chunkMgr = new ChunkManager("grasslands", BiomeType.GRASS);
  state.chunkManager = chunkMgr;

  const camera = new Camera(0, 0, window.innerWidth, window.innerHeight);
  camera.setZoom(1.0);
  state.camera = camera;

  const canvas = $(CANVAS_ID) as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d")!;
  const renderer = new CampaignRenderer(ctx, camera);
  state.renderer = renderer;

  const input = new InputManager(canvas);
  state.input = input;

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

  const player = new Entity("player");
  player.addComponent(new TransformComponent(spawnPx.x, spawnPx.y));
  player.addComponent(new VelocityComponent(0, 0));
  player.addComponent(new SpriteComponent(heroDef.spriteId, 32, 48));
  player.addComponent(new ColliderComponent(16, 24));
  player.addComponent(new PlayerControllerComponent());

  const baseStats = heroDef.baseAttributes;
  const maxHp = 100 + baseStats.vit * 10;
  const maxMana = 50 + baseStats.int * 8;
  const moveSpeed = 200 + baseStats.dex * 5;

  player.addComponent(new HealthComponent(maxHp, maxHp));
  player.addComponent(new ManaComponent(maxMana, maxMana));
  player.addComponent(new XPComponent(0, 100, 1));
  player.addComponent(new InventoryComponent(30));
  player.addComponent(new StatsComponent(baseStats, moveSpeed));

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

  camera.follow(player);

  updateLoadingText("Generating world\u2026");
  chunkMgr.updatePlayerPosition(spawnPx.x, spawnPx.y, CHUNK_LOAD_RADIUS);

  const minimapCanvas = $(MINIMAP_ID) as HTMLCanvasElement;
  state.minimapCtx = minimapCanvas.getContext("2d")!;

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

  const dt = state.lastTime ? Math.min((timestamp - state.lastTime) / 1000, 0.05) : 0.016;
  state.lastTime = timestamp;

  input.update();

  const inputState = input.getState();
  if (inputState.moveX !== 0 || inputState.moveY !== 0) {
    const stats = player.getComponent(StatsComponent);
    const speed = stats ? stats.moveSpeed : 200;
    player.getComponent(VelocityComponent)?.set(inputState.moveX * speed, inputState.moveY * speed);
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

  const transform = player.getComponent(TransformComponent);
  if (transform) {
    chunkManager.updatePlayerPosition(transform.x, transform.y, CHUNK_LOAD_RADIUS);
  }

  world.update(dt);
  camera.update(dt);

  const loadedChunks = chunkManager.getLoadedChunks();
  renderer.render(world, loadedChunks, chunkManager.getCurrentBiome());

  if (minimapCtx && transform) {
    renderMinimap(minimapCtx, loadedChunks, transform.x, transform.y);
  }

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

  let minCX = Infinity, minCY = Infinity, maxCX = -Infinity, maxCY = -Infinity;
  for (const c of chunks) {
    minCX = Math.min(minCX, c.x); minCY = Math.min(minCY, c.y);
    maxCX = Math.max(maxCX, c.x); maxCY = Math.max(maxCY, c.y);
  }

  const rangeX = maxCX - minCX + 1;
  const rangeY = maxCY - minCY + 1;
  const scaleX = size / (rangeX * CHUNK_TILES);
  const scaleY = size / (rangeY * CHUNK_TILES);
  const scale = Math.min(scaleX, scaleY);

  for (const chunk of chunks) {
    const offsetX = (chunk.x - minCX) * CHUNK_TILES * scale;
    const offsetY = (chunk.y - minCY) * CHUNK_TILES * scale;
    ctx.fillStyle = "#2d5a27";
    ctx.fillRect(offsetX, offsetY, CHUNK_TILES * scale, CHUNK_TILES * scale);
    ctx.fillStyle = "#1a3a17";
    for (let ty = 0; ty < Math.min(chunk.tiles.length, 16); ty += 4) {
      for (let tx = 0; tx < Math.min(chunk.tiles[ty]?.length ?? 0, 16); tx += 4) {
        if (chunk.tiles[ty]?.[tx] === 1) {
          ctx.fillRect(offsetX + tx * scale, offsetY + ty * scale, 4 * scale, 4 * scale);
        }
      }
    }
  }

  const px = ((playerX / TILE_PX) - minCX * CHUNK_TILES) * scale;
  const py = ((playerY / TILE_PX) - minCY * CHUNK_TILES) * scale;
  ctx.fillStyle = "#00ff88";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
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
    const fill = $("camp-hp-fill") as HTMLElement;
    if (fill) fill.style.width = `${(hp.current / hp.max) * 100}%`;
    const text = $("camp-hp-text");
    if (text) text.textContent = `${Math.ceil(hp.current)}/${hp.max}`;
  }

  if (mana) {
    const fill = $("camp-mana-fill") as HTMLElement;
    if (fill) fill.style.width = `${(mana.current / mana.max) * 100}%`;
    const text = $("camp-mana-text");
    if (text) text.textContent = `${Math.ceil(mana.current)}/${mana.max}`;
  }

  if (xp) {
    const fill = $("camp-xp-fill") as HTMLElement;
    if (fill) fill.style.width = `${(xp.current / xp.max) * 100}%`;
    const lvl = $("camp-level");
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
      if (state.onboarding) return;
      togglePause();
    }
  });

  // Pause buttons
  $("camp-resume")?.addEventListener("click", () => setPause(false));
  $("camp-quit")?.addEventListener("click", () => {
    stopCampaign();
    import("../ui/lobby.js").then(({ showScreen }) => showScreen("menu"));
  });

  // Onboarding
  $("camp-onboard-next")?.addEventListener("click", advanceOnboarding);

  // Resize
  window.addEventListener("resize", () => {
    const canvas = $(CANVAS_ID) as HTMLCanvasElement;
    if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    state.camera?.setViewport(window.innerWidth, window.innerHeight);
  });
}

// ─── Pause ───────────────────────────────────────────────────────────────────

function togglePause(): void { setPause(!state.paused); }

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
    state.lastTime = 0;
  }
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

const ONBOARD_STEPS = [
  { title: "Welcome to BomberMeme World", body: `<p><b>WASD</b> to move freely — no grid, go anywhere!</p><p>Explore the open world, fight enemies, and uncover the secrets of the Seven Factions.</p>` },
  { title: "Combat Basics", body: `<p><b>LMB (hold)</b> to charge and throw a bomb toward your cursor.</p><p>The longer you hold, the farther it flies.</p>` },
  { title: "Skills & Abilities", body: `<p><b>RMB</b> to use your hero's unique skill.</p><p>Each hero has a different skill — find your playstyle!</p>` },
  { title: "Ready to Explore", body: `<p><b>I</b> — Inventory · <b>M</b> — Map · <b>ESC</b> — Pause</p><p>Good luck, bomber! 💣</p>` },
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
  if (btn) btn.textContent = step < ONBOARD_STEPS.length - 1 ? "Next →" : "Start Adventure!";
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

// ─── Public API ──────────────────────────────────────────────────────────────

/** Запуск Campaign Mode (вызывается из main.ts). */
export async function startCampaign(): Promise<void> {
  if (state.running) return;

  const { showScreen } = await import("../ui/lobby.js");
  showScreen("campaign");

  show(LOADING_ID);
  hide(HUD_ID);
  hide(PAUSE_ID);
  hide(ONBOARD_ID);

  try {
    updateLoadingText("Choosing hero\u2026");
    const heroId = await selectHero();

    updateLoadingText("Loading world\u2026");
    await initWorld(heroId);

    hide(LOADING_ID);

    const onboarded = localStorage.getItem("bp_campaign_onboarded");
    if (!onboarded) {
      startOnboarding();
    } else {
      show(HUD_ID);
      document.body.style.cursor = "crosshair";
    }

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
