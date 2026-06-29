import { Component } from "../ECS.js";

export class InventoryComponent extends Component {
  currency: number;

  constructor(currency = 0) {
    super("inventory");
    this.currency = currency;
  }
}
