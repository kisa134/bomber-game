import { Direction } from "@bomberpump/shared";
import type { Room } from "./room.js";
import type { Player } from "./player.js";

const DECISION_INTERVAL_MS = 300;
const DANGER_FUSE_MS = 1500;
const DANGER_RANGE = 2;
const BOMB_CHANCE_PER_TICK = 0.05;

const DIRS: Array<{ d: Direction; dx: number; dy: number }> = [
  { d: Direction.UP, dx: 0, dy: -1 },
  { d: Direction.DOWN, dx: 0, dy: 1 },
  { d: Direction.LEFT, dx: -1, dy: 0 },
  { d: Direction.RIGHT, dx: 1, dy: 0 },
];

/** Easy bot: random walker that flees nearby live bombs and bombs adjacent soft blocks. */
export class BotController {
  private nextDecisionMs = 0;
  private dir = Direction.NONE;

  update(room: Room, p: Player, dt: number): void {
    // Flee first: if standing somewhere a bomb will soon reach, dodge.
    if (this.inDanger(room, p.cellX, p.cellY)) {
      const escape = this.pickSafeDir(room, p);
      this.dir = escape;
      p.dir = escape;
      if (escape !== Direction.NONE) p.lastMoveAtMs = Date.now();
      return;
    }

    this.nextDecisionMs -= dt;
    if (this.nextDecisionMs <= 0) {
      this.nextDecisionMs = DECISION_INTERVAL_MS;
      this.dir = this.pickWanderDir(room, p);
    }

    if (this.adjacentSoft(room, p) && Math.random() < BOMB_CHANCE_PER_TICK) {
      room.placeBomb(p.id, 0);
      // After dropping, bias to move off the bomb cell next.
      this.dir = this.pickSafeDir(room, p);
    }

    p.dir = this.dir;
    if (this.dir !== Direction.NONE) p.lastMoveAtMs = Date.now();
  }

  private walkable(room: Room, cx: number, cy: number): boolean {
    if (room.world.isSolid(cx, cy)) return false;
    if (room.bombs.some((b) => !b.exploded && b.x === cx && b.y === cy)) return false;
    return true;
  }

  private inDanger(room: Room, cx: number, cy: number): boolean {
    for (const b of room.bombs) {
      if (b.exploded || b.fuseLeftMs > DANGER_FUSE_MS) continue;
      if (b.x === cx && Math.abs(b.y - cy) <= DANGER_RANGE) {
        if (this.clearLine(room, cx, Math.min(cy, b.y), Math.max(cy, b.y), true)) return true;
      }
      if (b.y === cy && Math.abs(b.x - cx) <= DANGER_RANGE) {
        if (this.clearLine(room, cy, Math.min(cx, b.x), Math.max(cx, b.x), false)) return true;
      }
    }
    return false;
  }

  /** True if no hard/soft block sits between two cells along a row/column. */
  private clearLine(room: Room, fixed: number, from: number, to: number, vertical: boolean): boolean {
    for (let v = from + 1; v < to; v++) {
      const solid = vertical ? room.world.isSolid(fixed, v) : room.world.isSolid(v, fixed);
      if (solid) return false;
    }
    return true;
  }

  private pickSafeDir(room: Room, p: Player): Direction {
    const options = DIRS.filter(
      (o) => this.walkable(room, p.cellX + o.dx, p.cellY + o.dy) && !this.inDanger(room, p.cellX + o.dx, p.cellY + o.dy),
    );
    if (options.length === 0) return Direction.NONE;
    return options[(Math.random() * options.length) | 0].d;
  }

  private pickWanderDir(room: Room, p: Player): Direction {
    const options = DIRS.filter((o) => this.walkable(room, p.cellX + o.dx, p.cellY + o.dy));
    if (options.length === 0) return Direction.NONE;
    return options[(Math.random() * options.length) | 0].d;
  }

  private adjacentSoft(room: Room, p: Player): boolean {
    return DIRS.some((o) => room.world.isSoft(p.cellX + o.dx, p.cellY + o.dy));
  }
}
