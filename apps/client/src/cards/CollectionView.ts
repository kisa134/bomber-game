// ============================================================================
// BomberMeme CCG v2 — Collection Binder View
// ============================================================================
// Full-screen collection browser with set grouping, progress tracking,
// filtering, sorting, and simplified card thumbnails.
//
// IMPORT PATTERN:  import { CollectionView, buildCollection, injectCollectionStyles } from "../cards/CollectionView.js";
//
// Architecture:
//   - Simplified thumbnails: ~8 core layers (no tilt, no animation)
//   - Owned cards: full color + reduced holo shimmer
//   - Unowned cards: black silhouette via brightness(0) — PRESERVES existing mechanic
//   - Click card -> dispatches "card:inspect" CustomEvent with characterId detail
//   - Glass-morphism UI with .panel styling
// ============================================================================

import {
  SETS,
  ALL_CHARACTERS,
  TOTAL_CARDS,
  getCharacterSet,
  tierRank,
  tierColor,
  formatSerial,
} from "./SetDefinitions.js";
import type { SetId, Tier, CardInSet } from "./SetDefinitions.js";

// Re-use the existing tier/rarity system from main.ts
// These match the RARITY_TIERS and EXT_RARITY arrays in the main codebase
const SKIN_NAMES: string[] = [
  "Shiba", "Pepe", "Trump", "Musk", "Doge", "Pump", "Durov", "Vitalik",
  "Troll", "Bogdanoff", "Gigachad", "Nyan", "Grumpy", "Harambe", "Shrek",
  "Fine Dog", "Wojak", "NPC", "Chad", "Doomer", "Bloomer", "Stonks",
  "Satoshi", "SBF", "CZ", "Laser Eyes", "WAGMI", "Diamond", "Rich Pepe",
  "Bonk", "WIF", "Popcat", "Titan", "Salt Bae", "Harold", "Paper Hands",
  "Moonboy", "Brett", "Andy", "GOAT", "Pnut", "Moodeng", "MEW", "Ponke",
  "Sigma", "Boomer", "Zoomer", "Chemist", "Galaxy Brain", "Cry Jordan",
  "Disaster", "Leeroy", "MLG", "Keanu", "Rick", "Crewmate", "Grogu",
  "Voxel", "Skibidi", "Ohio", "Rizzler", "Zuck", "Bezos", "Gates", "Jobs",
  "Success", "Bad Luck", "Drake", "Distracted", "Two Buttons", "Philosoraptor",
  "Y U NO", "Good Guy Greg", "Smudge", "Fwog", "Woman Yelling", "Math Lady",
  "Scumbag", "Blinking Guy", "Overly GF", "Based Ape", "Michi", "Dank Pepe",
  "Whale", "Degen", "Anon", "Normie", "Banana", "Copium", "Hopium",
  "Ape In", "FUD", "Jeet", "Shiller", "Maxi", "Rugger", "Mooner",
  "Bag Hodler", "FrenPet", "KEK",
];

