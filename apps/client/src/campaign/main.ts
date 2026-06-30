/**
 * BomberMeme World — Campaign Mode Entry Point
 *
 * Boots the unified-ECS campaign engine, builds its own canvas + HUD inside a
 * caller-provided container, runs the game loop, and exposes a clean
 * start/stop launcher. NOT auto-run on import.
 */

import "./campaign.css";

import { TILE_PX } from "@bomberpump/shared";

import {
  Entity,
  World as ECSWorld,
  MovementSystem,
  Camera,
  CampaignRenderer,
  InputManager,
  ChunkManager,
  CHUNK_SIZE_TILES,
  SpriteComponent,
  TransformComponent,
  PhysicsComponent,
  CombatComponent,
  InputComponent,
  RPGComponent,
} from "./engine/index.js";
import type { CampaignDirection, FactionId, ChunkData } from "@bomberpump/shared";

import { HeroRegistry } from "./entities/HeroRegistry.js";
import { Faction } from "@bomberpump/shared";

// ─── Element IDs (scoped inside the campaign container) ───────────────────────

const CANVAS_ID = "campaign-canvas";
const MINIMAP_ID = "camp-minimap";
const LOADING_ID = "campaign-loading";
const ONBOARD_ID = "campaign-onboard";
const HUD_ID = "campaign-hud";
const PAUSE_ID = "campaign-pause";

const CHUNK_PX = CHUNK_SIZE_TILES * TILE_PX;

// ─── Faction (rpg enum) → FactionId (engine string union) mapping ─────────────

const FACTION_TO_ID: Record<Faction, FactionId> = {
  [Faction.NEON_CARTEL]: "neon_cartel",
  [Faction.CHAPPIE_CULT]: "iron_church",
  [Faction.WILD_CIRCLE]: "wild_circle",
  [Faction.GRATE_CLAN]: "grate_syndicate",
  [Faction.INDUSTRIAL_GUILD]: "industrial_clan",
  [Faction.SANDS_ETERNAL]: "sands_eternal",
  [Faction.VOID_LEGION]: "void",
};

// ─── Campaign State ──────────────────────────────────────────────────────────

interface CampaignState {
  container: HTMLElement | null;
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
  onResize: (() => void) | null;
  onKeyDown: ((e: KeyboardEvent) => void) | null;
}

const state: CampaignState = {
  container: null,
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
  onResize: null,
  onKeyDown: null,
};

function $(id: string): HTMLElement | null {
  return state.container?.querySelector(`#${id}`) ?? document.getElementById(id);
}
function show(id: string): void { $(id)?.classList.remove("hidden"); }
function hide(id: string): void { $(id)?.classList.add("hidden"); }

// ─── DOM Scaffold ────────────────────────────────────────────────────────────

