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
  private unsubMessage: (() => void) | null = null;

  constructor(worldSocket: WorldSocket) {
    this.ws = worldSocket;
    this.unsubMessage = worldSocket.onMessage((msg) => this.handleServerMessage(msg));
  }

  destroy(): void {
    this.unsubMessage?.();
  }

  /** Process WorldServer messages for party updates and errors. */
  private handleServerMessage(msg: WorldServerMessage): void {
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

      let resolved = false;
      const offUpdate = this.onPartyUpdateOnce((party) => {
        resolved = true;
        resolve(party.code);
      });

      this.ws.sendRaw({ type: WorldClientMsg.PARTY_CREATE });

      setTimeout(() => {
        if (!resolved) {
          offUpdate();
          reject(new Error("party_create_timeout"));
        }
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
        resolve(true);
      });

      const offError = this.onPartyErrorOnce((errCode) => {
        if (errCode === "party_not_found" || errCode === "party_full" || errCode === "already_in_party") {
          resolved = true;
          resolve(false);
        }
      });

      this.ws.sendRaw({ type: WorldClientMsg.PARTY_JOIN, code: code.toUpperCase() });

      setTimeout(() => {
        if (!resolved) {
          offUpdate();
          offError();
          resolve(false);
        }
      }, 5000);
    });
  }

  /** Leave the current party. */
  leaveParty(): void {
    if (!this.ws?.isConnected()) return;
    this.ws.sendRaw({ type: WorldClientMsg.PARTY_LEAVE });
    this.currentParty = null;
    this.onPartyUpdateCb?.(null);
  }

  /** Kick a member (leader only). */
  kickMember(targetCharacterId: string): void {
    if (!this.ws?.isConnected()) return;
    this.ws.sendRaw({ type: WorldClientMsg.PARTY_KICK, targetId: targetCharacterId });
  }

  /** Transfer leadership. */
  transferLeadership(newLeaderCharacterId: string): void {
    if (!this.ws?.isConnected()) return;
    this.ws.sendRaw({ type: WorldClientMsg.PARTY_TRANSFER, newLeaderId: newLeaderCharacterId });
  }

  /** Set loot mode (leader only). */
  setLootMode(mode: LootMode): void {
    if (!this.ws?.isConnected()) return;
    this.ws.sendRaw({ type: WorldClientMsg.PARTY_SET_LOOT, mode });
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  getParty(): Party | null {
    return this.currentParty;
  }

  isLeader(): boolean {
    if (!this.currentParty || !this.ws) return false;
    return this.currentParty.leaderId === this.ws.characterId;
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

  private onPartyUpdateOnce(callback: (party: Party) => void): () => void {
    const prev = this.onPartyUpdateCb;
    this.onPartyUpdateCb = (party) => {
      this.onPartyUpdateCb = prev;
      if (party) callback(party);
    };
    return () => { this.onPartyUpdateCb = prev; };
  }

  private onPartyErrorOnce(callback: (code: string) => void): () => void {
    const prev = this.onPartyErrorCb;
    this.onPartyErrorCb = (code) => {
      this.onPartyErrorCb = prev;
      callback(code);
    };
    return () => { this.onPartyErrorCb = prev; };
  }
}
