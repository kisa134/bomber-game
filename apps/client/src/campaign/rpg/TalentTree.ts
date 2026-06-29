export interface Talent {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  requires?: string[];
}

export interface TalentNode {
  talent: Talent;
  rank: number;
}

export const TALENTS: Talent[] = [
  { id: "bomb_dmg", name: "Bomb Mastery", description: "+5% bomb damage per rank", maxRank: 5 },
  { id: "move_speed", name: "Swift Feet", description: "+3% move speed per rank", maxRank: 5 },
  { id: "max_hp", name: "Toughness", description: "+10 max HP per rank", maxRank: 5 },
  { id: "max_mana", name: "Mana Pool", description: "+10 max mana per rank", maxRank: 5 },
  { id: "skill_cdr", name: "Quick Recovery", description: "-3% skill cooldown per rank", maxRank: 5 },
];

export class TalentTree {
  private nodes = new Map<string, TalentNode>();

  constructor() {
    for (const t of TALENTS) {
      this.nodes.set(t.id, { talent: t, rank: 0 });
    }
  }

  getRank(talentId: string): number {
    return this.nodes.get(talentId)?.rank ?? 0;
  }

  canRankUp(talentId: string, availablePoints: number): boolean {
    const node = this.nodes.get(talentId);
    if (!node || availablePoints <= 0) return false;
    if (node.rank >= node.talent.maxRank) return false;
    if (node.talent.requires) {
      for (const req of node.talent.requires) {
        if (this.getRank(req) === 0) return false;
      }
    }
    return true;
  }

  rankUp(talentId: string): boolean {
    const node = this.nodes.get(talentId);
    if (!node || node.rank >= node.talent.maxRank) return false;
    node.rank++;
    return true;
  }

  getAllNodes(): TalentNode[] {
    return Array.from(this.nodes.values());
  }

  reset(): void {
    for (const node of this.nodes.values()) {
      node.rank = 0;
    }
  }

  serialize(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, node] of this.nodes) {
      out[id] = node.rank;
    }
    return out;
  }

  load(data: Record<string, number>): void {
    for (const [id, rank] of Object.entries(data)) {
      const node = this.nodes.get(id);
      if (node) node.rank = Math.min(rank, node.talent.maxRank);
    }
  }
}
