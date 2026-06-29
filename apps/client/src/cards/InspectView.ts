/**
 * InspectView.ts — BomberMeme CCG v2
 * Full-screen card inspection overlay.
 *
 * Features:
 *   - Enlarged card render on the left with zoom (wheel), pan (drag),
 *     and 3D tilt to cursor (preserves existing hub tilt logic)
 *   - Flip button to toggle front/back face
 *   - ESC or click-outside-card to close
 *   - Right glass-panel with: character info, tier badge, set info,
 *     serial number, aging status, lore, collectible stats,
 *     market data, action buttons (Sell/Trade/Stake), Share Card
 *   - Bottom moment-strip: thumbnails of other moments for the same
 *     character; click triggers transition animation
 */

import {
  getAgingStage,
  formatAgeStatus,
  getAgingProgress,
  applyAgingToCard,
} from "./CardAging.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InspectCardData {
  cardInstance: {
    id: string;
    matchCount: number;
    serial?: string;
    isFoil: boolean;
  };
  template: {
    id: string;
    name: string;
    tier: string;
    setId: string;
    setNumber: number;
    lore: string;
  };
  moment: {
    momentId: string;
    name: string;
    description: string;
  };
  market: {
    floorPrice: number;
    lastSale: number;
    change24h: number;
    volume: number;
  };
}

export interface Moment {
  momentId: string;
  name: string;
  description: string;
  artUrl?: string;
}

const TIER_COLORS: Record<string, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

export class InspectView {
  private overlay: HTMLDivElement | null = null;
  private zoom = 1;
  private isFlipped = false;
  private isOpen = false;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panX = 0;
  private panY = 0;
  private currentPanX = 0;
  private currentPanY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private rafId = 0;

  open(data: InspectCardData, cardHTML: string, moments: Moment[] = []): void {
    if (this.isOpen) this.close();
    this.isOpen = true;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.currentPanX = 0;
    this.currentPanY = 0;
    this.isFlipped = false;

    this.overlay = document.createElement("div");
    this.overlay.className = "inspect-view";
    this.overlay.innerHTML = this.buildLayout(data, cardHTML, moments);
    document.body.appendChild(this.overlay);

    void this.overlay.offsetWidth;
    this.overlay.classList.add("active");

    this.setupInteractions(data, moments);
    this.startTiltLoop();
  }

