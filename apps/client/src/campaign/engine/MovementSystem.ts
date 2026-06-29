import { System, type Entity } from "./ECS.js";
import { TransformComponent } from "./components/TransformComponent.js";
import { PhysicsComponent } from "./components/PhysicsComponent.js";
import { InputComponent } from "./components/InputComponent.js";
import { SpriteComponent } from "./components/SpriteComponent.js";

export class MovementSystem extends System {
  sprintMultiplier = 1.6;
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

      let speed = physics.speed;
      if (input.isRunning) {
        speed *= this.sprintMultiplier;
      }

      const moveDir = input.moveDir;
      const isMoving = moveDir.x !== 0 || moveDir.y !== 0;

      if (isMoving) {
        physics.velocity.x = moveDir.x * speed;
        physics.velocity.y = moveDir.y * speed;
        physics.isMoving = true;

        input.facing.x = moveDir.x || input.facing.x;
        input.facing.y = moveDir.y || input.facing.y;

        const sprite = entity.getComponent<SpriteComponent>("sprite");
        if (sprite) {
          const dir = input.getFacingDirection();
          sprite.setDirection(dir);
          sprite.animation = input.isRunning ? "run" : "walk";
        }
      } else {
        physics.isMoving = false;
        physics.velocity.x *= physics.friction;
        physics.velocity.y *= physics.friction;
        if (Math.abs(physics.velocity.x) < 1) physics.velocity.x = 0;
        if (Math.abs(physics.velocity.y) < 1) physics.velocity.y = 0;

        const sprite = entity.getComponent<SpriteComponent>("sprite");
        if (sprite) {
          sprite.animation = "idle";
        }
      }

      transform.position.x += physics.velocity.x * dtSec;
      transform.position.y += physics.velocity.y * dtSec;

      input.resetOneShots();
    }
  }
}
