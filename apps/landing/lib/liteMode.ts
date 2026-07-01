"use client";

export type LiteLevel = "full" | "lite" | "minimal";

class PerformanceWatcher {
  private frameCount = 0;
  private lastTime = performance.now();
  private lowFpsCount = 0;
  private level: LiteLevel = "full";
  private rafId: number | null = null;

  static readonly FPS_LITE = 40;
  static readonly FPS_MINIMAL = 24;
  static readonly CONSECUTIVE = 3;

  start() {
    if (this.rafId !== null) return;
    const tick = () => {
      this.frameCount++;
      const now = performance.now();
      const delta = now - this.lastTime;
      if (delta >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / delta);
        this.evaluateFps(fps);
        this.frameCount = 0;
        this.lastTime = now;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getLevel() {
    return this.level;
  }

  /** Immediate triggers before FPS probe (spec §4.2). */
  detectImmediate(): LiteLevel | null {
    if (typeof window === "undefined") return null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "minimal";
    const nav = navigator as Navigator & {
      hardwareConcurrency?: number;
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    if (nav.connection?.saveData) return "minimal";
    if ((nav.hardwareConcurrency ?? 8) <= 4) return "lite";
    if ((nav.deviceMemory ?? 8) <= 2) return "lite";
    if (window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches) return "lite";
    return null;
  }

  private evaluateFps(fps: number) {
    if (fps < PerformanceWatcher.FPS_LITE) {
      this.lowFpsCount++;
      if (this.lowFpsCount >= PerformanceWatcher.CONSECUTIVE) this.escalate();
    } else {
      this.lowFpsCount = 0;
    }
  }

  private escalate() {
    if (this.level === "full") this.setLevel("lite");
    else if (this.level === "lite") this.setLevel("minimal");
  }

  setLevel(l: LiteLevel) {
    if (this.level === l) return;
    this.level = l;
    document.documentElement.dataset.liteMode = l;
    window.dispatchEvent(new CustomEvent("bm:lite-mode", { detail: { level: l } }));
  }
}

let watcher: PerformanceWatcher | null = null;

export function initLiteMode(): LiteLevel {
  if (typeof window === "undefined") return "full";
  if (!watcher) watcher = new PerformanceWatcher();

  const immediate = watcher.detectImmediate();
  if (immediate) {
    watcher.setLevel(immediate);
    if (immediate === "full") watcher.start();
    return immediate;
  }

  watcher.setLevel("full");
  watcher.start();
  return "full";
}

export function stopLiteMode() {
  watcher?.stop();
}

export function getLiteLevel(): LiteLevel {
  return watcher?.getLevel() ?? "full";
}