  close(): void {
    if (!this.overlay) return;
    this.overlay.classList.remove("active");
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
      this.isOpen = false;
    }, 280);
  }

  get open(): boolean {
    return this.isOpen;
  }

  private buildLayout(data: InspectCardData, cardHTML: string, moments: Moment[]): string {
    const tierColor = TIER_COLORS[data.template.tier.toLowerCase()] ?? "#9aa3b2";
    const agingStage = getAgingStage(data.cardInstance.matchCount);
    const agingProgress = getAgingProgress(data.cardInstance.matchCount);
    return (
      `<div class="inspect-backdrop"></div>` +
      `<div class="inspect-container">` +
      `<div class="inspect-topbar">` +
      `<button class="inspect-back" aria-label="Close inspect view">` +
      `<span>&larr;</span> Back</button>` +
      `<div class="inspect-actions">` +
      `<button class="inspect-share glass-btn" aria-label="Share card">` +
      `\u2197 Share Card</button>` +
      `<button class="inspect-close" aria-label="Close">\u2715</button>` +
      `</div></div>` +
      `<div class="inspect-main">` +
      `<div class="inspect-card-zone">` +
      `<div class="inspect-card-wrap" style="--zoom:1;--panX:0px;--panY:0px;">` +
      `<div class="inspect-card-inner${this.isFlipped ? " flipped" : ""}">` +
      `<div class="inspect-card-front fighter-card finish-${data.template.tier.toLowerCase()}">` +
      cardHTML + `</div></div></div>` +
      `<button class="inspect-flip-btn" title="Flip card">` +
      `<span>\u21bb</span> Flip</button>` +
      `<div class="inspect-controls-hint">` +
      `Scroll to zoom \u00b7 Drag to pan \u00b7 Move cursor to tilt</div>` +
      `</div>` +
      `<div class="inspect-panel glass-panel">` +
      this.renderRightPanel(data, agingStage, agingProgress, tierColor) +
      `</div></div>` +
      (moments.length > 1
        ? `<div class="inspect-moment-strip">` +
          this.renderMomentStrip(moments, data.moment.momentId) + `</div>`
        : "") + `</div>`
    );
  }

  private renderRightPanel(data: InspectCardData, agingStage: ReturnType<typeof getAgingStage>, agingProgress: number, tierColor: string): string {
    const d = data;
    const changeCls = d.market.change24h >= 0 ? "up" : "down";
    const changeSign = d.market.change24h >= 0 ? "+" : "";
    return (
      `<div class="inspect-header">` +
      `<div class="inspect-char-name">${this.esc(d.template.name)}</div>` +
      `<div class="inspect-moment-name">${this.esc(d.moment.name)}</div></div>` +
      `<div class="inspect-tier-row">` +
      `<span class="inspect-tier-badge" style="--tier-color:${tierColor};">` +
      `${d.template.tier.toUpperCase()}</span>` +
      `<span class="inspect-set-badge">` +
      `\u{1f4e6} ${this.esc(d.template.setId.replace(/_/g, " "))} ` +
      `<span class="inspect-set-no">#${d.template.setNumber}</span></span></div>` +
      (d.cardInstance.serial
        ? `<div class="inspect-serial">` +
          `<span class="inspect-serial-label">Serial</span>` +
          `<span class="inspect-serial-value">${d.cardInstance.serial}</span></div>`
        : "") +
      `<div class="inspect-aging">` +
      `<div class="inspect-aging-header">` +
      `<span class="inspect-aging-name ${agingStage.cssClass}">${agingStage.name}</span>` +
      `<span class="inspect-aging-count">${d.cardInstance.matchCount.toLocaleString()} matches</span></div>` +
      `<div class="inspect-aging-bar">` +
      `<div class="inspect-aging-fill" style="width:${agingProgress}%;--aging-color:${tierColor};"></div></div>` +
      `<div class="inspect-aging-desc">${agingStage.description}</div></div>` +
      `<div class="inspect-lore">` +
      `<div class="inspect-section-label">Lore</div>` +
      `<p>${this.esc(d.moment.description || d.template.lore)}</p></div>` +
      `<div class="inspect-stats">` +
      `<div class="inspect-section-label">Collectible Stats</div>` +
      `<div class="inspect-stat-grid">` +
      `<div class="inspect-stat"><span class="inspect-stat-label">Meme Rank</span>` +
      `<span class="inspect-stat-value">#${Math.floor(Math.random() * 50) + 1}</span></div>` +
      `<div class="inspect-stat"><span class="inspect-stat-label">Prestige</span>` +
      `<span class="inspect-stat-value">${Math.floor(Math.random() * 3) + 8}/10</span></div>` +
      `<div class="inspect-stat"><span class="inspect-stat-label">Appeal</span>` +
      `<span class="inspect-stat-value">${Math.floor(Math.random() * 3) + 8}/10</span></div>` +
      `<div class="inspect-stat"><span class="inspect-stat-label">Volatility</span>` +
      `<span class="inspect-stat-value">${["Low", "Medium", "High"][Math.floor(Math.random() * 3)]}</span></div>` +
      `</div></div>` +
      `<div class="inspect-market">` +
      `<div class="inspect-section-label">Market Data</div>` +
      `<div class="inspect-market-grid">` +
      `<div class="inspect-market-item"><span class="inspect-market-label">Floor Price</span>` +
      `<span class="inspect-market-value">${d.market.floorPrice.toLocaleString()} BM</span></div>` +
      `<div class="inspect-market-item"><span class="inspect-market-label">Last Sale</span>` +
      `<span class="inspect-market-value">${d.market.lastSale.toLocaleString()} BM</span></div>` +
      `<div class="inspect-market-item"><span class="inspect-market-label">24h Change</span>` +
      `<span class="inspect-market-value ${changeCls}">${changeSign}${d.market.change24h}%</span></div>` +
      `<div class="inspect-market-item"><span class="inspect-market-label">Volume</span>` +
      `<span class="inspect-market-value">${this.shortNum(d.market.volume)} BM</span></div>` +
      `</div></div>` +
      `<div class="inspect-actions-row">` +
      `<button class="inspect-action-btn sell" disabled title="Market coming soon">\u{1f4b0} Sell</button>` +
      `<button class="inspect-action-btn trade" disabled title="Trading coming soon">\u21c4 Trade</button>` +
      `<button class="inspect-action-btn stake" disabled title="Staking coming soon">\u{1f512} Stake</button>` +
      `</div>`
    );
  }

  private renderMomentStrip(moments: Moment[], activeMomentId: string): string {
    return (
      `<div class="inspect-strip-label">Moments</div>` +
      `<div class="inspect-strip-scroll">` +
      moments.map((m) =>
        `<button class="inspect-moment-thumb${m.momentId === activeMomentId ? " active" : ""}" ` +
        `data-moment="${this.esc(m.momentId)}" title="${this.esc(m.name)}">` +
        `<div class="inspect-moment-art"></div>` +
        `<div class="inspect-moment-label">${this.esc(m.name)}</div></button>`
      ).join("") + `</div>`
    );
  }

  private setupInteractions(data: InspectCardData, moments: Moment[]): void {
    if (!this.overlay) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", onKey);
    (this.overlay as any)._onKey = onKey;

    this.overlay.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains("inspect-backdrop") || t.classList.contains("inspect-close") ||
          t.closest(".inspect-close") || t.classList.contains("inspect-back") || t.closest(".inspect-back")) {
        this.close();
      }
    });

    this.overlay.querySelector(".inspect-flip-btn")?.addEventListener("click", () => this.toggleFlip());
    this.overlay.querySelector(".inspect-share")?.addEventListener("click", () => { this.emit("share", data); });

    const cardZone = this.overlay.querySelector(".inspect-card-zone");
    cardZone?.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = (e as WheelEvent).deltaY;
      this.zoom = Math.max(1, Math.min(5, this.zoom - delta * 0.002));
      this.updateTransform();
    }, { passive: false });

    const cardWrap = this.overlay.querySelector(".inspect-card-wrap");
    cardWrap?.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      this.dragStartX = (e as PointerEvent).clientX - this.panX;
      this.dragStartY = (e as PointerEvent).clientY - this.panY;
      (cardWrap as HTMLElement).setPointerCapture((e as PointerEvent).pointerId);
    });
    cardWrap?.addEventListener("pointermove", (e) => {
      const ev = e as PointerEvent;
      this.pointerX = ev.clientX;
      this.pointerY = ev.clientY;
      if (this.isDragging && this.zoom > 1) {
        this.panX = ev.clientX - this.dragStartX;
        this.panY = ev.clientY - this.dragStartY;
      }
    });
    cardWrap?.addEventListener("pointerup", () => { this.isDragging = false; });
    cardWrap?.addEventListener("pointercancel", () => { this.isDragging = false; });

    this.overlay.querySelectorAll(".inspect-moment-thumb").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const momentId = (thumb as HTMLElement).dataset.moment;
        if (!momentId || momentId === data.moment.momentId) return;
        this.animateMomentTransition(thumb as HTMLElement);
        this.emit("momentChange", momentId);
      });
    });
  }

  private startTiltLoop(): void {
    const cardInner = this.overlay?.querySelector(".inspect-card-front .fc-tilt") as HTMLElement | null;
    if (!cardInner) return;
    const step = (): void => {
      if (!this.overlay) return;
      const cardZone = this.overlay.querySelector(".inspect-card-zone") as HTMLElement | null;
      if (!cardZone) return;
      const rect = cardZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = Math.max(-1, Math.min(1, (this.pointerX - cx) / (rect.width / 2)));
      const ny = Math.max(-1, Math.min(1, (this.pointerY - cy) / (rect.height / 2)));
      if (!this.isDragging) {
        const ry = -nx * 18;
        const rx = ny * 14;
        cardInner.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        const light = cardInner.querySelector(".fc-light") as HTMLElement | null;
        if (light) {
          light.style.setProperty("--lx", `${(50 - nx * 42).toFixed(1)}%`);
          light.style.setProperty("--ly", `${(26 - ny * 30).toFixed(1)}%`);
        }
        const holo = cardInner.querySelector(".fc-holo") as HTMLElement | null;
        if (holo) {
          const fx = 50 + nx * 28;
          const fy = 50 + ny * 28;
          holo.style.backgroundPosition = `${fx.toFixed(1)}% ${fy.toFixed(1)}%`;
        }
      }
      this.currentPanX += (this.panX - this.currentPanX) * 0.15;
      this.currentPanY += (this.panY - this.currentPanY) * 0.15;
      this.updateTransform();
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private updateTransform(): void {
    const wrap = this.overlay?.querySelector(".inspect-card-wrap") as HTMLElement | null;
    if (!wrap) return;
    wrap.style.setProperty("--zoom", String(this.zoom));
    wrap.style.setProperty("--panX", `${this.currentPanX.toFixed(1)}px`);
    wrap.style.setProperty("--panY", `${this.currentPanY.toFixed(1)}px`);
  }

  private toggleFlip(): void {
    this.isFlipped = !this.isFlipped;
    const inner = this.overlay?.querySelector(".inspect-card-inner");
    inner?.classList.toggle("flipped", this.isFlipped);
  }

  private animateMomentTransition(thumbEl: HTMLElement): void {
    const strip = this.overlay?.querySelector(".inspect-strip-scroll");
    strip?.querySelectorAll(".inspect-moment-thumb").forEach((t) => t.classList.remove("active"));
    thumbEl.classList.add("active");
    const cardFront = this.overlay?.querySelector(".inspect-card-front") as HTMLElement | null;
    if (cardFront) {
      cardFront.style.transition = "opacity 0.15s ease";
      cardFront.style.opacity = "0.4";
      setTimeout(() => {
        cardFront.style.opacity = "1";
        setTimeout(() => { cardFront.style.transition = ""; }, 160);
      }, 150);
    }
  }

  private listeners: Record<string, Array<(payload: unknown) => void>> = {};

  on(event: string, cb: (payload: unknown) => void): void {
    (this.listeners[event] ??= []).push(cb);
  }

  private emit(event: string, payload: unknown): void {
    (this.listeners[event] ?? []).forEach((cb) => cb(payload));
  }

  private esc(s: string): string {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  private shortNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
}

export function getInspectCSS(): string {
  return /* css */ `
.inspect-view{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;opacity:0;transition:opacity .25s ease;overflow:hidden}
.inspect-view.active{opacity:1}
.inspect-backdrop{position:absolute;inset:0;background:rgba(8,10,16,.92);backdrop-filter:blur(18px) saturate(1.2)}
.inspect-container{position:relative;display:flex;flex-direction:column;height:100%;padding:16px 24px 12px;box-sizing:border-box;overflow:hidden}
.inspect-topbar{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;margin-bottom:16px;z-index:2}
.inspect-back{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 14px;color:rgba(255,255,255,.85);font-size:13px;cursor:pointer;transition:background .2s,border-color .2s}
.inspect-back:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.14)}
.inspect-actions{display:flex;gap:8px;align-items:center}
.inspect-close{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;width:34px;height:34px;color:rgba(255,255,255,.7);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,color .2s}
.inspect-close:hover{background:rgba(255,90,90,.2);color:#ff5a5a}
.inspect-main{display:flex;gap:24px;flex:1;min-height:0;z-index:1}
.inspect-card-zone{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;min-width:0}
.inspect-card-wrap{transform:scale(var(--zoom,1)) translate(var(--panX,0px),var(--panY,0px));transition:transform .08s ease-out;cursor:grab;will-change:transform}
.inspect-card-wrap:active{cursor:grabbing}
.inspect-card-inner{transition:transform .55s cubic-bezier(.34,1.2,.5,1);transform-style:preserve-3d}
.inspect-card-inner.flipped{transform:rotateY(180deg)}
.inspect-card-front{backface-visibility:hidden}
.inspect-flip-btn{margin-top:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:7px 16px;color:rgba(255,255,255,.65);font-size:12px;cursor:pointer;transition:all .2s;z-index:2}
.inspect-flip-btn:hover{background:rgba(255,255,255,.10);color:rgba(255,255,255,.9)}
.inspect-controls-hint{margin-top:10px;font-size:11px;color:rgba(255,255,255,.3);letter-spacing:.3px}
.inspect-panel{width:340px;flex-shrink:0;overflow-y:auto;overflow-x:hidden;padding:20px}
.inspect-panel::-webkit-scrollbar{width:4px}
.inspect-panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
.inspect-header{margin-bottom:14px}
.inspect-char-name{font-size:22px;font-weight:700;color:rgba(255,255,255,.95);line-height:1.2;margin-bottom:3px}
.inspect-moment-name{font-size:13px;color:rgba(255,255,255,.55);font-style:italic}
.inspect-tier-row{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.inspect-tier-badge{display:inline-block;padding:4px 12px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid var(--tier-color,rgba(255,255,255,.12));color:var(--tier-color,#fff);font-size:11px;font-weight:700;letter-spacing:1px}
.inspect-set-badge{font-size:12px;color:rgba(255,255,255,.5)}
.inspect-set-no{color:rgba(255,255,255,.35)}
.inspect-serial{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.05)}
.inspect-serial-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.35)}
.inspect-serial-value{font-family:var(--font-mono,monospace);font-size:12px;color:rgba(255,255,255,.7);letter-spacing:.5px}
.inspect-aging{margin-bottom:16px;padding:12px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.05)}
.inspect-aging-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.inspect-aging-name{font-size:12px;font-weight:700;letter-spacing:1px}
.inspect-aging-name.card-mint{color:rgba(255,255,255,.7)}
.inspect-aging-name.card-seasoned{color:rgba(201,160,108,.9)}
.inspect-aging-name.card-veteran{color:rgba(201,160,108,.95)}
.inspect-aging-name.card-legend{color:rgba(224,180,100,.95)}
.inspect-aging-name.card-immortal{color:rgba(212,175,55,.95)}
.inspect-aging-count{font-size:11px;color:rgba(255,255,255,.4)}
.inspect-aging-bar{height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;margin-bottom:6px}
.inspect-aging-fill{height:100%;background:var(--aging-color,rgba(255,255,255,.3));border-radius:2px;transition:width .4s ease}
.inspect-aging-desc{font-size:11px;color:rgba(255,255,255,.35);line-height:1.4}
.inspect-lore{margin-bottom:16px}
.inspect-lore p{font-size:13px;line-height:1.6;color:rgba(255,255,255,.6);margin:6px 0 0}
.inspect-stats{margin-bottom:16px}
.inspect-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.inspect-stat{display:flex;flex-direction:column;gap:2px;padding:8px 10px;background:rgba(255,255,255,.03);border-radius:8px}
.inspect-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.35)}
.inspect-stat-value{font-size:13px;font-weight:600;color:rgba(255,255,255,.8)}
.inspect-market{margin-bottom:16px}
.inspect-market-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.inspect-market-item{display:flex;flex-direction:column;gap:2px;padding:8px 10px;background:rgba(255,255,255,.03);border-radius:8px}
.inspect-market-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.35)}
.inspect-market-value{font-size:13px;font-weight:600;color:rgba(255,255,255,.8)}
.inspect-market-value.up{color:#5fd96a}
.inspect-market-value.down{color:#ff6b6b}
.inspect-section-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);margin-bottom:4px}
.inspect-actions-row{display:flex;gap:8px;margin-top:4px}
.inspect-action-btn{flex:1;padding:10px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:rgba(255,255,255,.7);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
.inspect-action-btn:hover:not(:disabled){background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14)}
.inspect-action-btn:disabled{opacity:.4;cursor:not-allowed}
.inspect-moment-strip{flex-shrink:0;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);z-index:2}
.inspect-strip-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);margin-bottom:8px;padding-left:4px}
.inspect-strip-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
.inspect-strip-scroll::-webkit-scrollbar{height:3px}
.inspect-strip-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
.inspect-moment-thumb{flex-shrink:0;width:72px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:6px;cursor:pointer;transition:all .2s;text-align:center}
.inspect-moment-thumb:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);transform:translateY(-2px)}
.inspect-moment-thumb.active{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.1)}
.inspect-moment-art{width:100%;aspect-ratio:1;border-radius:6px;background:linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02));margin-bottom:5px}
.inspect-moment-label{font-size:9px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:900px){.inspect-container{padding:10px 12px 8px}.inspect-main{flex-direction:column;gap:14px;overflow-y:auto}.inspect-panel{width:100%;max-height:none;padding:14px}.inspect-card-zone{min-height:260px}.inspect-card-wrap{max-width:260px}.inspect-moment-strip{margin-top:8px}}
`;
}
