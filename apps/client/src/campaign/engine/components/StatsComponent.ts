import { Component } from "../ECS.js";
import type { Attributes } from "@bomberpump/shared";

export class StatsComponent extends Component {
  attributes: Attributes;
  moveSpeed: number;

  constructor(attributes: Attributes, moveSpeed: number) {
    super("stats");
    this.attributes = attributes;
    this.moveSpeed = moveSpeed;
  }
}
