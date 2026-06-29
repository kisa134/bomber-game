/**
 * MarketView.ts — BomberMeme CCG v2
 *
 * 4-tab marketplace UI:
 *   Primary   — featured drops, new releases, flash sales
 *   Secondary — P2P listings with filters, floor badges, sparklines
 *   My Listings — cards you're selling + sell button
 *   History   — your buy/sell transaction log
 */

import {
  type MarketListing,
  type MarketSale,
  type FloorData,
  type MyListing,
  type FeaturedDrop,
  type NewRelease,
  type FlashSale,
  type MarketTab,
  type Tier,
} from "./MarketTypes.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<Tier, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

const TIER_ORDER: Record<Tier, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
};

// ---------------------------------------------------------------------------
// MarketView class
// ---------------------------------------------------------------------------

export class MarketView {
  private container: HTMLElement;
  private activeTab: MarketTab = "primary";
  private listings: MarketListing[] = [];
  private myListings: MyListing[] = [];
  private history: MarketSale[] = [];
  private floorData: FloorData[] = [];
  private featuredDrops: FeaturedDrop[] = [];
  private newReleases: NewRelease[] = [];
  private flashSales: FlashSale[] = [];
  private tierFilter: Tier | "all" = "all";
  private sortMode: "price_asc" | "price_desc" | "recent" = "recent";

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Render the full market view. */
  render(): void {
    this.container.innerHTML = this.buildHTML();
    this.attachListeners();
  }

  /** Update data and re-render the active tab. */
  setData(opts: {
    listings?: MarketListing[];
    myListings?: MyListing[];
    history?: MarketSale[];
    floorData?: FloorData[];
    featuredDrops?: FeaturedDrop[];
    newReleases?: NewRelease[];
    flashSales?: FlashSale[];
  }): void {
    if (opts.listings) this.listings = opts.listings;
    if (opts.myListings) this.myListings = opts.myListings;
    if (opts.history) this.history = opts.history;
    if (opts.floorData) this.floorData = opts.floorData;
    if (opts.featuredDrops) this.featuredDrops = opts.featuredDrops;
    if (opts.newReleases) this.newReleases = opts.newReleases;
    if (opts.flashSales) this.flashSales = opts.flashSales;
    this.render();
  }

  // -----------------------------------------------------------------
  // HTML builders
  // -----------------------------------------------------------------

  private buildHTML(): string {
    return (
      `<div class="market-view">` +
      `<div class="market-tabs">` +
      this.renderTabButton("primary", "Primary") +
      this.renderTabButton("secondary", "Secondary") +
      this.renderTabButton("my_listings", "My Listings") +
      this.renderTabButton("history", "History") +
      `</div>` +
      `<div class="market-body">${this.renderActiveTab()}</div>` +
      `</div>`
    );
  }

  private renderTabButton(tab: MarketTab, label: string): string {
    const active = tab === this.activeTab ? " active" : "";
    return (
      `<button class="market-tab${active}" data-tab="${tab}">${label}</button>`
    );
  }

  private renderActiveTab(): string {
    switch (this.activeTab) {
      case "primary": return this.renderPrimaryTab();
      case "secondary": return this.renderSecondaryTab();
      case "my_listings": return this.renderMyListingsTab();
      case "history": return this.renderHistoryTab();
      default: return "";
    }
  }

  // ---- Primary Tab ----

  private renderPrimaryTab(): string {
    const drops = this.featuredDrops.length
      ? this.renderFeaturedDrops()
      : `<div class="market-empty">No featured drops right now.</div>`;

    const releases = this.newReleases.length
      ? this.renderNewReleases()
      : "";

    const flash = this.flashSales.length
      ? this.renderFlashSales()
      : "";

    return (
      `<div class="market-tab-content market-primary">` +
      `<div class="market-section"><div class="market-section-title">Featured Drops</div>${drops}</div>` +
      (releases ? `<div class="market-section"><div class="market-section-title">New Releases</div>${releases}</div>` : "") +
      (flash ? `<div class="market-section"><div class="market-section-title">Flash Sales</div>${flash}</div>` : "") +
      `</div>`
    );
  }

