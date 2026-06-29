import { Component } from "../ECS.js";

export class ManaComponent extends Component {
  mana: number;
  maxMana: number;
  manaRegen: number;

  constructor(maxMana = 100, manaRegen = 5) {
    super("mana");
    this.maxMana = maxMana;
    this.mana = maxMana;
    this.manaRegen = manaRegen;
  }
}
