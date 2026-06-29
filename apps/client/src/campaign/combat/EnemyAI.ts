import type { Entity } from "../engine/ECS.js";
import { TransformComponent } from "../engine/components/TransformComponent.js";
import { PhysicsComponent } from "../engine/components/PhysicsComponent.js";

export type AIBehavior = "wander" | "chase" | "flee" | "patrol";

export interface AIConfig {
  behavior: AIBehavior;
  aggroRange: number;
  attackRange: number;
  speed: number;
  patrolPoints?: Array<{ x: number; y: number }>;
}

export class EnemyAI {
  private entity: Entity;
  private config: AIConfig;
  private target: Entity | null = null;
  private wanderAngle = Math.random() * Math.PI * 2;
  private patrolIndex = 0;

  constructor(entity: Entity, config: AIConfig) {
    this.entity = entity;
    this.config = config;
  }

  update(dt: number, nearbyPlayers: Entity[]): void {
    const transform = this.entity.getComponent<TransformComponent>("transform");
    const physics = this.entity.getComponent<PhysicsComponent>("physics");
    if (!transform || !physics) return;

    // Find nearest player
    let nearestDist = Infinity;
    let nearest: Entity | null = null;
    for (const p of nearbyPlayers) {
      const pt = p.getComponent<TransformComponent>("transform");
      if (!pt) continue;
      const dist = Math.hypot(pt.position.x - transform.position.x, pt.position.y - transform.position.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = p;
      }
    }
    this.target = nearest;

    switch (this.config.behavior) {
      case "wander":
        this.wander(dt, transform, physics);
        break;
      case "chase":
        if (nearest && nearestDist < this.config.aggroRange) {
          this.chase(dt, transform, physics, nearest);
        } else {
          this.wander(dt, transform, physics);
        }
        break;
      case "flee":
        if (nearest && nearestDist < this.config.aggroRange) {
          this.flee(dt, transform, physics, nearest);
        } else {
          this.wander(dt, transform, physics);
        }
        break;
      case "patrol":
        this.patrol(dt, transform, physics);
        break;
    }
  }

  private wander(dt: number, transform: TransformComponent, physics: PhysicsComponent): void {
    this.wanderAngle += (Math.random() - 0.5) * 2;
    physics.velocity.x = Math.cos(this.wanderAngle) * this.config.speed * 0.3;
    physics.velocity.y = Math.sin(this.wanderAngle) * this.config.speed * 0.3;
  }

  private chase(dt: number, transform: TransformComponent, physics: PhysicsComponent, target: Entity): void {
    const tt = target.getComponent<TransformComponent>("transform")!;
    const dx = tt.position.x - transform.position.x;
    const dy = tt.position.y - transform.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      physics.velocity.x = (dx / dist) * this.config.speed;
      physics.velocity.y = (dy / dist) * this.config.speed;
    }
  }

  private flee(dt: number, transform: TransformComponent, physics: PhysicsComponent, target: Entity): void {
    const tt = target.getComponent<TransformComponent>("transform")!;
    const dx = transform.position.x - tt.position.x;
    const dy = transform.position.y - tt.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      physics.velocity.x = (dx / dist) * this.config.speed * 1.2;
      physics.velocity.y = (dy / dist) * this.config.speed * 1.2;
    }
  }

  private patrol(dt: number, transform: TransformComponent, physics: PhysicsComponent): void {
    const points = this.config.patrolPoints ?? [{ x: transform.position.x, y: transform.position.y }];
    const target = points[this.patrolIndex];
    const dx = target.x - transform.position.x;
    const dy = target.y - transform.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) {
      this.patrolIndex = (this.patrolIndex + 1) % points.length;
    } else {
      physics.velocity.x = (dx / dist) * this.config.speed * 0.5;
      physics.velocity.y = (dy / dist) * this.config.speed * 0.5;
    }
  }
}
