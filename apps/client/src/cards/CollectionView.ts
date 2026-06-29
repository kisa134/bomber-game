/**
 * CollectionView.ts — BomberMeme CCG v2
 *
 * Full collection binder screen.  Displays all ~100 character cards
 * grouped by set, with owned/unowned visual distinction, filtering,
 * sorting, progress bars, and "Missing X" indicators per set.
 */

import {
  SetId,
  SETS,
  getSetCharacters,
  getSetProgress,
  getSetReward,
  CardInSet,
} from "./SetDefinitions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollectionCard {
  characterId: string;
  characterName: string;
  tier: string;
  setId: SetId;
  owned: boolean;
  ownedMoments: number;
  totalMoments: number;
  matchCount: number;
  isFoil: boolean;
  serial?: string;
}

type FilterMode = "all" | "owned" | "unowned" | "common" | "rare" | "epic" | "legendary" | "mythic";
type SortMode = "az" | "tier" | "recent" | "set";

const TIER_ORDER: Record<string, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
};

const TIER_COLORS: Record<string, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

// ---------------------------------------------------------------------------
// CollectionView class
// ---------------------------------------------------------------------------

export class CollectionView {
  private container: HTMLElement;
  private filter: FilterMode = "all";
  private sortBy: SortMode = "set";
  private selectedSet: SetId | "all" = "all";
  private searchQuery = "";
  private cards: CollectionCard[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Render the collection with the given card data. */
  render(cards: CollectionCard[]): void {
    this.cards = cards;
    this.container.innerHTML = this.buildHTML(cards);
    this.attachListeners();
  }

  /** Refresh only the card grid without re-rendering the chrome. */
  refresh(cards: CollectionCard[]): void {
    this.cards = cards;
    const grid = this.container.querySelector(".cv-grid") as HTMLElement | null;
    const stats = this.container.querySelector(".cv-stats-bar") as HTMLElement | null;
    if (grid) {
      grid.innerHTML = this.buildFilteredGrid(cards);
      this.attachCardListeners(grid);
    }
    if (stats) {
      const owned = cards.filter((c) => c.owned).length;
      stats.innerHTML = this.buildStatsHTML(owned, cards.length);
    }
  }

  // -----------------------------------------------------------------
  // HTML builders
  // -----------------------------------------------------------------

  private buildHTML(cards: CollectionCard[]): string {
    const owned = cards.filter((c) => c.owned).length;
    const total = cards.length;

    return (
      `<div class="collection-view">` +
      this.buildHeader(owned, total) +
      this.buildFilters() +
      `<div class="cv-stats-bar">${this.buildStatsHTML(owned, total)}</div>` +
      `<div class="cv-grid">${this.buildFilteredGrid(cards)}</div>` +
      `</div>`
    );
  }

  private buildHeader(owned: number, total: number): string {
    return (
      `<div class="cv-header">` +
      `<h2 class="cv-title">Collection</h2>` +
      `<div class="cv-counter">` +
      `<span class="cv-count-owned">${owned}</span>` +
      `<span class="cv-count-sep"> / </span>` +
      `<span class="cv-count-total">${total}</span>` +
      `<span class="cv-count-label"> cards</span></div></div>`
    );
  }

  private buildStatsHTML(owned: number, total: number): string {
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    return (
      `<div class="cv-progress-wrap">` +
      `<div class="cv-progress-bar">` +
      `<div class="cv-progress-fill" style="width:${pct}%"></div></div>` +
      `<span class="cv-progress-text">${pct}% complete</span></div>`
    );
  }

  private buildFilters(): string {
    const sets: Array<{ id: SetId | "all"; label: string }> = [
      { id: "all", label: "All Sets" },
      { id: "genesis", label: "Genesis" },
      { id: "crypto_degens", label: "Degens" },
      { id: "frog_dynasty", label: "Frogs" },
      { id: "meme_pantheon", label: "Pantheon" },
      { id: "election_chaos", label: "Election" },
      { id: "pump_circuit", label: "Pump" },
      { id: "animal_kingdom", label: "Animals" },
      { id: "crypto_twitter", label: "CT" },
      { id: "seasonal_drop", label: "Seasonal" },
    ];

    const filters: Array<{ id: FilterMode; label: string }> = [
      { id: "all", label: "All" },
      { id: "owned", label: "Owned" },
      { id: "unowned", label: "Missing" },
      { id: "legendary", label: "Legendary" },
      { id: "epic", label: "Epic" },
      { id: "rare", label: "Rare" },
      { id: "common", label: "Common" },
      { id: "mythic", label: "Mythic" },
    ];

    const sorts: Array<{ id: SortMode; label: string }> = [
      { id: "set", label: "By Set" },
      { id: "az", label: "A-Z" },
      { id: "tier", label: "Tier" },
      { id: "recent", label: "Recent" },
    ];

    return (
      `<div class="cv-filters">` +
      `<div class="cv-filter-row">` +
      `<div class="cv-set-tabs">` +
      sets.map((s) =>
        `<button class="cv-set-tab${s.id === this.selectedSet ? " active" : ""}" ` +
        `data-set="${s.id}">${s.label}</button>`
      ).join("") + `</div></div>` +
      `<div class="cv-filter-row cv-filter-row2">` +
      `<div class="cv-filter-group">` +
      filters.map((f) =>
        `<button class="cv-filter-btn${f.id === this.filter ? " active" : ""}" ` +
        `data-filter="${f.id}">${f.label}</button>`
      ).join("") + `</div>` +
      `<div class="cv-sort-group">` +
      sorts.map((s) =>
        `<button class="cv-sort-btn${s.id === this.sortBy ? " active" : ""}" ` +
        `data-sort="${s.id}">${s.label}</button>`
      ).join("") + `</div>` +
      `<input type="text" class="cv-search" placeholder="Search characters..." ` +
      `value="${this.esc(this.searchQuery)}"/>` +
      `</div></div>`
    );
  }

  private buildFilteredGrid(cards: CollectionCard[]): string {
    let filtered = this.applyFilter(cards);
    filtered = this.applySearch(filtered);
    filtered = this.applySort(filtered);

    if (this.sortBy === "set" && this.selectedSet === "all") {
      return this.buildSetGroupedGrid(filtered);
    }
    return this.buildFlatGrid(filtered);
  }

  private buildSetGroupedGrid(cards: CollectionCard[]): string {
    const setIds: Array<SetId | "all"> = [
      "genesis", "crypto_degens", "frog_dynasty", "meme_pantheon",
      "election_chaos", "pump_circuit", "animal_kingdom", "crypto_twitter", "seasonal_drop",
    ];

    return setIds
      .map((setId) => {
        const setCards = cards.filter((c) => c.setId === setId);
        if (setCards.length === 0) return "";
        return this.renderSetSection(setId as SetId, setCards);
      })
      .join("");
  }

  private renderSetSection(setId: SetId, cards: CollectionCard[]): string {
    const setDef = SETS[setId];
    const owned = cards.filter((c) => c.owned).length;
    const total = cards.length;
    const missing = total - owned;
    const pct = Math.round((owned / total) * 100);
    const reward = getSetReward(setId);
    const rewardIcon = reward.type === "back_skin" ? "\ud83c\udfa8" : reward.type === "emote" ? "\ud83c\udfad" : "\ud83c\udfc6";

    return (
      `<div class="cv-set-section" data-set-id="${setId}">` +
      `<div class="cv-set-header">` +
      `<div class="cv-set-info">` +
      `<span class="cv-set-name">${this.esc(setDef.name)}</span>` +
      `<span class="cv-set-count">${owned}/${total}</span>` +
      (missing === 1
        ? `<span class="cv-set-missing cv-set-missing-1">Missing 1!</span>`
        : missing > 0
        ? `<span class="cv-set-missing">Missing ${missing}</span>`
        : `<span class="cv-set-complete">${rewardIcon} Complete! ${this.esc(reward.name)}</span>`) +
      `</div>` +
      `<div class="cv-set-progress">` +
      `<div class="cv-set-bar">` +
      `<div class="cv-set-fill" style="width:${pct}%"></div></div>` +
      `<span class="cv-set-pct">${pct}%</span></div></div>` +
      `<div class="cv-set-grid">` +
      cards.map((c) => this.renderCardThumb(c)).join("") + `</div></div>`
    );
  }

  private renderCardThumb(card: CollectionCard): string {
    const tierColor = TIER_COLORS[card.tier.toLowerCase()] ?? "#9aa3b2";
    const tierOrder = TIER_ORDER[card.tier.toLowerCase()] ?? 0;

    if (!card.owned) {
      // Unowned = silhouette (brightness(0)) — same mechanic as hub deck mode
      return (
        `<div class="cv-card cv-card-unowned" data-id="${this.esc(card.characterId)}" ` +
        `title="${this.esc(card.characterName)} (${card.tier})" tabindex="0" role="button">` +
        `<div class="cv-card-art" style="filter:brightness(0);opacity:0.35;">` +
        `<div class="cv-card-placeholder"></div></div>` +
        `<div class="cv-card-info">` +
        `<span class="cv-card-name" style="color:rgba(255,255,255,0.25)">???</span>` +
        `<span class="cv-card-tier" style="color:rgba(255,255,255,0.15)">${card.tier.toUpperCase()}</span></div>` +
        `</div>`
      );
    }

    // Owned card
    const foilClass = card.isFoil ? " cv-card-foil" : "";
    const serialDisplay = card.serial
      ? `<span class="cv-card-serial">${card.serial}</span>`
      : "";

    return (
      `<div class="cv-card cv-card-owned${foilClass}" data-id="${this.esc(card.characterId)}" ` +
      `data-tier="${tierOrder}" title="${this.esc(card.characterName)}" ` +
      `tabindex="0" role="button" ` +
      `style="--card-tier-color:${tierColor};">` +
      `<div class="cv-card-art">` +
      `<div class="cv-card-shimmer"></div>` +
      `<div class="cv-card-placeholder" style="background:${this.tierGradient(card.tier)}"></div></div>` +
      `<div class="cv-card-info">` +
      `<span class="cv-card-name">${this.esc(card.characterName)}</span>` +
      `<span class="cv-card-tier" style="color:${tierColor}">${card.tier.toUpperCase()}</span></div>` +
      `${serialDisplay}` +
      (card.ownedMoments < card.totalMoments
        ? `<span class="cv-card-partial">${card.ownedMoments}/${card.totalMoments}</span>`
        : "") +
      `</div>`
    );
  }

  private buildFlatGrid(cards: CollectionCard[]): string {
    if (cards.length === 0) {
      return `<div class="cv-empty">No cards match your filters.</div>`;
    }
    return (
      `<div class="cv-set-grid cv-flat-grid">` +
      cards.map((c) => this.renderCardThumb(c)).join("") + `</div>`
    );
  }

  // -----------------------------------------------------------------
  // Filtering & sorting
  // -----------------------------------------------------------------

  private applyFilter(cards: CollectionCard[]): CollectionCard[] {
    let result = cards;

    // Set filter
    if (this.selectedSet !== "all") {
      result = result.filter((c) => c.setId === this.selectedSet);
    }

    // Tier/ownership filter
    switch (this.filter) {
      case "owned": result = result.filter((c) => c.owned); break;
      case "unowned": result = result.filter((c) => !c.owned); break;
      case "common": result = result.filter((c) => c.tier.toLowerCase() === "common"); break;
      case "rare": result = result.filter((c) => c.tier.toLowerCase() === "rare"); break;
      case "epic": result = result.filter((c) => c.tier.toLowerCase() === "epic"); break;
      case "legendary": result = result.filter((c) => c.tier.toLowerCase() === "legendary"); break;
      case "mythic": result = result.filter((c) => c.tier.toLowerCase() === "mythic"); break;
      case "all":
      default: break;
    }

    return result;
  }

  private applySearch(cards: CollectionCard[]): CollectionCard[] {
    if (!this.searchQuery.trim()) return cards;
    const q = this.searchQuery.toLowerCase();
    return cards.filter((c) =>
      c.characterName.toLowerCase().includes(q) ||
      c.setId.toLowerCase().includes(q) ||
      c.tier.toLowerCase().includes(q)
    );
  }

  private applySort(cards: CollectionCard[]): CollectionCard[] {
    const result = [...cards];
    switch (this.sortBy) {
      case "az":
        result.sort((a, b) => a.characterName.localeCompare(b.characterName));
        break;
      case "tier":
        result.sort((a, b) => {
          const ta = TIER_ORDER[a.tier.toLowerCase()] ?? 0;
          const tb = TIER_ORDER[b.tier.toLowerCase()] ?? 0;
          return tb - ta; // Highest tier first
        });
        break;
      case "recent":
        result.sort((a, b) => (b.matchCount - a.matchCount));
        break;
      case "set":
      default:
        result.sort((a, b) => {
          const sa = a.setId.localeCompare(b.setId);
          if (sa !== 0) return sa;
          return a.characterName.localeCompare(b.characterName);
        });
        break;
    }
    return result;
  }

  // -----------------------------------------------------------------
  // Event handling
  // -----------------------------------------------------------------

  private attachListeners(): void {
    this.container.querySelectorAll(".cv-set-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.selectedSet = (tab as HTMLElement).dataset.set as SetId | "all";
        this.refresh(this.cards);
      });
    });

    this.container.querySelectorAll(".cv-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.filter = (btn as HTMLElement).dataset.filter as FilterMode;
        this.refresh(this.cards);
      });
    });

    this.container.querySelectorAll(".cv-sort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.sortBy = (btn as HTMLElement).dataset.sort as SortMode;
        this.refresh(this.cards);
      });
    });

    const search = this.container.querySelector(".cv-search");
    search?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.refresh(this.cards);
    });

    const grid = this.container.querySelector(".cv-grid") as HTMLElement | null;
    if (grid) this.attachCardListeners(grid);
  }

  private attachCardListeners(grid: HTMLElement): void {
    grid.querySelectorAll(".cv-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = (card as HTMLElement).dataset.id;
        if (id) this.emit("cardClick", id);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const id = (card as HTMLElement).dataset.id;
          if (id) this.emit("cardClick", id);
        }
      });
    });
  }

  private listeners: Record<string, Array<(payload: unknown) => void>> = {};

  on(event: string, cb: (payload: unknown) => void): void {
    (this.listeners[event] ??= []).push(cb);
  }

  private emit(event: string, payload: unknown): void {
    (this.listeners[event] ?? []).forEach((cb) => cb(payload));
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  private esc(s: string): string {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  private tierGradient(tier: string): string {
    const colors: Record<string, string> = {
      common: "linear-gradient(135deg,#5a6370,#3a414d)",
      rare: "linear-gradient(135deg,#3a6ea5,#1a3a5a)",
      epic: "linear-gradient(135deg,#7a3ab0,#3a1a5a)",
      legendary: "linear-gradient(135deg,#c8a030,#7a6010)",
      mythic: "linear-gradient(135deg,#c03030,#601010)",
    };
    return colors[tier.toLowerCase()] ?? colors.common!;
  }
}

// ---------------------------------------------------------------------------
// CollectionView CSS (returned as string for injection)
// ---------------------------------------------------------------------------

export function getCollectionCSS(): string {
  return /* css */ `
.collection-view{padding:16px 20px;max-width:1200px;margin:0 auto}
.cv-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.cv-title{font-size:24px;font-weight:700;color:rgba(255,255,255,.9);margin:0}
.cv-counter{font-size:14px;color:rgba(255,255,255,.5)}
.cv-count-owned{font-size:24px;font-weight:700;color:#5fd96a}
.cv-count-sep{color:rgba(255,255,255,.3)}
.cv-count-total{font-size:24px;font-weight:700;color:rgba(255,255,255,.7)}
.cv-count-label{color:rgba(255,255,255,.4);margin-left:4px}
.cv-stats-bar{margin-bottom:16px}
.cv-progress-wrap{display:flex;align-items:center;gap:10px}
.cv-progress-bar{flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}
.cv-progress-fill{height:100%;background:linear-gradient(90deg,#5fd96a,#3da852);border-radius:3px;transition:width .5s ease}
.cv-progress-text{font-size:12px;color:rgba(255,255,255,.4);white-space:nowrap}
.cv-filters{margin-bottom:16px}
.cv-filter-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.cv-filter-row2{gap:8px}
.cv-set-tabs{display:flex;gap:4px;flex-wrap:wrap}
.cv-set-tab{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:6px 12px;font-size:12px;color:rgba(255,255,255,.5);cursor:pointer;transition:all .2s;white-space:nowrap}
.cv-set-tab:hover{background:rgba(255,255,255,.08);color:rgba(255,255,255,.7)}
.cv-set-tab.active{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.9);font-weight:600}
.cv-filter-group{display:flex;gap:4px;flex-wrap:wrap}
.cv-filter-btn{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:5px 10px;font-size:11px;color:rgba(255,255,255,.45);cursor:pointer;transition:all .2s}
.cv-filter-btn:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}
.cv-filter-btn.active{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.9);font-weight:600}
.cv-sort-group{display:flex;gap:4px}
.cv-sort-btn{background:transparent;border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:5px 10px;font-size:11px;color:rgba(255,255,255,.4);cursor:pointer;transition:all .2s}
.cv-sort-btn:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6)}
.cv-sort-btn.active{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:rgba(255,255,255,.8);font-weight:600}
.cv-search{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:6px 12px;font-size:12px;color:rgba(255,255,255,.7);width:180px;outline:none;transition:border-color .2s}
.cv-search:focus{border-color:rgba(255,255,255,.2)}
.cv-search::placeholder{color:rgba(255,255,255,.25)}
.cv-set-section{margin-bottom:24px}
.cv-set-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:0 4px}
.cv-set-info{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cv-set-name{font-size:15px;font-weight:700;color:rgba(255,255,255,.8)}
.cv-set-count{font-size:12px;color:rgba(255,255,255,.4)}
.cv-set-missing{font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(255,90,90,.12);color:#ff8a8a;font-weight:600}
.cv-set-missing-1{background:rgba(255,204,51,.15);color:#ffd966}
.cv-set-complete{font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(95,217,106,.15);color:#5fd96a;font-weight:600}
.cv-set-progress{display:flex;align-items:center;gap:8px}
.cv-set-bar{width:80px;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.cv-set-fill{height:100%;background:linear-gradient(90deg,#5fd96a,#3da852);border-radius:2px;transition:width .4s ease}
.cv-set-pct{font-size:11px;color:rgba(255,255,255,.35)}
.cv-set-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}
.cv-card{position:relative;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s;aspect-ratio:3/4;display:flex;flex-direction:column}
.cv-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.15);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.cv-card:focus{outline:2px solid rgba(255,255,255,.2);outline-offset:2px}
.cv-card-unowned{cursor:default;opacity:.6}
.cv-card-unowned:hover{transform:none;border-color:rgba(255,255,255,.06);box-shadow:none}
.cv-card-art{flex:1;position:relative;overflow:hidden;min-height:0}
.cv-card-placeholder{position:absolute;inset:4px;border-radius:8px;background-size:cover!important}
.cv-card-shimmer{position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.04) 50%,transparent 60%);background-size:200% 100%;animation:cvShimmer 3s infinite;pointer-events:none;z-index:1}
@keyframes cvShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.cv-card-foil .cv-card-shimmer{animation-duration:1.5s}
.cv-card-info{padding:6px 8px;display:flex;flex-direction:column;gap:1px;background:rgba(0,0,0,.3)}
.cv-card-name{font-size:11px;font-weight:600;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-card-tier{font-size:9px;letter-spacing:.5px}
.cv-card-serial{font-size:8px;color:rgba(255,255,255,.3);padding:0 8px;font-family:var(--font-mono,monospace)}
.cv-card-partial{position:absolute;top:6px;right:6px;font-size:9px;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,.5);color:rgba(255,255,255,.6);z-index:2}
.cv-empty{text-align:center;padding:40px;color:rgba(255,255,255,.3);font-size:14px}
@media(max-width:700px){.cv-set-grid{grid-template-columns:repeat(auto-fill,minmax(90px,1fr))}.cv-filter-row2{flex-direction:column;align-items:stretch}.cv-search{width:100%;box-sizing:border-box}}
`;
}