// Map character IDs to skin indices (best-effort name matching)
function skinIndexForCharacter(characterId: string): number {
  const char = ALL_CHARACTERS.find((c) => c.characterId === characterId);
  if (!char) return 0;
  const idx = SKIN_NAMES.findIndex(
    (name) => name.toLowerCase() === char.characterName.toLowerCase(),
  );
  return idx >= 0 ? idx : Math.abs(hashString(characterId)) % SKIN_NAMES.length;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Skin-to-tier mapping (matches main.ts tierRank + rarityOf logic)
function skinTier(skin: number): { name: string; color: string; rank: number } {
  if (skin < 4) return { name: "Common", color: "#9aa3b2", rank: 0 };
  if (skin < 6) return { name: "Rare", color: "#4aa3ff", rank: 1 };
  if (skin < 8) return { name: "Epic", color: "#c879ff", rank: 2 };
  if (skin < 10) return { name: "Legendary", color: "#ffcc33", rank: 3 };
  if (skin === 10) return { name: "Mythic", color: "#ff5a5a", rank: 4 };
  const EXT_RARITY = [
    3, 2, 3, 4, 1, 0, 0, 1, 2, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 1, 3, 2, 3, 0,
    2, 1, 0, 3, 1, 2, 4, 1, 3, 2, 1, 1, 4, 2, 0, 3, 1, 2, 3, 0, 4, 1, 2, 3, 4,
    1, 2, 0, 3, 2, 1, 4, 2, 3, 1, 4, 0, 2, 1, 3, 3, 1, 2, 0, 1, 3, 2, 4, 4, 2,
    1, 0, 1, 2, 3, 1, 1, 2, 3, 1, 0, 3, 2, 1, 4,
  ];
  const t = EXT_RARITY[skin - 11] ?? 4;
  const tiers = [
    { name: "Common", color: "#9aa3b2", rank: 0 },
    { name: "Rare", color: "#4aa3ff", rank: 1 },
    { name: "Epic", color: "#c879ff", rank: 2 },
    { name: "Legendary", color: "#ffcc33", rank: 3 },
    { name: "Mythic", color: "#ff5a5a", rank: 4 },
  ];
  return tiers[t] ?? tiers[4];
}

function cardHue(skin: number): string {
  const CARD_HUE = [
    "#d98a3a", "#3fbf5a", "#e0533a", "#3a8ad9", "#e0a52a", "#2fcf6a",
    "#3a6ad9", "#8a5cff", "#8a90a8", "#c99a3a", "#ff4a5a",
  ];
  return CARD_HUE[skin] ?? "#9aa3b2";
}

// Asset versioning — matches main.ts ASSET_VER usage
const ASSET_VER = (typeof window !== "undefined" && (window as any).__ASSET_VER__) || "1";

// ============================================================================
// Collection Card Data Interface
// ============================================================================

export interface CollectionCard {
  characterId: string;
  characterName: string;
  tier: Tier;
  setId: SetId;
  owned: boolean;
  ownedMoments: number;
  totalMoments: number;
  matchCount: number;
  isFoil: boolean;
  serial?: string;
  skinIndex: number; // mapped sprite index
}

// ============================================================================
// Simplified Card Thumbnail HTML — ~8 core layers (no tilt, no animation)
// ============================================================================

/**
 * Generate a simplified card thumbnail for the collection grid.
 * Uses only the essential visual layers from the full fighterCardHTML:
 *   1. Base art gradient (.fc-art)
 *   2. Hero sprite (.fc-hero)
 *   3. Reduced holo finish (.fc-holo)
 *   4. Frame border (.fc-frame)
 *   5. Tier badge (.fc-badge)
 *   6. Character name (.fc-name)
 *   7. Reduced stars (.fc-stars)
 *   8. Lock overlay for unowned (.fc-lock)
 *
 * Unowned cards get the "unowned" class -> filter: brightness(0) for silhouette.
 * This PRESERVES the existing silhouette mechanic from the main card system.
 */
function cardThumbnailHTML(
  skin: number,
  opts: {
    characterName: string;
    tierName: string;
    tierColor: string;
    tierRank: number;
    owned: boolean;
    isFoil: boolean;
    serial?: string;
  },
): string {
  const hue = cardHue(skin);
  const finishClass =
    opts.tierRank <= 1
      ? "silver"
      : opts.tierRank === 2
        ? "gold"
        : opts.tierRank === 3
          ? "holo"
          : "prismatic";

  // Thumbnail-only classes: no tilt, no animation, reduced effects
  const thumbClasses = [
    "coll-card-thumb",
    `finish-${finishClass}`,
    opts.owned ? "owned" : "unowned",
    opts.isFoil ? "foil" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const padNo = (n: number): string => String(n).padStart(3, "0");
  const gems = "◆".repeat(Math.min(6, 2 + opts.tierRank));

  return (
    `<div class="${thumbClasses}" data-skin="${skin}" style="--tier:${opts.tierColor};--holo:${0.08 + opts.tierRank * 0.04};">` +
    `<div class="fc-art" style="background:radial-gradient(125% 92% at 50% 26%, ${hue}59, transparent 62%), radial-gradient(90% 70% at 50% 88%, ${hue}33, transparent 70%)"></div>` +
    `<div class="fc-holo"></div>` +
    `<img class="fc-hero" src="/sprites/skin_${skin}_down_1.webp?v=${ASSET_VER}" alt="${opts.characterName}" loading="lazy" />` +
    `<div class="fc-frame"></div>` +
    `<div class="fc-badge" style="--badge:${opts.tierColor};">${opts.tierName[0]}</div>` +
    `<div class="fc-namerow"><div class="fc-name">${opts.characterName}</div><div class="fc-gems">${gems}</div></div>` +
    starDotsHTML(opts.tierRank) +
    (opts.owned
      ? `<div class="fc-owned-mark">✓</div>`
      : `<div class="fc-lock">🔒</div>`) +
    (opts.serial ? `<div class="fc-serial">${opts.serial}</div>` : "") +
    `</div>`
  );
}

/** Minimal star dots — appear on rare+ cards, fewer than the full version. */
function starDotsHTML(tierRank: number): string {
  if (tierRank < 1) return "";
  const n = 2 + tierRank * 2; // rare=4, mythic=10
  let out = '<div class="fc-stars">';
  for (let j = 0; j < n; j++) {
    const left = (8 + ((j * 37) % 84)).toFixed(1);
    const top = (6 + ((j * 53) % 88)).toFixed(1);
    const del = ((j * 0.7) % 3).toFixed(2);
    const dur = (2 + ((j * 0.3) % 2)).toFixed(2);
    out += `<i class="fc-star" style="left:${left}%;top:${top}%;--d:${del}s;--dur:${dur}s;--sc:#fff"></i>`;
  }
  return out + "</div>";
}

// ============================================================================
// Collection View — Main Class
// ============================================================================

type FilterTier = "all" | Tier;
type SortMode = "az" | "tier" | "recent" | "set";
type FilterOwned = "all" | "owned" | "unowned";

export class CollectionView {
  private container: HTMLElement;
  private filterTier: FilterTier = "all";
  private filterOwned: FilterOwned = "all";
  private sortBy: SortMode = "az";
  private selectedSet: SetId | "all" = "all";
  private searchQuery = "";
  private cards: CollectionCard[] = [];
  private scrollPos = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add("collection-view");
    this.container.setAttribute("role", "region");
    this.container.setAttribute("aria-label", "Card Collection");
  }

  /** Populate the collection with card data and render. */
  render(cards: CollectionCard[]): void {
    this.cards = cards;
    this.buildUI();
    this.refreshGrid();
  }

  /** Update collection data without full rebuild (preserves scroll). */
  updateCards(cards: CollectionCard[]): void {
    this.cards = cards;
    this.refreshGrid();
  }

  /** Return current filter state for external use. */
  getFilterState(): {
    tier: FilterTier;
    owned: FilterOwned;
    sort: SortMode;
    set: SetId | "all";
    search: string;
  } {
    return {
      tier: this.filterTier,
      owned: this.filterOwned,
      sort: this.sortBy,
      set: this.selectedSet,
      search: this.searchQuery,
    };
  }

  // --------------------------------------------------------------------------
  // Private: UI Building
  // --------------------------------------------------------------------------

  private buildUI(): void {
    // Header: title + counter
    const ownedCount = this.cards.filter((c) => c.owned).length;
    const totalCount = TOTAL_CARDS;

    this.container.innerHTML =
      // Header
      `<div class="coll-header">` +
      `<div class="coll-title-row">` +
      `<h2 class="coll-title">MY COLLECTION</h2>` +
      `<span class="coll-counter">${ownedCount} / ${totalCount} cards</span>` +
      `</div>` +
      // Filter bar
      `<div class="coll-filter-bar">` +
      // Tier filters
      `<div class="coll-tier-filters">` +
      this.tierFilterBtn("all", "All", "") +
      this.tierFilterBtn("common", "Common", "#9aa3b2") +
      this.tierFilterBtn("rare", "Rare", "#4aa3ff") +
      this.tierFilterBtn("epic", "Epic", "#c879ff") +
      this.tierFilterBtn("legendary", "Legendary", "#ffcc33") +
      this.tierFilterBtn("mythic", "Mythic", "#ff5a5a") +
      `</div>` +
      // Set dropdown
      `<select class="coll-set-select glass-select" aria-label="Filter by set">` +
      `<option value="all">All Sets</option>` +
      (Object.values(SETS) as CardSet[])
        .map((s) => `<option value="${s.id}">${s.name}</option>`)
        .join("") +
      `</select>` +
      // Owned filter
      `<div class="coll-owned-filters">` +
      this.ownedFilterBtn("all", "All") +
      this.ownedFilterBtn("owned", "Owned") +
      this.ownedFilterBtn("unowned", "Missing") +
      `</div>` +
      // Sort
      `<select class="coll-sort-select glass-select" aria-label="Sort cards">` +
      `<option value="az">A → Z</option>` +
      `<option value="tier">Rarity</option>` +
      `<option value="recent">Recently Acquired</option>` +
      `<option value="set">Set</option>` +
      `</select>` +
      // Search
      `<input type="search" class="coll-search glass-input" placeholder="Search cards..." aria-label="Search cards" />` +
      `</div>` +
      // Progress summary
      `<div class="coll-progress-summary">` +
      this.renderOverallProgress() +
      `</div>` +
      `</div>` +
      // Set sections container
      `<div class="coll-sets-container"></div>`;

    // Wire events
    this.wireFilterEvents();
  }

  private tierFilterBtn(value: string, label: string, color: string): string {
    const active = this.filterTier === value ? "active" : "";
    const style = color ? `style="--tier:${color}"` : "";
    return `<button class="coll-tier-btn ${active}" data-tier="${value}" ${style}>${label}</button>`;
  }

  private ownedFilterBtn(value: string, label: string): string {
    const active = this.filterOwned === value ? "active" : "";
    return `<button class="coll-owned-btn ${active}" data-owned="${value}">${label}</button>`;
  }

  private wireFilterEvents(): void {
    // Tier filters
    this.container.querySelectorAll(".coll-tier-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.filterTier = (e.currentTarget as HTMLElement).dataset
          .tier as FilterTier;
        this.refreshGrid();
        this.updateFilterButtons();
      });
    });

    // Set select
    const setSelect = this.container.querySelector(
      ".coll-set-select",
    ) as HTMLSelectElement;
    if (setSelect) {
      setSelect.addEventListener("change", () => {
        this.selectedSet = setSelect.value as SetId | "all";
        this.refreshGrid();
      });
    }

    // Owned filters
    this.container.querySelectorAll(".coll-owned-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.filterOwned = (e.currentTarget as HTMLElement).dataset
          .owned as FilterOwned;
        this.refreshGrid();
        this.updateFilterButtons();
      });
    });

    // Sort
    const sortSelect = this.container.querySelector(
      ".coll-sort-select",
    ) as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        this.sortBy = sortSelect.value as SortMode;
        this.refreshGrid();
      });
    }

    // Search
    const searchInput = this.container.querySelector(
      ".coll-search",
    ) as HTMLInputElement;
    if (searchInput) {
      let debounce: ReturnType<typeof setTimeout>;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.searchQuery = searchInput.value.trim().toLowerCase();
          this.refreshGrid();
        }, 200);
      });
    }
  }

  private updateFilterButtons(): void {
    this.container.querySelectorAll(".coll-tier-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        (btn as HTMLElement).dataset.tier === this.filterTier,
      );
    });
    this.container.querySelectorAll(".coll-owned-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        (btn as HTMLElement).dataset.owned === this.filterOwned,
      );
    });
  }

  // --------------------------------------------------------------------------
  // Private: Filtering & Sorting
  // --------------------------------------------------------------------------

  private getFilteredAndSorted(): CollectionCard[] {
    let result = [...this.cards];

    // Tier filter
    if (this.filterTier !== "all") {
      result = result.filter((c) => c.tier === this.filterTier);
    }

    // Set filter
    if (this.selectedSet !== "all") {
      result = result.filter((c) => c.setId === this.selectedSet);
    }

    // Owned filter
    if (this.filterOwned === "owned") {
      result = result.filter((c) => c.owned);
    } else if (this.filterOwned === "unowned") {
      result = result.filter((c) => !c.owned);
    }

    // Search
    if (this.searchQuery) {
      result = result.filter(
        (c) =>
          c.characterName.toLowerCase().includes(this.searchQuery) ||
          c.setId.toLowerCase().includes(this.searchQuery),
      );
    }

    // Sort
    switch (this.sortBy) {
      case "az":
        result.sort((a, b) => a.characterName.localeCompare(b.characterName));
        break;
      case "tier":
        result.sort(
          (a, b) =>
            tierRank(b.tier) - tierRank(a.tier) ||
            a.characterName.localeCompare(b.characterName),
        );
        break;
      case "recent":
        result.sort(
          (a, b) =>
            (b.owned ? 1 : 0) - (a.owned ? 1 : 0) ||
            a.characterName.localeCompare(b.characterName),
        );
        break;
      case "set":
        result.sort(
          (a, b) =>
            a.setId.localeCompare(b.setId) ||
            a.characterName.localeCompare(b.characterName),
        );
        break;
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Private: Rendering
  // --------------------------------------------------------------------------

  private refreshGrid(): void {
    const container = this.container.querySelector(
      ".coll-sets-container",
    ) as HTMLElement;
    if (!container) return;

    const filtered = this.getFilteredAndSorted();

    // Group by set when sorting by set or "all" with no tier filter
    const groupBySet =
      this.sortBy === "set" ||
      (this.selectedSet === "all" && this.filterTier === "all");

    if (groupBySet) {
      container.innerHTML = this.renderGroupedBySet(filtered);
    } else {
      container.innerHTML = this.renderFlatGrid(filtered);
    }

    // Update counter
    const counter = this.container.querySelector(".coll-counter");
    if (counter) {
      const owned = this.cards.filter((c) => c.owned).length;
      counter.textContent = `${owned} / ${TOTAL_CARDS} cards`;
    }

    // Update progress summary
    const progressEl = this.container.querySelector(
      ".coll-progress-summary",
    );
    if (progressEl) {
      progressEl.innerHTML = this.renderOverallProgress();
    }

    // Wire card click events
    container.querySelectorAll(".coll-card-thumb").forEach((el) => {
      el.addEventListener("click", (e) => {
        const cardEl = (e.currentTarget as HTMLElement).closest(
          ".coll-card-wrap",
        ) as HTMLElement;
        if (cardEl) {
          const characterId = cardEl.dataset.characterId;
          if (characterId) this.onCardClick(characterId);
        }
      });
    });

    // Restore scroll position on re-render
    container.scrollTop = this.scrollPos;
    container.addEventListener("scroll", () => {
      this.scrollPos = container.scrollTop;
    });
  }

  /** Group cards by set with section headers and progress bars. */
  private renderGroupedBySet(cards: CollectionCard[]): string {
    const setIds = this.selectedSet === "all"
      ? (Object.keys(SETS) as SetId[])
      : [this.selectedSet];

    return setIds.map((setId) => this.renderSetSection(setId, cards)).join("");
  }

  private renderSetSection(setId: SetId, allCards: CollectionCard[]): string {
    const set = SETS[setId];
    if (!set) return "";

    const setCards = allCards.filter((c) => c.setId === setId);
    if (setCards.length === 0) return "";

    const totalInSet = set.totalCards;
    const ownedInSet = this.cards.filter(
      (c) => c.setId === setId && c.owned,
    ).length;
    const missing = totalInSet - ownedInSet;

    return (
      `<div class="coll-set-section" data-set="${setId}">` +
      // Set header
      `<div class="coll-set-header">` +
      `<div class="coll-set-info">` +
      `<h3 class="coll-set-name">${set.name}</h3>` +
      `<span class="coll-set-count">${ownedInSet} / ${totalInSet}</span>` +
      `</div>` +
      this.renderProgressBar(ownedInSet, totalInSet) +
      (missing > 0
        ? `<span class="coll-missing-badge">Missing ${missing}</span>`
        : `<span class="coll-complete-badge">✓ Complete</span>`) +
      (missing === 0
        ? `<div class="coll-reward">Reward: ${set.reward.name}</div>`
        : `<div class="coll-reward dim">Reward: ${set.reward.name}</div>`) +
      `</div>` +
      // Card grid
      `<div class="coll-card-grid">` +
      setCards.map((c) => this.renderCardThumb(c)).join("") +
      `</div>` +
      `</div>`
    );
  }

  private renderFlatGrid(cards: CollectionCard[]): string {
    if (cards.length === 0) {
      return `<div class="coll-empty-state">No cards match your filters.</div>`;
    }
    return (
      `<div class="coll-card-grid flat">` +
      cards.map((c) => this.renderCardThumb(c)).join("") +
      `</div>`
    );
  }

  private renderCardThumb(card: CollectionCard): string {
    const tInfo = skinTier(card.skinIndex);
    const serial = card.serial || formatSerial(card.skinIndex + 1, TOTAL_CARDS);

    return (
      `<div class="coll-card-wrap" data-character-id="${card.characterId}" data-set="${card.setId}" data-tier="${card.tier}">` +
      cardThumbnailHTML(card.skinIndex, {
        characterName: card.characterName,
        tierName: tInfo.name,
        tierColor: tInfo.color,
        tierRank: tInfo.rank,
        owned: card.owned,
        isFoil: card.isFoil,
        serial: card.owned ? serial : undefined,
      }) +
      `<div class="coll-card-meta">` +
      `<span class="coll-meta-name">${card.characterName}</span>` +
      `<span class="coll-meta-tier" style="color:${tInfo.color}">${tInfo.name}</span>` +
      `</div>` +
      `</div>`
    );
  }

  private renderProgressBar(owned: number, total: number): string {
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    const color =
      pct >= 100 ? "#5fe08a" : pct >= 75 ? "#4aa3ff" : pct >= 50 ? "#c879ff" : pct >= 25 ? "#ffcc33" : "#ff5a5a";
    return (
      `<div class="coll-progress-bar" aria-label="${owned} of ${total} cards collected">` +
      `<div class="coll-progress-fill" style="width:${pct}%;background:${color};"></div>` +
      `</div>`
    );
  }

  private renderOverallProgress(): string {
    const owned = this.cards.filter((c) => c.owned).length;
    const total = TOTAL_CARDS;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

    // Per-set mini progress
    const setProgress = (Object.values(SETS) as CardSet[])
      .map((set) => {
        const setOwned = this.cards.filter(
          (c) => c.setId === set.id && c.owned,
        ).length;
        const setPct = Math.round((setOwned / set.totalCards) * 100);
        return (
          `<div class="coll-mini-set">` +
          `<span class="coll-mini-name">${set.name}</span>` +
          `<div class="coll-mini-bar"><div class="coll-mini-fill" style="width:${setPct}%"></div></div>` +
          `<span class="coll-mini-pct">${setPct}%</span>` +
          `</div>`
        );
      })
      .join("");

    return (
      `<div class="coll-overall-progress">` +
      `<div class="coll-overall-bar">` +
      `<div class="coll-overall-fill" style="width:${pct}%"></div>` +
      `</div>` +
      `<span class="coll-overall-label">${pct}% Complete (${owned}/${total})</span>` +
      `</div>` +
      `<div class="coll-set-progress-grid">${setProgress}</div>`
    );
  }

  // --------------------------------------------------------------------------
  // Private: Interactions
  // --------------------------------------------------------------------------

  private onCardClick(characterId: string): void {
    // Dispatch event for InspectView to handle
    this.container.dispatchEvent(
      new CustomEvent("card:inspect", {
        detail: { characterId },
        bubbles: true,
      }),
    );
  }

  private onFilterChange(filter: string): void {
    this.container.dispatchEvent(
      new CustomEvent("collection:filter", {
        detail: { filter },
        bubbles: true,
      }),
    );
  }

  private onSortChange(sort: string): void {
    this.container.dispatchEvent(
      new CustomEvent("collection:sort", {
        detail: { sort },
        bubbles: true,
      }),
    );
  }

  private getMissingText(owned: number, total: number): string {
    const missing = total - owned;
    if (missing <= 0) return "Set complete! Reward unlocked.";
    if (missing === 1) return "Missing 1 card — almost there!";
    return `Missing ${missing} cards`;
  }
}

// ============================================================================
// Factory: Build CollectionCard[] from owned character IDs
// ============================================================================

/**
 * Convert a list of owned character IDs into a full CollectionCard array.
 * All characters from all sets are included; unowned ones have owned=false.
 *
 * @param ownedIds — Set of character IDs the player owns
 * @param ownedMomentsMap — Map of characterId -> number of moments owned
 * @param matchCountMap — Map of characterId -> matches played with this card
 * @param foilSet — Set of character IDs that are foil versions
 */
export function buildCollection(
  ownedIds: Set<string>,
  ownedMomentsMap: Map<string, number> = new Map(),
  matchCountMap: Map<string, number> = new Map(),
  foilSet: Set<string> = new Set(),
): CollectionCard[] {
  return ALL_CHARACTERS.map((char) => {
    const setId = getCharacterSet(char.characterId) ?? "genesis";
    const owned = ownedIds.has(char.characterId);
    const ownedMoments = ownedMomentsMap.get(char.characterId) ?? 0;
    const matchCount = matchCountMap.get(char.characterId) ?? 0;
    const isFoil = foilSet.has(char.characterId);

    return {
      characterId: char.characterId,
      characterName: char.characterName,
      tier: char.tier,
      setId,
      owned,
      ownedMoments: owned ? Math.max(1, ownedMoments) : 0,
      totalMoments: char.moments.length,
      matchCount,
      isFoil,
      skinIndex: skinIndexForCharacter(char.characterId),
    };
  });
}

// ============================================================================
// CSS Injection — Collection-specific styles
// ============================================================================

/** Inject collection CSS into the document head. Call once at app init. */
export function injectCollectionStyles(): void {
  if (document.getElementById("collection-styles")) return;
  const style = document.createElement("style");
  style.id = "collection-styles";
  style.textContent = COLLECTION_CSS;
  document.head.appendChild(style);
}

const COLLECTION_CSS = `
/* ==========================================================================
   Collection View — Glass-morphism card collection browser
   ========================================================================== */

.collection-view {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 16px 20px 40px;
  background: rgba(8, 10, 16, 0.6);
  backdrop-filter: blur(12px) saturate(1.2);
}

/* Header */
.coll-header {
  margin-bottom: 20px;
}

.coll-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.coll-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #e8ecf1;
  margin: 0;
  text-transform: uppercase;
}

.coll-counter {
  font-size: 14px;
  font-weight: 600;
  color: #7fd8ff;
  background: rgba(0, 0, 0, 0.35);
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid rgba(127, 216, 255, 0.2);
}

/* Filter bar */
.coll-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: rgba(13, 16, 26, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  backdrop-filter: blur(16px);
}

.coll-tier-filters,
.coll-owned-filters {
  display: flex;
  gap: 4px;
}

.coll-tier-btn,
.coll-owned-btn {
  padding: 5px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #9aa3b2;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.coll-tier-btn:hover,
.coll-owned-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8ecf1;
}

.coll-tier-btn.active,
.coll-owned-btn.active {
  background: var(--tier, rgba(127, 216, 255, 0.25));
  color: #fff;
  border-color: var(--tier, rgba(127, 216, 255, 0.4));
  box-shadow: 0 0 10px var(--tier, rgba(127, 216, 255, 0.15));
}

.glass-select,
.glass-input {
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(13, 16, 26, 0.6);
  color: #e8ecf1;
  font-size: 13px;
  outline: none;
  transition: border-color 0.18s ease;
}

.glass-select:focus,
.glass-input:focus {
  border-color: rgba(127, 216, 255, 0.4);
}

.coll-search {
  width: 160px;
  min-width: 120px;
}

/* Progress summary */
.coll-progress-summary {
  padding: 12px 14px;
  background: rgba(13, 16, 26, 0.45);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.coll-overall-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.coll-overall-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.coll-overall-fill {
  height: 100%;
  background: linear-gradient(90deg, #4aa3ff, #c879ff, #ffcc33);
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.coll-overall-label {
  font-size: 12px;
  font-weight: 600;
  color: #9aa3b2;
  white-space: nowrap;
}

.coll-set-progress-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 6px 12px;
}

.coll-mini-set {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.coll-mini-name {
  color: #9aa3b2;
  width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coll-mini-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.coll-mini-fill {
  height: 100%;
  background: #4aa3ff;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.coll-mini-pct {
  color: #7fd8ff;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

/* Set sections */
.coll-sets-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.coll-set-section {
  background: rgba(13, 16, 26, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 16px 18px;
  backdrop-filter: blur(10px);
}

.coll-set-header {
  margin-bottom: 14px;
}

.coll-set-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.coll-set-name {
  font-size: 16px;
  font-weight: 700;
  color: #e8ecf1;
  margin: 0;
  letter-spacing: 0.5px;
}

.coll-set-count {
  font-size: 13px;
  color: #9aa3b2;
  font-weight: 600;
}

.coll-progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.coll-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.coll-missing-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 8px;
  background: rgba(255, 90, 90, 0.15);
  color: #ff5a5a;
  font-size: 11px;
  font-weight: 700;
  margin-right: 8px;
}

.coll-complete-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 8px;
  background: rgba(95, 224, 138, 0.15);
  color: #5fe08a;
  font-size: 11px;
  font-weight: 700;
  margin-right: 8px;
}

.coll-reward {
  font-size: 11px;
  color: #c879ff;
  margin-top: 4px;
  font-weight: 600;
}

.coll-reward.dim {
  color: #5a5f6b;
}

/* Card grid */
.coll-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 14px;
}

.coll-card-grid.flat {
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
}

/* Card wrapper */
.coll-card-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.coll-card-wrap:hover {
  transform: translateY(-4px) scale(1.02);
}

.coll-card-wrap:hover .coll-card-thumb {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px var(--tier, rgba(127, 216, 255, 0.2));
}

/* Simplified card thumbnail — ~8 core layers */
.coll-card-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 236 / 332;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(145deg, #1a1d2a, #0d0f18);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  transition: box-shadow 0.25s ease, transform 0.2s ease;
}

/* === Core layers (simplified from fighterCardHTML) === */

.coll-card-thumb .fc-art {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.coll-card-thumb .fc-holo {
  position: absolute;
  inset: 0;
  z-index: 2;
  opacity: var(--holo, 0.12);
  background:
    repeating-linear-gradient(
      105deg,
      transparent 0%,
      rgba(255, 255, 255, 0.03) 2%,
      transparent 4%
    );
  mix-blend-mode: overlay;
  pointer-events: none;
}

.coll-card-thumb .fc-hero {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 3;
  image-rendering: pixelated;
  padding: 12% 8% 20%;
}

.coll-card-thumb .fc-frame {
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 7px;
  z-index: 4;
  pointer-events: none;
}

.coll-card-thumb .fc-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--badge, #9aa3b2);
  color: #000;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: 0 0 6px var(--badge, #9aa3b2);
}

.coll-card-thumb .fc-namerow {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 6px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.coll-card-thumb .fc-name {
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}

.coll-card-thumb .fc-gems {
  font-size: 7px;
  color: rgba(255, 255, 255, 0.5);
}

/* Stars — reduced from full version */
.coll-card-thumb .fc-stars {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}

.coll-card-thumb .fc-star {
  position: absolute;
  width: 3px;
  height: 3px;
  background: var(--sc, #fff);
  border-radius: 50%;
  animation: fc-star-twinkle var(--dur, 2s) ease-in-out var(--d, 0s) infinite alternate;
  opacity: 0.6;
}

@keyframes fc-star-twinkle {
  0% { opacity: 0.3; transform: scale(0.8); }
  100% { opacity: 0.9; transform: scale(1.2); }
}

/* Lock overlay for unowned */
.coll-card-thumb .fc-lock {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  z-index: 6;
  opacity: 0.85;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

/* Owned checkmark */
.coll-card-thumb .fc-owned-mark {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(95, 224, 138, 0.85);
  color: #000;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
}

/* Serial number */
.coll-card-thumb .fc-serial {
  position: absolute;
  top: 5px;
  left: 5px;
  font-size: 6px;
  font-family: var(--font-mono, monospace);
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  z-index: 6;
}

/* ===== UNOWNED SILHOUETTE — PRESERVES EXISTING MECHANIC ===== */
.coll-card-thumb.unowned .fc-hero {
  filter: brightness(0);
}

.coll-card-thumb.unowned .fc-art {
  filter: grayscale(0.6) brightness(0.4);
}

.coll-card-thumb.unowned .fc-holo {
  opacity: 0;
}

.coll-card-thumb.unowned .fc-stars {
  display: none;
}

.coll-card-thumb.unowned .fc-namerow {
  opacity: 0.3;
}

/* Foil variant shimmer */
.coll-card-thumb.foil::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 7;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255, 255, 255, 0.06) 45%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.06) 55%,
    transparent 60%
  );
  background-size: 250% 250%;
  animation: foil-sweep 5s ease-in-out infinite;
  pointer-events: none;
  mix-blend-mode: overlay;
}

@keyframes foil-sweep {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* Card meta below thumbnail */
.coll-card-meta {
  margin-top: 6px;
  text-align: center;
  width: 100%;
}

.coll-meta-name {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #e8ecf1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coll-meta-tier {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Empty state */
.coll-empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 20px;
  color: #5a5f6b;
  font-size: 14px;
}

/* Scrollbar styling */
.collection-view::-webkit-scrollbar {
  width: 6px;
}
.collection-view::-webkit-scrollbar-track {
  background: transparent;
}
.collection-view::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.collection-view::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Responsive */
@media (max-width: 600px) {
  .coll-card-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 10px;
  }
  .coll-filter-bar {
    padding: 8px;
  }
  .coll-search {
    width: 100%;
    order: -1;
  }
  .coll-set-progress-grid {
    grid-template-columns: 1fr;
  }
}
`;
