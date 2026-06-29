import { HEROES, type HeroData } from "./Hero.js";

export class HeroRegistry {
  private static instance: HeroRegistry;
  private heroes = new Map<string, HeroData>();

  private constructor() {
    for (const h of HEROES) {
      this.heroes.set(h.id, h);
    }
  }

  static getInstance(): HeroRegistry {
    if (!HeroRegistry.instance) HeroRegistry.instance = new HeroRegistry();
    return HeroRegistry.instance;
  }

  get(id: string): HeroData | undefined {
    return this.heroes.get(id);
  }

  getAll(): HeroData[] {
    return Array.from(this.heroes.values());
  }

  getByFaction(faction: string): HeroData[] {
    return this.getAll().filter((h) => h.faction === faction);
  }
}
