/**
 * PackOpening.ts — BomberMeme CCG v2
 *
 * Ceremonial card pack opening experience:
 *   1. Pack appears center-screen
 *   2. Pack shakes for 1.5s
 *   3. Explosion — particles burst outward
 *   4. Cards scatter face-down in a fan
 *   5. Player clicks each card to reveal:
 *      Common = simple flip
 *      Rare   = flip + soft gold glow
 *      Epic   = flip + gold particles
 *      Legendary = flip + screen flash + rainbow particles
 *      Mythic = flip + screen shake + red/gold glow + particle storm
 *   6. Collect All + Share Pull buttons
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PackType = "basic" | "premium" | "legendary";
export type RarityReveal = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface RevealedCard {
  cardId: string;
  characterName: string;
  tier: RarityReveal;
  momentId: string;
  momentName: string;
  isNew: boolean;
}

interface PackConfig {
  cardCount: number;
  guaranteedMinTier: RarityReveal;
  shakeDuration: number;
  label: string;
  color: string;
}

const PACK_CONFIG: Record<PackType, PackConfig> = {
  basic: {
    cardCount: 3,
    guaranteedMinTier: "rare",
    shakeDuration: 1200,
    label: "Basic Pack",
    color: "#6b7280",
  },
  premium: {
    cardCount: 5,
    guaranteedMinTier: "rare",
    shakeDuration: 1500,
    label: "Premium Pack",
    color: "#4aa3ff",
  },
  legendary: {
    cardCount: 1,
    guaranteedMinTier: "epic",
    shakeDuration: 1800,
    label: "Legendary Pack",
    color: "#ffcc33",
  },
};

const RARITY_COLORS: Record<RarityReveal, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

// ---------------------------------------------------------------------------
// PackOpening class
// ---------------------------------------------------------------------------

export class PackOpening {
  private overlay: HTMLDivElement | null = null;
  private isOpening = false;
  private revealedCount = 0;
  private cards: RevealedCard[] = [];

  /** Open a pack and return the revealed cards via Promise. */
  open(packType: PackType): Promise<RevealedCard[]> {
    return new Promise((resolve) => {
      if (this.isOpening) return;
      this.isOpening = true;
      this.revealedCount = 0;

      this.cards = this.generateCards(packType);
      const config = PACK_CONFIG[packType];

      this.overlay = document.createElement("div");
      this.overlay.className = "pack-opening-view";
      this.overlay.innerHTML = this.renderPackModel(config);
      document.body.appendChild(this.overlay);

      void this.overlay.offsetWidth;
      this.overlay.classList.add("active");

      // Phase 1: shake
      const packEl = this.overlay.querySelector(".pack-model") as HTMLElement;
      this.animateShake(packEl, config.shakeDuration).then(() => {
        // Phase 2: explosion
        this.animateExplosion(config.color);

        // Phase 3: remove pack, spawn cards face-down
        setTimeout(() => {
          packEl.style.transition = "transform 0.4s ease, opacity 0.4s ease";
          packEl.style.transform = "scale(1.5)";
          packEl.style.opacity = "0";

          setTimeout(() => {
            packEl.remove();
            this.spawnCardFan(this.cards, packType);
          }, 400);
        }, 200);
      });

      // Resolve when all cards revealed
      this.on("allRevealed", () => {
        this.showSummary(this.cards, resolve);
      });
    });
  }

  close(): void {
    if (!this.overlay) return;
    this.overlay.classList.remove("active");
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
      this.isOpening = false;
    }, 300);
  }

  get isActive(): boolean {
    return this.isOpening;
  }

  // -----------------------------------------------------------------
  // Card generation (mock)
  // -----------------------------------------------------------------

  private generateCards(packType: PackType): RevealedCard[] {
    const config = PACK_CONFIG[packType];
    const result: RevealedCard[] = [];
    const names = [
      ["Pepe", "Wojak", "Chad", "Doge", "Cheems", "Shiba", "Cat", "Frog"],
      ["Trump", "Elon", "Bogdanoff", "Grumpy Cat", "Nyan Cat", "Keyboard Cat"],
      ["Frog God", "Doge God", "Bitcoin Maxi", "ETH Whale", "OG Miner"],
    ];
    const tiers: RarityReveal[] = ["common", "rare", "epic", "legendary", "mythic"];
    const moments = ["Classic", "HODL", "Pump", "Smug", "Victory", "Rage"];

    for (let i = 0; i < config.cardCount; i++) {
      const tierIdx = i === 0 ? Math.max(1, Math.floor(Math.random() * 3)) : Math.floor(Math.random() * 4);
      const tier = i === 0 ? config.guaranteedMinTier : tiers[tierIdx]!;
      const nameList = TIER_ORDER[tier] >= 3 ? names[2] : TIER_ORDER[tier] >= 2 ? names[1] : names[0];
      result.push({
        cardId: `card_${Date.now()}_${i}`,
        characterName: nameList![Math.floor(Math.random() * nameList!.length)],
        tier,
        momentId: `moment_${i}`,
        momentName: moments[Math.floor(Math.random() * moments.length)]!,
        isNew: Math.random() > 0.5,
      });
    }

    // Legendary pack: guarantee epic+ with legendary/mythic chance
    if (packType === "legendary") {
      const roll = Math.random();
      result[0]!.tier = roll > 0.95 ? "mythic" : roll > 0.7 ? "legendary" : "epic";
    }

    return result;
  }

  // -----------------------------------------------------------------
  // Render & Animation
  // -----------------------------------------------------------------

  private renderPackModel(config: PackConfig): string {
    return (
      `<div class="pack-backdrop"></div>` +
      `<div class="pack-container">` +
      `<div class="pack-model" style="--pack-color:${config.color}">` +
      `<div class="pack-face pack-front">` +
      `<div class="pack-logo">&#x1f4a3;</div>` +
      `<div class="pack-label">${config.label}</div></div>` +
      `<div class="pack-face pack-back"></div>` +
      `<div class="pack-face pack-left"></div>` +
      `<div class="pack-face pack-right"></div>` +
      `<div class="pack-face pack-top"></div>` +
      `<div class="pack-face pack-bottom"></div>` +
      `</div>` +
      `<div class="pack-hint">Opening pack...</div>` +
      `</div>`
    );
  }

  private animateShake(packEl: HTMLElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number): void => {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        const intensity = 1 - progress * 0.3; // shake dampens slightly
        const rx = Math.sin(elapsed * 0.05) * 4 * intensity;
        const ry = Math.cos(elapsed * 0.04) * 3 * intensity;
        const rz = Math.sin(elapsed * 0.03) * 2 * intensity;
        packEl.style.transform =
          `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          packEl.style.transform = "perspective(800px) rotateX(0) rotateY(0) rotateZ(0)";
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  private animateExplosion(color: string): void {
    if (!this.overlay) return;
    const container = this.overlay.querySelector(".pack-container") as HTMLElement;
    this.spawnParticles(container, 60, color, 500);
    // Screen flash
    const flash = document.createElement("div");
    flash.className = "pack-screen-flash";
    container.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
  }

  private spawnParticles(
    container: HTMLElement,
    count: number,
    color: string,
    maxDist: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "pack-particle";
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * maxDist;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const size = 3 + Math.random() * 8;
      const duration = 400 + Math.random() * 600;
      p.style.cssText =
        `width:${size}px;height:${size}px;background:${color};` +
        `border-radius:50%;position:absolute;left:50%;top:40%;` +
        `transform:translate(-50%,-50%);pointer-events:none;z-index:50;` +
        `box-shadow:0 0 ${size}px ${color};opacity:0.9;`;
      container.appendChild(p);

      const anim = p.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 0.9 },
          { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 },
        ],
        { duration, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" },
      );
      anim.onfinish = () => p.remove();
    }
  }

  private spawnCardFan(cards: RevealedCard[], packType: PackType): void {
    if (!this.overlay) return;
    const container = this.overlay.querySelector(".pack-container") as HTMLElement;
    container.innerHTML = `<div class="pack-card-fan"></div>`;
    const fan = container.querySelector(".pack-card-fan") as HTMLElement;

    cards.forEach((card, i) => {
      const spread = cards.length > 1 ? (i - (cards.length - 1) / 2) * 25 : 0;
      const el = document.createElement("div");
      el.className = "pack-card pack-card-down";
      el.dataset.index = String(i);
      el.style.cssText =
        `--card-angle:${spread}deg;--card-color:${RARITY_COLORS[card.tier]};`;
      el.innerHTML =
        `<div class="pack-card-face pack-card-front"></div>` +
        `<div class="pack-card-face pack-card-back">` +
        `<div class="pack-card-back-design">&#x1f4a3;</div></div>`;

      el.addEventListener("click", () => this.revealCard(el, card, i));
      fan.appendChild(el);
    });

    // Animate cards fanning out
    requestAnimationFrame(() => {
      fan.querySelectorAll(".pack-card").forEach((el, i) => {
        const htmlEl = el as HTMLElement;
        setTimeout(() => {
          htmlEl.classList.add("dealt");
        }, i * 120);
      });
    });

    // Show "Tap to reveal" hint
    setTimeout(() => {
      const hint = document.createElement("div");
      hint.className = "pack-reveal-hint";
      hint.textContent = "Tap cards to reveal";
      container.appendChild(hint);
    }, cards.length * 120 + 300);
  }

  private async revealCard(el: HTMLElement, card: RevealedCard, index: number): Promise<void> {
    if (el.classList.contains("revealed")) return;
    el.classList.add("revealed");

    const revealFn = this.getRevealEffect(card.tier);
    await revealFn(el, card);

    this.revealedCount++;
    if (this.revealedCount >= this.cards.length) {
      this.emit("allRevealed", null);
    }
  }

  private getRevealEffect(tier: RarityReveal): (el: HTMLElement, card: RevealedCard) => Promise<void> {
    const effects: Record<RarityReveal, (el: HTMLElement, card: RevealedCard) => Promise<void>> = {
      common: this.revealCommon.bind(this),
      rare: this.revealRare.bind(this),
      epic: this.revealEpic.bind(this),
      legendary: this.revealLegendary.bind(this),
      mythic: this.revealMythic.bind(this),
    };
    return effects[tier] ?? effects.common!;
  }

  private revealCommon(el: HTMLElement, card: RevealedCard): Promise<void> {
    return this.flipCard(el, card, 400);
  }

  private revealRare(el: HTMLElement, card: RevealedCard): Promise<void> {
    return new Promise((resolve) => {
      this.flipCard(el, card, 400).then(() => {
        // Soft gold glow
        el.style.boxShadow = `0 0 30px ${RARITY_COLORS.rare}66, 0 0 60px ${RARITY_COLORS.rare}33`;
        setTimeout(resolve, 200);
      });
    });
  }

  private revealEpic(el: HTMLElement, card: RevealedCard): Promise<void> {
    return new Promise((resolve) => {
      this.flipCard(el, card, 400).then(() => {
        // Gold particles burst
        const rect = el.getBoundingClientRect();
        const container = this.overlay?.querySelector(".pack-container") as HTMLElement;
        if (container) {
          this.spawnParticlesAt(container, rect.left + rect.width / 2, rect.top + rect.height / 2, 20, RARITY_COLORS.epic);
        }
        el.style.boxShadow = `0 0 40px ${RARITY_COLORS.epic}77, 0 0 80px ${RARITY_COLORS.epic}33`;
        setTimeout(resolve, 400);
      });
    });
  }

  private revealLegendary(el: HTMLElement, card: RevealedCard): Promise<void> {
    return new Promise((resolve) => {
      // Screen flash white
      const flash = document.createElement("div");
      flash.className = "pack-reveal-flash";
      this.overlay?.appendChild(flash);
      setTimeout(() => flash.remove(), 250);

      this.flipCard(el, card, 500).then(() => {
        const rect = el.getBoundingClientRect();
        const container = this.overlay?.querySelector(".pack-container") as HTMLElement;
        if (container) {
          // Rainbow particles
          const colors = ["#ff5a5a", "#ffcc33", "#5fd96a", "#4aa3ff", "#c879ff"];
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              this.spawnParticlesAt(container, rect.left + rect.width / 2, rect.top + rect.height / 2, 10, colors[i]!);
            }, i * 60);
          }
        }
        el.style.boxShadow = `0 0 50px ${RARITY_COLORS.legendary}88, 0 0 100px ${RARITY_COLORS.legendary}44`;
        setTimeout(resolve, 600);
      });
    });
  }

  private revealMythic(el: HTMLElement, card: RevealedCard): Promise<void> {
    return new Promise((resolve) => {
      // Screen shake
      this.overlay?.classList.add("screen-shake");
      setTimeout(() => this.overlay?.classList.remove("screen-shake"), 600);

      // Red/gold glow before flip
      el.style.boxShadow = `0 0 60px #ff5a5a88, 0 0 120px #ffcc3344`;

      this.flipCard(el, card, 600).then(() => {
        const rect = el.getBoundingClientRect();
        const container = this.overlay?.querySelector(".pack-container") as HTMLElement;
        if (container) {
          // Particle storm
          for (let i = 0; i < 8; i++) {
            setTimeout(() => {
              const color = i % 2 === 0 ? "#ff5a5a" : "#ffcc33";
              const cx = rect.left + rect.width / 2 + (Math.random() - 0.5) * 60;
              const cy = rect.top + rect.height / 2 + (Math.random() - 0.5) * 60;
              this.spawnParticlesAt(container, cx, cy, 12, color);
            }, i * 80);
          }
        }

        el.style.boxShadow = `0 0 70px #ff5a5aAA, 0 0 140px #ffcc3355, 0 0 200px #ff5a5a22`;
        // Slow-mo scale pulse
        el.animate([
          { transform: `rotateY(180deg) rotate(var(--card-angle)) scale(1)` },
          { transform: `rotateY(180deg) rotate(var(--card-angle)) scale(1.15)`, offset: 0.5 },
          { transform: `rotateY(180deg) rotate(var(--card-angle)) scale(1)` },
        ], { duration: 800, easing: "cubic-bezier(.34,1.8,.5,1)" });

        setTimeout(resolve, 900);
      });
    });
  }

  private flipCard(el: HTMLElement, card: RevealedCard, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const front = el.querySelector(".pack-card-front") as HTMLElement;
      front!.innerHTML = this.renderCardFront(card);
      el.style.transition = `transform ${duration}ms cubic-bezier(.34,1.4,.5,1)`;
      el.style.transform = `rotateY(180deg) rotate(var(--card-angle))`;
      setTimeout(resolve, duration);
    });
  }

  private renderCardFront(card: RevealedCard): string {
    const color = RARITY_COLORS[card.tier];
    const isBest = TIER_ORDER[card.tier] >= 3;
    return (
      `<div class="pack-revealed-card" style="--rarity-color:${color}">` +
      `<div class="pack-rev-art" style="background:linear-gradient(135deg,${color}44,${color}11)"></div>` +
      `<div class="pack-rev-name">${card.characterName}</div>` +
      `<div class="pack-rev-tier" style="color:${color}">${card.tier.toUpperCase()}</div>` +
      `<div class="pack-rev-moment">${card.momentName}</div>` +
      (card.isNew ? `<div class="pack-rev-new">NEW</div>` : "") +
      (isBest ? `<div class="pack-rev-glow"></div>` : "") +
      `</div>`
    );
  }

  private spawnParticlesAt(
    container: HTMLElement,
    x: number,
    y: number,
    count: number,
    color: string,
  ): void {
    const rect = container.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "pack-particle";
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 80;
      const size = 2 + Math.random() * 6;
      const duration = 300 + Math.random() * 400;
      p.style.cssText =
        `width:${size}px;height:${size}px;background:${color};border-radius:50%;` +
        `position:absolute;left:${cx}px;top:${cy}px;pointer-events:none;z-index:60;` +
        `box-shadow:0 0 ${size}px ${color};`;
      container.appendChild(p);
      const anim = p.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 0.9 },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`, opacity: 0 },
        ],
        { duration, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" },
      );
      anim.onfinish = () => p.remove();
    }
  }

  // -----------------------------------------------------------------
  // Summary screen
  // -----------------------------------------------------------------

  private showSummary(cards: RevealedCard[], resolve: (cards: RevealedCard[]) => void): void {
    if (!this.overlay) return;
    const container = this.overlay.querySelector(".pack-container") as HTMLElement;

    // Remove hint
    container.querySelector(".pack-reveal-hint")?.remove();

    // Fade out non-best cards slightly
    const bestTier = cards.reduce((best, c) =>
      TIER_ORDER[c.tier] > TIER_ORDER[best.tier] ? c : best, cards[0]!);

    container.querySelectorAll(".pack-card").forEach((el) => {
      const idx = Number((el as HTMLElement).dataset.index);
      const card = cards[idx];
      if (card && card.tier !== bestTier.tier) {
        (el as HTMLElement).style.opacity = "0.5";
      }
    });

    const summary = document.createElement("div");
    summary.className = "pack-summary";
    summary.innerHTML = (
      `<div class="pack-summary-title">Pack Opened!</div>` +
      `<div class="pack-summary-cards">${cards.map((c) =>
        `<span class="pack-summary-tag" style="color:${RARITY_COLORS[c.tier]}">${c.characterName} (${c.tier})</span>`
      ).join(" \u00b7 ")}</div>` +
      `<div class="pack-summary-actions">` +
      `<button class="pack-collect-btn">Collect All</button>` +
      (TIER_ORDER[bestTier.tier] >= 2 ? `<button class="pack-share-btn">\u2197 Share Pull</button>` : "") +
      `</div>`
    );

    container.appendChild(summary);

    summary.querySelector(".pack-collect-btn")?.addEventListener("click", () => {
      this.close();
      resolve(cards);
    });

    summary.querySelector(".pack-share-btn")?.addEventListener("click", () => {
      this.emit("sharePull", bestTier);
    });
  }

  // -----------------------------------------------------------------
  // Event helpers
  // -----------------------------------------------------------------

  private listeners: Record<string, Array<(payload: unknown) => void>> = {};

  on(event: string, cb: (payload: unknown) => void): void {
    (this.listeners[event] ??= []).push(cb);
  }

  private emit(event: string, payload: unknown): void {
    (this.listeners[event] ?? []).forEach((cb) => cb(payload));
  }
}

const TIER_ORDER: Record<RarityReveal, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4,
};

// ---------------------------------------------------------------------------
// PackOpening CSS
// ---------------------------------------------------------------------------

export function getPackOpeningCSS(): string {
  return /* css */ `
