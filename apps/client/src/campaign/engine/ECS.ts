/**
 * Minimal ECS (Entity-Component-System) foundation for BomberMeme World.
 * Agent 1 will extend this with full system management.
 */

export interface Component {
  readonly type: string;
}

export class Entity {
  public readonly id: string;
  private components: Map<string, Component> = new Map();

  constructor(id: string) {
    this.id = id;
  }

  addComponent<T extends Component>(component: T): this {
    this.components.set(component.type, component);
    return this;
  }

  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  removeComponent(type: string): boolean {
    return this.components.delete(type);
  }

  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }
}

export class ComponentRegistry {
  private static instance: ComponentRegistry;
  private factories = new Map<string, (...args: unknown[]) => Component>();

  static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  register<T extends Component>(
    type: string,
    factory: (...args: unknown[]) => T,
  ): void {
    this.factories.set(type, factory);
  }

  create(type: string, ...args: unknown[]): Component | undefined {
    const factory = this.factories.get(type);
    return factory ? factory(...args) : undefined;
  }
}
