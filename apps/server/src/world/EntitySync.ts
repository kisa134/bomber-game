// EntitySync.ts — delta compression + client reconciliation for world entities (Issue #6)

import {
  type EntitySnapshot,
  type WorldStateDelta,
  type Vec2,
} from "@bomberpump/shared";
import type { PlayerSession } from "./PlayerSession.js";

/** Maximum speed in pixels/tick (anti-cheat). At 20Hz, 8px/tick = 160px/sec. */
const MAX_SPEED_PER_TICK = 8;

/** Track which entities each session has already seen (for add/remove tracking). */
export class EntitySync {
  private known = new Map<string, Set<string>>(); // sessionId -> known entity ids
  private lastState = new Map<string, EntitySnapshot>(); // entityId -> last sent snapshot
  private tick = 0;

  incrementTick(): number {
    this.tick++;
    return this.tick;
  }

  getTick(): number {
    return this.tick;
  }

  /** Build a delta for a single session: only what changed since last ack. */
  buildDelta(session: PlayerSession): WorldStateDelta {
    const knownSet = this.known.get(session.id) ?? new Set<string>();
    const updated: EntitySnapshot[] = [];
    const added: EntitySnapshot[] = [];

    // Scan all living entities from the world
    for (const snap of this.currentEntities.values()) {
      const last = this.lastState.get(snap.id);
      if (!knownSet.has(snap.id)) {
        added.push(snap);
        knownSet.add(snap.id);
        this.lastState.set(snap.id, { ...snap });
      } else if (this.changed(last, snap)) {
        updated.push(this.minimalDelta(last!, snap));
        this.lastState.set(snap.id, { ...snap });
      }
    }

    // Detect removed entities (known but not in current)
    const removed: string[] = [];
    for (const id of knownSet) {
      if (!this.currentEntities.has(id)) {
        removed.push(id);
        this.lastState.delete(id);
      }
    }
    for (const id of removed) knownSet.delete(id);

    this.known.set(session.id, knownSet);
    return { tick: this.tick, updated, removed, added };
  }

  /** Clear known set on session disconnect. */
  purgeSession(sessionId: string): void {
    this.known.delete(sessionId);
  }

  /** Full state snapshot for a newly-connecting client. */
  buildFullSnapshot(): WorldStateDelta {
    return {
      tick: this.tick,
      updated: [],
      removed: [],
      added: Array.from(this.currentEntities.values()),
    };
  }

  /** Mark an entity as destroyed so all clients remove it next tick. */
  destroyEntity(entityId: string): void {
    this.currentEntities.delete(entityId);
  }

  /** The authoritative set of entities — updated by WorldServer each tick. */
  readonly currentEntities = new Map<string, EntitySnapshot>();

  /** Anti-cheat: validate a claimed movement from a client. */
  validateMovement(
    oldPos: Vec2,
    newPos: Vec2,
    maxSpeed: number = MAX_SPEED_PER_TICK,
  ): boolean {
    const dx = newPos.x - oldPos.x;
    const dy = newPos.y - oldPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= maxSpeed * 1.2; // 20% tolerance for jitter
  }

  /** Server reconciliation: compute authoritative position given inputs. */
  reconcile(
    authoritative: Vec2,
    predicted: Vec2,
    serverDelta: Vec2,
  ): Vec2 {
    const threshold = 4; // pixels of drift before snapping
    const dx = predicted.x - authoritative.x;
    const dy = predicted.y - authoritative.y;
    const drift = Math.sqrt(dx * dx + dy * dy);
    if (drift < threshold) {
      // Smoothly interpolate back
      return {
        x: predicted.x + serverDelta.x * 0.3,
        y: predicted.y + serverDelta.y * 0.3,
      };
    }
    // Hard snap if drifted too far
    return { x: authoritative.x, y: authoritative.y };
  }

  /** Encode a delta into a compact binary form for WS send. */
  encodeDelta(delta: WorldStateDelta): Buffer {
    return Buffer.from(JSON.stringify(delta));
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private changed(a: EntitySnapshot | undefined, b: EntitySnapshot): boolean {
    if (!a) return true;
    return (
      a.position.x !== b.position.x ||
      a.position.y !== b.position.y ||
      a.velocity.x !== b.velocity.x ||
      a.velocity.y !== b.velocity.y ||
      a.hp !== b.hp ||
      a.animation !== b.animation ||
      a.direction !== b.direction ||
      a.frame !== b.frame
    );
  }

  /** Send only the fields that actually changed. */
  private minimalDelta(
    last: EntitySnapshot,
    curr: EntitySnapshot,
  ): EntitySnapshot {
    const snap: EntitySnapshot = { id: curr.id, type: curr.type, position: curr.position, velocity: curr.velocity };
    if (curr.hp !== undefined && curr.hp !== last.hp) snap.hp = curr.hp;
    if (curr.maxHp !== undefined && curr.maxHp !== last.maxHp) snap.maxHp = curr.maxHp;
    if (curr.animation !== undefined && curr.animation !== last.animation) snap.animation = curr.animation;
    if (curr.frame !== undefined && curr.frame !== last.frame) snap.frame = curr.frame;
    if (curr.direction !== undefined && curr.direction !== last.direction) snap.direction = curr.direction;
    return snap;
  }
}
