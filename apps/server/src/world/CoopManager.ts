// CoopManager.ts — party creation, joining, shared progress, loot modes (Issue #6)

import {
  type Party,
  type PartyMember,
  type SharedProgress,
  type LootMode,
} from "@bomberpump/shared";
import { randomBytes } from "node:crypto";

const PARTY_MAX_SIZE = 4;
const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/I/1 confusion

function generateCode(): string {
  let code = "";
  const bytes = randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

function blankProgress(): SharedProgress {
  return { zonesDiscovered: [], questsCompleted: [], bossesKilled: [], chestsOpened: [], totalKills: 0 };
}

/** Difficulty scale factor based on party size and average level. */
function computeDifficultyScale(members: PartyMember[]): number {
  const count = Math.max(1, members.length);
  const avgLevel = members.reduce((s, m) => s + m.level, 0) / count;
  // +25% HP/damage per extra player, +2% per level above 1
  return 1.0 + (count - 1) * 0.25 + Math.max(0, avgLevel - 1) * 0.02;
}

export class CoopManager {
  private parties = new Map<string, Party>(); // partyId -> Party
  private codeToParty = new Map<string, string>(); // code -> partyId
  private memberToParty = new Map<string, string>(); // characterId -> partyId

  /** Create a new party. Returns the Party with a 6-digit join code. */
  createParty(
    leaderId: string,
    leaderName: string,
    leaderLevel: number,
    leaderHeroId: string,
  ): Party {
    // Leave any existing party first
    this.leaveParty(leaderId);

    const code = generateCode();
    const party: Party = {
      id: crypto.randomUUID(),
      code,
      leaderId,
      members: [
        { characterId: leaderId, name: leaderName, level: leaderLevel, heroId: leaderHeroId, online: true },
      ],
      worldId: "grasslands",
      sharedProgress: blankProgress(),
      lootMode: "free",
      difficultyScale: 1.0,
    };
    party.difficultyScale = computeDifficultyScale(party.members);
    this.parties.set(party.id, party);
    this.codeToParty.set(code, party.id);
    this.memberToParty.set(leaderId, party.id);
    return party;
  }

  /** Join a party by its 6-digit code. */
  joinParty(
    code: string,
    characterId: string,
    name: string,
    level: number,
    heroId: string,
  ): { success: boolean; party?: Party; error?: string } {
    const partyId = this.codeToParty.get(code.toUpperCase());
    if (!partyId) return { success: false, error: "party_not_found" };

    const party = this.parties.get(partyId)!;
    if (party.members.length >= PARTY_MAX_SIZE) {
      return { success: false, error: "party_full" };
    }
    if (party.members.some((m) => m.characterId === characterId)) {
      return { success: false, error: "already_in_party" };
    }

    // Leave current party if in one
    this.leaveParty(characterId);

    party.members.push({ characterId, name, level, heroId, online: true });
    party.difficultyScale = computeDifficultyScale(party.members);
    this.memberToParty.set(characterId, party.id);
    return { success: true, party };
  }

  /** Leave a party. Dissolves the party if the leader leaves. */
  leaveParty(characterId: string): void {
    const partyId = this.memberToParty.get(characterId);
    if (!partyId) return;

    const party = this.parties.get(partyId);
    if (!party) {
      this.memberToParty.delete(characterId);
      return;
    }

    // Leader leaves => dissolve the whole party
    if (party.leaderId === characterId) {
      for (const m of party.members) {
        this.memberToParty.delete(m.characterId);
      }
      this.parties.delete(partyId);
      this.codeToParty.delete(party.code);
      return;
    }

    // Regular member leaves
    party.members = party.members.filter((m) => m.characterId !== characterId);
    party.difficultyScale = computeDifficultyScale(party.members);
    this.memberToParty.delete(characterId);

    // Auto-dissolve empty parties
    if (party.members.length === 0) {
      this.parties.delete(partyId);
      this.codeToParty.delete(party.code);
    }
  }

  /** Kick a member (leader only). */
  kickMember(leaderId: string, targetId: string): boolean {
    const party = this.getPartyByMember(leaderId);
    if (!party || party.leaderId !== leaderId) return false;
    if (!party.members.some((m) => m.characterId === targetId)) return false;
    this.leaveParty(targetId);
    return true;
  }

  /** Transfer leadership. */
  transferLeadership(leaderId: string, newLeaderId: string): boolean {
    const party = this.getPartyByMember(leaderId);
    if (!party || party.leaderId !== leaderId) return false;
    if (!party.members.some((m) => m.characterId === newLeaderId)) return false;
    party.leaderId = newLeaderId;
    return true;
  }

  /** Set loot mode (leader only). */
  setLootMode(leaderId: string, mode: LootMode): boolean {
    const party = this.getPartyByMember(leaderId);
    if (!party || party.leaderId !== leaderId) return false;
    party.lootMode = mode;
    return true;
  }

  /** Record shared progress (zone discovery, quest completion, boss kill). */
  recordProgress(partyId: string, update: Partial<SharedProgress>): void {
    const party = this.parties.get(partyId);
    if (!party) return;
    if (update.zonesDiscovered) {
      const set = new Set([...party.sharedProgress.zonesDiscovered, ...update.zonesDiscovered]);
      party.sharedProgress.zonesDiscovered = Array.from(set);
    }
    if (update.questsCompleted) {
      const set = new Set([...party.sharedProgress.questsCompleted, ...update.questsCompleted]);
      party.sharedProgress.questsCompleted = Array.from(set);
    }
    if (update.bossesKilled) {
      const set = new Set([...party.sharedProgress.bossesKilled, ...update.bossesKilled]);
      party.sharedProgress.bossesKilled = Array.from(set);
    }
    if (update.chestsOpened) {
      const set = new Set([...party.sharedProgress.chestsOpened, ...update.chestsOpened]);
      party.sharedProgress.chestsOpened = Array.from(set);
    }
    if (update.totalKills !== undefined) {
      party.sharedProgress.totalKills += update.totalKills;
    }
  }

  /** Get a party by its ID. */
  getParty(partyId: string): Party | undefined {
    return this.parties.get(partyId);
  }

  /** Get the party a character belongs to. */
  getPartyByMember(characterId: string): Party | undefined {
    const partyId = this.memberToParty.get(characterId);
    if (!partyId) return undefined;
    return this.parties.get(partyId);
  }

  /** Get the party a character belongs to by ID. */
  getPartyIdForMember(characterId: string): string | undefined {
    return this.memberToParty.get(characterId);
  }

  /** Set member online status. */
  setOnline(characterId: string, online: boolean): void {
    const party = this.getPartyByMember(characterId);
    if (!party) return;
    const m = party.members.find((x) => x.characterId === characterId);
    if (m) m.online = online;
  }

  /** List all active parties (for admin / debugging). */
  listParties(): Party[] {
    return Array.from(this.parties.values());
  }

  /** Clean up empty / stale parties. */
  gc(maxAgeMs: number = 300_000): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, party] of this.parties) {
      const allOffline = party.members.every((m) => !m.online);
      if (allOffline && party.members.length > 0) {
        // Tag for removal — in a real system we'd track lastActivity
        // For now, only remove truly empty parties
      }
      if (party.members.length === 0) {
        this.parties.delete(id);
        this.codeToParty.delete(party.code);
        removed++;
      }
    }
    return removed;
  }
}