/** Build the canvas + HUD + overlays inside the container. Idempotent. */
function buildDom(container: HTMLElement): void {
  container.innerHTML = `
    <canvas id="${CANVAS_ID}"></canvas>

    <div id="${LOADING_ID}" class="campaign-loading">
      <div class="spinner"></div>
      <div id="campaign-loading-text">Loading world…</div>
    </div>

    <div id="${HUD_ID}" class="campaign-hud hidden">
      <div class="camp-hud-tl">
        <div class="camp-bar-row camp-hp">
          <span class="camp-bar-label">HP</span>
          <div class="camp-bar">
            <div id="camp-hp-fill" class="camp-fill" style="width:100%"></div>
            <span id="camp-hp-text" class="camp-bar-text">100/100</span>
          </div>
        </div>
        <div class="camp-bar-row camp-mana">
          <span class="camp-bar-label">SP</span>
          <div class="camp-bar">
            <div id="camp-mana-fill" class="camp-fill" style="width:100%"></div>
            <span id="camp-mana-text" class="camp-bar-text">0/0</span>
          </div>
        </div>
        <div class="camp-xp-row">
          <span>Lv <span id="camp-level">1</span></span>
          <div class="camp-xp-bar"><div id="camp-xp-fill" class="camp-xp-fill" style="width:0%"></div></div>
        </div>
      </div>

      <div class="camp-hud-tr">
        <div class="camp-minimap-wrap">
          <div id="camp-zone" class="camp-zone">Wild Lands</div>
          <canvas id="${MINIMAP_ID}" class="camp-minimap" width="120" height="120"></canvas>
        </div>
        <div class="camp-currency">💰 <span id="camp-gold">0</span></div>
      </div>

      <div class="camp-hud-bot">
        <div class="camp-hud-hint">WASD move · LMB bomb · RMB skill · ESC pause</div>
      </div>
    </div>

    <div id="${ONBOARD_ID}" class="campaign-onboard hidden">
      <div class="camp-onboard-card">
        <h2 id="camp-onboard-title"></h2>
        <div id="camp-onboard-body"></div>
        <div class="camp-onboard-steps">
          <span class="camp-step-dot"></span>
          <span class="camp-step-dot"></span>
          <span class="camp-step-dot"></span>
          <span class="camp-step-dot"></span>
        </div>
        <button id="camp-onboard-next">Next →</button>
      </div>
    </div>

    <div id="${PAUSE_ID}" class="campaign-pause hidden">
      <div class="camp-pause-card">
        <h2>Paused</h2>
        <button id="camp-resume">Resume</button>
        <button id="camp-quit">Quit to Menu</button>
      </div>
    </div>
  `;
}

// ─── Hero Selection ──────────────────────────────────────────────────────────

