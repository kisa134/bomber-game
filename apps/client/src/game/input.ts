import { Direction } from "../net/protocol.js";
import type { ControlScheme } from "../settings.js";

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: Direction.UP,
  ArrowDown: Direction.DOWN,
  ArrowLeft: Direction.LEFT,
  ArrowRight: Direction.RIGHT,
  KeyW: Direction.UP,
  KeyS: Direction.DOWN,
  KeyA: Direction.LEFT,
  KeyD: Direction.RIGHT,
};

const JOY_DEADZONE = 14; // px

/** Tracks the effective movement direction (keyboard or virtual stick). */
export class Input {
  private held: Direction[] = []; // keyboard
  private joyDir: Direction = Direction.NONE; // touch joystick / dpad
  private lastEffective: Direction = Direction.NONE;

  onBomb: () => void = () => {};
  onChange: (dir: Direction) => void = () => {};

  get dir(): Direction {
    if (this.joyDir !== Direction.NONE) return this.joyDir;
    return this.held.length ? this.held[this.held.length - 1] : Direction.NONE;
  }

  private notify(): void {
    const d = this.dir;
    if (d !== this.lastEffective) {
      this.lastEffective = d;
      this.onChange(d);
    }
  }

  private press(dir: Direction): void {
    if (dir === Direction.NONE) return;
    const i = this.held.indexOf(dir);
    if (i >= 0) this.held.splice(i, 1);
    this.held.push(dir);
    this.notify();
  }

  private release(dir: Direction): void {
    const i = this.held.indexOf(dir);
    if (i >= 0) this.held.splice(i, 1);
    this.notify();
  }

  private setJoy(dir: Direction): void {
    this.joyDir = dir;
    this.notify();
  }

  attach(): void {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const dir = KEY_DIR[e.code];
      if (dir !== undefined) {
        this.press(dir);
        e.preventDefault();
      } else if (e.code === "Space" || e.code === "Enter") {
        this.onBomb();
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      const dir = KEY_DIR[e.code];
      if (dir !== undefined) this.release(dir);
    });

    this.attachDpad();
    this.attachJoystick();
    this.attachBombButton();
  }

  /** Show the chosen touch control scheme (only relevant on touch devices). */
  setControlScheme(scheme: ControlScheme): void {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const controls = document.getElementById("touch-controls");
    const dpad = document.getElementById("dpad");
    const joy = document.getElementById("joystick");
    if (!controls) return;
    controls.classList.toggle("hidden", !isTouch);
    dpad?.classList.toggle("hidden", scheme !== "dpad");
    joy?.classList.toggle("hidden", scheme !== "joystick");
    // Reset any held touch direction when switching.
    this.setJoy(Direction.NONE);
    if (scheme === "joystick") this.showJoyHome();
  }

  private attachBombButton(): void {
    const bomb = document.getElementById("bomb-btn");
    bomb?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.onBomb();
    });
  }

  private attachDpad(): void {
    const dpad = document.querySelectorAll<HTMLButtonElement>("#dpad .dbtn");
    dpad.forEach((btn) => {
      const dir = Direction[btn.dataset.dir as keyof typeof Direction] as unknown as Direction;
      const start = (e: Event) => {
        e.preventDefault();
        this.setJoy(dir);
      };
      const end = (e: Event) => {
        e.preventDefault();
        if (this.joyDir === dir) this.setJoy(Direction.NONE);
      };
      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointerleave", end);
      btn.addEventListener("pointercancel", end);
    });
  }

  private base: HTMLElement | null = null;
  private thumb: HTMLElement | null = null;

  /** Fixed resting position of the stick, shown faintly when idle. In landscape
   *  it's pinned to the far-left edge, vertically centered (matching the CSS edge
   *  zone); in portrait it sits bottom-left clear of the home indicator. */
  private homeXY(): { x: number; y: number } {
    const cs = getComputedStyle(document.documentElement);
    const safeBottom = parseInt(cs.getPropertyValue("--sai-bottom")) || 0;
    const safeLeft = parseInt(cs.getPropertyValue("--sai-left")) || 0;
    const landscape = window.innerWidth >= window.innerHeight;
    if (landscape) return { x: 64 + safeLeft, y: window.innerHeight / 2 };
    return { x: 120 + safeLeft, y: window.innerHeight - 150 - safeBottom };
  }

  private showJoyHome(): void {
    if (!this.base || !this.thumb) return;
    const h = this.homeXY();
    this.base.style.left = this.thumb.style.left = `${h.x}px`;
    this.base.style.top = this.thumb.style.top = `${h.y}px`;
    this.base.style.opacity = "0.4";
    this.thumb.style.opacity = "0.5";
  }

  /** Floating virtual joystick: touch anywhere in the left zone to grab it. */
  private attachJoystick(): void {
    const zone = document.getElementById("joystick");
    const base = document.getElementById("joy-base");
    const thumb = document.getElementById("joy-thumb");
    if (!zone || !base || !thumb) return;
    this.base = base;
    this.thumb = thumb;

    const MAX_TRAVEL = 56;
    let active = false;
    let ox = 0;
    let oy = 0;

    zone.addEventListener("pointerdown", (e) => {
      active = true;
      // Anchor the stick at its fixed home (don't jump it to the finger), so it
      // never wanders — the thumb just deflects around the fixed base.
      const h = this.homeXY();
      ox = h.x;
      oy = h.y;
      base.style.left = `${ox}px`;
      base.style.top = `${oy}px`;
      thumb.style.left = `${ox}px`;
      thumb.style.top = `${oy}px`;
      base.style.opacity = "0.9";
      thumb.style.opacity = "1";
      zone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    zone.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - ox;
      const dy = e.clientY - oy;
      const mag = Math.hypot(dx, dy);
      const clamp = Math.min(mag, MAX_TRAVEL);
      const ang = Math.atan2(dy, dx);
      thumb.style.left = `${ox + Math.cos(ang) * clamp}px`;
      thumb.style.top = `${oy + Math.sin(ang) * clamp}px`;
      // Inside the deadzone: KEEP the current direction (don't flip to NONE) so
      // the player doesn't stop-and-go flicker while the thumb hovers near center.
      if (mag < JOY_DEADZONE) return;
      this.setJoy(
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? Direction.RIGHT
            : Direction.LEFT
          : dy > 0
            ? Direction.DOWN
            : Direction.UP,
      );
    });
    const end = (e: Event) => {
      active = false;
      this.setJoy(Direction.NONE);
      this.showJoyHome();
      e.preventDefault();
    };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);
    this.showJoyHome();
  }

  reset(): void {
    this.held = [];
    this.setJoy(Direction.NONE);
  }
}
