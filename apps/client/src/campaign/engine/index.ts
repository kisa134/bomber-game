// Barrel export for the BomberMeme World campaign engine.

export {
  Component,
  Entity,
  System,
  World,
  genEntityId,
  resetEntityIdCounter,
} from "./ECS.js";

export {
  TransformComponent,
  SpriteComponent,
  PhysicsComponent,
  CombatComponent,
  InputComponent,
  RPGComponent,
  HealthComponent,
  XPComponent,
  ManaComponent,
  InventoryComponent,
  StatsComponent,
  PlayerControllerComponent,
} from "./components/index.js";

export {
  ChunkManager,
  CHUNK_SIZE_TILES,
  CHUNK_SIZE_TILES as CHUNK_TILES,
  CHUNK_LOAD_RADIUS,
  CHUNK_UNLOAD_RADIUS,
} from "./ChunkManager.js";

export { Camera } from "./Camera.js";
export { InputManager } from "./InputManager.js";
export { CampaignRenderer, preloadCampaignSprites } from "./Renderer.js";
export { CollisionSystem } from "./CollisionSystem.js";
export { MovementSystem } from "./MovementSystem.js";
