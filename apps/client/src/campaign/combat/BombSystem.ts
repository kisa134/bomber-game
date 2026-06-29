import type { Entity, World } from "../engine/ECS.js";
import { TransformComponent } from "../engine/components/TransformComponent.js";
import { CombatComponent } from "../engine/components/CombatComponent.js";

export interface BombConfig {
  fuseMs: number;
  power: number;
  pierce: boolean;
  chainDelay?: number;
}

export class BombSystem {
  private world: World;
  private bombs: Array<{
    entity: Entity;
    ownerId: string;
    placedAt: number;
    config: BombConfig;
  }> = [];

  constructor(world: World) {
    this.world = world;
  }

  placeBomb(owner: Entity, config: BombConfig): Entity | null {
    const transform = owner.getComponent<TransformComponent>("transform");
    if (!transform) return null;

    const bomb = new Entity("bomb");
    bomb.addComponent(new TransformComponent({
      x: Math.floor(transform.position.x / 48) * 48 + 24,
      y: Math.floor(transform.position.y / 48) * 48 + 24,
    }));
    bomb.addComponent(new CombatComponent(1, 0, config.power, 0));

    this.world.addEntity(bomb);
    this.bombs.push({
      entity: bomb,
      ownerId: owner.id,
      placedAt: performance.now(),
      config,
    });

    return bomb;
  }

  update(): void {
    const now = performance.now();
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (now - bomb.placedAt >= bomb.config.fuseMs) {
        this.explode(bomb.entity, bomb.config);
        this.world.removeEntity(bomb.entity.id);
        this.bombs.splice(i, 1);
      }
    }
  }

  private explode(bomb: Entity, config: BombConfig): void {
    const transform = bomb.getComponent<TransformComponent>("transform");
    if (!transform) return;

    // Get entities in blast radius
    const radius = config.power * 48;
    const entities = this.world.getEntitiesWith("transform", "combat");
    for (const e of entities) {
      if (e.id === bomb.id) continue;
      const et = e.getComponent<TransformComponent>("transform")!;
      const dist = Math.hypot(
        et.position.x - transform.position.x,
        et.position.y - transform.position.y,
      );
      if (dist <= radius) {
        const combat = e.getComponent<CombatComponent>("combat")!;
        combat.takeDamage(25);
      }
    }
  }

  clear(): void {
    this.bombs = [];
  }
}
