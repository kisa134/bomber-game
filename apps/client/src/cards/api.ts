// cards/api.ts — the client↔server boundary for the card system.
// Phase 0 = localStorage stub (instance-based ownership). When Kimi's backend lands,
// these methods get swapped for real HTTP/tRPC calls (same signatures) — nothing else
// in the client changes. Owning a card = holding a CardInstance.

export interface CardInstance {
  instanceId: string;
  characterId: string;
  momentId: string;
  tier: string;
  setId: string;
  isFoil: boolean;
  isGoldFrame: boolean;
  matchCount: number;
  mintedAt: number;
  serial?: string;
}

const KEY = "bp_card_instances";

function load(): CardInstance[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as CardInstance[]; } catch { return []; }
}
function persist(list: CardInstance[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

let seq = 0;
function newId(): string {
  return `ci_${Date.now().toString(36)}_${(seq++).toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Local stub implementation of the cards API. Backend will replace these later. */
export const cardsApi = {
  /** All owned card instances (this browser, for now). */
  getInstances(): CardInstance[] { return load(); },

  /** Mint + grant new instances (e.g. from opening a pack). Returns the created ones. */
  grant(partials: Array<Omit<CardInstance, "instanceId" | "mintedAt">>): CardInstance[] {
    const all = load();
    const made = partials.map((p) => ({ ...p, instanceId: newId(), mintedAt: Date.now() }));
    all.push(...made);
    persist(all);
    return made;
  },

  /** Burn (remove) instances by id — used by Forge fusion. */
  burn(instanceIds: string[]): void {
    const drop = new Set(instanceIds);
    persist(load().filter((i) => !drop.has(i.instanceId)));
  },

  /** Bump matchCount on instances of a character (drives CardAging). */
  recordMatch(characterId: string): void {
    const all = load();
    for (const i of all) if (i.characterId === characterId) i.matchCount++;
    persist(all);
  },
};
