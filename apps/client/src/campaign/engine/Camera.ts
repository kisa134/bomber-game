// Camera — follows a target entity with smooth lerp, handles zoom,
// world/screen coordinate transforms, and visible chunk/area queries.

import type { Vec2 } from "@bomberpump/shared";
import { CHUNK_SIZE_TILES } from "./ChunkManager.js";

const TILE_PX = 48;
const CHUNK_PX = CHUNK_SIZE_TILES * TILE_PX;

export class Camera {
  /** Camera center position in world pixels. */
  position: Vec2 = { x: 0, y: 0 };

  /** Zoom level: 1.0 = default, 0.5 = zoomed out, 2.0 = zoomed in. */
  zoom = 1.0;

  /** Minimum zoom level. */
  minZoom = 0.25;

  /** Maximum zoom level. */
  maxZoom = 4.0;

  /** How quickly the camera catches up to the target (0..1 per frame at 60fps). */
  lerpFactor = 0.08;

  /** Canvas dimensions in CSS pixels. */
  private canvasWidth = 0;
  private canvasHeight = 0;

  /** Device pixel ratio. */
  private dpr = 1;

  /** The entity this camera follows. Set to null for free camera. */
  target: Vec2 | null = null;

  /** Camera shake offset. */
  private shakeX = 0;
  private shakeY = 0;
  private shakeDecay = 0;

  resize(width: number, height: number, dpr = 1): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.dpr = dpr;
  }

  /** Update camera position with lerp toward target. Call each frame. */
  update(_dt: number): void {
    if (this.target) {
      this.position.x += (this.target.x - this.position.x) * this.lerpFactor;
      this.position.y += (this.target.y - this.position.y) * this.lerpFactor;
    }
    // Apply shake decay
    if (this.shakeDecay > 0) {
      this.shakeX *= this.shakeDecay;
      this.shakeY *= this.shakeDecay;
      this.shakeDecay *= 0.9;
      if (Math.abs(this.shakeX) < 0.5) this.shakeX = 0;
      if (Math.abs(this.shakeY) < 0.5) this.shakeY = 0;
    }
  }

  /** Convert world pixel coords to screen (canvas) coords. */
  worldToScreen(worldX: number, worldY: number): Vec2 {
    const halfW = this.canvasWidth / 2;
    const halfH = this.canvasHeight / 2;
    return {
      x: (worldX - this.position.x) * this.zoom + halfW + this.shakeX,
      y: (worldY - this.position.y) * this.zoom + halfH + this.shakeY,
    };
  }

  /** Convert screen (canvas) coords to world pixel coords. */
  screenToWorld(screenX: number, screenY: number): Vec2 {
    const halfW = this.canvasWidth / 2;
    const halfH = this.canvasHeight / 2;
    return {
      x: (screenX - halfW - this.shakeX) / this.zoom + this.position.x,
      y: (screenY - halfH - this.shakeY) / this.zoom + this.position.y,
    };
  }

  /** Get the world-space visible rectangle {x, y, w, h}. */
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

  /** Get chunk coords that are currently visible. Returns array of {cx, cy}. */
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

  /** Check if a world-space point is within the visible area (with margin). */
  isVisible(worldX: number, worldY: number, margin = 64): boolean {
    const area = this.getVisibleArea();
    return (
      worldX >= area.x - margin &&
      worldX <= area.x + area.w + margin &&
      worldY >= area.y - margin &&
      worldY <= area.y + area.h + margin
    );
  }

  /** Check if a world-space rectangle is visible. */
  isRectVisible(
    worldX: number,
    worldY: number,
    width: number,
    height: number,
    margin = 64,
  ): boolean {
    const area = this.getVisibleArea();
    return (
      worldX + width >= area.x - margin &&
      worldX <= area.x + area.w + margin &&
      worldY + height >= area.y - margin &&
      worldY <= area.y + area.h + margin
    );
  }

  /** Apply a screen shake impulse. */
  shake(magnitude: number, decay = 0.85): void {
    const angle = Math.random() * Math.PI * 2;
    this.shakeX = Math.cos(angle) * magnitude;
    this.shakeY = Math.sin(angle) * magnitude;
    this.shakeDecay = decay;
  }

  /** Set zoom with clamping. */
  setZoom(z: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  /** Zoom in/out by a delta. */
  zoomBy(delta: number): void {
    this.setZoom(this.zoom + delta);
  }

  /** Get the DPR (for canvas scaling). */
  getDpr(): number {
    return this.dpr;
  }

  /** Get canvas dimensions. */
  getSize(): { width: number; height: number } {
    return { width: this.canvasWidth, height: this.canvasHeight };
  }
}
