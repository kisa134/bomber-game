// PartyClient.ts — High-level party/co-op client for BomberMeme World (Issue #6)
// Wraps WorldSocket to provide party create/join/leave/kick/transfer APIs.

import {
  WorldClientMsg,
  WorldServerMsg,
  type Party,
  type LootMode,
  type PartyUpdateMsg,
  type PartyErrorMsg,
  type WorldServerMessage,
} from "@bomberpump/shared";
import type { WorldSocket } from "./WorldSocket.js";

export class PartyClient {
  private ws: WorldSocket | null = null;
  private currentParty: Party | null = null;
  private onPartyUpdateCb: ((party: Party | null) => void) | null = null;
  private onPartyErrorCb: ((code: string, message: string) => void) | null = null;

  constructor(worldSocket: WorldSocket) {
    this.ws = worldSocket;
    // Listen to raw messages on the socket — but WorldSocket currently
    // doesn't expose a generic message listener. We rely on the caller
    // to wire party messages via handleServerMessage().
  }

  /** Must be called when a WorldServerMessage arrives (PARTY_UPDATE / PARTY_ERROR). */
  handleServerMessage(msg: WorldServerMessage): void {
    switch (msg.type) {
      case WorldServerMsg.PARTY_UPDATE: {
        const update = msg as PartyUpdateMsg;
        this.currentParty = update.party;
        this.onPartyUpdateCb?.(update.party);
        break;
      }
      case WorldServerMsg.PARTY_ERROR: {
        const err = msg as PartyErrorMsg;
        this.onPartyErrorCb?.(err.code, err.message);
        break;
      }
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  /** Create a new party. Returns a promise that resolves with the 6-digit code. */
  createParty(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws?.isConnected()) {
        reject(new Error("not_connected"));
        return;
      }

      const offUpdate = this.onPartyUpdateOnce((party) => {
        offUpdate?.();
        resolve(party.code);
      });

      this.send({ type: WorldClientMsg.PARTY_CREATE });

      // Timeout
      setTimeout(() => {
        reject(new Error("party_create_timeout"));
      }, 5000);
    });
  }

  /** Join a party by its 6-digit code. */
  joinParty(code: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.ws?.isConnected()) {
        reject(new Error("not_connected"));
        return;
      }
      if (!/^[A-Z0-9]{6}$/i.test(code)) {
        reject(new Error("invalid_code"));
        return;
      }

      let resolved = false;

      const offUpdate = this.onPartyUpdateOnce(() => {
        resolved = true;
        offUpdate?.();
        resolve(true);
      });

      const offError = this.onPartyErrorOnce((errCode) => {
        if (errCode === "party_not_found" || errCode === "party_full" || errCode === "already_in_party") {
          resolved = true;
          offError?.();
          resolve(false);
        }
      });

      this.send({ type: WorldClientMsg.PARTY_JOIN, code: code.toUpperCase() });

      setTimeout(() => {
        if (!resolved) {
          offUpdate?.();
          offError?.();
          resolve(false);
        }
      }, 5000);
    });
  }

  /** Leave the current party. */
  leaveParty(): void {
    if (!this.ws?.isConnected()) return;
    this.send({ type: WorldClientMsg.PARTY_LEAVE });
    this.currentParty = null;
    this.onPartyUpdateCb?.(null);
  }

  /** Kick a member (leader only). */
  kickMember(targetCharacterId: string): void {
    if (!this.ws?.isConnected()) return;
    this.send({ type: WorldClientMsg.PARTY_KICK, targetId: targetCharacterId });
  }

  /** Transfer leadership. */
  transferLeadership(newLeaderCharacterId: string): void {
    if (!this.ws?.isConnected()) return;
    this.send({ type: WorldClientMsg.PARTY_TRANSFER, newLeaderId: newLeaderCharacterId });
  }

  /** Set loot mode (leader only). */
  setLootMode(mode: LootMode): void {
    if (!this.ws?.isConnected()) return;
    this.send({ type: WorldClientMsg.PARTY_SET_LOOT, mode });
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  getParty(): Party | null {
    return this.currentParty;
  }

  isLeader(): boolean {
    if (!this.currentParty) return false;
    // characterId is resolved from the socket's auth
    return this.currentParty.leaderId === this.getLocalCharacterId();
  }

  getMemberCount(): number {
    return this.currentParty?.members.length ?? 0;
  }

  getMaxMembers(): number {
    return 4;
  }

  getLootMode(): LootMode {
    return this.currentParty?.lootMode ?? "free";
  }

  /** Shared progress: zones discovered, quests completed, bosses killed. */
  getSharedProgress() {
    return this.currentParty?.sharedProgress ?? null;
  }

  /** Difficulty scale factor (1.0 = solo, higher = more enemies/HP). */
  getDifficultyScale(): number {
    return this.currentParty?.difficultyScale ?? 1.0;
  }

  // ─── Callbacks ───────────────────────────────────────────────────────────

  onPartyUpdate(callback: (party: Party | null) => void): void {
    this.onPartyUpdateCb = callback;
  }

  onPartyError(callback: (code: string, message: string) => void): void {
    this.onPartyErrorCb = callback;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private send(payload: object): void {
    // Access the raw WebSocket via a private field or a send method
    // Since WorldSocket doesn't expose raw send, we need to extend it
    // For now we use a workaround: cast and access internal ws
    const socketAny = this.ws as unknown as { ws: WebSocket | null };
    if (socketAny.ws && socketAny.ws.readyState === WebSocket.OPEN) {
      socketAny.ws.send(JSON.stringify(payload));
    }
  }

  private getLocalCharacterId(): string {
    // Access characterId from WorldSocket
    const socketAny = this.ws as unknown as { characterId: string };
    return socketAny.characterId ?? "";
  }

  private onPartyUpdateOnce(callback: (party: Party) => void): (() => void) | null {
    const prev = this.onPartyUpdateCb;
    this.onPartyUpdateCb = (party) => {
      if (party) callback(party);
    };
    // Return cleanup
    return () => { this.onPartyUpdateCb = prev; };
  }

  private onPartyErrorOnce(callback: (code: string) => void): (() => void) | null {
    const prev = this.onPartyErrorCb;
    this.onPartyErrorCb = (code) => callback(code);
    return () => { this.onPartyErrorCb = prev; };
  }
}
