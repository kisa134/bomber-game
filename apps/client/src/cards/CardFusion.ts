/**
 * CardFusion.ts — Duplicate card fusion system for BomberMeme CCG v2.
 *
 * Mechanics:
 *   3 Common (same character + moment) -> 1 Foil Common
 *   3 Foil Common (same character)     -> 1 Rare Gold-Framed
 *   3 Rare (same character + moment)   -> 1 Epic Gold-Framed
 *   3 Epic (same character + moment)   -> 1 Legendary Gold-Framed
 *
 * Flow: select 3 cards -> preview result -> confirm -> swirl animation ->
 *       merge + result appear.
 *
 * Technical: ESM, strict TypeScript, CSS animations + Canvas 2D only.
 */

import { ASSET_VER } from "../game/assets.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FusionRecipe {
  inputs: {
    tier: string;
    count: number;
    sameCharacter: boolean;
    sameMoment: boolean;
  };
  output: {
    tier: string;
    isFoil: boolean;
    isGoldFrame: boolean;
  };
  fee: number; // BM tokens
}

export interface FusionCard {
  instanceId: string;
  characterId: string;
  characterName: string;
  momentId: string;
  tier: string;
  isFoil: boolean;
  matchCount: number;
  thumbnailHTML: string;
}

// ---------------------------------------------------------------------------
// Fusion rules
// ---------------------------------------------------------------------------

const RECIPES: FusionRecipe[] = [
  {
    inputs: { tier: "common", count: 3, sameCharacter: true, sameMoment: true },
    output: { tier: "common", isFoil: true, isGoldFrame: false },
    fee: 50,
  },
  {
    inputs: { tier: "foil_common", count: 3, sameCharacter: true, sameMoment: false },
    output: { tier: "rare", isFoil: false, isGoldFrame: true },
    fee: 150,
  },
  {
    inputs: { tier: "rare", count: 3, sameCharacter: true, sameMoment: true },
    output: { tier: "epic", isFoil: false, isGoldFrame: true },
    fee: 500,
  },
  {
    inputs: { tier: "epic", count: 3, sameCharacter: true, sameMoment: true },
    output: { tier: "legendary", isFoil: false, isGoldFrame: true },
    fee: 2000,
  },
];

const TIER_COLORS: Record<string, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
  foil_common: "#b8e0ff",
};

const TIER_RANK: Record<string, number> = {
  common: 0, foil_common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
};

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