.pack-opening-view{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease}
.pack-opening-view.active{opacity:1}
.pack-backdrop{position:absolute;inset:0;background:rgba(4,6,12,.95);backdrop-filter:blur(20px)}
.pack-container{position:relative;width:100%;max-width:600px;height:400px;display:flex;align-items:center;justify-content:center;z-index:1}
.pack-model{position:relative;width:180px;height:240px;transform-style:preserve-3d;perspective:800px}
.pack-face{position:absolute;background:linear-gradient(135deg,var(--pack-color,#555),rgba(0,0,0,.6));border:1px solid rgba(255,255,255,.1)}
.pack-front{width:180px;height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;transform:translateZ(20px);border-radius:12px}
.pack-back{width:180px;height:240px;transform:translateZ(-20px) rotateY(180deg);border-radius:12px}
.pack-left{width:40px;height:240px;transform:rotateY(-90deg) translateZ(20px);left:70px}
.pack-right{width:40px;height:240px;transform:rotateY(90deg) translateZ(20px);left:70px}
.pack-top{width:180px;height:40px;transform:rotateX(90deg) translateZ(20px);top:100px}
.pack-bottom{width:180px;height:40px;transform:rotateX(-90deg) translateZ(20px);top:100px}
.pack-logo{font-size:48px;filter:drop-shadow(0 0 12px var(--pack-color))}
.pack-label{font-size:14px;font-weight:700;color:rgba(255,255,255,.8);letter-spacing:1px;text-transform:uppercase}
.pack-hint{position:absolute;bottom:40px;font-size:13px;color:rgba(255,255,255,.3);letter-spacing:.5px}
.pack-particle{will-change:transform,opacity}
.pack-screen-flash{position:absolute;inset:0;background:white;opacity:.3;pointer-events:none;z-index:100;animation:packFlash .25s ease-out forwards}
@keyframes packFlash{0%{opacity:.4}100%{opacity:0}}
.pack-card-fan{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.pack-card{position:absolute;width:140px;height:190px;border-radius:14px;transform-style:preserve-3d;cursor:pointer;transition:box-shadow .3s ease}
.pack-card-down{transform:rotateY(0deg) rotate(var(--card-angle)) scale(0.6);opacity:0}
.pack-card.dealt{transform:rotateY(0deg) rotate(var(--card-angle)) scale(1);opacity:1;transition:transform .5s cubic-bezier(.34,1.4,.5,1),opacity .4s ease}
.pack-card:hover:not(.revealed){transform:rotateY(0deg) rotate(var(--card-angle)) scale(1.08);transition:transform .25s ease}
.pack-card.revealed{cursor:default}
.pack-card-face{position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;overflow:hidden}
.pack-card-front{background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.1);transform:rotateY(180deg)}
.pack-card-back{background:linear-gradient(135deg,#1a1424,#0d0b14);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center}
.pack-card-back-design{font-size:40px;opacity:.3}
.pack-reveal-hint{position:absolute;bottom:30px;font-size:14px;color:rgba(255,255,255,.4);animation:packHintPulse 2s infinite}
@keyframes packHintPulse{0%,100%{opacity:.4}50%{opacity:.7}}
.pack-reveal-flash{position:fixed;inset:0;background:linear-gradient(135deg,rgba(255,204,51,.3),rgba(255,255,255,.2));pointer-events:none;z-index:200;animation:packFlash .4s ease-out forwards}
.pack-revealed-card{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;text-align:center;position:relative}
.pack-rev-art{position:absolute;inset:0;border-radius:14px;z-index:0}
.pack-rev-name{position:relative;z-index:1;font-size:16px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px;text-shadow:0 2px 8px rgba(0,0,0,.5)}
.pack-rev-tier{position:relative;z-index:1;font-size:11px;font-weight:700;letter-spacing:1.5px;margin-bottom:3px}
.pack-rev-moment{position:relative;z-index:1;font-size:10px;color:rgba(255,255,255,.5);font-style:italic}
.pack-rev-new{position:absolute;top:8px;right:8px;padding:3px 8px;border-radius:6px;background:rgba(95,217,106,.9);color:#0a0c14;font-size:9px;font-weight:700;letter-spacing:1px;z-index:2}
.pack-rev-glow{position:absolute;inset:-4px;border-radius:18px;background:radial-gradient(circle at center,var(--rarity-color,transparent) 0%,transparent 70%);opacity:.4;z-index:-1;animation:packGlow 2s infinite alternate}
@keyframes packGlow{0%{opacity:.3;transform:scale(1)}100%{opacity:.5;transform:scale(1.05)}}
.pack-summary{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);text-align:center;z-index:10;animation:packSummaryIn .5s ease}
@keyframes packSummaryIn{0%{opacity:0;transform:translateX(-50%) translateY(20px)}100%{opacity:1;transform:translateX(-50%) translateY(0)}}
.pack-summary-title{font-size:20px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:10px}
.pack-summary-cards{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;font-size:12px}
.pack-summary-tag{padding:4px 10px;border-radius:8px;background:rgba(255,255,255,.06);font-weight:600}
.pack-summary-actions{display:flex;gap:10px;justify-content:center}
.pack-collect-btn{padding:10px 24px;border-radius:12px;background:rgba(95,217,106,.15);border:1px solid rgba(95,217,106,.3);color:#5fd96a;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
.pack-collect-btn:hover{background:rgba(95,217,106,.25)}
.pack-share-btn{padding:10px 20px;border-radius:12px;background:rgba(74,163,255,.15);border:1px solid rgba(74,163,255,.3);color:#4aa3ff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
.pack-share-btn:hover{background:rgba(74,163,255,.25)}
.screen-shake{animation:packScreenShake .5s ease}
@keyframes packScreenShake{0%,100%{transform:translate(0)}10%{transform:translate(-8px,-4px)}20%{transform:translate(6px,3px)}30%{transform:translate(-4px,6px)}40%{transform:translate(8px,-3px)}50%{transform:translate(-6px,4px)}60%{transform:translate(4px,-6px)}70%{transform:translate(-3px,3px)}80%{transform:translate(6px,2px)}90%{transform:translate(-4px,-3px)}}
`;
}