  private renderFeaturedDrops(): string {
    return (
      `<div class="market-drops-grid">` +
      this.featuredDrops.map((d) => {
        const tierColor = TIER_COLORS[d.tier];
        const discounted = Math.round(d.price * (1 - d.discount / 100));
        return (
          `<div class="market-drop-card" data-drop="${d.dropId}">` +
          `<div class="market-drop-img" style="background:linear-gradient(135deg,${tierColor}33,${tierColor}11)">` +
          `<span class="market-drop-tier" style="color:${tierColor}">${d.tier.toUpperCase()}</span>` +
          `</div>` +
          `<div class="market-drop-info">` +
          `<div class="market-drop-name">${this.esc(d.name)}</div>` +
          `<div class="market-drop-desc">${this.esc(d.description)}</div>` +
          `<div class="market-drop-price-row">` +
          `<span class="market-drop-price">${discounted.toLocaleString()} BM</span>` +
          `<span class="market-drop-original">${d.price.toLocaleString()}</span>` +
          `<span class="market-drop-discount">-${d.discount}%</span></div>` +
          `<button class="market-buy-btn" data-drop="${d.dropId}">Buy Now</button>` +
          `</div></div>`
        );
      }).join("") + `</div>`
    );
  }

  private renderNewReleases(): string {
    return (
      `<div class="market-releases-row">` +
      this.newReleases.map((r) => {
        const tierColor = TIER_COLORS[r.tier];
        return (
          `<div class="market-release-card" data-release="${r.releaseId}">` +
          `<div class="market-release-img" style="background:linear-gradient(135deg,${tierColor}22,${tierColor}08)">` +
          `<span class="market-release-tier" style="color:${tierColor}">${r.tier.toUpperCase()}</span>` +
          `</div>` +
          `<div class="market-release-name">${this.esc(r.characterName)}</div>` +
          `<div class="market-release-price">${r.price.toLocaleString()} BM</div>` +
          `<button class="market-buy-btn small" data-release="${r.releaseId}">Buy</button>` +
          `</div>`
        );
      }).join("") + `</div>`
    );
  }

  private renderFlashSales(): string {
    return (
      `<div class="market-flash-grid">` +
      this.flashSales.map((s) => {
        const tierColor = TIER_COLORS[s.tier];
        const timeLeft = this.timeLeft(s.endsAt);
        return (
          `<div class="market-flash-card" data-sale="${s.saleId}">` +
          `<div class="market-flash-img" style="background:linear-gradient(135deg,${tierColor}33,${tierColor}11)">` +
          `<span class="market-flash-badge">FLASH</span>` +
          `</div>` +
          `<div class="market-flash-info">` +
          `<div class="market-flash-name">${this.esc(s.name)}</div>` +
          `<div class="market-flash-timer">${timeLeft}</div>` +
          `<div class="market-flash-price-row">` +
          `<span class="market-flash-price">${s.salePrice.toLocaleString()} BM</span>` +
          `<span class="market-flash-original">${s.originalPrice.toLocaleString()}</span></div>` +
          `<button class="market-buy-btn" data-sale="${s.saleId}">Buy Now</button>` +
          `</div></div>`
        );
      }).join("") + `</div>`
    );
  }

  // ---- Secondary Tab ----

  private renderSecondaryTab(): string {
    let filtered = this.listings.filter((l) => l.status === "active");
    if (this.tierFilter !== "all") {
      filtered = filtered.filter((l) => l.tier === this.tierFilter);
    }
    filtered = this.sortListings(filtered);

    return (
      `<div class="market-tab-content market-secondary">` +
      this.renderSecondaryFilters() +
      (filtered.length
        ? `<div class="market-listings-grid">` +
          filtered.map((l) => this.renderListingCard(l)).join("") + `</div>`
        : `<div class="market-empty">No active listings.</div>`) +
      `</div>`
    );
  }

