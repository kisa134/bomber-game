// ECS Core for BomberMeme World
// Entity-Component-System architecture with Map-based lookups.

let nextEntityId = 0;

export function resetEntityIdCounter(): void {
  nextEntityId = 0;
}

export function genEntityId(): string {
  return `e_${++nextEntityId}_${Math.random().toString(36).slice(2, 6)}`;
}

export abstract class Component {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
}

export class Entity {
  id: string;
  type: string;
  components: Map<string, Component> = new Map();

  constructor(type: string, id?: string) {
    this.id = id ?? genEntityId();
    this.type = type;
  }

  addComponent(c: Component): void {
    this.components.set(c.name, c);
  }

  getComponent<T extends Component>(name: string): T | undefined {
    return this.components.get(name) as T | undefined;
  }

  removeComponent(name: string): void {
    this.components.delete(name);
  }

  hasComponent(name: string): boolean {
    return this.components.has(name);
  }

  hasAll(...names: string[]): boolean {
    for (const n of names) {
      if (!this.components.has(n)) return false;
    }
    return true;
  }
}

export abstract class System {
  readonly name: string;
  readonly componentsRequired: string[];
  enabled = true;

  constructor(name: string, componentsRequired: string[]) {
    this.name = name;
    this.componentsRequired = componentsRequired;
  }

  abstract update(entities: Entity[], dt: number): void;

  onEntityAdded?(_entity: Entity): void;
  onEntityRemoved?(_entity: Entity): void;
}

export class World {
  entities: Map<string, Entity> = new Map();
  systems: System[] = [];
  private pendingRemoval: string[] = [];

  addEntity(e: Entity): void {
    this.entities.set(e.id, e);
    for (const s of this.systems) {
      s.onEntityAdded?.(e);
    }
  }

  removeEntity(id: string): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    for (const s of this.systems) {
      s.onEntityRemoved?.(e);
    }
  }

  queueRemove(id: string): void {
    if (!this.pendingRemoval.includes(id)) {
      this.pendingRemoval.push(id);
    }
  }

  addSystem(s: System): void {
    this.systems.push(s);
  }

  removeSystem(name: string): void {
    const i = this.systems.findIndex((s) => s.name === name);
    if (i >= 0) this.systems.splice(i, 1);
  }

  getSystem<T extends System>(name: string): T | undefined {
    return this.systems.find((s) => s.name === name) as T | undefined;
  }

  getEntitiesWith(...componentNames: string[]): Entity[] {
    const out: Entity[] = [];
    for (const e of this.entities.values()) {
      if (e.hasAll(...componentNames)) out.push(e);
    }
    return out;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  update(dt: number): void {
    for (const s of this.systems) {
      if (!s.enabled) continue;
      const matching = this.getEntitiesWith(...s.componentsRequired);
      s.update(matching, dt);
    }
    if (this.pendingRemoval.length) {
      for (const id of this.pendingRemoval) {
        this.removeEntity(id);
      }
      this.pendingRemoval.length = 0;
    }
  }

  clear(): void {
    for (const e of this.entities.values()) {
      for (const s of this.systems) {
        s.onEntityRemoved?.(e);
      }
    }
    this.entities.clear();
    this.pendingRemoval.length = 0;
    resetEntityIdCounter();
  }
}
