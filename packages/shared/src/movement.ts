// Deterministic grid movement, rail-locked. Used by BOTH the server and the
// client predictor (identical inputs -> identical output) — no rubberbanding.
//
// When moving along an axis the perpendicular coordinate is HARD-snapped to the
// lane center, so there is zero lateral freedom inside a cell (rigid, NES-style
// movement). Coordinates are in cells (a cell center is integer + 0.5).
// `blocked(cx,cy)` reports whether a cell stops movement (walls/bombs/oob).

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

  if (dir === Direction.LEFT || dir === Direction.RIGHT) {
    const s = dir === Direction.RIGHT ? 1 : -1;
    const ly = Math.floor(y) + 0.5; // hard-lock to the row center
    const row = Math.floor(ly);
    const newX = x + s * dist;
    const cellX = Math.floor(newX + s * r); // leading-edge cell
    if (!blocked(cellX, row)) return { x: newX, y: ly };
    return { x: s > 0 ? cellX - r - EPS : cellX + 1 + r + EPS, y: ly };
  }

  const s = dir === Direction.DOWN ? 1 : -1;
  const lx = Math.floor(x) + 0.5; // hard-lock to the column center
  const col = Math.floor(lx);
  const newY = y + s * dist;
  const cellY = Math.floor(newY + s * r);
  if (!blocked(col, cellY)) return { x: lx, y: newY };
  return { x: lx, y: s > 0 ? cellY - r - EPS : cellY + 1 + r + EPS };
}