  private renderSecondaryFilters(): string {
    const tiers: Array<Tier | "all"> = ["all", "legendary", "epic", "rare", "common", "mythic"];
    return (
      `<div class="market-sec-filters">` +
      `<div class="market-tier-filters">` +
      tiers.map((t) =>
        `<button class="market-tier-btn${t === this.tierFilter ? " active" : ""}" ` +
        `data-tier="${t}">${t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}</button>`
      ).join("") + `</div>` +
      `<select class="market-sort-select" data-sort>` +
      `<option value="recent" ${this.sortMode === "recent" ? "selected" : ""}>Recent</option>` +
      `<option value="price_asc" ${this.sortMode === "price_asc" ? "selected" : ""}>Price: Low</option>` +
      `<option value="price_desc" ${this.sortMode === "price_desc" ? "selected" : ""}>Price: High</option>` +
      `</select></div>`
    );
  }

  private renderListingCard(listing: MarketListing): string {
    const tierColor = TIER_COLORS[listing.tier];
    const floor = this.floorData.find((f) => f.cardTemplateId === listing.cardTemplateId);
    const change = floor?.change24h ?? 0;
    const changeCls = change >= 0 ? "up" : "down";
    const changeSign = change >= 0 ? "+" : "";
    return (
      `<div class="market-listing" data-listing="${listing.listingId}">` +
      `<div class="market-listing-img" style="background:linear-gradient(135deg,${tierColor}28,${tierColor}0a)">` +
      `<span class="market-listing-tier" style="color:${tierColor}">${listing.tier.charAt(0).toUpperCase()}</span>` +
      `</div>` +
      `<div class="market-listing-info">` +
      `<div class="market-listing-name">${this.esc(listing.characterName)}</div>` +
      `<div class="market-listing-moment">${this.esc(listing.momentId)}</div>` +
      `<div class="market-listing-seller">by ${listing.seller}</div>` +
      (listing.serial ? `<div class="market-listing-serial">${listing.serial}</div>` : "") +
      `</div>` +
      `<div class="market-listing-right">` +
      `<div class="market-listing-price">${listing.price.toLocaleString()} BM</div>` +
      (floor
        ? `<div class="market-listing-floor">Floor: ${floor.floorPrice.toLocaleString()} ` +
          `<span class="market-listing-change ${changeCls}">${changeSign}${change}%</span></div>`
        : "") +
      (floor ? `<div class="market-sparkline">${this.renderSparkline(floor.sparkline, change >= 0 ? "#5fd96a" : "#ff6b6b", 72, 24)}</div>` : "") +
      `<button class="market-buy-btn" data-listing="${listing.listingId}">Buy</button>` +
      `</div></div>`
    );
  }

