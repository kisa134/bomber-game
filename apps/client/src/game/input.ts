import { Direction } from "../net/protocol.js";

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

/** Tracks held directions (last-pressed wins) and emits bomb presses. */
export class Input {
  private held: Direction[] = [];
  onBomb: () => void = () => {};
  /** Fired the instant the active direction changes, for zero-delay sending. */
  onChange: (dir: Direction) => void = () => {};

  get dir(): Direction {
    return this.held.length ? this.held[this.held.length - 1] : Direction.NONE;
  }

  private press(dir: Direction): void {
    if (dir === Direction.NONE) return;
    const before = this.dir;
    this.release(dir);
    this.held.push(dir);
    if (this.dir !== before) this.onChange(this.dir);
  }

  private release(dir: Direction): void {
    const before = this.dir;
    const i = this.held.indexOf(dir);
    if (i >= 0) this.held.splice(i, 1);
    if (this.dir !== before) this.onChange(this.dir);
  }

  attach(): void {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const dir = KEY_DIR[e.code];
      if (dir !== undefined) {
        this.press(dir);
        e.preventDefault();
      } else if (e.code === "Space") {
        this.onBomb();
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      const dir = KEY_DIR[e.code];
      if (dir !== undefined) this.release(dir);
    });

    this.attachTouch();
  }

  private attachTouch(): void {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const controls = document.getElementById("touch-controls");
    if (!isTouch || !controls) return;
    controls.classList.remove("hidden");

    const dpad = controls.querySelectorAll<HTMLButtonElement>(".dbtn");
    dpad.forEach((btn) => {
      const dir = Direction[btn.dataset.dir as keyof typeof Direction] as unknown as Direction;
      const start = (e: Event) => {
        e.preventDefault();
        this.press(dir);
      };
      const end = (e: Event) => {
        e.preventDefault();
        this.release(dir);
      };
      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointerleave", end);
      btn.addEventListener("pointercancel", end);
    });

    const bombBtn = document.getElementById("bomb-btn");
    bombBtn?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.onBomb();
    });
  }

  reset(): void {
    this.held = [];
  }
}
