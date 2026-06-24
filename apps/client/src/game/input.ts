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

const JOY_DEADZONE = 12; // px — below this the current direction is held (no flicker)
const JOY_TRAVEL = 52; // px — thumb max offset; past it the base trails the finger
const JOY_SWITCH = 1.3; // hysteresis: a new axis must beat the current one by this much

/** Snap an analog vector to one of 4 grid directions with angular hysteresis:
 *  once a direction is committed, the finger must clearly cross past the diagonal
 *  to switch — so movement along a row/column never flickers into a turn. */
function snap4(dx: number, dy: number, cur: Direction): Direction {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  let horiz = ax >= ay;
  const curHoriz = cur === Direction.LEFT || cur === Direction.RIGHT;
  const curVert = cur === Direction.UP || cur === Direction.DOWN;
  // Sticky: don't flip axes unless the new axis dominates by JOY_SWITCH.
  if (horiz && curVert && ax < ay * JOY_SWITCH) horiz = false;
  else if (!horiz && curHoriz && ay < ax * JOY_SWITCH) horiz = true;
  return horiz
    ? dx >= 0
      ? Direction.RIGHT
      : Direction.LEFT
    : dy >= 0
      ? Direction.DOWN
      : Direction.UP;
}

/** True when the key event targets a text field — don't hijack those keys. */
function typingInField(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el?.isContentEditable ?? false);
}

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
      if (e.repeat || typingInField(e)) return; // don't steal keys from text inputs
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
      if (typingInField(e)) return;
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
    if (scheme === "joystick") this.hideJoy();
  }

  private attachBombButton(): void {
    // Both the visible round button AND the big invisible right-half zone drop a bomb.
    for (const id of ["bomb-btn", "bomb-zone"]) {
      document.getElementById(id)?.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.onBomb();
      });
    }
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

  /** Hide the stick when no finger is down (so nothing is parked on screen). */
  private hideJoy(): void {
    if (!this.base || !this.thumb) return;
    this.base.style.opacity = "0";
    this.thumb.style.opacity = "0";
  }

  /** Floating "dynamic" virtual joystick — the pro mobile pattern:
   *   • the WHOLE left zone is live; touch anywhere and the stick spawns under
   *     your finger (it's invisible until then, so nothing's parked on screen);
   *   • CLUTCH: drag past the ring and the base trails your finger, so direction
   *     stays finger-relative and you can never run out of travel / lose control;
   *   • a small dead-zone + axis hysteresis keep grid movement rock-steady (no
   *     flicker into a turn when you're running straight);
   *   • tracks one specific finger by id, so the bomb hand never interferes. */
  private attachJoystick(): void {
    const zone = document.getElementById("joystick");
    const base = document.getElementById("joy-base");
    const thumb = document.getElementById("joy-thumb");
    if (!zone || !base || !thumb) return;
    this.base = base;
    this.thumb = thumb;

    let pid = -1; // the finger currently driving the stick (-1 = none)
    let ox = 0;
    let oy = 0;
    const placeBase = (): void => {
      base.style.left = `${ox}px`;
      base.style.top = `${oy}px`;
    };

    zone.addEventListener("pointerdown", (e) => {
      if (pid !== -1) return; // already tracking a finger — ignore extra touches
      pid = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      placeBase();
      thumb.style.left = `${ox}px`;
      thumb.style.top = `${oy}px`;
      base.style.opacity = "0.6";
      thumb.style.opacity = "0.95";
      zone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      let dx = e.clientX - ox;
      let dy = e.clientY - oy;
      let mag = Math.hypot(dx, dy);
      // Clutch: once the finger is past the ring, slide the base toward it so it
      // trails at exactly JOY_TRAVEL away — the stick "follows" and never pins.
      if (mag > JOY_TRAVEL) {
        const k = (mag - JOY_TRAVEL) / mag;
        ox += dx * k;
        oy += dy * k;
        placeBase();
        dx = e.clientX - ox;
        dy = e.clientY - oy;
        mag = JOY_TRAVEL;
      }
      thumb.style.left = `${ox + dx}px`;
      thumb.style.top = `${oy + dy}px`;
      // Near centre: hold the current direction (no stop-and-go flicker).
      if (mag < JOY_DEADZONE) return;
      this.setJoy(snap4(dx, dy, this.joyDir));
      e.preventDefault();
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== pid) return;
      pid = -1;
      this.setJoy(Direction.NONE);
      this.hideJoy();
    };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);
    this.hideJoy();
  }

  reset(): void {
    this.held = [];
    this.setJoy(Direction.NONE);
  }
}