  private renderSparkline(data: number[], color: string, width: number, height: number): string {
    if (!data.length) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    let d = "";
    data.forEach((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="sparkline">` +
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`
    );
  }

  // ---- My Listings Tab ----

  private renderMyListingsTab(): string {
    return (
      `<div class="market-tab-content market-my">` +
      `<div class="market-my-header">` +
      `<span class="market-my-count">${this.myListings.length} listing${this.myListings.length !== 1 ? "s" : ""}</span>` +
      `<button class="market-sell-card-btn">+ List Card</button></div>` +
      (this.myListings.length
        ? `<div class="market-my-grid">` +
          this.myListings.map((l) => this.renderMyListingCard(l)).join("") + `</div>`
        : `<div class="market-empty">You have no active listings. Click "List Card" to sell.</div>`) +
      `</div>`
    );
  }

  private renderMyListingCard(listing: MyListing): string {
    const tierColor = TIER_COLORS[listing.tier];
    const statusCls = `status-${listing.status}`;
    const statusLabel = listing.status.charAt(0).toUpperCase() + listing.status.slice(1);
    return (
      `<div class="market-my-card ${statusCls}">` +
      `<div class="market-my-img" style="background:linear-gradient(135deg,${tierColor}28,${tierColor}0a)">` +
      `<span style="color:${tierColor}">${listing.tier.charAt(0).toUpperCase()}</span>` +
      `</div>` +
      `<div class="market-my-info">` +
      `<div class="market-my-name">${this.esc(listing.characterName)}</div>` +
      `<div class="market-my-price">${listing.price.toLocaleString()} BM</div>` +
      `<div class="market-my-status ${statusCls}">${statusLabel}</div>` +
      `</div>` +
      (listing.status === "active"
        ? `<button class="market-cancel-btn" data-listing="${listing.listingId}">Cancel</button>`
        : `<button class="market-cancel-btn" disabled>${listing.status === "sold" ? "Sold" : "Expired"}</button>`) +
      `</div>`
    );
  }

  // ---- History Tab ----

  private renderHistoryTab(): string {
    return (
      `<div class="market-tab-content market-history">` +
      (this.history.length
        ? `<div class="market-history-table">` +
          `<div class="market-history-header">` +
          `<span>Card</span><span>Tier</span><span>Price</span>` +
          `<span>Buyer</span><span>Seller</span><span>Date</span></div>` +
          this.history.map((s) => this.renderHistoryRow(s)).join("") + `</div>`
        : `<div class="market-empty">No transaction history yet.</div>`) +
      `</div>`
    );
  }

  private renderHistoryRow(sale: MarketSale): string {
    const tierColor = TIER_COLORS[sale.tier];
    const date = sale.soldAt.toLocaleDateString();
    const isBuyer = sale.buyer.startsWith("0x") && sale.buyer.length < 20; // simplified check
    return (
      `<div class="market-history-row">` +
      `<span class="market-hist-name">${this.esc(sale.characterName)}</span>` +
      `<span class="market-hist-tier" style="color:${tierColor}">${sale.tier.toUpperCase()}</span>` +
      `<span class="market-hist-price">${sale.price.toLocaleString()} BM</span>` +
      `<span class="market-hist-addr">${sale.buyer}</span>` +
      `<span class="market-hist-addr">${sale.seller}</span>` +
      `<span class="market-hist-date">${date}</span>` +
      `</div>`
    );
  }

  // -----------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------

  private sortListings(listings: MarketListing[]): MarketListing[] {
    const arr = [...listings];
    switch (this.sortMode) {
      case "price_asc": arr.sort((a, b) => a.price - b.price); break;
      case "price_desc": arr.sort((a, b) => b.price - a.price); break;
      case "recent":
      default: arr.sort((a, b) => b.listedAt.getTime() - a.listedAt.getTime()); break;
    }
    return arr;
  }

  // -----------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------

  private timeLeft(end: Date): string {
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }

  private esc(s: string): string {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // -----------------------------------------------------------------
  // Event handling
  // -----------------------------------------------------------------

  private attachListeners(): void {
    this.container.querySelectorAll(".market-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.activeTab = (tab as HTMLElement).dataset.tab as MarketTab;
        this.render();
      });
    });

    this.container.querySelectorAll(".market-tier-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.tierFilter = (btn as HTMLElement).dataset.tier as Tier | "all";
        this.render();
      });
    });

    const sortSelect = this.container.querySelector("[data-sort]") as HTMLSelectElement | null;
    sortSelect?.addEventListener("change", () => {
      this.sortMode = sortSelect.value as typeof this.sortMode;
      this.render();
    });

    this.container.querySelectorAll(".market-buy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = btn as HTMLElement;
        this.emit("buy", {
          dropId: el.dataset.drop,
          releaseId: el.dataset.release,
          saleId: el.dataset.sale,
          listingId: el.dataset.listing,
        });
      });
    });

    this.container.querySelectorAll(".market-cancel-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLElement).dataset.listing;
        if (id) this.emit("cancelListing", id);
      });
    });

    this.container.querySelector(".market-sell-card-btn")?.addEventListener("click", () => {
      this.emit("listCard", null);
    });
  }

  private listeners: Record<string, Array<(payload: unknown) => void>> = {};

  on(event: string, cb: (payload: unknown) => void): void {
    (this.listeners[event] ??= []).push(cb);
  }

  private emit(event: string, payload: unknown): void {
    (this.listeners[event] ?? []).forEach((cb) => cb(payload));
  }
}

// ---------------------------------------------------------------------------
// MarketView CSS
// ---------------------------------------------------------------------------

