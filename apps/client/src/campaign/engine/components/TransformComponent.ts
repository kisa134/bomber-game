// TransformComponent — position, rotation, and scale in world space.

import { Component } from "../ECS.js";
import type { Vec2 } from "@bomberpump/shared";

export class TransformComponent extends Component {
  position: Vec2;
  rotation: number; // radians
  scale: Vec2;

  constructor(position: Vec2 = { x: 0, y: 0 }, rotation = 0, scale: Vec2 = { x: 1, y: 1 }) {
    super("transform");
    this.position = { ...position };
    this.rotation = rotation;
    this.scale = { ...scale };
  }

  /** Deep copy of position to avoid reference leaks. */
  getPosition(): Vec2 {
    return { ...this.position };
  }

  setPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  moveBy(dx: number, dy: number): void {
    this.position.x += dx;
    this.position.y += dy;
  }
}
