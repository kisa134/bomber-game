// WorldSocket.ts — WebSocket client for the BomberMeme World server (Issue #6)
// Connects to ws://host:9001/world, sends inputs, receives delta states.
// Implements client-side prediction + server reconciliation.

import {
  WorldClientMsg,
  WorldServerMsg,
  type WorldInputState,
  type WorldStateDelta,
  type EntitySnapshot,
  type Vec2,
  type WorldWelcomeMsg,
  type WorldServerMessage,
} from "@bomberpump/shared";

const RECONNECT_DELAY_MS = 3000;
const INPUT_SEND_INTERVAL = 50; // 20Hz — matches server tick rate
const PING_INTERVAL = 5000;

interface LocalEntityState {
  snapshot: EntitySnapshot;
  /** Last processed server tick for this entity. */
  lastServerTick: number;
}

export class WorldSocket {
  private _ws: WebSocket | null = null;
  private token: string = "";
  private _characterId: string = "";
  private url: string = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private inputTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  /** Local predicted position (client-side prediction). */
  private localPos: Vec2 = { x: 1280, y: 1280 };
  private localVel: Vec2 = { x: 0, y: 0 };
  private localDir: "up" | "down" | "left" | "right" = "down";

  /** Server tick counter. */
  private serverTick = 0;
  private clientTick = 0;

  /** Pending inputs sent to server but not yet acknowledged. */
  private pendingInputs: Array<{ tick: number; input: WorldInputState }> = [];

  /** Current input frame (built by caller each game tick). */
  private currentInput: WorldInputState = {
    tick: 0, moveX: 0, moveY: 0, attack: false, useSkill: false, interact: false, dodge: false, facing: "down",
  };

  /** Cached entity states from server deltas. */
  private entities = new Map<string, LocalEntityState>();

  /** RTT tracking. */
  private pingMs = 0;
  private lastPingTs = 0;

  /** Generic message listeners (for PartyClient etc). */
  private msgListeners = new Set<(msg: WorldServerMessage) => void>();

  // ─── Callbacks ───────────────────────────────────────────────────────────

  private onStateDeltaCb: ((delta: WorldStateDelta) => void) | null = null;
  private onConnectCb: (() => void) | null = null;
  private onDisconnectCb: (() => void) | null = null;
  private onWelcomeCb: ((msg: WorldWelcomeMsg) => void) | null = null;

  // ─── Connection ──────────────────────────────────────────────────────────

  connect(token: string, characterId: string, host: string = window.location.hostname): void {
    this.token = token;
    this._characterId = characterId;
    this.url = `ws://${host}:9001/world?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(characterId)}`;
    this.doConnect();
  }