export function getMarketCSS(): string {
  return /* css */ `
.market-view{padding:16px 20px;max-width:1100px;margin:0 auto}
.market-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:8px}
.market-tab{background:transparent;border:none;padding:8px 16px;font-size:13px;color:rgba(255,255,255,.4);cursor:pointer;border-radius:8px 8px 0 0;transition:all .2s;position:relative}
.market-tab:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.04)}
.market-tab.active{color:rgba(255,255,255,.9);font-weight:600}
.market-tab.active::after{content:"";position:absolute;bottom:-9px;left:16px;right:16px;height:2px;background:rgba(255,255,255,.5);border-radius:1px}
.market-body{min-height:300px}
.market-section{margin-bottom:24px}
.market-section-title{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);margin-bottom:10px}
.market-drops-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.market-drop-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.market-drop-card:hover{border-color:rgba(255,255,255,.14);box-shadow:0 6px 20px rgba(0,0,0,.25)}
.market-drop-img{height:120px;display:flex;align-items:center;justify-content:center;position:relative}
.market-drop-tier{font-size:12px;font-weight:700;letter-spacing:1px;opacity:.6}
.market-drop-info{padding:12px}
.market-drop-name{font-size:14px;font-weight:600;color:rgba(255,255,255,.85);margin-bottom:3px}
.market-drop-desc{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:8px;line-height:1.4}
.market-drop-price-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.market-drop-price{font-size:16px;font-weight:700;color:#5fd96a}
.market-drop-original{font-size:12px;color:rgba(255,255,255,.3);text-decoration:line-through}
.market-drop-discount{font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,90,90,.15);color:#ff8a8a;font-weight:600}
.market-releases-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.market-releases-row::-webkit-scrollbar{height:3px}
.market-releases-row::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
.market-release-card{flex-shrink:0;width:140px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;text-align:center;padding:10px;transition:border-color .2s}
.market-release-card:hover{border-color:rgba(255,255,255,.14)}
.market-release-img{height:80px;display:flex;align-items:center;justify-content:center;border-radius:8px;margin-bottom:8px}
.market-release-tier{font-size:10px;font-weight:700;letter-spacing:1px;opacity:.5}
.market-release-name{font-size:12px;font-weight:600;color:rgba(255,255,255,.8);margin-bottom:4px}
.market-release-price{font-size:12px;color:#5fd96a;margin-bottom:8px}
.market-flash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.market-flash-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,204,51,.15);border-radius:14px;overflow:hidden;position:relative;transition:border-color .2s,box-shadow .2s}
.market-flash-card:hover{border-color:rgba(255,204,51,.3);box-shadow:0 0 20px rgba(255,204,51,.08)}
.market-flash-img{height:120px;display:flex;align-items:center;justify-content:center}
.market-flash-badge{position:absolute;top:8px;left:8px;padding:3px 8px;border-radius:6px;background:rgba(255,204,51,.9);color:#1a1000;font-size:9px;font-weight:700;letter-spacing:1px}
.market-flash-info{padding:12px}
.market-flash-name{font-size:14px;font-weight:600;color:rgba(255,255,255,.85);margin-bottom:3px}
.market-flash-timer{font-size:12px;color:#ffcc33;margin-bottom:8px;font-family:var(--font-mono,monospace)}
.market-flash-price-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.market-flash-price{font-size:16px;font-weight:700;color:#5fd96a}
.market-flash-original{font-size:12px;color:rgba(255,255,255,.3);text-decoration:line-through}
.market-sec-filters{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap}
.market-tier-filters{display:flex;gap:4px}
.market-tier-btn{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:5px 12px;font-size:11px;color:rgba(255,255,255,.45);cursor:pointer;transition:all .2s}
.market-tier-btn:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}
.market-tier-btn.active{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.9);font-weight:600}
.market-sort-select{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:5px 10px;font-size:11px;color:rgba(255,255,255,.6);outline:none}
.market-listings-grid{display:flex;flex-direction:column;gap:8px}
.market-listing{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:10px 14px;transition:border-color .2s}
.market-listing:hover{border-color:rgba(255,255,255,.12)}
.market-listing-img{width:52px;height:52px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.market-listing-tier{font-size:14px;font-weight:700}
.market-listing-info{flex:1;min-width:0}
.market-listing-name{font-size:13px;font-weight:600;color:rgba(255,255,255,.8);margin-bottom:1px}
.market-listing-moment{font-size:10px;color:rgba(255,255,255,.35)}
.market-listing-seller{font-size:10px;color:rgba(255,255,255,.25)}
.market-listing-serial{font-size:9px;color:rgba(255,255,255,.25);font-family:var(--font-mono,monospace)}
.market-listing-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
.market-listing-price{font-size:15px;font-weight:700;color:rgba(255,255,255,.85)}
.market-listing-floor{font-size:10px;color:rgba(255,255,255,.35)}
.market-listing-change{font-size:10px;font-weight:600}
.market-listing-change.up{color:#5fd96a}
.market-listing-change.down{color:#ff6b6b}
.sparkline{opacity:.7}
.market-my-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.market-my-count{font-size:13px;color:rgba(255,255,255,.5)}
.market-sell-card-btn{padding:8px 16px;border-radius:10px;background:rgba(95,217,106,.15);border:1px solid rgba(95,217,106,.3);color:#5fd96a;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
.market-sell-card-btn:hover{background:rgba(95,217,106,.25)}
.market-my-grid{display:flex;flex-direction:column;gap:8px}
.market-my-card{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:10px 14px}
.market-my-img{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700}
.market-my-info{flex:1}
.market-my-name{font-size:13px;font-weight:600;color:rgba(255,255,255,.8)}
.market-my-price{font-size:12px;color:rgba(255,255,255,.55)}
.market-my-status{font-size:10px;margin-top:1px}
.market-my-status.status-active{color:#5fd96a}
.market-my-status.status-expired{color:rgba(255,255,255,.35)}
.market-my-status.status-sold{color:#4aa3ff}
.market-cancel-btn{padding:6px 12px;border-radius:8px;background:rgba(255,90,90,.1);border:1px solid rgba(255,90,90,.2);color:#ff8a8a;font-size:11px;cursor:pointer;transition:all .2s}
.market-cancel-btn:hover:not(:disabled){background:rgba(255,90,90,.2)}
.market-cancel-btn:disabled{opacity:.3;cursor:not-allowed}
.market-history-table{display:flex;flex-direction:column;gap:1px;background:rgba(255,255,255,.03);border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.05)}
.market-history-header{display:grid;grid-template-columns:2fr 1fr 1.2fr 1fr 1fr 1fr;padding:10px 14px;background:rgba(255,255,255,.04);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.35)}
.market-history-row{display:grid;grid-template-columns:2fr 1fr 1.2fr 1fr 1fr 1fr;padding:10px 14px;align-items:center;font-size:12px;color:rgba(255,255,255,.65);transition:background .15s}
.market-history-row:hover{background:rgba(255,255,255,.03)}
.market-hist-name{font-weight:600;color:rgba(255,255,255,.8)}
.market-hist-tier{font-size:10px;font-weight:700;letter-spacing:.5px}
.market-hist-price{font-weight:600;color:#5fd96a}
.market-hist-addr{font-family:var(--font-mono,monospace);font-size:10px;color:rgba(255,255,255,.35)}
.market-hist-date{font-size:10px;color:rgba(255,255,255,.3)}
.market-empty{text-align:center;padding:40px;color:rgba(255,255,255,.25);font-size:13px}
.market-buy-btn{padding:8px 18px;border-radius:10px;background:rgba(95,217,106,.15);border:1px solid rgba(95,217,106,.3);color:#5fd96a;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.market-buy-btn:hover{background:rgba(95,217,106,.25)}
.market-buy-btn.small{padding:5px 12px;font-size:11px}
@media(max-width:700px){.market-drops-grid,.market-flash-grid{grid-template-columns:1fr 1fr}.market-history-header,.market-history-row{grid-template-columns:2fr 1fr 1fr;font-size:10px}.market-history-header span:nth-child(4),.market-history-header span:nth-child(5),.market-history-header span:nth-child(6),.market-history-row span:nth-child(4),.market-history-row span:nth-child(5),.market-history-row span:nth-child(6){display:none}.market-listing{flex-wrap:wrap}}
`;
}