function selectHero(): Promise<string> {
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
    (state.container ?? document.body).appendChild(modal);

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

// ─── Local Chunk Loader ──────────────────────────────────────────────────────

/** Procedural fallback chunk generator so the world is walkable offline. */
function makeLocalChunkLoader() {
  return async (worldId: string, cx: number, cy: number): Promise<ChunkData | null> => {
    const size = CHUNK_SIZE_TILES;
    const tiles: number[][] = [];
    for (let y = 0; y < size; y++) {
      const row: number[] = new Array(size).fill(0);
      for (let x = 0; x < size; x++) {
        // Deterministic sparse scatter of hard (1) / soft (2) blocks.
        const h = ((cx * 73856093) ^ (cy * 19349663) ^ (x * 83492791) ^ (y * 50331653)) >>> 0;
        const r = (h % 100) / 100;
        if (r < 0.04) row[x] = 1;
        else if (r < 0.10) row[x] = 2;
        else row[x] = 0;
      }
      tiles.push(row);
    }
    return {
      x: cx,
      y: cy,
      worldId,
      tiles,
      objects: [],
      entities: [],
      lastAccessed: performance.now(),
    };
  };
}

// ─── World Initialization ────────────────────────────────────────────────────

async function initWorld(heroId: string): Promise<void> {
  const container = state.container!;

  const world = new ECSWorld();
  world.addSystem(new MovementSystem());
  state.world = world;

  const chunkMgr = new ChunkManager();
  chunkMgr.setWorld("default");
  chunkMgr.loader = makeLocalChunkLoader();
  state.chunkManager = chunkMgr;

  const camera = new Camera();
  camera.resize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, window.devicePixelRatio || 1);
  camera.setZoom(1.0);
  state.camera = camera;

  const canvas = $(CANVAS_ID) as HTMLCanvasElement;
  const renderer = new CampaignRenderer(canvas, camera, chunkMgr, world);
  renderer.resize();
  state.renderer = renderer;

  const input = new InputManager();
  input.attach();
  state.input = input;

  const registry = HeroRegistry.getInstance();
  const heroDef = registry.get(heroId) ?? registry.get("hero_0")!;

  const spawnChunk = { x: 5, y: 5 };
  const spawnPx = {
    x: (spawnChunk.x * CHUNK_SIZE_TILES + CHUNK_SIZE_TILES / 2) * TILE_PX,
    y: (spawnChunk.y * CHUNK_SIZE_TILES + CHUNK_SIZE_TILES / 2) * TILE_PX,
  };

  const baseStats = heroDef.baseAttributes;
  const maxHp = 100 + baseStats.vit * 10;
  const moveSpeed = 200 + baseStats.dex * 5;
  const factionId = FACTION_TO_ID[heroDef.faction];

  const player = new Entity("player", "player");
  const transform = new TransformComponent({ x: spawnPx.x, y: spawnPx.y });
  player.addComponent(transform);
  player.addComponent(new PhysicsComponent(moveSpeed, 18, true));
  player.addComponent(new SpriteComponent(`skin_${heroDef.skinId}`, "entity"));
  player.addComponent(new CombatComponent(maxHp, 0, 20 + baseStats.str * 2, 0));
  player.addComponent(new InputComponent());
  player.addComponent(new RPGComponent(factionId, 1, baseStats));

  world.addEntity(player);
  state.player = player;

  camera.target = transform.position;
  camera.position.x = transform.position.x;
  camera.position.y = transform.position.y;

  updateLoadingText("Generating world…");
  chunkMgr.update(spawnPx.x, spawnPx.y);

  const minimapCanvas = $(MINIMAP_ID) as HTMLCanvasElement | null;
  state.minimapCtx = minimapCanvas?.getContext("2d") ?? null;

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

  const dtMs = state.lastTime ? Math.min(timestamp - state.lastTime, 50) : 16;
  const dt = dtMs / 1000;
  state.lastTime = timestamp;

  const inputState = input.getState();
  const moveX = inputState.moveDir.x;
  const moveY = inputState.moveDir.y;

  const physics = player.getComponent<PhysicsComponent>("physics");
  const sprite = player.getComponent<SpriteComponent>("sprite");

  if (physics) {
    if (moveX !== 0 || moveY !== 0) {
      physics.velocity.x = moveX * physics.speed;
      physics.velocity.y = moveY * physics.speed;
      physics.isMoving = true;
      if (sprite) {
        let dir: CampaignDirection;
        if (Math.abs(moveX) > Math.abs(moveY)) {
          dir = moveX > 0 ? "right" : "left";
        } else {
          dir = moveY > 0 ? "down" : "up";
        }
        sprite.setDirection(dir);
        sprite.animation = "walk";
      }
    } else {
      physics.stop();
      if (sprite) sprite.animation = "idle";
    }
  }

  const transform = player.getComponent<TransformComponent>("transform");
  if (transform) {
    chunkManager.update(transform.position.x, transform.position.y);
  }

  world.update(dt);
  renderer.updateAnimations(dtMs);
  camera.update(dt);

  renderer.render();

  if (minimapCtx && transform) {
    renderMinimap(minimapCtx, chunkManager, transform.position.x, transform.position.y);
  }

  updateHUD(player);

  state.animFrame = requestAnimationFrame(gameLoop);
}

// ─── Minimap ─────────────────────────────────────────────────────────────────

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  chunkManager: ChunkManager,
  playerX: number,
  playerY: number,
): void {
  const size = 120;
  ctx.clearRect(0, 0, size, size);

  const keys = chunkManager.getLoadedKeys();
  const chunks: ChunkData[] = [];
  for (const key of keys) {
    const c = chunkManager.getChunk(key);
    if (c) chunks.push(c);
  }
  if (chunks.length === 0) return;

  let minCX = Infinity, minCY = Infinity, maxCX = -Infinity, maxCY = -Infinity;
  for (const c of chunks) {
    minCX = Math.min(minCX, c.x); minCY = Math.min(minCY, c.y);
    maxCX = Math.max(maxCX, c.x); maxCY = Math.max(maxCY, c.y);
  }

  const rangeX = maxCX - minCX + 1;
  const rangeY = maxCY - minCY + 1;
  const cellW = size / rangeX;
  const cellH = size / rangeY;

  for (const chunk of chunks) {
    const offsetX = (chunk.x - minCX) * cellW;
    const offsetY = (chunk.y - minCY) * cellH;
    ctx.fillStyle = "#2d5a27";
    ctx.fillRect(offsetX, offsetY, cellW, cellH);
  }

  const pcx = Math.floor(playerX / CHUNK_PX);
  const pcy = Math.floor(playerY / CHUNK_PX);
  const fracX = (playerX % CHUNK_PX) / CHUNK_PX;
  const fracY = (playerY % CHUNK_PX) / CHUNK_PX;
  const px = (pcx - minCX + fracX) * cellW;
  const py = (pcy - minCY + fracY) * cellH;
  ctx.fillStyle = "#00ff88";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeRect(0, 0, size, size);
}

