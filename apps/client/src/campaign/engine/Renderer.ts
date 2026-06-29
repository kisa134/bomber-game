import type { Camera } from "./Camera.js";
import type { Entity, World } from "./ECS.js";
import { TransformComponent } from "./components/TransformComponent.js";
import { SpriteComponent } from "./components/SpriteComponent.js";
import { PhysicsComponent } from "./components/PhysicsComponent.js";
import { CombatComponent } from "./components/CombatComponent.js";
import { ChunkManager } from "./ChunkManager.js";

const TILE_PX = 48;
const spriteCache = new Map<string, HTMLCanvasElement>();
const rawImages = new Map<string, HTMLImageElement>();

function loadRawImage(key: string, basePath: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const exts = [".webp", ".png"];
    let i = 0;
    const tryNext = () => {
      if (i >= exts.length) { resolve(null); return; }
      img.src = `${basePath}${exts[i++]}?v=${Date.now()}`;
    };
    img.onload = () => { rawImages.set(key, img); resolve(img); };
    img.onerror = () => tryNext();
    tryNext();
  });
}

function getScaledSprite(key: string, size: number): HTMLCanvasElement | null {
  const cacheKey = `${key}_s${size}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) return cached;

  const raw = rawImages.get(key);
  if (!raw) return null;

  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = true;
  g.drawImage(raw, 0, 0, size, size);
  spriteCache.set(cacheKey, c);
  return c;
}

export async function preloadCampaignSprites(): Promise<void> {
  const loads: Promise<unknown>[] = [];
  for (let s = 0; s < 20; s++) {
    loads.push(loadRawImage(`skin${s}`, `/sprites/skin_${s}`));
    for (const dir of ["down", "up", "side"]) {
      for (let f = 0; f < 3; f++) {
        loads.push(loadRawImage(`skin${s}_${dir}_${f}`, `/sprites/skin_${s}_${dir}_${f}`));
      }
    }
  }
  for (const f of ["floor", "floor_grate", "floor_neon", "floor_sand", "floor_grass"]) {
    loads.push(loadRawImage(f, `/sprites/${f}`));
  }
  for (const b of ["hard", "soft", "hard_stone", "hard_sand", "soft_sand"]) {
    loads.push(loadRawImage(b, `/sprites/${b}`));
  }
  await Promise.all(loads);
}

export class CampaignRenderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private chunkManager: ChunkManager;
  private world: World;
  private dpr = 1;
  private lowFx = false;
  private floorCache = new Map<string, HTMLCanvasElement>();
  private floorCacheDirty = true;
  private entitySize = 48;
  private cssWidth = 0;
  private cssHeight = 0;
  debug = false;
  private frames = 0;
  private lastFpsTime = 0;
  fps = 0;
  renderedEntityCount = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    camera: Camera,
    chunkManager: ChunkManager,
    world: World,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.camera = camera;
    this.chunkManager = chunkManager;
    this.world = world;
    this.detectLowFx();
  }

  private detectLowFx(): void {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.lowFx = coarse || touch;
  }

  resize(): void {
    this.detectLowFx();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.lowFx ? 1.5 : 2);

    const host = this.canvas.parentElement;
    const cs = host ? getComputedStyle(host) : null;
    const padX = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0;
    const padY = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 0;
    const margin = this.lowFx ? 0 : 22;

    const availW = (host?.clientWidth || window.innerWidth) - padX - margin * 2;
    const availH = (host?.clientHeight || window.innerHeight) - padY - margin * 2;

    this.cssWidth = availW;
    this.cssHeight = availH;

    this.canvas.width = Math.max(1, Math.round(availW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(availH * this.dpr));
    this.canvas.style.width = `${availW}px`;
    this.canvas.style.height = `${availH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = !this.lowFx;

    this.camera.resize(availW, availH, this.dpr);
    this.floorCacheDirty = true;
  }

  render(): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const zoom = cam.zoom;
    const { width, height } = cam.getSize();

    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastFpsTime = now;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    const halfW = width / 2;
    const halfH = height / 2;
    ctx.translate(halfW, halfH);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.position.x, -cam.position.y);

    this.renderGround(ctx, cam);
    this.renderObjects(ctx, cam);
    this.renderEntities(ctx, cam);
    this.renderEffects(ctx, cam);

    ctx.restore();

    if (this.debug) {
      this.renderDebug(ctx, width, height);
    }
  }

  private renderGround(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const visible = cam.getVisibleChunks();
    const floorKey = this.lowFx ? "floor" : "floor_grass";

    for (const { cx, cy } of visible) {
      const chunkKey = ChunkManager.key("default", cx, cy);
      const chunk = this.chunkManager.getChunk(chunkKey);
      if (!chunk) continue;

      const chunkPixelX = cx * 256 * TILE_PX;
      const chunkPixelY = cy * 256 * TILE_PX;

      let floorCanvas = this.floorCache.get(chunkKey);
      if (!floorCanvas || this.floorCacheDirty) {
        floorCanvas = this.buildFloorCanvas(chunk, floorKey);
        if (floorCanvas) this.floorCache.set(chunkKey, floorCanvas);
      }

      if (floorCanvas) {
        ctx.drawImage(floorCanvas, chunkPixelX, chunkPixelY, 256 * TILE_PX, 256 * TILE_PX);
      } else {
        ctx.fillStyle = "#2e4a24";
        ctx.fillRect(chunkPixelX, chunkPixelY, 256 * TILE_PX, 256 * TILE_PX);
      }

      this.renderChunkBlocks(ctx, chunk, chunkPixelX, chunkPixelY);
    }
    this.floorCacheDirty = false;
  }

  private buildFloorCanvas(
    chunk: { tiles: number[][] },
    floorSpriteKey: string,
  ): HTMLCanvasElement | null {
    const size = 256 * TILE_PX;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    if (!g) return null;

    const floorImg = getScaledSprite(floorSpriteKey, TILE_PX);

    for (let ty = 0; ty < 256; ty++) {
      const row = chunk.tiles[ty];
      if (!row) continue;
      for (let tx = 0; tx < 256; tx++) {
        const tileId = row[tx];
        const px = tx * TILE_PX;
        const py = ty * TILE_PX;

        if (tileId === 1 || tileId === 2) {
          g.fillStyle = (tx + ty) % 2 === 0 ? "#345628" : "#2e4a24";
          g.fillRect(px, py, TILE_PX, TILE_PX);
        } else if (floorImg) {
          g.drawImage(floorImg, px, py);
        } else {
          g.fillStyle = (tx + ty) % 2 === 0 ? "#4b8a30" : "#427a2b";
          g.fillRect(px, py, TILE_PX, TILE_PX);
        }
      }
    }
    return c;
  }

  private renderChunkBlocks(
    ctx: CanvasRenderingContext2D,
    chunk: { tiles: number[][] },
    chunkPixelX: number,
    chunkPixelY: number,
  ): void {
    const cam = this.camera;
    const area = cam.getVisibleArea();

    const startTx = Math.max(0, Math.floor((area.x - chunkPixelX) / TILE_PX));
    const startTy = Math.max(0, Math.floor((area.y - chunkPixelY) / TILE_PX));
    const endTx = Math.min(256, Math.ceil((area.x + area.w - chunkPixelX) / TILE_PX) + 1);
    const endTy = Math.min(256, Math.ceil((area.y + area.h - chunkPixelY) / TILE_PX) + 1);

    for (let ty = startTy; ty < endTy; ty++) {
      const row = chunk.tiles[ty];
      if (!row) continue;
      for (let tx = startTx; tx < endTx; tx++) {
        const tileId = row[tx];
        if (tileId !== 1 && tileId !== 2) continue;

        const px = chunkPixelX + tx * TILE_PX;
        const py = chunkPixelY + ty * TILE_PX;
        const spriteKey = tileId === 1 ? "hard" : "soft";
        const sprite = getScaledSprite(spriteKey, TILE_PX);

        if (sprite) {
          ctx.drawImage(sprite, px, py);
        } else {
          if (tileId === 1) {
            ctx.fillStyle = "#414a5e";
            ctx.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
            ctx.fillStyle = "#535e76";
            ctx.fillRect(px + 1, py + 1, TILE_PX - 2, (TILE_PX - 2) * 0.35);
          } else {
            ctx.fillStyle = "#8a5a3c";
            ctx.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
            ctx.fillStyle = "#a06b48";
            ctx.fillRect(px + 2, py + 2, TILE_PX - 4, (TILE_PX - 4) * 0.4);
          }
        }
      }
    }
  }

  private renderObjects(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const visible = cam.getVisibleChunks();
    for (const { cx, cy } of visible) {
      const chunkKey = ChunkManager.key("default", cx, cy);
      const chunk = this.chunkManager.getChunk(chunkKey);
      if (!chunk) continue;
      for (const obj of chunk.objects) {
        if (!cam.isVisible(obj.x, obj.y, 32)) continue;
        ctx.fillStyle = "#5a4030";
        ctx.fillRect(obj.x - obj.width / 2, obj.y - obj.height, obj.width, obj.height);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(obj.x, obj.y, obj.width * 0.4, obj.height * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderEntities(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const zoom = cam.zoom;
    const size = Math.max(1, Math.round(this.entitySize * zoom));
    let rendered = 0;

    const toRender: Array<{
      entity: Entity;
      transform: TransformComponent;
      sprite: SpriteComponent;
      y: number;
    }> = [];

    for (const entity of this.world.entities.values()) {
      const transform = entity.getComponent<TransformComponent>("transform");
      const sprite = entity.getComponent<SpriteComponent>("sprite");
      if (!transform || !sprite) continue;

      const pos = transform.position;
      if (!cam.isVisible(pos.x, pos.y, size)) continue;

      toRender.push({ entity, transform, sprite, y: pos.y });
    }

    toRender.sort((a, b) => a.y - b.y);

    for (const { transform, sprite } of toRender) {
      const pos = transform.position;
      const x = pos.x;
      const y = pos.y;

      if (!this.lowFx) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.38, size * 0.3, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      let spriteKey = sprite.getSpriteKey();
      let img = getScaledSprite(spriteKey, size);
      if (!img) {
        const dirName = sprite.direction === "left" || sprite.direction === "right" ? "side" : sprite.direction;
        spriteKey = `${sprite.spriteId}_${dirName}_${sprite.frame}`;
        img = getScaledSprite(spriteKey, size);
      }
      if (!img) {
        spriteKey = sprite.getFallbackKey();
        img = getScaledSprite(spriteKey, size);
      }

      ctx.save();
      ctx.translate(x, y);
      if (sprite.flipX) ctx.scale(-1, 1);

      if (img) {
        if (sprite.tint !== "#ffffff" || sprite.alpha < 1) {
          ctx.globalAlpha = sprite.alpha;
          ctx.drawImage(img, -size / 2, -size / 2);
          ctx.globalAlpha = 1;
        } else {
          ctx.drawImage(img, -size / 2, -size / 2);
        }
      } else {
        ctx.fillStyle = "#8888ff";
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      rendered++;

      const combat = toRender.find((r) => r.transform === transform)?.entity.getComponent<CombatComponent>("combat");
      if (combat && combat.isAlive && combat.maxHp > 0) {
        const hpFrac = combat.getHpFraction();
        const barW = size * 0.7;
        const barH = Math.max(2, size * 0.08);
        const barX = x - barW / 2;
        const barY = y - size * 0.6;

        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = hpFrac > 0.3 ? "#5fd96a" : "#ff5555";
        ctx.fillRect(barX, barY, barW * hpFrac, barH);
      }
    }

    this.renderedEntityCount = rendered;
  }

  private renderEffects(ctx: CanvasRenderingContext2D, cam: Camera): void {
    void ctx;
    void cam;
  }

  updateAnimations(dt: number): void {
    for (const entity of this.world.entities.values()) {
      const sprite = entity.getComponent<SpriteComponent>("sprite");
      if (!sprite) continue;
      const physics = entity.getComponent<PhysicsComponent>("physics");
      if (physics?.isMoving) {
        sprite.tick(dt);
      } else {
        sprite.frame = 1;
      }
    }
  }

  private renderDebug(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(4, 4, 180, 90);
    ctx.fillStyle = "#ffffff";
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`FPS: ${this.fps}`, 10, 10);
    ctx.fillText(`Entities: ${this.renderedEntityCount}/${this.world.entities.size}`, 10, 28);
    ctx.fillText(`Chunks: ${this.chunkManager.getLoadedCount()}`, 10, 46);
    ctx.fillText(`Cam: ${Math.round(this.camera.position.x)},${Math.round(this.camera.position.y)}`, 10, 64);
    void w;
  }

  invalidateFloorCache(): void {
    this.floorCache.clear();
    this.floorCacheDirty = true;
  }
}
