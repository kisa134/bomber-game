// SpriteComponent — visual appearance: sprite reference, animation, frame, direction, layer.

import { Component } from "../ECS.js";
import type { CampaignDirection } from "@bomberpump/shared";

export type RenderLayer = "ground" | "object" | "entity" | "effect" | "ui";

export class SpriteComponent extends Component {
  /** Base sprite ID, e.g. "skin_0" or "tree_oak". */
  spriteId: string;

  /** Current animation name, e.g. "idle", "walk", "attack". */
  animation: string;

  /** Current frame index (0, 1, 2 for 3-frame animations). */
  frame: number;

  /** Facing direction — drives which sprite variant is shown. */
  direction: CampaignDirection;

  /** Render layer — ground is drawn first, effects last. */
  layer: RenderLayer;

  /** Frame timer for animation cycling. */
  frameTimer: number;

  /** Ms per animation frame. */
  frameInterval: number;

  /** Whether the sprite should be flipped horizontally (for left-facing side sprites). */
  flipX: boolean;

  /** Tint color applied when rendering ("#ffffff" = no tint). */
  tint: string;

  /** Opacity 0..1. */
  alpha: number;

  constructor(
    spriteId: string,
    layer: RenderLayer = "entity",
    animation = "idle",
    direction: CampaignDirection = "down",
    frameInterval = 120,
  ) {
    super("sprite");
    this.spriteId = spriteId;
    this.animation = animation;
    this.frame = 0;
    this.direction = direction;
    this.layer = layer;
    this.frameTimer = 0;
    this.frameInterval = frameInterval;
    this.flipX = direction === "left";
    this.tint = "#ffffff";
    this.alpha = 1;
  }

  /** Advance animation by dt (ms). Returns true if frame changed. */
  tick(dt: number): boolean {
    this.frameTimer += dt;
    if (this.frameTimer >= this.frameInterval) {
      this.frameTimer -= this.frameInterval;
      this.frame = (this.frame + 1) % 3; // 3-frame cycle
      return true;
    }
    return false;
  }

  /** Set direction and update flipX accordingly. */
  setDirection(dir: CampaignDirection): void {
    this.direction = dir;
    this.flipX = dir === "left";
  }

  /** Get the full sprite key for the current state, e.g. "skin_0_down_1". */
  getSpriteKey(): string {
    const dirName = this.direction === "left" ? "side" : this.direction === "right" ? "side" : this.direction;
    return `${this.spriteId}_${this.animation}_${dirName}_${this.frame}`;
  }

  /** Get the fallback sprite key (static portrait) when directional frames are missing. */
  getFallbackKey(): string {
    return `${this.spriteId}`;
  }
}
