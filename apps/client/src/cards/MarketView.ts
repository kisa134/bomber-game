/**
 * BomberMeme CCG v2 — Market View
 *
 * Full market screen with 4 tabs:
 *   Primary     — featured drops, new releases, flash-sale countdowns
 *   Secondary   — P2P listings with tier/set/price filters + floor analytics
 *   My Listings — player's active/expired/sold listings + sell-card CTA
 *   History     — completed purchases & sales table
 *
 * Glass-morphism design language (matches existing .panel styles).
 * All rendering is DOM-based HTML-string composition — zero external deps.
 *
 * ESM (.js suffix imports) | TypeScript strict
 */

import {
  type MarketListing,
  type MarketSale,
  type FloorData,
  type MyListing,
  type FeaturedDrop,
  type MarketTab,
  type MarketFilters,
  type SortOption,
  type Tier,
  type SetId,
  MARKET_TABS,
  TIER_ORDER,
  TIER_LABEL,
  TIER_COLOR,
  SET_ORDER,
  SET_LABEL,
  SORT_LABEL,
  DEFAULT_FILTERS,
} from "./MarketTypes.js";

// ---------------------------------------------------------------------------
// Helper: create a DOM element with class + HTML content
// ---------------------------------------------------------------------------
function el(tag: string, cls: string, html: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

// ---------------------------------------------------------------------------
/** Price-display helpers */
// ---------------------------------------------------------------------------
const BM_PER_USD = 0.0709; // approximate BM token → USD rate

function fmtBM(n: number): string {
  return n.toLocaleString("en-US") + " BM";
}

function fmtUsd(n: number): string {
  const usd = n * BM_PER_USD;
  return "~ $" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(pct: number): { text: string; color: string; arrow: string } {
  const up = pct >= 0;
  return {
    text: (up ? "+" : "") + pct.toFixed(1) + "%",
    color: up ? "#5fe08a" : "#ff6b6b",
    arrow: up ? "▲" : "▼",
  };
}

function timeLeft(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// ---------------------------------------------------------------------------
/** Simplified card thumbnail HTML (CSS-only, no tilt, no animation). */
// ---------------------------------------------------------------------------
function cardThumbnailHTML(
  name: string,
  tier: Tier,
  momentId: string,
  size: "sm" | "md" = "sm",
): string {
  const tierColor = TIER_COLOR[tier];
  const w = size === "sm" ? 80 : 120;
  const h = Math.round(w * 1.41);
  return (
    `<div class="mkt-thumb" style="` +
    `width:${w}px;height:${h}px;` +
    `background:radial-gradient(ellipse at 30% 20%,${tierColor}44 0%,transparent 70%),linear-gradient(135deg,rgba(13,16,26,0.9),rgba(8,10,16,0.95));` +
    `border:1px solid ${tierColor}66;border-radius:10px;` +
    `display:flex;flex-direction:column;align-items:center;justify-content:center;` +
    `box-shadow:0 4px 12px rgba(0,0,0,0.4);position:relative;overflow:hidden;` +
    `">` +
    `<div style="font-size:${size === "sm" ? 24 : 36}px;opacity:0.9;">${characterEmoji(name)}</div>` +
    `<div style="font-size:9px;color:${tierColor};margin-top:4px;font-weight:700;letter-spacing:0.5px;">${name}</div>` +
    `<div style="font-size:7px;color:rgba(255,255,255,0.35);margin-top:1px;">${momentId}</div>` +
    `</div>`
  );
}

/** Emoji mapping for card thumbnails (fallback until sprites are ready). */
function characterEmoji(name: string): string {
  const map: Record<string, string> = {
    Pepe: "🐸",
    Trump: "🇺🇸",
    Doge: "🐕",
    Gigachad: "💪",
    Wojak: "😢",
    Elon: "🚀",
    Shiba: "🦊",
    Bogdanoff: "📈",
    Milady: "👩‍🎤",
    "Top G": "🥊",
    Satoshi: "₿",
    Brett: "🐸",
  };
  return map[name] || "🃏";
}

// ---------------------------------------------------------------------------
// Sparkline SVG renderer (mini 7-day price chart)
// ---------------------------------------------------------------------------
function renderSparkline(
  data: number[],
  color: string,
  width = 90,
  height = 30,
): string {
  if (data.length < 2) return "";
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = hi - lo || 1;
  const pad = 2;
  const px = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
  const py = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const area = `${d} L${px(data.length - 1).toFixed(1)} ${height} L${pad} ${height} Z`;
  return (
    `<svg class="mkt-spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">` +
    `<defs><linearGradient id="slg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="0.35"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>` +
    `<path d="${area}" fill="url(#slg)"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
/** Main Market View class */
// ---------------------------------------------------------------------------
export class MarketView {
  private container: HTMLElement;
  private activeTab: MarketTab = "primary";
  private filters: MarketFilters = { ...DEFAULT_FILTERS };

  // Data stores (populated via setters or mock data)
  private listings: MarketListing[] = [];
  private myListings: MyListing[] = [];
  private history: MarketSale[] = [];
  private floorData: FloorData[] = [];
  private featuredDrops: FeaturedDrop[] = [];
  private newReleases: FeaturedDrop[] = [];

  // Countdown timer handle
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  /** Callbacks — wire these up from main.ts */
  public onBuy: ((listingId: string) => void) | null = null;
  public onCancel: ((listingId: string) => void) | null = null;
  public onListCard: (() => void) | null = null;
  public onMintDrop: ((dropId: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  // -------------------------------------------------------------------------
  // Public data setters
  // -------------------------------------------------------------------------
  setListings(v: MarketListing[]) {
    this.listings = v;
    if (this.activeTab === "secondary") this.refresh();
  }
  setMyListings(v: MyListing[]) {
    this.myListings = v;
    if (this.activeTab === "my_listings") this.refresh();
  }
  setHistory(v: MarketSale[]) {
    this.history = v;
    if (this.activeTab === "history") this.refresh();
  }
  setFloorData(v: FloorData[]) {
    this.floorData = v;
    if (this.activeTab === "secondary") this.refresh();
  }
  setFeaturedDrops(v: FeaturedDrop[]) {
    this.featuredDrops = v;
    if (this.activeTab === "primary") this.refresh();
  }
  setNewReleases(v: FeaturedDrop[]) {
    this.newReleases = v;
    if (this.activeTab === "primary") this.refresh();
  }

  // -------------------------------------------------------------------------
  // Render the full market screen
  // -------------------------------------------------------------------------
  render(): void {
    this.cleanup();
    this.container.innerHTML = this.buildShell();
    this.setupTabListeners();
    this.setupFilterListeners();
    this.setupActionListeners();
    this.startCountdowns();
    this.refresh();
  }

  /** Full re-render of the active tab content only (preserves scroll). */
  private refresh(): void {
    const contentEl = this.container.querySelector(".mkt-tab-content") as HTMLElement | null;
    if (!contentEl) return;
    switch (this.activeTab) {
      case "primary":
        contentEl.innerHTML = this.renderPrimaryTab();
        break;
      case "secondary":
        contentEl.innerHTML = this.renderSecondaryTab();
        break;
      case "my_listings":
        contentEl.innerHTML = this.renderMyListingsTab();
        break;
      case "history":
        contentEl.innerHTML = this.renderHistoryTab();
        break;
    }
    this.setupActionListeners();
    this.startCountdowns();
  }

  // -------------------------------------------------------------------------
  // Shell: header + tabs + content area
  // -------------------------------------------------------------------------
  private buildShell(): string {
    const tabsHTML = MARKET_TABS.map(
      (t) =>
        `<button class="mkt-tab${t.id === this.activeTab ? " active" : ""}" data-tab="${t.id}">${t.label}</button>`,
    ).join("");

    return (
      `<div class="mkt-view">` +
      // Header
      `<div class="mkt-header">` +
      `<div class="mkt-title">🛒 Market</div>` +
      `<div class="mkt-balance" title="Your BM token balance">💎 12,450 BM</div>` +
      `</div>` +
      // Tabs
      `<div class="mkt-tabs">${tabsHTML}</div>` +
      // Filter bar (Secondary tab only — injected dynamically)
      `<div class="mkt-filter-bar" data-filter-bar></div>` +
      // Tab content
      `<div class="mkt-tab-content"></div>` +
      `</div>`
    );
  }

  // =========================================================================
  // TAB 1 — PRIMARY (Featured drops, new releases, flash sales)
  // =========================================================================
  private renderPrimaryTab(): string {
    const featuredHTML = this.featuredDrops.map((d) => this.renderFeaturedCard(d)).join("");
    const newHTML = this.newReleases.map((d) => this.renderNewReleaseCard(d)).join("");

    return (
      `<div class="mkt-primary">` +
      // Featured drops
      `<section class="mkt-section">` +
      `<h2 class="mkt-section-h">🔥 Featured Drops</h2>` +
      `<div class="mkt-featured-grid">${featuredHTML || "<div class='mkt-empty'>No featured drops right now</div>"}</div>` +
      `</section>` +
      // New releases
      `<section class="mkt-section">` +
      `<h2 class="mkt-section-h">🆕 New Releases</h2>` +
      `<div class="mkt-new-grid">${newHTML || "<div class='mkt-empty'>No new releases</div>"}</div>` +
      `</section>` +
      `</div>`
    );
  }

  private renderFeaturedCard(d: FeaturedDrop): string {
    const tierColor = TIER_COLOR[d.tier];
    const pctSold = Math.round(((d.supplyTotal - d.supplyRemaining) / d.supplyTotal) * 100);
    const hasDiscount = d.originalPrice && d.originalPrice > d.price;
    const discountPct = hasDiscount ? Math.round((1 - d.price / d.originalPrice!) * 100) : 0;

    return (
      `<div class="mkt-drop-card" style="--tier-color:${tierColor}">` +
      `<div class="mkt-drop-badge" style="background:${tierColor}">${TIER_LABEL[d.tier]}</div>` +
      `${hasDiscount ? `<div class="mkt-drop-discount">−${discountPct}%</div>` : ""}` +
      `<div class="mkt-drop-thumb">${cardThumbnailHTML(d.characterName, d.tier, "", "md")}</div>` +
      `<div class="mkt-drop-name">${d.characterName}</div>` +
      `<div class="mkt-drop-set">${SET_LABEL[d.setId]}</div>` +
      `<div class="mkt-drop-price-row">` +
      `<span class="mkt-drop-price">${fmtBM(d.price)}</span>` +
      `${hasDiscount ? `<span class="mkt-drop-original">${fmtBM(d.originalPrice!)}</span>` : ""}` +
      `</div>` +
      `<div class="mkt-drop-usd">${fmtUsd(d.price)}</div>` +
      `<div class="mkt-drop-supply">` +
      `<div class="mkt-drop-supply-bar"><div class="mkt-drop-supply-fill" style="width:${pctSold}%"></div></div>` +
      `<span class="mkt-drop-supply-text">${d.supplyRemaining}/${d.supplyTotal} left</span>` +
      `</div>` +
      `<div class="mkt-drop-timer" data-countdown="${d.endsAt.toISOString()}">⏱ ${timeLeft(d.endsAt)}</div>` +
      `<button class="mkt-btn mkt-btn-primary mkt-btn-buy" data-drop-id="${d.dropId}">Buy Now</button>` +
      `</div>`
    );
  }

  private renderNewReleaseCard(d: FeaturedDrop): string {
    const tierColor = TIER_COLOR[d.tier];
    return (
      `<div class="mkt-release-card" style="--tier-color:${tierColor}">` +
      `<div class="mkt-release-thumb">${cardThumbnailHTML(d.characterName, d.tier, "", "sm")}</div>` +
      `<div class="mkt-release-info">` +
      `<div class="mkt-release-name">${d.characterName} <span style="color:${tierColor}">●</span></div>` +
      `<div class="mkt-release-set">${SET_LABEL[d.setId]}</div>` +
      `<div class="mkt-release-price">${fmtBM(d.price)} <span class="mkt-release-usd">${fmtUsd(d.price)}</span></div>` +
      `</div>` +
      `<button class="mkt-btn mkt-btn-primary mkt-btn-sm" data-drop-id="${d.dropId}">Buy</button>` +
      `</div>`
    );
  }

  // =========================================================================
  // TAB 2 — SECONDARY (P2P listings with filters + floor badges)
  // =========================================================================
  private renderSecondaryTab(): string {
    // 1. Filter bar
    const filterBarHTML = this.renderFilterBar();
    const filterBarEl = this.container.querySelector("[data-filter-bar]") as HTMLElement | null;
    if (filterBarEl) filterBarEl.innerHTML = filterBarHTML;

    // 2. Floor analytics strip
    const floorHTML = this.renderFloorStrip();

    // 3. Filtered listings
    const filtered = this.applyFilters(this.listings);
    const listingsHTML = filtered.map((l) => this.renderListingCard(l)).join("");

    return (
      `<div class="mkt-secondary">` +
      floorHTML +
      `<div class="mkt-listings">` +
      (listingsHTML || `<div class="mkt-empty">No listings match your filters</div>`) +
      `</div>` +
      `</div>`
    );
  }

  // -------------------------------------------------------------------------
  // Filter bar HTML
  // -------------------------------------------------------------------------
  private renderFilterBar(): string {
    const tierOpts = `<option value="all">All Tiers</option>` +
      TIER_ORDER.map((t) => `<option value="${t}"${this.filters.tier === t ? " selected" : ""}>${TIER_LABEL[t]}</option>`).join("");
    const setOpts = `<option value="all">All Sets</option>` +
      SET_ORDER.map((s) => `<option value="${s}"${this.filters.setId === s ? " selected" : ""}>${SET_LABEL[s]}</option>`).join("");
    const sortOpts = Object.entries(SORT_LABEL).map(
      ([k, v]) => `<option value="${k}"${this.filters.sort === k ? " selected" : ""}>${v}</option>`,
    ).join("");

    return (
      `<div class="mkt-filters">` +
      `<select class="mkt-select" data-filter="tier">${tierOpts}</select>` +
      `<select class="mkt-select" data-filter="setId">${setOpts}</select>` +
      `<input class="mkt-input" type="number" placeholder="Min price" data-filter="priceMin" value="${this.filters.priceMin || ""}">` +
      `<input class="mkt-input" type="number" placeholder="Max price" data-filter="priceMax" value="${this.filters.priceMax === 1_000_000 ? "" : this.filters.priceMax}">` +
      `<input class="mkt-input mkt-input-search" type="text" placeholder="Search character..." data-filter="search" value="${this.filters.search}">` +
      `<select class="mkt-select" data-filter="sort">${sortOpts}</select>` +
      `<button class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-filter="reset">Reset</button>` +
      `</div>`
    );
  }

  private applyFilters(listings: MarketListing[]): MarketListing[] {
    let out = [...listings];
    if (this.filters.tier !== "all") out = out.filter((l) => l.tier === this.filters.tier);
    if (this.filters.setId !== "all") out = out.filter((l) => l.setId === this.filters.setId);
    out = out.filter((l) => l.price >= this.filters.priceMin && l.price <= this.filters.priceMax);
    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      out = out.filter((l) => l.characterName.toLowerCase().includes(q));
    }
    // Sort
    switch (this.filters.sort) {
      case "price_asc":
        out.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        out.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        out.sort((a, b) => b.listedAt.getTime() - a.listedAt.getTime());
        break;
      case "oldest":
        out.sort((a, b) => a.listedAt.getTime() - b.listedAt.getTime());
        break;
      case "tier_desc":
        out.sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
        break;
      case "tier_asc":
        out.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
        break;
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Floor-price analytics strip
  // -------------------------------------------------------------------------
  private renderFloorStrip(): string {
    if (!this.floorData.length) return "";
    const items = this.floorData.map((f) => {
      const ch = fmtChange(f.change24h);
      const tierColor = TIER_COLOR[f.tier];
      return (
        `<div class="mkt-floor-item" title="${f.characterName} floor analytics">` +
        `<div class="mkt-floor-name">${f.characterName} <span style="color:${tierColor}">●</span></div>` +
        `<div class="mkt-floor-spark">${renderSparkline(f.sparkline, ch.color)}</div>` +
        `<div class="mkt-floor-price">${fmtBM(f.floorPrice)}</div>` +
        `<div class="mkt-floor-change" style="color:${ch.color}">${ch.arrow} ${ch.text}</div>` +
        `<div class="mkt-floor-meta">Vol: ${(f.volume24h / 1e6).toFixed(1)}M · Holders: ${f.uniqueHolders}</div>` +
        `</div>`
      );
    }).join("");

    return `<div class="mkt-floor-strip">${items}</div>`;
  }

  // -------------------------------------------------------------------------
  // Individual listing card
  // -------------------------------------------------------------------------
  private renderListingCard(l: MarketListing): string {
    const tierColor = TIER_COLOR[l.tier];
    // Find floor data for this card template
    const floor = this.floorData.find((f) => f.cardTemplateId === l.cardTemplateId);
    const ch = floor ? fmtChange(floor.change24h) : null;

    return (
      `<div class="mkt-listing" style="--tier-color:${tierColor}">` +
      // Left: card thumbnail
      `<div class="mkt-listing-thumb">${cardThumbnailHTML(l.characterName, l.tier, l.momentId, "sm")}</div>` +
      // Middle: info
      `<div class="mkt-listing-info">` +
      `<div class="mkt-listing-top">` +
      `<span class="mkt-listing-name">${l.characterName}</span>` +
      `<span class="mkt-listing-tier" style="background:${tierColor}22;color:${tierColor}">${TIER_LABEL[l.tier]}</span>` +
      `</div>` +
      `<div class="mkt-listing-moment">${l.momentId} · ${SET_LABEL[l.setId]}</div>` +
      `<div class="mkt-listing-meta">` +
      `<span class="mkt-listing-seller" title="${l.sellerFull || l.seller}">Seller: ${l.seller}</span>` +
      `${l.serial ? `<span class="mkt-listing-serial">${l.serial}</span>` : ""}` +
      `</div>` +
      `</div>` +
      // Right: price + actions
      `<div class="mkt-listing-actions">` +
      `<div class="mkt-listing-price-col">` +
      `<div class="mkt-listing-price">${fmtBM(l.price)}</div>` +
      `<div class="mkt-listing-usd">${fmtUsd(l.price)}</div>` +
      `${ch ? `<div class="mkt-listing-change" style="color:${ch.color}">${ch.arrow} ${ch.text}</div>` : ""}` +
      `${floor ? `<div class="mkt-listing-floor">Floor: ${fmtBM(floor.floorPrice)}</div>` : ""}` +
      `</div>` +
      `<button class="mkt-btn mkt-btn-primary" data-buy-id="${l.listingId}">Buy</button>` +
      `</div>` +
      `</div>`
    );
  }

  // =========================================================================
  // TAB 3 — MY LISTINGS
  // =========================================================================
  private renderMyListingsTab(): string {
    const active = this.myListings.filter((l) => l.status === "active");
    const expired = this.myListings.filter((l) => l.status === "expired");
    const sold = this.myListings.filter((l) => l.status === "sold");

    const renderGroup = (label: string, items: MyListing[], statusColor: string) => {
      if (!items.length) return "";
      return (
        `<section class="mkt-my-group">` +
        `<h3 class="mkt-my-group-h" style="color:${statusColor}">${label} (${items.length})</h3>` +
        items.map((l) => this.renderMyListingCard(l)).join("") +
        `</section>`
      );
    };

    return (
      `<div class="mkt-my">` +
      // Sell Card CTA
      `<div class="mkt-sell-cta">` +
      `<span>Have cards to sell?</span>` +
      `<button class="mkt-btn mkt-btn-primary" data-action="sell-card">+ Sell Card</button>` +
      `</div>` +
      // Groups
      renderGroup("Active", active, "#5fe08a") +
      renderGroup("Expired", expired, "#ffb347") +
      renderGroup("Sold", sold, "#6ecfff") +
      // Empty state
      `${!this.myListings.length ? "<div class='mkt-empty'>You have no listings yet. Click <b>+ Sell Card</b> to get started.</div>" : ""}` +
      `</div>`
    );
  }

  private renderMyListingCard(l: MyListing): string {
    const tierColor = TIER_COLOR[l.tier];
    const statusLabel = l.status.charAt(0).toUpperCase() + l.status.slice(1);
    const isActive = l.status === "active";

    return (
      `<div class="mkt-my-card" style="--tier-color:${tierColor}">` +
      `<div class="mkt-my-thumb">${cardThumbnailHTML(l.characterName, l.tier, l.momentId, "sm")}</div>` +
      `<div class="mkt-my-info">` +
      `<div class="mkt-my-top">` +
      `<span class="mkt-my-name">${l.characterName}</span>` +
      `<span class="mkt-my-tier" style="background:${tierColor}22;color:${tierColor}">${TIER_LABEL[l.tier]}</span>` +
      `<span class="mkt-my-status mkt-my-status--${l.status}">${statusLabel}</span>` +
      `</div>` +
      `<div class="mkt-my-moment">${l.momentId}</div>` +
      `<div class="mkt-my-price">${fmtBM(l.price)} <span class="mkt-my-usd">${fmtUsd(l.price)}</span></div>` +
      `<div class="mkt-my-date">Listed: ${l.listedAt.toLocaleDateString()}</div>` +
      `</div>` +
      `<div class="mkt-my-actions">` +
      `${isActive ? `<button class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-cancel-id="${l.listingId}">Cancel</button>` : ""}` +
      `</div>` +
      `</div>`
    );
  }

  // =========================================================================
  // TAB 4 — HISTORY (completed sales table)
  // =========================================================================
  private renderHistoryTab(): string {
    if (!this.history.length) {
      return `<div class="mkt-empty">No trade history yet.</div>`;
    }

    const rows = this.history.map((s) => this.renderHistoryRow(s)).join("");

    return (
      `<div class="mkt-history">` +
      `<table class="mkt-history-table">` +
      `<thead>` +
      `<tr>` +
      `<th>Card</th><th>Tier</th><th>Price</th><th>Type</th><th>Counterparty</th><th>Date</th>` +
      `</tr>` +
      `</thead>` +
      `<tbody>${rows}</tbody>` +
      `</table>` +
      `</div>`
    );
  }

  private renderHistoryRow(s: MarketSale): string {
    const tierColor = TIER_COLOR[s.tier];
    const isBuy = s.buyer === "You";
    const typeLabel = isBuy ? "Buy" : "Sell";
    const typeColor = isBuy ? "#5fe08a" : "#ff6b6b";
    const counterparty = isBuy ? s.seller : s.buyer;

    return (
      `<tr class="mkt-history-row">` +
      `<td class="mkt-history-card">` +
      `<span class="mkt-history-dot" style="background:${tierColor}"></span>` +
      `${s.characterName} <span class="mkt-history-moment">${s.momentId}</span>` +
      `</td>` +
      `<td><span class="mkt-history-tier" style="color:${tierColor}">${TIER_LABEL[s.tier]}</span></td>` +
      `<td class="mkt-history-price">${fmtBM(s.price)} <span class="mkt-history-usd">${fmtUsd(s.price)}</span></td>` +
      `<td><span class="mkt-history-type" style="color:${typeColor}">${typeLabel}</span></td>` +
      `<td class="mkt-history-party" title="${counterparty}">${counterparty}</td>` +
      `<td class="mkt-history-date">${s.soldAt.toLocaleDateString()}</td>` +
      `</tr>`
    );
  }

  // =========================================================================
  // Event listeners
  // =========================================================================
  private setupTabListeners(): void {
    const bar = this.container.querySelector(".mkt-tabs");
    if (!bar) return;
    bar.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-tab]") as HTMLElement | null;
      if (!btn) return;
      const tab = btn.dataset.tab as MarketTab;
      this.switchTab(tab);
    });
  }

  private switchTab(tab: MarketTab): void {
    this.activeTab = tab;
    // Update tab buttons
    this.container.querySelectorAll(".mkt-tab").forEach((b) => {
      b.classList.toggle("active", (b as HTMLElement).dataset.tab === tab);
    });
    // Clear filter bar (only secondary uses it)
    const filterBarEl = this.container.querySelector("[data-filter-bar]") as HTMLElement | null;
    if (filterBarEl) filterBarEl.innerHTML = "";
    this.refresh();
  }

  private setupFilterListeners(): void {
    this.container.addEventListener("change", (e) => {
      const el = e.target as HTMLElement;
      const key = el.dataset.filter;
      if (!key || key === "reset") return;
      if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
        (this.filters as Record<string, unknown>)[key] =
          key.startsWith("price") ? Number(el.value) || 0 : el.value;
        if (key === "search") this.debouncedRefresh();
        else this.refresh();
      }
    });

    this.container.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-filter=\"reset\"]") as HTMLElement | null;
      if (!btn) return;
      this.filters = { ...DEFAULT_FILTERS };
      this.refresh();
    });
  }

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  private debouncedRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), 250);
  }

  private setupActionListeners(): void {
    this.container.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;

      // Buy button
      const buyBtn = t.closest("[data-buy-id]") as HTMLElement | null;
      if (buyBtn) {
        const id = buyBtn.dataset.buyId!;
        this.onBuy?.(id);
        return;
      }

      // Mint / buy drop button
      const dropBtn = t.closest("[data-drop-id]") as HTMLElement | null;
      if (dropBtn) {
        const id = dropBtn.dataset.dropId!;
        this.onMintDrop?.(id);
        return;
      }

      // Cancel listing
      const cancelBtn = t.closest("[data-cancel-id]") as HTMLElement | null;
      if (cancelBtn) {
        const id = cancelBtn.dataset.cancelId!;
        this.onCancel?.(id);
        return;
      }

      // Sell card CTA
      const sellBtn = t.closest("[data-action=\"sell-card\"]") as HTMLElement | null;
      if (sellBtn) {
        this.onListCard?.();
        return;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Countdown timer for flash sales / drops
  // -------------------------------------------------------------------------
  private startCountdowns(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.container.querySelectorAll<HTMLElement>("[data-countdown]").forEach((el) => {
        const iso = el.dataset.countdown;
        if (!iso) return;
        el.textContent = "⏱ " + timeLeft(new Date(iso));
      });
    }, 30_000); // update every 30s (good enough for minute-level precision)
  }

  // -------------------------------------------------------------------------
  // Cleanup before re-render / dispose
  // -------------------------------------------------------------------------
  private cleanup(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  dispose(): void {
    this.cleanup();
    this.container.innerHTML = "";
  }
}
