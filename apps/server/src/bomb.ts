import { Direction } from "@bomberpump/shared";

export interface Bomb {
  id: number;
  ownerId: number;
  x: number; // cell (int)
  y: number;
  power: number;
  fuseLeftMs: number;
  exploded: boolean;
  /** Players currently allowed to pass through this bomb (they haven't stepped off yet). */
  passThrough: Set<number>;
  /** Non-NONE while the bomb is sliding from a kick. */
  kickDir: Direction;
  /** Accumulated time toward the next cell while sliding. */
  kickProgressMs: number;
}

export function dirVector(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case Direction.UP: return { dx: 0, dy: -1 };
    case Direction.DOWN: return { dx: 0, dy: 1 };
    case Direction.LEFT: return { dx: -1, dy: 0 };
    case Direction.RIGHT: return { dx: 1, dy: 0 };
    default: return { dx: 0, dy: 0 };
  }
}
