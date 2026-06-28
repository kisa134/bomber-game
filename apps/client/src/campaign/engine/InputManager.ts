// InputManager — keyboard + mouse input for campaign mode.
// WASD movement, mouse aiming, LKM/RKM/E/Shift/Space.

import type { Vec2 } from "@bomberpump/shared";

export interface InputState {
  /** Normalized movement direction from WASD. */
  moveDir: Vec2;
  /** Mouse position in screen pixels. */
  mouseScreen: Vec2;
  /** Mouse position in world pixels (updated via Camera). */
  mouseWorld: Vec2;
  /** Left mouse button (attack / charge). */
  attack: boolean;
  /** Right mouse button (skill). */
  skill: boolean;
  /** Interact key (E). */
  interact: boolean;
  /** Sprint modifier (Shift). */
  run: boolean;
  /** Dodge/roll (Space). */
  dodge: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private mouseDown = new Set<number>();
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private mouseWorldX = 0;
  private mouseWorldY = 0;
  private attached = false;

  /** One-shot flags: set on press, consumed by reader, then cleared. */
  private interactPressed = false;
  private dodgePressed = false;

  /** Attack was just released (for charge-release detection). */
  attackReleased = false;

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
  }

  /** Attach event listeners. Call once on init. */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("contextmenu", this.onContextMenu);
  }

  /** Detach event listeners. Call on cleanup. */
  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("contextmenu", this.onContextMenu);
  }

  /** Update mouse world position from camera. Call each frame. */
  setMouseWorld(x: number, y: number): void {
    this.mouseWorldX = x;
    this.mouseWorldY = y;
  }

  /** Get the current input state for processing. */
  getState(): InputState {
    const x = (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? -1 : 0) +
              (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0);
    const y = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? -1 : 0) +
              (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);

    // Normalize diagonal movement
    const len = Math.hypot(x, y);
    const moveDir = len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };

    return {
      moveDir,
      mouseScreen: { x: this.mouseScreenX, y: this.mouseScreenY },
      mouseWorld: { x: this.mouseWorldX, y: this.mouseWorldY },
      attack: this.mouseDown.has(0),
      skill: this.mouseDown.has(2),
      interact: this.consumeInteract(),
      run: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      dodge: this.consumeDodge(),
    };
  }

  private consumeInteract(): boolean {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  private consumeDodge(): boolean {
    const v = this.dodgePressed;
    this.dodgePressed = false;
    return v;
  }

  /** Check if a key is currently held. */
  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.isTypingTarget(e.target)) return;
    this.keys.add(e.code);
    if (e.code === "KeyE") this.interactPressed = true;
    if (e.code === "Space") {
      this.dodgePressed = true;
      e.preventDefault();
    }
    // Prevent scrolling with arrows/space
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private onMouseMove(e: MouseEvent): void {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
  }

  private onMouseDown(e: MouseEvent): void {
    this.mouseDown.add(e.button);
    if (e.button === 0) this.attackReleased = false;
  }

  private onMouseUp(e: MouseEvent): void {
    this.mouseDown.delete(e.button);
    if (e.button === 0) this.attackReleased = true;
  }

  private onContextMenu(e: Event): void {
    e.preventDefault();
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
  }

  /** Reset all inputs (e.g., on window blur). */
  reset(): void {
    this.keys.clear();
    this.mouseDown.clear();
    this.interactPressed = false;
    this.dodgePressed = false;
    this.attackReleased = false;
  }
}
