// PhysicsComponent — velocity, speed, hitbox, solid flag, chunk tracking.

import { Component } from "../ECS.js";
import type { Vec2 } from "@bomberpump/shared";

export class PhysicsComponent extends Component {
  /** Current velocity vector (pixels per second). */
  velocity: Vec2;

  /** Maximum movement speed (pixels per second). */
  speed: number;

  /** Hitbox radius in pixels. */
  radius: number;

  /** Whether this entity blocks movement of other solid entities. */
  solid: boolean;

  /** Cached chunk coord this entity occupies. Updated by ChunkManager. */
  chunkX: number;
  chunkY: number;

  /** Whether the entity is currently moving (used for animation). */
  isMoving: boolean;

  /** Mass for knockback calculations (0 = infinite / immovable). */
  mass: number;

  /** Friction coefficient 0..1. Applied each frame to velocity. */
  friction: number;

  /** Z-height for jumping/flying effects (0 = ground level). */
  z: number;

  /** Z-velocity for jumps. */
  vz: number;

  constructor(
    speed = 120,
    radius = 16,
    solid = true,
    mass = 1,
    friction = 0.85,
  ) {
    super("physics");
    this.velocity = { x: 0, y: 0 };
    this.speed = speed;
    this.radius = radius;
    this.solid = solid;
    this.chunkX = 0;
    this.chunkY = 0;
    this.isMoving = false;
    this.mass = mass;
    this.friction = friction;
    this.z = 0;
    this.vz = 0;
  }

  getSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.y);
  }

  /** Zero out velocity. */
  stop(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.isMoving = false;
  }

  /** Apply a knockback impulse. */
  applyImpulse(dx: number, dy: number): void {
    this.velocity.x += dx / Math.max(this.mass, 0.01);
    this.velocity.y += dy / Math.max(this.mass, 0.01);
  }
}
