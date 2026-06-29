export interface PartyMember {
  id: string;
  name: string;
  skinId: number;
  level: number;
  ready: boolean;
  isLeader: boolean;
}

export class PartyClient {
  private members: PartyMember[] = [];
  onMembersChange: ((members: PartyMember[]) => void) | null = null;

  createParty(): void {
    this.members = [];
    this.onMembersChange?.([]);
  }

  joinParty(_partyId: string): void {
    // Stub — will connect to party server
    this.members = [];
    this.onMembersChange?.([]);
  }

  leaveParty(): void {
    this.members = [];
    this.onMembersChange?.([]);
  }

  getMembers(): PartyMember[] {
    return this.members;
  }

  isInParty(): boolean {
    return this.members.length > 0;
  }
}
