// Hardcoded arena constants (decoupled from monorepo @bomberpump/shared).
export const GRID_W = 17;
export const GRID_H = 11;
export const BOMB_TIMER_MS = 2500;

/** Brand palette — mirrored from apps/client/src/game/renderer.ts & style.css. */
export const PALETTE = {
  bg: "#0e1018",
  panel: "#1b2030",
  hardA: "#414a5e",
  hardB: "#535e76",
  accent: "#ffcc33",
  accent2: "#ff5a5f",
  blue: "#7fd8ff",
  p_red: "#ff5555",
  p_blue: "#7fd8ff",
  p_green: "#5fd96a",
  p_gold: "#ffcc33",
  green: "#5fd96a",
  flame: "#f0a92a",
  flameHot: "#ffd24a",
  money: "#7bd66a",  // burned-dollar green
} as const;

/** Cell grid-coords → centered world XZ (origin = board center). */
export function cellToWorld(x: number, y: number): [number, number] {
  return [x - (GRID_W - 1) / 2, y - (GRID_H - 1) / 2];
}

/** Classic Bomberman odd/odd interior hard pillars. */
export function hardPillars(): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 1; y < GRID_H - 1; y += 2) {
    for (let x = 1; x < GRID_W - 1; x += 2) {
      cells.push(cellToWorld(x, y));
    }
  }
  return cells;
}

/**
 * Bomb fuse-pulse math ported verbatim from apps/client/src/game/renderer.ts.
 *   const beat    = Math.sin(now / (90 - urgency * 55));
 *   const glow    = 0.5 + urgency * 0.25;
 *   const bombScale = (0.95 + 0.05 * beat) * (1 - fuseLeftMs/BOMB_TIMER_MS * 0.25);
 */
export function bombPulse(fuseLeftMs: number, nowMs: number) {
  const urgency = 1 - fuseLeftMs / BOMB_TIMER_MS;
  const beat = Math.sin(nowMs / (90 - urgency * 55));
  const glow = (0.5 + urgency * 0.25) * (0.8 + 0.2 * beat);
  const bombScale = (0.95 + 0.05 * beat) * (1 - (fuseLeftMs / BOMB_TIMER_MS) * 0.25);
  return { urgency, beat, glow, bombScale };
}
