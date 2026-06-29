/**
 * CardFusion.ts — BomberMeme CCG v2
 *
 * Duplicate fusion system: merge 3 identical cards into 1 upgraded version.
 *
 * Recipes:
 *   3x Common (same character, same moment) → 1x Foil Common
 *   3x Foil Common (same character)         → 1x Rare Gold-Framed
 *   3x Rare (same character, same moment)   → 1x Epic Gold-Framed
 *   3x Epic (same character, same moment)   → 1x Legendary Gold-Framed
 *
 * Animation flow: select → preview → swirl → converge → merge → result pop
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FusionRecipe {
  inputs: {
    tier: string;
    count: number;
    sameCharacter: boolean;
    sameMoment: boolean;
    requireFoil?: boolean;
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

const TIER_ORDER: Record<string, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4,
};

const TIER_COLORS: Record<string, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

// ---------------------------------------------------------------------------
// Default recipes
// ---------------------------------------------------------------------------

function getRecipes(): FusionRecipe[] {
  return [
    { inputs: { tier: "common", count: 3, sameCharacter: true, sameMoment: true }, output: { tier: "common", isFoil: true, isGoldFrame: false }, fee: 100 },
    { inputs: { tier: "common", count: 3, sameCharacter: true, sameMoment: true, requireFoil: true }, output: { tier: "rare", isFoil: false, isGoldFrame: true }, fee: 500 },
    { inputs: { tier: "rare", count: 3, sameCharacter: true, sameMoment: true }, output: { tier: "epic", isFoil: false, isGoldFrame: true }, fee: 2000 },
    { inputs: { tier: "epic", count: 3, sameCharacter: true, sameMoment: true }, output: { tier: "legendary", isFoil: false, isGoldFrame: true }, fee: 10000 },
  ];
}

// ---------------------------------------------------------------------------
// CardFusion class
// ---------------------------------------------------------------------------

export class CardFusion {
  private container: HTMLElement;
  private selectedCards: FusionCard[] = [];
  private recipe: FusionRecipe | null = null;
  private availableCards: FusionCard[] = [];
  private isFusing = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(availableCards: FusionCard[]): void {
    this.availableCards = availableCards;
    this.selectedCards = [];
    this.recipe = null;
    this.container.innerHTML = this.buildHTML();
    this.attachListeners();
  }

  // -----------------------------------------------------------------
  // HTML builders
  // -----------------------------------------------------------------

  private buildHTML(): string {
    return (
      `<div class="card-fusion">` +
      `<div class="fusion-header">` +
      `<h3 class="fusion-title">Card Fusion</h3>` +
      `<p class="fusion-subtitle">Select 3 identical cards to fuse them into an upgraded version.</p></div>` +
      `<div class="fusion-selected-bar">` +
      `<span class="fusion-selected-count">${this.selectedCards.length}/3 selected</span>` +
      `<div class="fusion-selected-slots">` +
      [0, 1, 2].map((i) => {
        const card = this.selectedCards[i];
        return (
          `<div class="fusion-slot${card ? " filled" : ""}" data-slot="${i}">` +
          (card
            ? `<div class="fusion-slot-card">${card.characterName}</div>` +
              `<button class="fusion-remove" data-slot="${i}" title="Remove">\u2715</button>`
            : `<div class="fusion-slot-empty">+</div>`) +
          `</div>`
        );
      }).join("") + `</div>` +
      (this.recipe ? this.renderPreview(this.recipe) : "") +
      `</div>` +
      `<div class="fusion-grid">${this.renderCardGrid(this.availableCards)}</div>` +
      `</div>`
    );
  }

  private renderCardGrid(cards: FusionCard[]): string {
    if (cards.length === 0) {
      return `<div class="fusion-empty">No cards available for fusion.</div>`;
    }
    return cards.map((c) => {
      const isSelected = this.selectedCards.some((s) => s.instanceId === c.instanceId);
      const tierColor = TIER_COLORS[c.tier.toLowerCase()] ?? "#9aa3b2";
      const foilClass = c.isFoil ? " fusion-card-foil" : "";
      return (
        `<div class="fusion-card${isSelected ? " selected" : ""}${foilClass}" ` +
        `data-id="${c.instanceId}" style="--card-tier:${tierColor}">` +
        `<div class="fusion-card-art" style="background:${this.tierGradient(c.tier)}"></div>` +
        `<div class="fusion-card-info">` +
        `<div class="fusion-card-name">${this.esc(c.characterName)}</div>` +
        `<div class="fusion-card-meta">` +
        `<span style="color:${tierColor}">${c.tier.toUpperCase()}</span>` +
        `<span class="fusion-card-moment">${this.esc(c.momentId)}</span>` +
        (c.isFoil ? `<span class="fusion-card-foil-badge">FOIL</span>` : "") +
        `</div></div>` +
        (isSelected ? `<div class="fusion-card-check">\u2713</div>` : "") +
        `</div>`
      );
    }).join("");
  }

  private renderPreview(recipe: FusionRecipe): string {
    const outColor = TIER_COLORS[recipe.output.tier.toLowerCase()] ?? "#9aa3b2";
    return (
      `<div class="fusion-preview">` +
      `<div class="fusion-preview-arrow">\u2192</div>` +
      `<div class="fusion-preview-result" style="--result-tier:${outColor}">` +
      `<div class="fusion-preview-img" style="background:${this.tierGradient(recipe.output.tier)}"></div>` +
      `<div class="fusion-preview-tier" style="color:${outColor}">${recipe.output.tier.toUpperCase()}</div>` +
      ${recipe.output.isFoil ? `<div class="fusion-preview-badge">FOIL</div>` : ""} +
      ${recipe.output.isGoldFrame ? `<div class="fusion-preview-badge gold">GOLD FRAME</div>` : ""} +
      `</div>` +
      `<div class="fusion-preview-fee">${recipe.fee.toLocaleString()} BM</div>` +
      `<button class="fusion-confirm-btn" ${this.isFusing ? "disabled" : ""}>` +
      `${this.isFusing ? "Fusing..." : "Confirm Fusion"}</button>` +
      `</div>`
    );
  }

  // -----------------------------------------------------------------
  // Selection logic
  // -----------------------------------------------------------------

  private onCardSelect(card: FusionCard): void {
    if (this.isFusing) return;
    const idx = this.selectedCards.findIndex((c) => c.instanceId === card.instanceId);
    if (idx >= 0) {
      this.selectedCards.splice(idx, 1);
    } else if (this.selectedCards.length < 3) {
      this.selectedCards.push(card);
    }
    this.recipe = this.canFuse(this.selectedCards);
    this.refresh();
  }

  private onCardDeselect(slotIndex: number): void {
    if (this.isFusing) return;
    this.selectedCards.splice(slotIndex, 1);
    this.recipe = this.canFuse(this.selectedCards);
    this.refresh();
  }

  private canFuse(selected: FusionCard[]): FusionRecipe | null {
    if (selected.length !== 3) return null;
    const recipes = getRecipes();
    for (const recipe of recipes) {
      if (this.matchesRecipe(selected, recipe)) return recipe;
    }
    return null;
  }

  private matchesRecipe(selected: FusionCard[], recipe: FusionRecipe): boolean {
    if (selected.length !== recipe.inputs.count) return false;
    // Check all same tier
    if (!selected.every((c) => c.tier.toLowerCase() === recipe.inputs.tier.toLowerCase())) return false;
    // Check same character
    if (recipe.inputs.sameCharacter) {
      const first = selected[0]!.characterId;
      if (!selected.every((c) => c.characterId === first)) return false;
    }
    // Check same moment
    if (recipe.inputs.sameMoment) {
      const first = selected[0]!.momentId;
      if (!selected.every((c) => c.momentId === first)) return false;
    }
    // Check foil requirement
    if (recipe.inputs.requireFoil && !selected.every((c) => c.isFoil)) return false;
    return true;
  }

  private refresh(): void {
    this.container.innerHTML = this.buildHTML();
    this.attachListeners();
  }

  // -----------------------------------------------------------------
  // Fusion animation
  // -----------------------------------------------------------------

  private async animateFusion(): Promise<void> {
    if (!this.recipe || this.selectedCards.length !== 3) return;
    this.isFusing = true;

    const selectedEls = this.selectedCards.map((c) =>
      this.container.querySelector(`.fusion-card[data-id="${c.instanceId}"]`) as HTMLElement | null
    ).filter(Boolean) as HTMLElement[];

    // Highlight selected
    selectedEls.forEach((el) => el.classList.add("fusion-highlight"));

    // Disable confirm button
    const confirmBtn = this.container.querySelector(".fusion-confirm-btn") as HTMLButtonElement | null;
    if (confirmBtn) confirmBtn.disabled = true;

    await this.animateSwirl(selectedEls);
    await this.animateMerge(selectedEls);
    await this.animateResultAppear();

    this.isFusing = false;
    this.emit("fused", {
      recipe: this.recipe,
      inputCards: this.selectedCards.map((c) => c.instanceId),
    });
  }

  private animateSwirl(cardEls: HTMLElement[]): Promise<void> {
    return new Promise((resolve) => {
      const container = this.container.querySelector(".fusion-grid") as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;
      const centerY = containerRect.top + containerRect.height / 2;

      cardEls.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const elCenterX = rect.left + rect.width / 2;
        const elCenterY = rect.top + rect.height / 2;

        // Orbit animation
        el.style.transition = "none";
        el.style.position = "fixed";
        el.style.left = `${elCenterX - rect.width / 2}px`;
        el.style.top = `${elCenterY - rect.height / 2}px`;
        el.style.zIndex = "100";

        const angleOffset = (i * 120 * Math.PI) / 180;
        const startTime = performance.now();
        const duration = 1200;

        const step = (now: number): void => {
          const progress = Math.min(1, (now - startTime) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const angle = angleOffset + eased * Math.PI * 4; // 2 full rotations
          const radius = 80 * (1 - eased * 0.5); // spiral inward
          const tx = centerX + Math.cos(angle) * radius - rect.width / 2;
          const ty = centerY + Math.sin(angle) * radius - rect.height / 2;
          el.style.left = `${tx}px`;
          el.style.top = `${ty}px`;

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    });
  }

  private animateMerge(cardEls: HTMLElement[]): Promise<void> {
    return new Promise((resolve) => {
      const container = this.container.querySelector(".fusion-grid") as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;
      const centerY = containerRect.top + containerRect.height / 2;

      // Particles converge
      for (let i = 0; i < 30; i++) {
        const p = document.createElement("div");
        p.style.cssText =
          `position:fixed;width:4px;height:4px;border-radius:50%;` +
          `background:#ffcc33;box-shadow:0 0 6px #ffcc33;z-index:150;pointer-events:none;`;
        const startAngle = Math.random() * Math.PI * 2;
        const startDist = 150 + Math.random() * 100;
        const sx = centerX + Math.cos(startAngle) * startDist;
        const sy = centerY + Math.sin(startAngle) * startDist;
        p.style.left = `${sx}px`;
        p.style.top = `${sy}px`;
        document.body.appendChild(p);

        p.animate(
          [
            { transform: "translate(-50%,-50%) scale(1)", opacity: 0.8 },
            { transform: `translate(calc(-50% + ${centerX - sx}px), calc(-50% + ${centerY - sy}px)) scale(0.2)`, opacity: 0 },
          ],
          { duration: 600 + Math.random() * 300, easing: "ease-in", fill: "forwards" },
        ).onfinish = () => p.remove();
      }

      // Cards converge to center
      cardEls.forEach((el, i) => {
        setTimeout(() => {
          el.style.transition = "all 0.4s cubic-bezier(.34,1.2,.5,1)";
          el.style.left = `${centerX - 60}px`;
          el.style.top = `${centerY - 80}px`;
          el.style.transform = "scale(0.5)";
          el.style.opacity = "0";
        }, i * 80);
      });

      // Flash
      setTimeout(() => {
        const flash = document.createElement("div");
        flash.style.cssText =
          `position:fixed;left:${centerX - 50}px;top:${centerY - 50}px;` +
          `width:100px;height:100px;border-radius:50%;` +
          `background:radial-gradient(circle,#ffcc33,white);` +
          `z-index:200;pointer-events:none;box-shadow:0 0 100px #ffcc33;`;
        document.body.appendChild(flash);
        flash.animate(
          [{ transform: "translate(-50%,-50%) scale(0.5)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(4)", opacity: 0 }],
          { duration: 500, easing: "ease-out", fill: "forwards" },
        ).onfinish = () => flash.remove();
        resolve();
      }, 500);
    });
  }

  private animateResultAppear(): Promise<void> {
    return new Promise((resolve) => {
      const outColor = TIER_COLORS[this.recipe!.output.tier.toLowerCase()] ?? "#ffcc33";

      const resultEl = document.createElement("div");
      resultEl.className = "fusion-result-popup";
      resultEl.style.cssText =
        `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);` +
        `z-index:250;text-align:center;`;
      resultEl.innerHTML = (
        `<div class="fusion-result-card" style="--result-color:${outColor}">` +
        `<div class="fusion-result-glow"></div>` +
        `<div class="fusion-result-tier" style="color:${outColor}">${this.recipe!.output.tier.toUpperCase()}</div>` +
        ${this.recipe!.output.isFoil ? `<div class="fusion-result-badge">FOIL</div>` : ""} +
        ${this.recipe!.output.isGoldFrame ? `<div class="fusion-result-badge gold">GOLD FRAME</div>` : ""} +
        `</div>` +
        `<div class="fusion-result-title">Fusion Complete!</div>` +
        `<button class="fusion-result-close">Awesome</button>`
      );

      document.body.appendChild(resultEl);

      // Entry animation
      resultEl.animate(
        [{ transform: "translate(-50%,-50%) scale(0.5)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }],
        { duration: 500, easing: "cubic-bezier(.34,1.8,.5,1)", fill: "forwards" },
      );

      resultEl.querySelector(".fusion-result-close")?.addEventListener("click", () => {
        resultEl.remove();
        // Restore card positions
        const grid = this.container.querySelector(".fusion-grid") as HTMLElement;
        grid.querySelectorAll(".fusion-card").forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.position = "";
          htmlEl.style.left = "";
          htmlEl.style.top = "";
          htmlEl.style.zIndex = "";
          htmlEl.style.transform = "";
        });
        this.selectedCards = [];
        this.recipe = null;
        this.refresh();
        resolve();
      });
    });
  }

  // -----------------------------------------------------------------
  // Event handling
  // -----------------------------------------------------------------

  private attachListeners(): void {
    this.container.querySelectorAll(".fusion-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.id;
        const card = this.availableCards.find((c) => c.instanceId === id);
        if (card) this.onCardSelect(card);
      });
    });

    this.container.querySelectorAll(".fusion-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const slot = Number((btn as HTMLElement).dataset.slot);
        this.onCardDeselect(slot);
      });
    });

    this.container.querySelector(".fusion-confirm-btn")?.addEventListener("click", () => {
      if (this.recipe && !this.isFusing) this.animateFusion();
    });
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
// CardFusion CSS
// ---------------------------------------------------------------------------

export function getCardFusionCSS(): string {
  return /* css */ `
.card-fusion{padding:16px 20px;max-width:900px;margin:0 auto}
.fusion-header{margin-bottom:20px}
.fusion-title{font-size:20px;font-weight:700;color:rgba(255,255,255,.9);margin:0 0 6px}
.fusion-subtitle{font-size:13px;color:rgba(255,255,255,.4);margin:0}
.fusion-selected-bar{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:14px;margin-bottom:16px}
.fusion-selected-count{font-size:12px;color:rgba(255,255,255,.5);margin-bottom:10px;display:block}
.fusion-selected-slots{display:flex;gap:10px;margin-bottom:12px}
.fusion-slot{width:80px;height:100px;border-radius:12px;border:2px dashed rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;position:relative;transition:all .2s}
.fusion-slot.filled{border-style:solid;border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.04)}
.fusion-slot-empty{font-size:24px;color:rgba(255,255,255,.15)}
.fusion-slot-card{font-size:11px;color:rgba(255,255,255,.7);text-align:center;padding:4px}
.fusion-remove{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(255,90,90,.8);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
.fusion-remove:hover{background:#ff5a5a}
.fusion-preview{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
.fusion-preview-arrow{font-size:20px;color:rgba(255,255,255,.3)}
.fusion-preview-result{position:relative;width:90px;height:120px;border-radius:12px;background:rgba(255,255,255,.05);border:2px solid var(--result-tier,rgba(255,255,255,.15));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.fusion-preview-img{position:absolute;inset:0;border-radius:12px;opacity:.3}
.fusion-preview-tier{font-size:11px;font-weight:700;letter-spacing:1px;position:relative;z-index:1}
.fusion-preview-badge{font-size:8px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);position:relative;z-index:1}
.fusion-preview-badge.gold{background:rgba(255,204,51,.15);color:#ffcc33}
.fusion-preview-fee{font-size:13px;color:rgba(255,255,255,.5);font-family:var(--font-mono,monospace)}
.fusion-confirm-btn{padding:10px 24px;border-radius:12px;background:rgba(255,204,51,.15);border:1px solid rgba(255,204,51,.3);color:#ffcc33;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
.fusion-confirm-btn:hover:not(:disabled){background:rgba(255,204,51,.25)}
.fusion-confirm-btn:disabled{opacity:.3;cursor:not-allowed}
.fusion-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.fusion-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:10px;cursor:pointer;transition:all .2s;position:relative}
.fusion-card:hover{border-color:rgba(255,255,255,.14);transform:translateY(-2px)}
.fusion-card.selected{border-color:var(--card-tier,#4aa3ff);background:rgba(255,255,255,.06);box-shadow:0 0 12px var(--card-tier)22}
.fusion-card-foil .fusion-card-art{box-shadow:inset 0 0 10px rgba(255,215,0,.2)}
.fusion-highlight{box-shadow:0 0 20px #ffcc3366!important;border-color:#ffcc33!important}
.fusion-card-art{width:100%;aspect-ratio:3/4;border-radius:8px;margin-bottom:8px;position:relative}
.fusion-card-info{display:flex;flex-direction:column;gap:2px}
.fusion-card-name{font-size:12px;font-weight:600;color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fusion-card-meta{display:flex;gap:6px;align-items:center;font-size:10px;flex-wrap:wrap}
.fusion-card-moment{color:rgba(255,255,255,.35)}
.fusion-card-foil-badge{font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(255,215,0,.15);color:#ffd700;font-weight:600}
.fusion-card-check{position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;background:var(--card-tier,#4aa3ff);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center}
.fusion-empty{text-align:center;padding:40px;color:rgba(255,255,255,.25);font-size:13px}
.fusion-result-popup{pointer-events:auto}
.fusion-result-card{width:160px;height:220px;margin:0 auto 20px;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:2px solid var(--result-color,rgba(255,255,255,.15));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;position:relative}
.fusion-result-glow{position:absolute;inset:-20px;border-radius:24px;background:radial-gradient(circle at center,var(--result-color,transparent) 0%,transparent 70%);opacity:.3;animation:fusionGlow 2s infinite alternate;z-index:-1}
@keyframes fusionGlow{0%{opacity:.2}100%{opacity:.4}}
.fusion-result-tier{font-size:18px;font-weight:700;letter-spacing:2px}
.fusion-result-badge{font-size:10px;padding:4px 12px;border-radius:8px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.8)}
.fusion-result-badge.gold{background:rgba(255,204,51,.15);color:#ffcc33}
.fusion-result-title{font-size:22px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:16px}
.fusion-result-close{padding:10px 32px;border-radius:12px;background:rgba(95,217,106,.15);border:1px solid rgba(95,217,106,.3);color:#5fd96a;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
.fusion-result-close:hover{background:rgba(95,217,106,.25)}
@media(max-width:700px){.usion-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}}
`;
}
