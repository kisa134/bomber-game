import { Direction, GRID_W, GRID_H } from "@bomberpump/shared";
import type { Room } from "./room.js";
import type { Player } from "./player.js";

const THINK_MS = 120;
const BOMB_CHANCE = 0.28; // lower = more cautious, longer rounds
const ENGAGE_RANGE = 2; // only bomb enemies this close (don't snipe across map)

const DIRS = [
  { d: Direction.UP, dx: 0, dy: -1 },
  { d: Direction.DOWN, dx: 0, dy: 1 },
  { d: Direction.LEFT, dx: -1, dy: 0 },
  { d: Direction.RIGHT, dx: 1, dy: 0 },
];

const idx = (x: number, y: number) => y * GRID_W + x;

/**
 * Medium bot: BFS-based. Survives by fleeing any bomb blast it can be caught in,
 * only places a bomb when it has a guaranteed escape, otherwise advances toward
 * the nearest destructible block or enemy. This makes rounds last longer.
 */
export class BotController {
  private think = 0;
  private dir: Direction = Direction.NONE;

  update(room: Room, me: Player, dt: number): void {
    this.think -= dt;
    const cx = me.cellX;
    const cy = me.cellY;
    const danger = computeDanger(room);

    // 1. Caught in a blast zone -> run to the nearest safe cell, now.
    if (danger.has(idx(cx, cy))) {
      me.intent = bfsStep(room, cx, cy, (x, y) => !danger.has(idx(x, y))) ?? Direction.NONE;
      return;
    }

    if (this.think > 0) {
      me.intent = this.dir;
      return;
    }
    this.think = THINK_MS;

    // 2. Bomb if it's useful AND we can still escape afterwards.
    if (shouldBomb(room, me) && Math.random() < BOMB_CHANCE && hasEscapeAfterBomb(room, me)) {
      room.placeBomb(me.id);
      const d2 = computeDanger(room);
      this.dir = bfsStep(room, cx, cy, (x, y) => !d2.has(idx(x, y))) ?? Direction.NONE;
      me.intent = this.dir;
      return;
    }

    // 3. Advance toward the nearest target (soft block / enemy), avoiding danger.
    this.dir =
      bfsStep(room, cx, cy, (x, y) => isTarget(room, x, y), danger) ??
      randomDir(room, cx, cy);
    me.intent = this.dir;
  }
}

function walkable(room: Room, x: number, y: number): boolean {
  if (room.world.isSolid(x, y)) return false;
  if (room.bombs.some((b) => !b.exploded && b.x === x && b.y === y)) return false;
  return true;
}

function addBlast(room: Room, bx: number, by: number, power: number, set: Set<number>): void {
  set.add(idx(bx, by));
  for (const { dx, dy } of DIRS) {
    for (let r = 1; r <= power; r++) {
      const nx = bx + dx * r;
      const ny = by + dy * r;
      if (!room.world.inBounds(nx, ny) || room.world.isHard(nx, ny)) break;
      set.add(idx(nx, ny));
      if (room.world.isSoft(nx, ny)) break;
    }
  }
}

function computeDanger(room: Room, extra?: { x: number; y: number; power: number }): Set<number> {
  const set = new Set<number>();
  for (const b of room.bombs) if (!b.exploded) addBlast(room, b.x, b.y, b.power, set);
  if (extra) addBlast(room, extra.x, extra.y, extra.power, set);
  const fire = room.world.fire;
  for (let i = 0; i < fire.length; i++) if (fire[i] > 0) set.add(i);
  return set;
}

/** BFS from (sx,sy); returns the first-step direction toward the nearest cell
 *  satisfying `goal`, or null. Cells in `avoid` are not traversed. */
function bfsStep(
  room: Room,
  sx: number,
  sy: number,
  goal: (x: number, y: number) => boolean,
  avoid?: Set<number>,
): Direction | null {
  const start = idx(sx, sy);
  const visited = new Uint8Array(GRID_W * GRID_H);
  const firstDir = new Int8Array(GRID_W * GRID_H).fill(-1);
  visited[start] = 1;
  let queue: number[] = [start];
  while (queue.length) {
    const next: number[] = [];
    for (const cur of queue) {
      const x = cur % GRID_W;
      const y = (cur / GRID_W) | 0;
      for (const { d, dx, dy } of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!room.world.inBounds(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (visited[ni]) continue;
        if (!walkable(room, nx, ny)) continue;
        if (avoid && avoid.has(ni)) continue;
        visited[ni] = 1;
        firstDir[ni] = cur === start ? d : firstDir[cur];
        if (goal(nx, ny)) return firstDir[ni] as Direction;
        next.push(ni);
      }
    }
    queue = next;
  }
  return null;
}

function isTarget(room: Room, x: number, y: number): boolean {
  for (const { dx, dy } of DIRS) {
    if (room.world.isSoft(x + dx, y + dy)) return true;
  }
  for (const p of room.players.values()) {
    if (p.alive && !p.isBot && p.cellX === x && p.cellY === y) return true;
  }
  return false;
}

function shouldBomb(room: Room, me: Player): boolean {
  for (const { dx, dy } of DIRS) {
    if (room.world.isSoft(me.cellX + dx, me.cellY + dy)) return true;
  }
  // enemy in line, but only when genuinely close (avoid constant trading)
  const range = Math.min(me.power, ENGAGE_RANGE);
  for (const p of room.players.values()) {
    if (!p.alive || p.id === me.id) continue;
    if (p.cellX === me.cellX && Math.abs(p.cellY - me.cellY) <= range) return true;
    if (p.cellY === me.cellY && Math.abs(p.cellX - me.cellX) <= range) return true;
  }
  return false;
}

function hasEscapeAfterBomb(room: Room, me: Player): boolean {
  const danger = computeDanger(room, { x: me.cellX, y: me.cellY, power: me.power });
  if (!danger.has(idx(me.cellX, me.cellY))) return true;
  return bfsStep(room, me.cellX, me.cellY, (x, y) => !danger.has(idx(x, y))) !== null;
}

function randomDir(room: Room, x: number, y: number): Direction {
  const opts = DIRS.filter((o) => walkable(room, x + o.dx, y + o.dy));
  if (!opts.length) return Direction.NONE;
  return opts[(Math.random() * opts.length) | 0].d;
}
