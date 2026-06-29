import { System, type Entity } from "./ECS.js";
import { TransformComponent } from "./components/TransformComponent.js";
import { PhysicsComponent } from "./components/PhysicsComponent.js";
import { ChunkManager } from "./ChunkManager.js";

const GRID_CELL_SIZE = 64;
const MAX_COLLISION_PAIRS_PER_CELL = 50;

export class CollisionSystem extends System {
  private chunkManager: ChunkManager;
  responseEnabled = true;
  onEntityCollision: ((a: Entity, b: Entity) => void) | null = null;
  onTileCollision: ((entity: Entity, tileX: number, tileY: number) => void) | null = null;

  constructor(chunkManager: ChunkManager) {
    super("collision", ["transform", "physics"]);
    this.chunkManager = chunkManager;
  }

  update(entities: Entity[], dt: number): void {
    if (entities.length === 0) return;

    const grid = this.buildSpatialGrid(entities);

    for (const entity of entities) {
      const phys = entity.getComponent<PhysicsComponent>("physics")!;
      if (!phys.solid) continue;
      this.resolveTileCollision(entity, dt);
    }

    const checkedPairs = new Set<string>();
    for (const cellEntities of grid.values()) {
      const n = Math.min(cellEntities.length, MAX_COLLISION_PAIRS_PER_CELL);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = cellEntities[i];
          const b = cellEntities[j];
          if (a.id === b.id) continue;
          const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          if (checkedPairs.has(pairKey)) continue;
          checkedPairs.add(pairKey);
          this.checkEntityCollision(a, b);
        }
      }
    }
  }

  private buildSpatialGrid(entities: Entity[]): Map<string, Entity[]> {
    const grid = new Map<string, Entity[]>();
    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>("transform")!;
      const phys = entity.getComponent<PhysicsComponent>("physics")!;
      if (!phys.solid) continue;

      const cx = Math.floor(transform.position.x / GRID_CELL_SIZE);
      const cy = Math.floor(transform.position.y / GRID_CELL_SIZE);
      const key = `${cx},${cy}`;
      const arr = grid.get(key);
      if (arr) {
        arr.push(entity);
      } else {
        grid.set(key, [entity]);
      }
    }
    return grid;
  }

  private resolveTileCollision(entity: Entity, _dt: number): void {
    const transform = entity.getComponent<TransformComponent>("transform")!;
    const phys = entity.getComponent<PhysicsComponent>("physics")!;
    const pos = transform.position;
    const r = phys.radius;

    const tileR = Math.ceil(r / 48);
    const centerTx = Math.floor(pos.x / 48);
    const centerTy = Math.floor(pos.y / 48);

    let collidedX = false;
    let collidedY = false;

    const newX = pos.x + phys.velocity.x * _dt;
    for (let ty = centerTy - tileR; ty <= centerTy + tileR; ty++) {
      for (let tx = centerTx - tileR; tx <= centerTx + tileR; tx++) {
        if (!this.isTileSolid(tx, ty)) continue;
        const closestX = Math.max(tx * 48, Math.min(newX, (tx + 1) * 48));
        const closestY = Math.max(ty * 48, Math.min(pos.y, (ty + 1) * 48));
        const dx = newX - closestX;
        const dy = pos.y - closestY;
        if (dx * dx + dy * dy < r * r) {
          collidedX = true;
          if (newX < (tx + 0.5) * 48) {
            transform.position.x = tx * 48 - r;
          } else {
            transform.position.x = (tx + 1) * 48 + r;
          }
          phys.velocity.x = 0;
          this.onTileCollision?.(entity, tx, ty);
          break;
        }
      }
      if (collidedX) break;
    }

    const newY = pos.y + phys.velocity.y * _dt;
    for (let ty = centerTy - tileR; ty <= centerTy + tileR; ty++) {
      for (let tx = centerTx - tileR; tx <= centerTx + tileR; tx++) {
        if (!this.isTileSolid(tx, ty)) continue;
        const closestX = Math.max(tx * 48, Math.min(transform.position.x, (tx + 1) * 48));
        const closestY = Math.max(ty * 48, Math.min(newY, (ty + 1) * 48));
        const dx = transform.position.x - closestX;
        const dy = newY - closestY;
        if (dx * dx + dy * dy < r * r) {
          collidedY = true;
          if (newY < (ty + 0.5) * 48) {
            transform.position.y = ty * 48 - r;
          } else {
            transform.position.y = (ty + 1) * 48 + r;
          }
          phys.velocity.y = 0;
          this.onTileCollision?.(entity, tx, ty);
          break;
        }
      }
      if (collidedY) break;
    }
  }

  private checkEntityCollision(a: Entity, b: Entity): void {
    const tA = a.getComponent<TransformComponent>("transform")!;
    const pA = a.getComponent<PhysicsComponent>("physics")!;
    const tB = b.getComponent<TransformComponent>("transform")!;
    const pB = b.getComponent<PhysicsComponent>("physics")!;

    const dx = tB.position.x - tA.position.x;
    const dy = tB.position.y - tA.position.y;
    const dist = Math.hypot(dx, dy);
    const minDist = pA.radius + pB.radius;

    if (dist >= minDist || dist === 0) return;

    this.onEntityCollision?.(a, b);

    if (!this.responseEnabled) return;
    if (!pA.solid || !pB.solid) return;

    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    const totalMass = Math.max(pA.mass + pB.mass, 0.001);
    const ratioA = pB.mass / totalMass;
    const ratioB = pA.mass / totalMass;

    tA.position.x -= nx * overlap * ratioA;
    tA.position.y -= ny * overlap * ratioA;
    tB.position.x += nx * overlap * ratioB;
    tB.position.y += ny * overlap * ratioB;
  }

  private isTileSolid(tx: number, ty: number): boolean {
    const worldX = tx * 48 + 24;
    const worldY = ty * 48 + 24;
    return this.chunkManager.isSolidAt(worldX, worldY);
  }
}
