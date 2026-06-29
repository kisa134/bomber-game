import type { Vec2 } from "@bomberpump/shared";
import { CHUNK_SIZE_TILES } from "./ChunkManager.js";

const TILE_PX = 48;
const CHUNK_PX = CHUNK_SIZE_TILES * TILE_PX;

export class Camera {
  position: Vec2 = { x: 0, y: 0 };
  zoom = 1.0;
  minZoom = 0.25;
  maxZoom = 4.0;
  lerpFactor = 0.08;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private dpr = 1;
  target: Vec2 | null = null;
  private shakeX = 0;
  private shakeY = 0;
  private shakeDecay = 0;

  resize(width: number, height: number, dpr = 1): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.dpr = dpr;
  }

  update(_dt: number): void {
    if (this.target) {
      this.position.x += (this.target.x - this.position.x) * this.lerpFactor;
      this.position.y += (this.target.y - this.position.y) * this.lerpFactor;
    }
    if (this.shakeDecay > 0) {
      this.shakeX *= this.shakeDecay;
      this.shakeY *= this.shakeDecay;
      this.shakeDecay *= 0.9;
      if (Math.abs(this.shakeX) < 0.5) this.shakeX = 0;
      if (Math.abs(this.shakeY) < 0.5) this.shakeY = 0;
    }
  }

  worldToScreen(worldX: number, worldY: number): Vec2 {
    const halfW = this.canvasWidth / 2;
    const halfH = this.canvasHeight / 2;
    return {
      x: (worldX - this.position.x) * this.zoom + halfW + this.shakeX,
      y: (worldY - this.position.y) * this.zoom + halfH + this.shakeY,
    };
  }

  screenToWorld(screenX: number, screenY: number): Vec2 {
    const halfW = this.canvasWidth / 2;
    const halfH = this.canvasHeight / 2;
    return {
      x: (screenX - halfW - this.shakeX) / this.zoom + this.position.x,
      y: (screenY - halfH - this.shakeY) / this.zoom + this.position.y,
    };
  }

  getVisibleArea(): { x: number; y: number; w: number; h: number } {
    const halfW = this.canvasWidth / 2 / this.zoom;
    const halfH = this.canvasHeight / 2 / this.zoom;
    return {
      x: this.position.x - halfW,
      y: this.position.y - halfH,
      w: halfW * 2,
      h: halfH * 2,
    };
  }

  getVisibleChunks(): Array<{ cx: number; cy: number }> {
    const area = this.getVisibleArea();
    const minCx = Math.floor(area.x / CHUNK_PX);
    const minCy = Math.floor(area.y / CHUNK_PX);
    const maxCx = Math.floor((area.x + area.w) / CHUNK_PX);
    const maxCy = Math.floor((area.y + area.h) / CHUNK_PX);
    const result: Array<{ cx: number; cy: number }> = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        result.push({ cx, cy });
      }
    }
    return result;
  }

  isVisible(worldX: number, worldY: number, margin = 64): boolean {
    const area = this.getVisibleArea();
    return (
      worldX >= area.x - margin &&
      worldX <= area.x + area.w + margin &&
      worldY >= area.y - margin &&
      worldY <= area.y + area.h + margin
    );
  }

  shake(magnitude: number, decay = 0.85): void {
    const angle = Math.random() * Math.PI * 2;
    this.shakeX = Math.cos(angle) * magnitude;
    this.shakeY = Math.sin(angle) * magnitude;
    this.shakeDecay = decay;
  }

  setZoom(z: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  zoomBy(delta: number): void {
    this.setZoom(this.zoom + delta);
  }

  getDpr(): number { return this.dpr; }
  getSize(): { width: number; height: number } {
    return { width: this.canvasWidth, height: this.canvasHeight };
  }
}
