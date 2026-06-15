// Arcade grid movement (Pac-Man / Battle City style), deterministic and shared
// by server + client predictor. The entity has a current direction `dir` and is
// driven by an `intent` (the held input). Turning to a perpendicular direction
// only happens at a cell center (intersection) and snaps onto the rail; a 180°
// reverse is instant. While moving, the perpendicular axis is hard-locked to the
// lane center — zero in-cell wobble. Collision is by cell (no hitbox), so the
// entity can never get stuck between tiles.
//
// Coordinates are in cells; a cell center is integer + 0.5.

import { Direction } from "./types.js";

export type BlockedFn = (cx: number, cy: number) => boolean;

export interface MoveState {
  x: number;
  y: number;
  dir: Direction;
}

const VEC: Record<Direction, { dx: number; dy: number }> = {
  [Direction.NONE]: { dx: 0, dy: 0 },
  [Direction.UP]: { dx: 0, dy: -1 },
  [Direction.DOWN]: { dx: 0, dy: 1 },
  [Direction.LEFT]: { dx: -1, dy: 0 },
  [Direction.RIGHT]: { dx: 1, dy: 0 },
};

function opposite(a: Direction, b: Direction): boolean {
  return (
    (a === Direction.UP && b === Direction.DOWN) ||
    (a === Direction.DOWN && b === Direction.UP) ||
    (a === Direction.LEFT && b === Direction.RIGHT) ||
    (a === Direction.RIGHT && b === Direction.LEFT)
  );
}

/** Next cell center ahead along `sign` on one axis (no backward snapping). */
function nextCenter(p: number, sign: number): number {
  return sign > 0 ? Math.ceil(p - 0.5) + 0.5 : Math.floor(p - 0.5) + 0.5;
}

/** Advance `s` by `dist` cells toward `intent`, mutating s.x/s.y/s.dir. */
export function advance(s: MoveState, intent: Direction, dist: number, blocked: BlockedFn): void {
  const tx = Math.floor(s.x);
  const ty = Math.floor(s.y);
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const atCenter = Math.abs(s.x - cx) <= dist && Math.abs(s.y - cy) <= dist;

  // --- direction change ---
  if (intent !== Direction.NONE && intent !== s.dir) {
    if (opposite(s.dir, intent)) {
      s.dir = intent; // instant 180°
    } else if (atCenter || s.dir === Direction.NONE) {
      const v = VEC[intent];
      if (!blocked(tx + v.dx, ty + v.dy)) {
        s.x = cx; // lock onto the rail at the intersection
        s.y = cy;
        s.dir = intent;
      }
    }
  }

  if (s.dir === Direction.NONE) return;

  const d = VEC[s.dir];
  const wantStop = intent === Direction.NONE; // released input -> coast to center & stop
  const wallAhead = blocked(tx + d.dx, ty + d.dy);

  if (wallAhead || wantStop) {
    // Glide to a cell center along the current axis, then stop.
    if (d.dx !== 0) {
      const target = wallAhead ? cx : nextCenter(s.x, d.dx);
      if (Math.abs(s.x - target) <= dist) {
        s.x = target;
        s.dir = Direction.NONE;
      } else {
        s.x += d.dx * dist;
      }
      s.y = cy;
    } else {
      const target = wallAhead ? cy : nextCenter(s.y, d.dy);
      if (Math.abs(s.y - target) <= dist) {
        s.y = target;
        s.dir = Direction.NONE;
      } else {
        s.y += d.dy * dist;
      }
      s.x = cx;
    }
    return;
  }

  // Free path: move and hard-lock the perpendicular axis to the rail.
  s.x += d.dx * dist;
  s.y += d.dy * dist;
  if (d.dx !== 0) s.y = cy;
  else s.x = cx;
}
