// MovementSystem — reads InputComponent and updates PhysicsComponent velocity,
// then applies velocity to TransformComponent position. Respects speed limits.

import { System, type Entity } from "./ECS.js";
import { TransformComponent } from "./components/TransformComponent.js";
import { PhysicsComponent } from "./components/PhysicsComponent.js";
import { InputComponent } from "./components/InputComponent.js";
import { SpriteComponent } from "./components/SpriteComponent.js";

export class MovementSystem extends System {
  /** Sprint speed multiplier. */
  sprintMultiplier = 1.6;

  /** Stamina cost per second of sprinting. */
  sprintCostPerSec = 20;

  constructor() {
    super("movement", ["transform", "physics", "input"]);
  }

  update(entities: Entity[], dt: number): void {
    const dtSec = dt / 1000;
    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>("transform")!;
      const physics = entity.getComponent<PhysicsComponent>("physics")!;
      const input = entity.getComponent<InputComponent>("input")!;

      // Calculate intended velocity from input
      let speed = physics.speed;
      if (input.isRunning) {
        speed *= this.sprintMultiplier;
      }

      // Set velocity from normalized input direction
      const moveDir = input.moveDir;
      const isMoving = moveDir.x !== 0 || moveDir.y !== 0;

      if (isMoving) {
        physics.velocity.x = moveDir.x * speed;
        physics.velocity.y = moveDir.y * speed;
        physics.isMoving = true;

        // Update facing direction
        input.facing.x = moveDir.x || input.facing.x;
        input.facing.y = moveDir.y || input.facing.y;

        // Update sprite direction
        const sprite = entity.getComponent<SpriteComponent>("sprite");
        if (sprite) {
          const dir = input.getFacingDirection();
          sprite.setDirection(dir);
          sprite.animation = input.isRunning ? "run" : "walk";
        }
      } else {
        physics.isMoving = false;
        // Apply friction when not actively moving
        physics.velocity.x *= physics.friction;
        physics.velocity.y *= physics.friction;
        // Snap to zero when very small
        if (Math.abs(physics.velocity.x) < 1) physics.velocity.x = 0;
        if (Math.abs(physics.velocity.y) < 1) physics.velocity.y = 0;

        const sprite = entity.getComponent<SpriteComponent>("sprite");
        if (sprite) {
          sprite.animation = "idle";
        }
      }

      // Apply velocity to position (collision resolution happens in CollisionSystem)
      // We store the desired position change; CollisionSystem will resolve overlaps
      // For now, just apply directly — CollisionSystem rewinds if needed
      transform.position.x += physics.velocity.x * dtSec;
      transform.position.y += physics.velocity.y * dtSec;

      // Update input one-shots
      input.resetOneShots();
    }
  }
}
