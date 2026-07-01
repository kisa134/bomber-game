// ADMIN-ONLY test arena — a self-contained fullscreen overlay to test EVERY arena visual
// (surfaces, blood/gore, explosions, lighting, graphics flags) live, with an on-screen FPS
// readout. Drives its OWN Renderer instance + a fake RenderView, so it never touches the
// real game. Opened from Settings (admin only). No other UI file's behaviour changes.
import { Renderer } from "../game/renderer.js";
import type { Assets } from "../game/assets.js";
import { GRID_W, GRID_H, TileType } from "../net/protocol.js";
import type { PlayerSnapshot, BombSnapshot } from "../net/protocol.js";
import type { ArenaTheme, TimeOfDay } from "../settings.js";

const THEMES: ArenaTheme[] = ["classic", "vault", "cyber", "void", "desert", "industrial", "chappie", "meme", "degen", "pepe"];
const PCOL = ["#ff5a5a", "#5aa0ff", "#5aff8c", "#ffd24a", "#c86bff", "#ff9a3a"];

let open = false;

export function openTestArena(assets: Assets): void {
  if (open) return;
  open = true;

  // ── Overlay + layout ──────────────────────────────────────────────────────
  const ov = document.createElement("div");
  Object.assign(ov.style, {
    position: "fixed", inset: "0", zIndex: "10000", display: "flex",
    background: "#0a0b10", color: "#e8e8ef", font: "13px/1.4 system-ui,sans-serif",
  } as CSSStyleDeclaration);

  const stage = document.createElement("div");
  Object.assign(stage.style, { flex: "1 1 auto", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "0" } as CSSStyleDeclaration);
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, { maxWidth: "100%", maxHeight: "100%", background: "#000", boxShadow: "0 0 40px rgba(0,0,0,0.6)" } as CSSStyleDeclaration);
  stage.appendChild(canvas);

  const fpsEl = document.createElement("div");
  Object.assign(fpsEl.style, { position: "absolute", top: "10px", left: "12px", padding: "6px 10px", background: "rgba(0,0,0,0.55)", borderRadius: "8px", font: "12px/1.3 'Space Mono',monospace", whiteSpace: "pre", pointerEvents: "none" } as CSSStyleDeclaration);
  stage.appendChild(fpsEl);

  const panel = document.createElement("div");
  Object.assign(panel.style, { flex: "0 0 320px", overflowY: "auto", padding: "14px", borderLeft: "1px solid #23252e", background: "#0d0e14" } as CSSStyleDeclaration);
  ov.append(stage, panel);
  document.body.appendChild(ov);

  // ── Renderer + fake world ─────────────────────────────────────────────────
  canvas.width = 780; canvas.height = Math.round(780 * GRID_H / GRID_W);
  const renderer = new Renderer(canvas);
  renderer.setAssets(assets);
  renderer.setGore(true);

  const grid = new Uint8Array(GRID_W * GRID_H);
  const rebuildGrid = (): void => {
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      const i = y * GRID_W + x;
      const border = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      grid[i] = border || pillar ? TileType.HARD : Math.random() < 0.4 ? TileType.SOFT : TileType.EMPTY;
    }
  };
  rebuildGrid();

  const spawnCell = (): { x: number; y: number } => {
    for (let tries = 0; tries < 200; tries++) {
      const x = 1 + ((Math.random() * (GRID_W - 2)) | 0), y = 1 + ((Math.random() * (GRID_H - 2)) | 0);
      if (grid[y * GRID_W + x] === TileType.EMPTY) return { x, y };
    }
    return { x: 1, y: 1 };
  };
  const mkPlayers = (): PlayerSnapshot[] => Array.from({ length: 4 }, (_, i) => {
    const c = spawnCell();
    return { id: i, x: c.x + 0.5, y: c.y + 0.5, alive: true, frags: 0, invuln: false } as unknown as PlayerSnapshot;
  });
  const view = { players: mkPlayers(), bombs: [] as BombSnapshot[], grid };

  // ── Actions ───────────────────────────────────────────────────────────────
  const killOne = (): void => {
    const alive = view.players.filter((p) => (p as { alive: boolean }).alive);
    if (!alive.length) { view.players = mkPlayers(); return; }
    const p = alive[(Math.random() * alive.length) | 0] as unknown as { id: number; x: number; y: number; alive: boolean };
    renderer.onDeath(Math.floor(p.x), Math.floor(p.y), PCOL[p.id % PCOL.length]);
    p.alive = false;
    setTimeout(() => { const c = spawnCell(); p.x = c.x + 0.5; p.y = c.y + 0.5; p.alive = true; }, 2600);
  };
  const explodeAt = (gx: number, gy: number, reach = 2): void => {
    const cells: Array<{ x: number; y: number }> = [{ x: gx, y: gy }];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      for (let r = 1; r <= reach; r++) {
        const nx = gx + dx * r, ny = gy + dy * r;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) break;
        const i = ny * GRID_W + nx;
        if (grid[i] === TileType.HARD) break;
        cells.push({ x: nx, y: ny });
        if (grid[i] === TileType.SOFT) { grid[i] = TileType.EMPTY; break; } // shatter the crate
      }
    }
    renderer.onExplosion(cells);
  };
  const explodeRandom = (reach = 2): void => { const c = spawnCell(); explodeAt(c.x, c.y, reach); };
  const floodBlood = (): void => { for (let i = 0; i < 10; i++) { const c = spawnCell(); renderer.onDeath(c.x, c.y, PCOL[i % PCOL.length]); } };

  // ── Panel builders ────────────────────────────────────────────────────────
  const h = (txt: string): void => { const e = document.createElement("div"); e.textContent = txt; Object.assign(e.style, { margin: "14px 0 6px", font: "700 11px/1 system-ui", letterSpacing: "1.5px", textTransform: "uppercase", color: "#8b8ea0" } as CSSStyleDeclaration); panel.appendChild(e); };
  const row = (): HTMLDivElement => { const r = document.createElement("div"); Object.assign(r.style, { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "4px" } as CSSStyleDeclaration); panel.appendChild(r); return r; };
  const btn = (parent: HTMLElement, label: string, on: () => void): HTMLButtonElement => {
    const b = document.createElement("button"); b.textContent = label;
    Object.assign(b.style, { flex: "1 1 auto", padding: "8px 10px", background: "#1a1c26", color: "#e8e8ef", border: "1px solid #2c2f3d", borderRadius: "8px", cursor: "pointer", font: "600 12px/1 system-ui" } as CSSStyleDeclaration);
    b.onclick = on; parent.appendChild(b); return b;
  };
  const toggle = (parent: HTMLElement, label: string, initial: boolean, set: (v: boolean) => void): void => {
    let v = initial; const b = btn(parent, "", () => { v = !v; set(v); paint(); });
    const paint = (): void => { b.textContent = `${label}: ${v ? "ON" : "off"}`; b.style.background = v ? "#1f3a2a" : "#1a1c26"; b.style.borderColor = v ? "#3a7a52" : "#2c2f3d"; };
    set(v); paint();
  };

  const title = document.createElement("div"); title.textContent = "🧪 TEST ARENA"; Object.assign(title.style, { font: "800 16px/1 system-ui", letterSpacing: "1px" } as CSSStyleDeclaration); panel.appendChild(title);

  h("Arena / surface");
  const themeSel = document.createElement("select");
  Object.assign(themeSel.style, { width: "100%", padding: "8px", background: "#1a1c26", color: "#e8e8ef", border: "1px solid #2c2f3d", borderRadius: "8px", marginBottom: "4px" } as CSSStyleDeclaration);
  for (const t of THEMES) { const o = document.createElement("option"); o.value = t; o.textContent = t; themeSel.appendChild(o); }
  themeSel.onchange = () => renderer.setArenaTheme(themeSel.value as ArenaTheme);
  panel.appendChild(themeSel);
  { const r = row(); for (const t of ["day", "dusk", "night", "auto"] as TimeOfDay[]) btn(r, t, () => renderer.setTimeOfDay(t)); }
  btn(row(), "Rebuild blocks", () => rebuildGrid());

  h("Death / gore");
  { const r = row(); btn(r, "Kill one", killOne); btn(r, "Massacre ×4", () => { for (let i = 0; i < 4; i++) setTimeout(killOne, i * 120); }); }
  { const r = row(); toggle(r, "Gore", true, (v) => renderer.setGore(v)); }

  h("Explosions / floor");
  { const r = row(); btn(r, "Blast", () => explodeRandom(2)); btn(r, "Big blast", () => explodeRandom(4)); }
  let spamTimer = 0;
  { const r = row(); toggle(r, "Spam blasts", false, (v) => { if (v && !spamTimer) spamTimer = window.setInterval(() => explodeRandom(2), 350); else if (!v && spamTimer) { clearInterval(spamTimer); spamTimer = 0; } }); }
  btn(row(), "CHAOS (kills + blasts)", () => { for (let i = 0; i < 8; i++) setTimeout(() => { killOne(); explodeRandom(3); }, i * 160); });

  h("Blood");
  btn(row(), "Flood blood (test spread)", floodBlood);

  h("Graphics + FPS");
  { const r = row(); for (const [lab, apply] of [["Low", [false, false, false, false, true]], ["Medium", [true, true, false, false, false]], ["High", [true, true, true, true, false]]] as const) {
    btn(r, lab, () => { const [dep, sh, bl, dl, lo] = apply; renderer.setBlockDepth(dep); renderer.setShadows(sh); renderer.setBloom(bl); renderer.setDynamicLight(dl); renderer.setLowFx(lo); renderer.setAtmosphere(!lo); }); } }
  { const r = row(); toggle(r, "Block depth", true, (v) => renderer.setBlockDepth(v)); toggle(r, "Shadows", true, (v) => renderer.setShadows(v)); }
  { const r = row(); toggle(r, "Bloom", false, (v) => renderer.setBloom(v)); toggle(r, "Dyn light", false, (v) => renderer.setDynamicLight(v)); }
  { const r = row(); toggle(r, "Atmosphere", true, (v) => renderer.setAtmosphere(v)); toggle(r, "Battle scars", true, (v) => renderer.setBattleScars(v)); }
  { const r = row(); toggle(r, "Lite (lowFx)", false, (v) => renderer.setLowFx(v)); toggle(r, "Grass tex", false, (v) => renderer.setGrassTexture(v)); }
  { const wrap = document.createElement("label"); wrap.textContent = "Particles"; Object.assign(wrap.style, { display: "block", marginTop: "6px", font: "12px system-ui" } as CSSStyleDeclaration);
    const sl = document.createElement("input"); sl.type = "range"; sl.min = "50"; sl.max = "250"; sl.value = "100"; sl.style.width = "100%";
    sl.oninput = () => renderer.setParticleDensity(Number(sl.value) / 100); wrap.appendChild(sl); panel.appendChild(wrap); }

  h("");
  const close = btn(row(), "✕ Close", () => teardown());
  Object.assign(close.style, { background: "#3a1c1c", borderColor: "#7a3a3a" } as CSSStyleDeclaration);

  // ── Loop + FPS ────────────────────────────────────────────────────────────
  let raf = 0, last = performance.now(), avg = 60;
  const samples: number[] = [];
  const loop = (now: number): void => {
    const dt = now - last; last = now;
    const f = 1000 / Math.max(1, dt); avg = avg * 0.9 + f * 0.1;
    samples.push(f); if (samples.length > 240) samples.shift();
    try { renderer.render(view as never, 0); } catch { /* keep the loop alive */ }
    const sorted = [...samples].sort((a, b) => a - b);
    const low = sorted[Math.floor(sorted.length * 0.01)] ?? avg;
    fpsEl.textContent = `FPS ${avg.toFixed(0)}   1%low ${low.toFixed(0)}   min ${(sorted[0] ?? avg).toFixed(0)}`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") teardown(); };
  window.addEventListener("keydown", onKey);

  function teardown(): void {
    cancelAnimationFrame(raf);
    if (spamTimer) clearInterval(spamTimer);
    window.removeEventListener("keydown", onKey);
    ov.remove(); open = false;
  }
}