const STYLE_ID = "card-fusion-styles";

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .cf-panel{background:rgba(13,16,26,.75);border:1px solid rgba(255,255,255,.08);border-radius:20px;backdrop-filter:blur(24px) saturate(1.3);box-shadow:0 24px 60px rgba(0,0,0,.5);padding:24px;max-width:960px;width:92vw;max-height:88vh;overflow-y:auto;color:#e0e4ec;font-family:var(--font-ui,system-ui,-apple-system,sans-serif)}
    .cf-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
    .cf-title{font-size:20px;font-weight:800;color:#fff;letter-spacing:.3px}
    .cf-subtitle{font-size:13px;color:#7a8398;margin-top:4px}
    .cf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:20px}
    .cf-card{position:relative;background:linear-gradient(145deg,#1a1f2e,#131824);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;cursor:pointer;transition:transform .18s,border-color .2s,box-shadow .2s;display:flex;flex-direction:column;align-items:center;gap:8px}
    .cf-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.3)}
    .cf-card.selected{border-color:var(--tier-c,#ffd84d);box-shadow:0 0 0 2px var(--tier-c,#ffd84d)33,0 8px 24px rgba(0,0,0,.3)}
    .cf-card.unavailable{opacity:.4;cursor:not-allowed;filter:grayscale(.6)}
    .cf-card-thumb{width:100%;aspect-ratio:236/332;background:linear-gradient(145deg,#242a3a,#181d2a);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:40px;overflow:hidden;position:relative}
    .cf-card-tier{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:3px 10px;border-radius:20px;background:rgba(0,0,0,.35);color:var(--tier-c,#9aa3b2)}
    .cf-card-name{font-size:12px;font-weight:700;color:#e0e4ec;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
    .cf-card-meta{font-size:10px;color:#5a6078;text-align:center}
    .cf-card-count{position:absolute;top:8px;right:8px;background:rgba(255,200,50,.85);color:#1a1205;font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px}
    .cf-preview-area{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-bottom:20px;padding:20px;background:rgba(0,0,0,.2);border-radius:16px;border:1px solid rgba(255,255,255,.06)}
    .cf-preview-inputs{display:flex;gap:12px;flex:1;min-width:200px;justify-content:center}
    .cf-preview-arrow{display:flex;align-items:center;justify-content:center;font-size:32px;color:#5a6078;padding:0 12px}
    .cf-preview-result{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:160px}
    .cf-result-card{width:140px;height:196px;background:linear-gradient(145deg,#2a2040,#1a1530);border:2px solid rgba(255,200,50,.4);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;position:relative;overflow:hidden}
    .cf-result-card::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,transparent 40%,rgba(255,255,255,.06) 50%,transparent 60%);animation:cf-sheen 3s infinite}
    @keyframes cf-sheen{0%,100%{transform:translateX(-100%)}50%{transform:translateX(100%)}}
    .cf-result-tier{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--tier-c,#ffd84d);text-shadow:0 0 8px var(--tier-c,#ffd84d)55}
    .cf-result-badge{font-size:10px;padding:3px 10px;border-radius:20px;background:rgba(255,200,50,.15);color:#ffd84d;border:1px solid rgba(255,200,50,.25)}
    .cf-fee{font-size:12px;color:#7a8398;margin-top:4px}
    .cf-fee strong{color:#ffd84d}
    .cf-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    .cf-btn{cursor:pointer;border:none;padding:12px 28px;border-radius:14px;font-weight:800;font-size:14px;letter-spacing:.5px;transition:transform .15s,box-shadow .2s}
    .cf-btn:hover{transform:translateY(-2px)}
    .cf-btn:active{transform:translateY(0)}
    .cf-btn-fuse{background:linear-gradient(90deg,#ffd84d,#ff9a3d);color:#1a1205;box-shadow:0 4px 20px rgba(255,150,50,.3)}
    .cf-btn-fuse:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
    .cf-btn-ghost{background:rgba(255,255,255,.06);color:#e0e4ec;border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(12px)}
    .cf-empty{text-align:center;padding:40px 20px;color:#5a6078;font-size:14px}
    .cf-stage{position:fixed;inset:0;z-index:1000;background:rgba(5,6,10,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .4s}
    .cf-stage.show{opacity:1}
    .cf-swirl-cards{display:flex;gap:40px;align-items:center;justify-content:center;margin-bottom:40px;position:relative}
    .cf-swirl-card{width:160px;height:224px;position:relative;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.34,1.4,.4,1)}
    @keyframes cf-swirl-1{0%{transform:translate(0,0) rotate(0)}30%{transform:translate(30px,-20px) rotate(15deg)}60%{transform:translate(-20px,10px) rotate(-10deg)}100%{transform:translate(0,0) rotate(0) scale(.8)}}
    @keyframes cf-swirl-2{0%{transform:translate(0,0) rotate(0)}30%{transform:translate(-30px,-20px) rotate(-15deg)}60%{transform:translate(20px,10px) rotate(10deg)}100%{transform:translate(0,0) rotate(0) scale(.8)}}
    @keyframes cf-swirl-3{0%{transform:translate(0,0) rotate(0)}30%{transform:translate(0,-30px) rotate(5deg)}60%{transform:translate(0,20px) rotate(-5deg)}100%{transform:translate(0,0) rotate(0) scale(.8)}}
    .cf-swirl-1{animation:cf-swirl-1 1.2s ease-in-out 2}
    .cf-swirl-2{animation:cf-swirl-2 1.2s ease-in-out 2}
    .cf-swirl-3{animation:cf-swirl-3 1.2s ease-in-out 2}
    @keyframes cf-merge-flash{0%{opacity:0}30%{opacity:.8}100%{opacity:0}}
    .cf-merge-flash{position:fixed;inset:0;background:radial-gradient(circle,rgba(255,200,50,.5),transparent 60%);opacity:0;pointer-events:none;animation:cf-merge-flash .8s ease-out}
    @keyframes cf-result-pop{0%{transform:scale(0) rotate(-10deg)}60%{transform:scale(1.1) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
    .cf-result-pop{animation:cf-result-pop .7s cubic-bezier(.34,1.4,.4,1)}
    @keyframes cf-particle-orbit{0%{transform:rotate(0deg) translateX(80px) rotate(0deg)}100%{transform:rotate(360deg) translateX(80px) rotate(-360deg)}}
    .cf-orbit-particle{position:absolute;width:6px;height:6px;border-radius:50%;background:#ffd84d;box-shadow:0 0 8px 2px rgba(255,200,50,.5);animation:cf-particle-orbit 1.5s linear infinite}
    .cf-converge-canvas{position:fixed;inset:0;z-index:1001;pointer-events:none}
    .cf-result-glow{position:absolute;inset:-30px;border-radius:30px;box-shadow:0 0 60px 20px rgba(255,200,50,.25),0 0 120px 40px rgba(255,150,50,.1);opacity:0;animation:cf-glow-in .8s ease-out .3s forwards}
    @keyframes cf-glow-in{to{opacity:1}}
    @media(max-width:640px){.cf-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}.cf-preview-area{flex-direction:column;align-items:center}.cf-swirl-cards{gap:16px}.cf-swirl-card{width:120px;height:168px}}
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Particle canvas for converge effect
// ---------------------------------------------------------------------------

class ConvergeParticles {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private running = false;
  private rafId = 0;
  private targets: Array<{ x: number; y: number; color: string; progress: number }> = [];

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "cf-converge-canvas";
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  mount(): void { document.body.appendChild(this.canvas); }
  unmount(): void { this.canvas.remove(); cancelAnimationFrame(this.rafId); }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  convergeTo(cx: number, cy: number, cardColors: string[]): void {
    this.targets = cardColors.map((color) => ({
      x: cx + (Math.random() - 0.5) * 300,
      y: cy + (Math.random() - 0.5) * 300,
      color,
      progress: 0,
    }));
    if (!this.running) this.loop(cx, cy);
  }

  private loop = (tcx: number, tcy: number): void => {
    this.running = true;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = "lighter";

    let alive = false;
    for (const t of this.targets) {
      t.progress += 0.025;
      if (t.progress >= 1) continue;
      alive = true;
      const x = t.x + (tcx - t.x) * t.progress;
      const y = t.y + (tcy - t.y) * t.progress;
      const a = 1 - t.progress;
      const s = 3 * a;
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (alive) {
      this.rafId = requestAnimationFrame(() => this.loop(tcx, tcy));
    } else {
      this.running = false;
    }
  };
}

// ---------------------------------------------------------------------------
// CardFusion class
// ---------------------------------------------------------------------------

export class CardFusion {
  private container: HTMLElement;
  private selectedCards: FusionCard[] = [];
  private recipe: FusionRecipe | null = null;
  private onComplete?: ((result: FusionRecipe, consumedIds: string[]) => void) | null;

  constructor(container: HTMLElement, opts?: { onComplete?: (result: FusionRecipe, consumedIds: string[]) => void }) {
    this.container = container;
    this.onComplete = opts?.onComplete;
    injectStyles();
  }

  /** Render the fusion UI into the container. */
  render(availableCards: FusionCard[]): void {
    this.container.innerHTML = "";
    this.selectedCards = [];
    this.recipe = null;

    // Panel
    const panel = document.createElement("div");
    panel.className = "cf-panel";

    // Header
    const header = document.createElement("div");
    header.className = "cf-header";
    header.innerHTML = `<div><div class="cf-title">Card Fusion</div><div class="cf-subtitle">Combine 3 duplicates into a higher-tier card</div></div>`;
    panel.appendChild(header);

    if (availableCards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cf-empty";
      empty.textContent = "No duplicate cards available for fusion.";
      panel.appendChild(empty);
      this.container.appendChild(panel);
      return;
    }

    // Card grid
    const grid = document.createElement("div");
    grid.className = "cf-grid";
    grid.innerHTML = this.renderCardGrid(availableCards);
    panel.appendChild(grid);

    // Wire up card selection
    grid.querySelectorAll<HTMLElement>(".cf-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id!;
        if (el.classList.contains("selected")) {
          this.onCardDeselect(id);
          el.classList.remove("selected");
        } else if (this.selectedCards.length < 3) {
          const card = availableCards.find((c) => c.instanceId === id);
          if (card) {
            this.onCardSelect(card);
            el.classList.add("selected");
          }
        }
        this.updatePreview(panel);
      });
    });

    // Preview area
    const previewArea = document.createElement("div");
    previewArea.className = "cf-preview-area";
    previewArea.id = "cf-preview";
    previewArea.style.display = "none";
    panel.appendChild(previewArea);

    // Actions
    const actions = document.createElement("div");
    actions.className = "cf-actions";
    actions.id = "cf-actions";
    actions.style.display = "none";

    const fuseBtn = document.createElement("button");
    fuseBtn.className = "cf-btn cf-btn-fuse";
    fuseBtn.textContent = "Fuse Cards";
    fuseBtn.addEventListener("click", () => void this.confirmFusion());

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "cf-btn cf-btn-ghost";
    cancelBtn.textContent = "Clear";
    cancelBtn.addEventListener("click", () => {
      this.selectedCards = [];
      this.recipe = null;
      grid.querySelectorAll(".cf-card.selected").forEach((el) => el.classList.remove("selected"));
      this.updatePreview(panel);
    });

    actions.append(fuseBtn, cancelBtn);
    panel.appendChild(actions);
    this.container.appendChild(panel);
  }

  // -------------------------------------------------------------------------
  // Card grid rendering
  // -------------------------------------------------------------------------

  private renderCardGrid(cards: FusionCard[]): string {
    return cards
      .map((card) => {
        const tierColor = TIER_COLORS[card.tier] ?? "#9aa3b2";
        const foilTag = card.isFoil ? " <span style='color:#7fd8ff'>Foil</span>" : "";
        return `
          <div class="cf-card" data-id="${card.instanceId}" style="--tier-c:${tierColor}">
            <div class="cf-card-thumb">${card.thumbnailHTML}</div>
            <div class="cf-card-tier" style="--tier-c:${tierColor}">${card.tier}${foilTag}</div>
            <div class="cf-card-name">${card.characterName}</div>
            <div class="cf-card-meta">${card.momentId} · ${card.matchCount} matches</div>
          </div>
        `;
      })
      .join("");
  }

  // -------------------------------------------------------------------------
  // Selection logic
  // -------------------------------------------------------------------------

  private onCardSelect(card: FusionCard): void {
    if (this.selectedCards.length >= 3) return;
    this.selectedCards.push(card);
    this.recipe = this.canFuse(this.selectedCards);
  }

  private onCardDeselect(instanceId: string): void {
    this.selectedCards = this.selectedCards.filter((c) => c.instanceId !== instanceId);
    this.recipe = this.canFuse(this.selectedCards);
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  private updatePreview(panel: HTMLElement): void {
    const previewArea = panel.querySelector<HTMLElement>("#cf-preview");
    const actions = panel.querySelector<HTMLElement>("#cf-actions");
    const fuseBtn = panel.querySelector<HTMLElement>(".cf-btn-fuse");
    if (!previewArea || !actions || !fuseBtn) return;

    if (this.selectedCards.length === 0) {
      previewArea.style.display = "none";
      actions.style.display = "none";
      return;
    }

    previewArea.style.display = "flex";
    actions.style.display = "flex";

    // Build preview HTML
    const inputCardsHtml = this.selectedCards
      .map((c) => {
        const col = TIER_COLORS[c.tier] ?? "#9aa3b2";
        return `
          <div class="cf-card" style="--tier-c:${col};cursor:default">
            <div class="cf-card-thumb">${c.thumbnailHTML}</div>
            <div class="cf-card-tier" style="--tier-c:${col}">${c.tier}${c.isFoil ? " Foil" : ""}</div>
            <div class="cf-card-name">${c.characterName}</div>
          </div>
        `;
      })
      .join("");

    const recipe = this.recipe;
    const resultHtml = recipe
      ? this.renderPreviewResult(recipe)
      : `<div class="cf-empty" style="padding:20px">Select ${3 - this.selectedCards.length} more...</div>`;

    const canFuse = recipe !== null && this.selectedCards.length === 3;
    fuseBtn.classList.toggle("cf-btn-fuse", canFuse);
    (fuseBtn as HTMLButtonElement).disabled = !canFuse;

    previewArea.innerHTML = `
      <div class="cf-preview-inputs">${inputCardsHtml}</div>
      <div class="cf-preview-arrow">&#10132;</div>
      <div class="cf-preview-result">${resultHtml}</div>
    `;
  }

  private renderPreviewResult(recipe: FusionRecipe): string {
    const outColor = TIER_COLORS[recipe.output.tier] ?? "#ffd84d";
    const badges: string[] = [];
    if (recipe.output.isFoil) badges.push("Foil");
    if (recipe.output.isGoldFrame) badges.push("Gold Frame");

    return `
      <div class="cf-result-card" style="--tier-c:${outColor}">
        <div class="cf-result-tier">${recipe.output.tier}</div>
        ${badges.length ? `<div class="cf-result-badge">${badges.join(" · ")}</div>` : ""}
        <div style="font-size:28px;margin-top:4px">&#9733;</div>
      </div>
      <div class="cf-fee">Fee: <strong>${recipe.fee} BM</strong></div>
    `;
  }

  // -------------------------------------------------------------------------
  // Fusion rules engine
  // -------------------------------------------------------------------------

  private canFuse(selected: FusionCard[]): FusionRecipe | null {
    if (selected.length !== 3) return null;

    const [a, b, c] = selected;
    const tierKey = a.isFoil && a.tier === "common" ? "foil_common" : a.tier;

    for (const recipe of this.getRecipes()) {
      const inputs = recipe.inputs;
      if (inputs.count !== 3) continue;

      // Check tier match
      const matchTier = inputs.tier === tierKey;
      if (!matchTier) continue;

      // Check same character
      if (inputs.sameCharacter && !(a.characterId === b.characterId && b.characterId === c.characterId)) continue;

      // Check same moment
      if (inputs.sameMoment && !(a.momentId === b.momentId && b.momentId === c.momentId)) continue;

      return recipe;
    }

    return null;
  }

  private getRecipes(): FusionRecipe[] {
    return RECIPES;
  }

  // -------------------------------------------------------------------------
  // Fusion animation + confirmation
  // -------------------------------------------------------------------------

  private async confirmFusion(): Promise<void> {
    if (!this.recipe || this.selectedCards.length !== 3) return;

    // Launch fusion stage
    const stage = document.createElement("div");
    stage.className = "cf-stage";
    document.body.appendChild(stage);
    requestAnimationFrame(() => stage.classList.add("show"));

    // Swirl cards
    const swirlWrap = document.createElement("div");
    swirlWrap.className = "cf-swirl-cards";

    this.selectedCards.forEach((card, i) => {
      const el = document.createElement("div");
      el.className = `cf-swirl-card cf-swirl-${i + 1}`;
      const col = TIER_COLORS[card.tier] ?? "#9aa3b2";
      el.innerHTML = `
        <div style="width:100%;height:100%;background:linear-gradient(145deg,#1a1f2e,#131824);border:2px solid ${col}44;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
          <div style="font-size:36px">&#9733;</div>
          <div style="font-size:11px;font-weight:800;color:${col};text-transform:uppercase">${card.tier}</div>
          <div style="font-size:12px;color:#e0e4ec">${card.characterName}</div>
        </div>
      `;
      swirlWrap.appendChild(el);
    });
    stage.appendChild(swirlWrap);

    // Orbiting particles
    for (let i = 0; i < 8; i++) {
      const p = document.createElement("div");
      p.className = "cf-orbit-particle";
      p.style.animationDelay = `${i * 0.2}s`;
      p.style.animationDuration = `${1.2 + Math.random() * 0.6}s`;
      swirlWrap.appendChild(p);
    }

    // Phase 1: Swirl
    await this.animateSwirl();

    // Phase 2: Converge particles
    const converge = new ConvergeParticles();
    converge.mount();
    const rect = swirlWrap.getBoundingClientRect();
    converge.convergeTo(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      this.selectedCards.map((c) => TIER_COLORS[c.tier] ?? "#ffd84d"),
    );

    await new Promise((r) => setTimeout(r, 800));

    // Phase 3: Merge flash + disappear cards
    const flash = document.createElement("div");
    flash.className = "cf-merge-flash";
    stage.appendChild(flash);

    swirlWrap.style.transition = "opacity .4s, transform .4s";
    swirlWrap.style.opacity = "0";
    swirlWrap.style.transform = "scale(0.5)";

    await new Promise((r) => setTimeout(r, 600));
    converge.unmount();

    // Phase 4: Result card appears
    const resultWrap = document.createElement("div");
    resultWrap.style.display = "flex";
    resultWrap.style.flexDirection = "column";
    resultWrap.style.alignItems = "center";
    resultWrap.style.gap = "16px";

    const outColor = TIER_COLORS[this.recipe.output.tier] ?? "#ffd84d";
    const badges = [this.recipe.output.isFoil ? "Foil" : "", this.recipe.output.isGoldFrame ? "Gold Frame" : ""].filter(Boolean);

    resultWrap.innerHTML = `
      <div class="cf-result-pop" style="position:relative">
        <div style="width:200px;height:280px;background:linear-gradient(145deg,#2a2040,#1a1530);border:3px solid ${outColor}66;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;box-shadow:0 0 60px 10px ${outColor}33">
          <div style="font-size:56px;filter:drop-shadow(0 0 12px ${outColor})">&#9733;</div>
          <div style="font-size:14px;font-weight:800;color:${outColor};text-transform:uppercase;letter-spacing:2px;text-shadow:0 0 8px ${outColor}55">${this.recipe.output.tier}</div>
          ${badges.length ? `<div style="font-size:11px;padding:4px 14px;border-radius:20px;background:${outColor}22;color:${outColor};border:1px solid ${outColor}44">${badges.join(" · ")}</div>` : ""}
          <div class="cf-result-glow"></div>
        </div>
      </div>
      <div style="font-size:18px;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5)">Fusion Complete!</div>
      <div style="font-size:13px;color:#7a8398">${this.recipe.output.tier}${badges.length ? ` (${badges.join(", ")})` : ""} created</div>
    `;
    stage.appendChild(resultWrap);

    await new Promise((r) => setTimeout(r, 200));

    // Done button
    const doneBtn = document.createElement("button");
    doneBtn.className = "cf-btn cf-btn-fuse";
    doneBtn.textContent = "Collect";
    doneBtn.style.marginTop = "12px";
    doneBtn.addEventListener("click", () => {
      stage.classList.remove("show");
      setTimeout(() => stage.remove(), 400);
      // Callback
      if (this.onComplete && this.recipe) {
        this.onComplete(this.recipe, this.selectedCards.map((c) => c.instanceId));
      }
      this.selectedCards = [];
      this.recipe = null;
    });
    resultWrap.appendChild(doneBtn);
  }

  private animateSwirl(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 2400));
  }

  private animateMerge(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 800));
  }

  private animateResultAppear(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 700));
  }
}
