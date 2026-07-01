type RafCallback = (dt: number, time: number) => void;

const subscribers = new Map<string, RafCallback>();
let lastTime = 0;

/** Called from GSAP ticker — single shared per-frame bus (spec §1.2). */
export function rafManagerTick(timeSeconds: number) {
  const timeMs = timeSeconds * 1000;
  const dt = Math.min(timeMs - lastTime, 50);
  lastTime = timeMs;
  subscribers.forEach((cb) => cb(dt, timeMs));
}

export function registerRaf(key: string, cb: RafCallback) {
  subscribers.set(key, cb);
}

export function unregisterRaf(key: string) {
  subscribers.delete(key);
}

export function resetRafManagerClock() {
  lastTime = 0;
}