// ─── HUD Update ──────────────────────────────────────────────────────────────

function updateHUD(player: Entity): void {
  const combat = player.getComponent<CombatComponent>("combat");
  const rpg = player.getComponent<RPGComponent>("rpg");

  if (combat) {
    const fill = $("camp-hp-fill") as HTMLElement | null;
    if (fill) fill.style.width = `${(combat.hp / combat.maxHp) * 100}%`;
    const text = $("camp-hp-text");
    if (text) text.textContent = `${Math.ceil(combat.hp)}/${combat.maxHp}`;
  }

  if (rpg) {
    const fill = $("camp-mana-fill") as HTMLElement | null;
    if (fill) fill.style.width = `${(rpg.stamina / Math.max(1, rpg.maxStamina)) * 100}%`;
    const text = $("camp-mana-text");
    if (text) text.textContent = `${Math.ceil(rpg.stamina)}/${Math.ceil(rpg.maxStamina)}`;

    const xpFill = $("camp-xp-fill") as HTMLElement | null;
    if (xpFill) xpFill.style.width = `${(rpg.xp / Math.max(1, rpg.xpToNext)) * 100}%`;
    const lvl = $("camp-level");
    if (lvl) lvl.textContent = String(rpg.level);
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

function setupEventListeners(): void {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      if (state.onboarding) return;
      togglePause();
    }
  };
  state.onKeyDown = onKeyDown;
  document.addEventListener("keydown", onKeyDown);

  $("camp-resume")?.addEventListener("click", () => setPause(false));
  $("camp-quit")?.addEventListener("click", () => {
    stopCampaign();
    import("../ui/lobby.js").then(({ showScreen }) => showScreen("menu")).catch(() => {});
  });

  $("camp-onboard-next")?.addEventListener("click", advanceOnboarding);

  const onResize = (): void => {
    state.renderer?.resize();
  };
  state.onResize = onResize;
  window.addEventListener("resize", onResize);
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
  const dots = state.container?.querySelectorAll(".camp-step-dot") ?? [];
  const btn = $("camp-onboard-next") as HTMLButtonElement | null;

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

/**
 * Launch Campaign Mode inside `container`. Creates its own canvas + HUD,
 * boots the ECS world, and starts the game loop.
 */
export function startCampaign(container: HTMLElement): void {
  if (state.running) return;

  state.container = container;
  container.classList.remove("hidden");
  buildDom(container);

  show(LOADING_ID);
  hide(HUD_ID);
  hide(PAUSE_ID);
  hide(ONBOARD_ID);

  void (async () => {
    try {
      updateLoadingText("Choosing hero…");
      const heroId = await selectHero();

      updateLoadingText("Loading world…");
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
  })();
}

/** Stop Campaign Mode: halt the loop and clean up listeners + state. */
export function stopCampaign(): void {
  state.running = false;
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = 0;
  }

  state.input?.detach();
  if (state.onResize) {
    window.removeEventListener("resize", state.onResize);
    state.onResize = null;
  }
  if (state.onKeyDown) {
    document.removeEventListener("keydown", state.onKeyDown);
    state.onKeyDown = null;
  }

  state.world = null;
  state.chunkManager = null;
  state.camera = null;
  state.renderer = null;
  state.input = null;
  state.player = null;
  state.minimapCtx = null;
  state.paused = false;
  state.onboarding = false;

  document.body.style.cursor = "default";
  state.container?.classList.add("hidden");
  state.container = null;
}

/** Whether the campaign loop is currently running. */
export function isCampaignRunning(): boolean {
  return state.running;
}