  private doConnect(): void {
    if (this._ws) return;

    try {
      this._ws = new WebSocket(this.url);
    } catch (e) {
      console.error("[WorldSocket] failed to create WebSocket:", e);
      this.scheduleReconnect();
      return;
    }

    this._ws.binaryType = "arraybuffer";

    this._ws.onopen = () => {
      console.log("[WorldSocket] connected");
      this.connected = true;
      this.pendingInputs = [];
      this.startLoops();
      this.onConnectCb?.();
    };

    this._ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data));
        this.handleServerMessage(data as WorldServerMessage);
      } catch {
        // ignore malformed
      }
    };

    this._ws.onclose = () => {
      console.log("[WorldSocket] disconnected");
      this.cleanup();
      this.onDisconnectCb?.();
      this.scheduleReconnect();
    };

    this._ws.onerror = (err) => {
      console.error("[WorldSocket] error:", err);
      this._ws?.close();
    };
  }

  disconnect(): void {
    this.cleanup();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected) this.doConnect();
    }, RECONNECT_DELAY_MS);
  }

  private cleanup(): void {
    this.connected = false;
    if (this._ws) {
      try { this._ws.close(); } catch { /* ignore */ }
      this._ws = null;
    }
    if (this.inputTimer) { clearInterval(this.inputTimer); this.inputTimer = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  // ─── Input ───────────────────────────────────────────────────────────────

  /** Set the current input state (called every frame by the game loop). */
  setInput(input: Partial<WorldInputState>): void {
    this.currentInput = { ...this.currentInput, ...input, tick: this.clientTick };
  }

  /** Send input immediately (for discrete actions: attack, skill, interact). */
  sendAction(action: Pick<WorldInputState, "attack" | "useSkill" | "interact" | "dodge">): void {
    if (!this.connected || !this._ws) return;
    const input: WorldInputState = { ...this.currentInput, ...action, tick: this.clientTick };
    this._ws.send(JSON.stringify({ type: WorldClientMsg.INPUT, payload: input }));
  }

  private startLoops(): void {
    // Input loop: 20Hz
    this.inputTimer = setInterval(() => {
      if (!this.connected || !this._ws) return;
      this.clientTick++;

      // Client-side prediction: apply input locally
      const speed = 3.2; // pixels per 50ms tick at 160px/sec
      const nx = this.localPos.x + this.currentInput.moveX * speed;
      const ny = this.localPos.y + this.currentInput.moveY * speed;
      this.localPos.x = Math.max(0, Math.min(2560, nx));
      this.localPos.y = Math.max(0, Math.min(2560, ny));
      this.localVel = { x: this.currentInput.moveX * 160, y: this.currentInput.moveY * 160 };
      if (Math.abs(this.currentInput.moveX) > 0.1 || Math.abs(this.currentInput.moveY) > 0.1) {
        this.localDir = this.inputToDir(this.currentInput.moveX, this.currentInput.moveY);
      }

      // Store and send
      const input: WorldInputState = { ...this.currentInput, tick: this.clientTick };
      this.pendingInputs.push({ tick: this.clientTick, input });
      if (this.pendingInputs.length > 60) this.pendingInputs.shift(); // cap buffer

      this._ws.send(JSON.stringify({ type: WorldClientMsg.INPUT, payload: input }));
    }, INPUT_SEND_INTERVAL);

    // Ping loop
    this.pingTimer = setInterval(() => {
      if (!this.connected || !this._ws) return;
      this.lastPingTs = Date.now();
      this._ws.send(JSON.stringify({ type: WorldClientMsg.PING, timestamp: this.lastPingTs }));
    }, PING_INTERVAL);
  }

  // ─── Server message handling ─────────────────────────────────────────────

  private handleServerMessage(msg: WorldServerMessage): void {
    // Notify generic listeners first (PartyClient etc)
    for (const listener of this.msgListeners) {
      try { listener(msg); } catch { /* ignore */ }
    }

    switch (msg.type) {
      case WorldServerMsg.DELTA_STATE:
        this.applyDelta(msg.delta);
        break;
      case WorldServerMsg.PONG: {
        if (this.lastPingTs > 0) {
          this.pingMs = Date.now() - this.lastPingTs;
        }
        break;
      }
      case WorldServerMsg.WELCOME:
        this.serverTick = msg.tick;
        this.localPos = { ...msg.spawnPos };
        this.onWelcomeCb?.(msg);
        break;
      case WorldServerMsg.ENTITY_REMOVED:
        for (const id of msg.ids) this.entities.delete(id);
        break;
    }
  }

  private applyDelta(delta: WorldStateDelta): void {
    this.serverTick = delta.tick;

    // Remove entities
    for (const id of delta.removed) {
      this.entities.delete(id);
    }

    // Add new entities
    for (const snap of delta.added) {
      this.entities.set(snap.id, { snapshot: { ...snap }, lastServerTick: delta.tick });
    }

    // Update existing entities + reconcile local player
    for (const snap of delta.updated) {
      if (snap.id === this._characterId) {
        // Server reconciliation for local player
        this.reconcilePlayer(snap, delta.tick);
      } else {
        const existing = this.entities.get(snap.id);
        if (existing) {
          existing.snapshot = this.mergeSnapshot(existing.snapshot, snap);
          existing.lastServerTick = delta.tick;
        } else {
          this.entities.set(snap.id, { snapshot: { ...snap }, lastServerTick: delta.tick });
        }
      }
    }

    // Notify listener
    this.onStateDeltaCb?.(delta);
  }

  /** Server reconciliation: snap to server position, then re-apply unack inputs. */
  private reconcilePlayer(serverSnap: EntitySnapshot, serverTick: number): void {
    // Remove acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter((p) => p.tick > serverTick);

    // Snap to server position
    this.localPos = { ...serverSnap.position };
    this.localVel = { ...serverSnap.velocity };
    if (serverSnap.direction) this.localDir = serverSnap.direction;

    // Re-apply pending inputs (prediction replay)
    const speed = 3.2;
    for (const { input } of this.pendingInputs) {
      this.localPos.x += input.moveX * speed;
      this.localPos.y += input.moveY * speed;
      this.localPos.x = Math.max(0, Math.min(2560, this.localPos.x));
      this.localPos.y = Math.max(0, Math.min(2560, this.localPos.y));
    }

    // Update stored snapshot
    const existing = this.entities.get(this._characterId);
    if (existing) {
      existing.snapshot = { ...serverSnap, position: { ...this.localPos }, velocity: { ...this.localVel } };
      existing.lastServerTick = serverTick;
    }
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  /** Get the local predicted position (render this). */
  getLocalPosition(): Vec2 {
    return { ...this.localPos };
  }

  getLocalVelocity(): Vec2 {
    return { ...this.localVel };
  }

  getLocalDirection(): "up" | "down" | "left" | "right" {
    return this.localDir;
  }

  getPingMs(): number {
    return this.pingMs;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getEntity(id: string): EntitySnapshot | undefined {
    return this.entities.get(id)?.snapshot;
  }

  getAllEntities(): Map<string, EntitySnapshot> {
    const map = new Map<string, EntitySnapshot>();
    for (const [k, v] of this.entities) map.set(k, v.snapshot);
    return map;
  }

  get characterId(): string {
    return this._characterId;
  }

  // ─── Raw send (for PartyClient) ──────────────────────────────────────────

  /** Send a raw JSON payload. Used by PartyClient for party messages. */
  sendRaw(payload: object): void {
    if (!this.connected || !this._ws) return;
    this._ws.send(JSON.stringify(payload));
  }

  /** Subscribe to all server messages (for PartyClient). */
  onMessage(listener: (msg: WorldServerMessage) => void): () => void {
    this.msgListeners.add(listener);
    return () => { this.msgListeners.delete(listener); };
  }

  // ─── Callback setters ────────────────────────────────────────────────────

  onStateDelta(callback: (delta: WorldStateDelta) => void): void {
    this.onStateDeltaCb = callback;
  }

  onConnect(callback: () => void): void {
    this.onConnectCb = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCb = callback;
  }

  onWelcome(callback: (msg: WorldWelcomeMsg) => void): void {
    this.onWelcomeCb = callback;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private inputToDir(x: number, y: number): "up" | "down" | "left" | "right" {
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
    return y > 0 ? "down" : "up";
  }

  private mergeSnapshot(base: EntitySnapshot, delta: EntitySnapshot): EntitySnapshot {
    return {
      ...base,
      position: delta.position ?? base.position,
      velocity: delta.velocity ?? base.velocity,
      hp: delta.hp ?? base.hp,
      maxHp: delta.maxHp ?? base.maxHp,
      animation: delta.animation ?? base.animation,
      frame: delta.frame ?? base.frame,
      direction: delta.direction ?? base.direction,
    };
  }
}
