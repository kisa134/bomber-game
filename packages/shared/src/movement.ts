// Deterministic grid movement with corner-cutting. Used by BOTH the server and
// the client predictor (identical inputs -> identical output), which gives the
// classic "slide around the corner" feel and eliminates rubberbanding.
//
// Coordinates are in cells (a cell center is integer + 0.5). `blocked(cx,cy)`
// reports whether a cell stops movement (walls/bombs/out-of-bounds); the caller
// supplies it so the server can include bombs and the client can use the grid.

import { Direction } from "./types.js";

export type BlockedFn = (cx: number, cy: number) => boolean;

const EPS = 1e-4;

export function stepMove(
  x: number,
  y: number,
  dir: Direction,
  dist: number,
  r: number,
  blocked: BlockedFn,
): { x: number; y: number } {
  if (dir === Direction.NONE || dist <= 0) return { x, y };
  if (dir === Direction.LEFT) return moveH(x, y, -1, dist, r, blocked);
  if (dir === Direction.RIGHT) return moveH(x, y, 1, dist, r, blocked);
  if (dir === Direction.UP) return moveV(x, y, -1, dist, r, blocked);
  return moveV(x, y, 1, dist, r, blocked);
}

function moveH(x: number, y: number, s: number, dist: number, r: number, blocked: BlockedFn) {
  const newX = x + s * dist;
  const cellX = Math.floor(newX + s * r); // leading edge cell
  const top = Math.floor(y - r + EPS);
  const bot = Math.floor(y + r - EPS);

  if (top === bot) {
    // Centered on a row: move if the cell ahead is free, else clamp to the wall.
    if (!blocked(cellX, top)) return { x: newX, y };
    return { x: s > 0 ? cellX - r - EPS : cellX + 1 + r + EPS, y };
  }
  // Straddling two rows: corner-cut toward whichever side is open.
  const topFree = !blocked(cellX, top);
  const botFree = !blocked(cellX, bot);
  if (topFree && botFree) return { x: newX, y };
  if (topFree) return { x, y: y - Math.min(dist, y - (top + 0.5)) }; // slide up
  if (botFree) return { x, y: y + Math.min(dist, bot + 0.5 - y) }; // slide down
  return { x: s > 0 ? cellX - r - EPS : cellX + 1 + r + EPS, y };
}

function moveV(x: number, y: number, s: number, dist: number, r: number, blocked: BlockedFn) {
  const newY = y + s * dist;
  const cellY = Math.floor(newY + s * r);
  const left = Math.floor(x - r + EPS);
  const right = Math.floor(x + r - EPS);

  if (left === right) {
    if (!blocked(left, cellY)) return { x, y: newY };
    return { x, y: s > 0 ? cellY - r - EPS : cellY + 1 + r + EPS };
  }
  const leftFree = !blocked(left, cellY);
  const rightFree = !blocked(right, cellY);
  if (leftFree && rightFree) return { x, y: newY };
  if (leftFree) return { x: x - Math.min(dist, x - (left + 0.5)), y }; // slide left
  if (rightFree) return { x: x + Math.min(dist, right + 0.5 - x), y }; // slide right
  return { x, y: s > 0 ? cellY - r - EPS : cellY + 1 + r + EPS };
}
