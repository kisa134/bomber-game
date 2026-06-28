// ECS Core for BomberMeme World
// Entity-Component-System architecture with Map-based lookups.

let nextEntityId = 0;

/** Unique ID generator for entities. Resets on world clear. */
export function resetEntityIdCounter(): void {
  nextEntityId = 0;
}

/** Generate a unique entity ID. */
export function genEntityId(): string {
  return `e_${++nextEntityId}_${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Base class for all components. The name is used as the lookup key. */
export abstract class Component {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

/** An entity is a bag of components with a unique ID. */
export class Entity {
  id: string;
  type: string; // e.g. "player", "mob", "bomb"
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

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

/** Base class for all systems. Systems process entities that have all required components. */
export abstract class System {
  readonly name: string;
  readonly componentsRequired: string[];
  enabled = true;

  constructor(name: string, componentsRequired: string[]) {
    this.name = name;
    this.componentsRequired = componentsRequired;
  }

  /** Called once per tick with entities that have all required components. */
  abstract update(entities: Entity[], dt: number): void;

  /** Optional: called when an entity is added to the world. */
  onEntityAdded?(_entity: Entity): void;

  /** Optional: called when an entity is removed from the world. */
  onEntityRemoved?(_entity: Entity): void;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

/** The World holds all entities and systems, and runs the update loop. */
export class World {
  entities: Map<string, Entity> = new Map();
  systems: System[] = [];

  /** Entities that were marked for removal (processed at end of update). */
  private pendingRemoval: string[] = [];

  /** Add an entity to the world. */
  addEntity(e: Entity): void {
    this.entities.set(e.id, e);
    for (const s of this.systems) {
      s.onEntityAdded?.(e);
    }
  }

  /** Remove an entity immediately. */
  removeEntity(id: string): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    for (const s of this.systems) {
      s.onEntityRemoved?.(e);
    }
  }

  /** Mark an entity for removal at the end of the current update. */
  queueRemove(id: string): void {
    if (!this.pendingRemoval.includes(id)) {
      this.pendingRemoval.push(id);
    }
  }

  /** Add a system to the world. Systems update in insertion order. */
  addSystem(s: System): void {
    this.systems.push(s);
  }

  /** Remove a system by name. */
  removeSystem(name: string): void {
    const i = this.systems.findIndex((s) => s.name === name);
    if (i >= 0) this.systems.splice(i, 1);
  }

  /** Get a system by name. */
  getSystem<T extends System>(name: string): T | undefined {
    return this.systems.find((s) => s.name === name) as T | undefined;
  }

  /** Find all entities that have every named component. */
  getEntitiesWith(...componentNames: string[]): Entity[] {
    const out: Entity[] = [];
    for (const e of this.entities.values()) {
      if (e.hasAll(...componentNames)) out.push(e);
    }
    return out;
  }

  /** Get a single entity by ID. */
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /** Main update loop: runs all enabled systems with their matching entities. */
  update(dt: number): void {
    for (const s of this.systems) {
      if (!s.enabled) continue;
      const matching = this.getEntitiesWith(...s.componentsRequired);
      s.update(matching, dt);
    }
    // Process deferred removals
    if (this.pendingRemoval.length) {
      for (const id of this.pendingRemoval) {
        this.removeEntity(id);
      }
      this.pendingRemoval.length = 0;
    }
  }

  /** Remove all entities and reset the ID counter. */
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
