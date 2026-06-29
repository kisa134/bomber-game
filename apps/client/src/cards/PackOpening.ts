/**
 * PackOpening.ts — Ceremonial card pack opening system for BomberMeme CCG v2.
 *
 * Flow:
 *   1. Dark overlay + 3D pack appears center
 *   2. Pack shakes with anticipation (CSS animation)
 *   3. EXPLOSION — particles burst (Canvas 2D)
 *   4. Cards fly out face-down in a fan
 *   5. Player clicks each card to reveal (flip by rarity)
 *   6. "Collect All" + "Share Pull" buttons
 *
 * Technical: ESM, strict TypeScript, CSS animations + Canvas 2D only.
 * All overlays are injected into document.body and cleaned up on close.
 */

import { ASSET_VER } from "../game/assets.js";

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

// ---------------------------------------------------------------------------
// Pack configuration
// ---------------------------------------------------------------------------

const PACK_CONFIG: Record<
  PackType,
  { cardCount: number; guaranteedRarity: RarityReveal | null; epicChance: number; legendaryChance: number; mythicChance: number }
> = {
  basic: { cardCount: 3, guaranteedRarity: "rare", epicChance: 0.08, legendaryChance: 0.01, mythicChance: 0.0 },
  premium: { cardCount: 5, guaranteedRarity: "rare", epicChance: 0.25, legendaryChance: 0.05, mythicChance: 0.005 },
  legendary: { cardCount: 1, guaranteedRarity: "epic", epicChance: 1.0, legendaryChance: 0.2, mythicChance: 0.02 },
};

const PACK_COLORS: Record<PackType, { primary: string; secondary: string; accent: string }> = {
  basic: { primary: "#5a8a5a", secondary: "#3a5a3a", accent: "#7fcf7f" },
  premium: { primary: "#5a6a9a", secondary: "#3a4a6a", accent: "#7fa0ff" },
  legendary: { primary: "#9a7a2a", secondary: "#6a5020", accent: "#ffd84d" },
};

const RARITY_COLORS: Record<RarityReveal, string> = {
  common: "#9aa3b2",
  rare: "#4aa3ff",
  epic: "#c879ff",
  legendary: "#ffcc33",
  mythic: "#ff5a5a",
};

const RARITY_WEIGHTS: Record<RarityReveal, number> = {
  common: 60,
  rare: 25,
  epic: 10,
  legendary: 4,
  mythic: 1,
};

// ---------------------------------------------------------------------------
// Tier utilities
// ---------------------------------------------------------------------------

function rollRarity(pack: PackType, _index: number): RarityReveal {
  const cfg = PACK_CONFIG[pack];
  const roll = Math.random();
  if (roll < cfg.mythicChance) return "mythic";
  if (roll < cfg.legendaryChance + cfg.mythicChance) return "legendary";
  if (roll < cfg.epicChance + cfg.legendaryChance + cfg.mythicChance) return "epic";
  if (roll < 0.5) return "rare";
  return "common";
}

function tierRank(t: RarityReveal): number {
  return ["common", "rare", "epic", "legendary", "mythic"].indexOf(t);
}

function pickCharacter(): { id: string; name: string } {
  // Placeholder: will be replaced with real character pool
  const NAMES = [
    "Shiba", "Pepe", "Trump", "Musk", "Doge", "Pump", "Durov",
    "Vitalik", "Troll", "Bogdanoff", "Gigachad", "Nyan", "Grumpy",
    "Harambe", "Shrek", "Wojak", "NPC", "Chad",
  ];
  const i = Math.floor(Math.random() * NAMES.length);
  return { id: `char_${i}`, name: NAMES[i] };
}

function pickMoment(): { id: string; name: string } {
  const MOMENTS = [
    { id: "classic", name: "Classic" },
    { id: "standard_1", name: "Standard I" },
    { id: "standard_2", name: "Standard II" },
    { id: "secret", name: "Secret" },
  ];
  return MOMENTS[Math.floor(Math.random() * MOMENTS.length)];
}

// ---------------------------------------------------------------------------
// CSS injection (scoped to pack-opening)
// ---------------------------------------------------------------------------

const STYLE_ID = "pack-opening-styles";

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .po-overlay{position:fixed;inset:0;z-index:1000;background:rgba(5,6,10,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-ui,system-ui,-apple-system,sans-serif);opacity:0;transition:opacity .4s ease}
    .po-overlay.show{opacity:1}
    .po-overlay.closing{opacity:0}
    .po-pack-wrap{perspective:900px;margin-bottom:24px}
    .po-pack{position:relative;width:200px;height:260px;transform-style:preserve-3d;animation:po-pack-idle 3s ease-in-out infinite}
    .po-pack-face{position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5);border:2px solid rgba(255,255,255,.1)}
    .po-pack-front{background:linear-gradient(135deg,var(--pk-p),var(--pk-s));box-shadow:0 20px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.15)}
    .po-pack-back{background:linear-gradient(135deg,var(--pk-s),var(--pk-p));transform:rotateY(180deg)}
    .po-pack-top{position:absolute;top:0;left:12px;right:12px;height:24px;background:linear-gradient(180deg,var(--pk-a),var(--pk-p));transform-origin:top;transform:rotateX(-90deg);border-radius:4px 4px 0 0}
    .po-pack-right{position:absolute;top:12px;right:0;bottom:12px;width:24px;background:linear-gradient(270deg,var(--pk-a),var(--pk-s));transform-origin:right;transform:rotateY(90deg);border-radius:0 4px 4px 0}
    .po-pack-label{font-size:28px;letter-spacing:2px;text-transform:uppercase}
    .po-pack-stars{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:14px}
    .po-pack-stars i{position:absolute;width:3px;height:3px;background:#fff;border-radius:50%;opacity:.4;animation:po-star-twinkle 2s infinite}
    @keyframes po-pack-idle{0%,100%{transform:translateY(0) rotateY(0)}50%{transform:translateY(-8px) rotateY(5deg)}}
    @keyframes po-shake{0%{transform:translate(0,0) rotate(0)}15%{transform:translate(-8px,4px) rotate(-4deg)}30%{transform:translate(8px,-4px) rotate(4deg)}45%{transform:translate(-6px,6px) rotate(-3deg)}60%{transform:translate(6px,-6px) rotate(3deg)}75%{transform:translate(-4px,4px) rotate(-2deg)}90%{transform:translate(4px,-2px) rotate(1deg)}100%{transform:translate(0,0) rotate(0)}}
    .po-shake{animation:po-shake .18s ease-in-out 8!important}
    @keyframes po-star-twinkle{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:.6;transform:scale(1.2)}}
    .po-particles{position:fixed;inset:0;z-index:1001;pointer-events:none}
    .po-fan{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;padding:0 20px;max-width:900px}
    .po-card-slot{perspective:700px;width:180px;height:252px;position:relative}
    .po-card-el{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.34,1.4,.4,1);cursor:pointer}
    .po-card-el.flipped{transform:rotateY(180deg)}
    .po-card-el:hover{transform:translateY(-8px) scale(1.04)}
    .po-card-el.flipped:hover{transform:rotateY(180deg) translateY(-8px) scale(1.04)}
    .po-card-face{position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;overflow:hidden}
    .po-card-front{background:linear-gradient(145deg,#1a1f2e,#0f131e);border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
    .po-card-back{background:linear-gradient(145deg,#2a2040,#1a1028);border:1px solid rgba(255,255,255,.12);transform:rotateY(180deg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
    .po-card-back .po-rarity-icon{font-size:48px;filter:drop-shadow(0 0 12px var(--rarity-c))}
    .po-card-back .po-rarity-name{color:var(--rarity-c);font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1px;text-shadow:0 0 8px var(--rarity-c)}
    .po-card-back .po-char-name{color:#e0e4ec;font-weight:700;font-size:15px}
    .po-card-back .po-moment-name{color:#8b93a8;font-size:11px}
    .po-card-back .po-new-badge{background:linear-gradient(90deg,#5fe08a,#3abf5a);color:#fff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:1px}
    .po-card-img{width:100%;height:100%;object-fit:cover;border-radius:14px}
    .po-back-pattern{position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(255,255,255,.02) 8px,rgba(255,255,255,.02) 16px);border-radius:14px}
    .po-back-seal{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:60px;height:60px;border:2px solid rgba(255,255,255,.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;opacity:.6}
    .po-back-text{position:absolute;top:16px;left:0;right:0;text-align:center;color:rgba(255,255,255,.25);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase}
    .po-reveal-glow{position:absolute;inset:-20px;border-radius:24px;opacity:0;pointer-events:none;z-index:-1}
    @keyframes po-glow-pulse{0%,100%{opacity:0;transform:scale(.95)}50%{opacity:1;transform:scale(1)}}
    .po-glow-rare .po-reveal-glow{box-shadow:0 0 40px 8px ${RARITY_COLORS.rare}44,0 0 80px 16px ${RARITY_COLORS.rare}22;animation:po-glow-pulse 2s ease-in-out 3}
    .po-glow-epic .po-reveal-glow{box-shadow:0 0 50px 12px ${RARITY_COLORS.epic}55,0 0 100px 24px ${RARITY_COLORS.epic}28;animation:po-glow-pulse 1.5s ease-in-out 4}
    @keyframes po-flash{0%{opacity:0}20%{opacity:.9}100%{opacity:0}}
    .po-flash-legendary::before{content:"";position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:1002;animation:po-flash .6s ease-out}
    @keyframes po-shake-screen{0%,100%{transform:translate(0)}20%{transform:translate(-6px,4px)}40%{transform:translate(6px,-3px)}60%{transform:translate(-4px,5px)}80%{transform:translate(4px,-4px)}}
    .po-shake-mythic{animation:po-shake-screen .5s ease-in-out 3}
    .po-glow-mythic .po-reveal-glow{box-shadow:0 0 60px 20px ${RARITY_COLORS.mythic}66,0 0 120px 40px #ff2e4d44,0 0 180px 60px rgba(255,200,50,.15);animation:po-glow-pulse 1.2s ease-in-out 5}
    .po-title{color:#fff;font-size:22px;font-weight:800;margin-bottom:16px;text-shadow:0 2px 12px rgba(0,0,0,.5)}
    .po-actions{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap;justify-content:center}
    .po-btn{cursor:pointer;border:none;padding:12px 28px;border-radius:14px;font-weight:800;font-size:14px;letter-spacing:.5px;transition:transform .15s,box-shadow .2s;text-transform:uppercase}
    .po-btn:hover{transform:translateY(-2px)}
    .po-btn:active{transform:translateY(0)}
    .po-btn-primary{background:linear-gradient(90deg,#ffd84d,#ff9a3d);color:#1a1205;box-shadow:0 4px 20px rgba(255,150,50,.3)}
    .po-btn-secondary{background:rgba(255,255,255,.08);color:#e0e4ec;border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px)}
    .po-btn-glass{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(16px);padding:10px 22px;font-size:13px}
    .po-summary{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px;max-width:700px}
    .po-summary-chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:6px 14px;font-size:12px;color:#b0b8c8;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px)}
    .po-summary-chip .dot{width:8px;height:8px;border-radius:50%}
    .po-skip-hint{position:absolute;bottom:20px;color:rgba(255,255,255,.35);font-size:12px;pointer-events:none}
    @media(max-width:640px){.po-card-slot{width:140px;height:196px}.po-fan{gap:8px}.po-pack{width:160px;height:208px}}
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Particle system (Canvas 2D)
// ---------------------------------------------------------------------------

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
  size: number; color: string; alpha: number; decay: number; gravity: number;
}

class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private running = false;
  private rafId = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "po-particles";
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  mount(): void {
    document.body.appendChild(this.canvas);
  }

  unmount(): void {
    this.canvas.remove();
    cancelAnimationFrame(this.rafId);
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(cx: number, cy: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        life: 1, maxLife: 30 + Math.random() * 60,
        size: 1 + Math.random() * 4,
        color, alpha: 0.8 + Math.random() * 0.2, decay: 0.008 + Math.random() * 0.015,
        gravity: 0.05 + Math.random() * 0.1,
      });
    }
    if (!this.running) this.loop();
  }

  rainbowBurst(cx: number, cy: number, count: number): void {
    const colors = ["#ff5a8a", "#ffd84d", "#5ad27a", "#7fd8ff", "#b07cff", "#ff9a3d", "#ff5a5a"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 10;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
        life: 1, maxLife: 40 + Math.random() * 70,
        size: 1.5 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1, decay: 0.006 + Math.random() * 0.012,
        gravity: 0.04 + Math.random() * 0.08,
      });
    }
    if (!this.running) this.loop();
  }

  converge(sx: number, sy: number, tx: number, ty: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      this.particles.push({
        x: sx + (tx - sx) * t + (Math.random() - 0.5) * 100,
        y: sy + (ty - sy) * t + (Math.random() - 0.5) * 100,
        vx: 0, vy: 0,
        life: 1, maxLife: 30 + Math.random() * 30,
        size: 2 + Math.random() * 3,
        color, alpha: 0.9, decay: 0.02,
        gravity: 0,
      });
    }
    // Animate toward target in loop via lerp
    if (!this.running) this.loop();
  }

  private loop = (): void => {
    this.running = true;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = "lighter";

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const a = Math.max(0, p.life);
      ctx.globalAlpha = a * p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (this.particles.length > 0) {
      this.rafId = requestAnimationFrame(this.loop);
    } else {
      this.running = false;
    }
  };

  clear(): void {
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// ---------------------------------------------------------------------------
// Card back HTML (face-down reveal)
// ---------------------------------------------------------------------------

function cardBackHTML(): string {
  return (
    `<div class="po-back-pattern"></div>` +
    `<div class="po-back-text">BomberMeme</div>` +
    `<div class="po-back-seal">&#128163;</div>`
  );
}

// ---------------------------------------------------------------------------
// Main PackOpening class
// ---------------------------------------------------------------------------

export class PackOpening {
  private overlay: HTMLDivElement | null = null;
  private particles: ParticleSystem | null = null;
  private isOpening = false;
  private revealedCount = 0;

  /** Main entry: start the pack opening ceremony. Returns revealed cards. */
  async open(packType: PackType): Promise<RevealedCard[]> {
    if (this.isOpening) return [];
    this.isOpening = true;
    this.revealedCount = 0;

    injectStyles();
    this.particles = new ParticleSystem();
    this.particles.mount();

    // Build the overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "po-overlay";
    document.body.appendChild(this.overlay);

    // Fade in
    requestAnimationFrame(() => this.overlay!.classList.add("show"));

    // --- Step 1: Show pack ---
    const packEl = this.renderPackModel(packType);
    this.overlay.appendChild(packEl);

    // Pack title
    const titleEl = document.createElement("div");
    titleEl.className = "po-title";
    titleEl.textContent = `${packType.charAt(0).toUpperCase() + packType.slice(1)} Pack`;
    this.overlay.appendChild(titleEl);

    // Skip hint
    const skipHint = document.createElement("div");
    skipHint.className = "po-skip-hint";
    skipHint.textContent = "Opening pack...";
    this.overlay.appendChild(skipHint);

    // Shake phase
    await this.animateShake(packEl);

    // --- Step 2: EXPLOSION ---
    await this.animateExplosion(packType);

    // Remove pack & title
    packEl.remove();
    titleEl.remove();
    skipHint.remove();

    // --- Step 3: Generate cards ---
    const cfg = PACK_CONFIG[packType];
    const cards: RevealedCard[] = [];
    for (let i = 0; i < cfg.cardCount; i++) {
      const char = pickCharacter();
      const moment = pickMoment();
      const rarity = rollRarity(packType, i);
      cards.push({
        cardId: `${char.id}_${moment.id}_${Date.now()}_${i}`,
        characterName: char.name,
        tier: rarity,
        momentId: moment.id,
        momentName: moment.name,
        isNew: Math.random() > 0.3,
      });
    }

    // Sort by rarity descending for presentation
    cards.sort((a, b) => tierRank(b.tier) - tierRank(a.tier));

    // --- Step 4: Card fan (face-down) ---
    const cardEls = this.createCardFan(cards);
    const fanContainer = document.createElement("div");
    fanContainer.className = "po-fan";
    cardEls.forEach((el) => fanContainer.appendChild(el));
    this.overlay.appendChild(fanContainer);

    // Instruction
    const instrEl = document.createElement("div");
    instrEl.className = "po-title";
    instrEl.textContent = "Click cards to reveal!";
    instrEl.style.fontSize = "16px";
    instrEl.style.opacity = "0.7";
    instrEl.style.marginTop = "12px";
    this.overlay.appendChild(instrEl);

    // --- Step 5: Wait for all reveals ---
    await this.setupRevealInteraction(cardEls, cards, instrEl);

    // --- Step 6: Summary ---
    instrEl.textContent = "Your pulls!";
    instrEl.style.opacity = "1";
    instrEl.style.fontSize = "20px";

    const summaryEl = document.createElement("div");
    summaryEl.className = "po-summary";
    summaryEl.innerHTML = this.renderSummary(cards);
    this.overlay.appendChild(summaryEl);

    // Actions
    const actionsEl = document.createElement("div");
    actionsEl.className = "po-actions";

    const collectBtn = document.createElement("button");
    collectBtn.className = "po-btn po-btn-primary";
    collectBtn.textContent = "Collect All";
    collectBtn.addEventListener("click", () => this.close());

    const shareBtn = document.createElement("button");
    shareBtn.className = "po-btn po-btn-glass";
    shareBtn.textContent = "Share Pull";
    const bestCard = cards.reduce((best, c) => (tierRank(c.tier) > tierRank(best.tier) ? c : best), cards[0]);
    shareBtn.addEventListener("click", () => {
      // Dispatch event for ShareCard integration
      window.dispatchEvent(new CustomEvent("pack:share-pull", { detail: bestCard }));
    });

    actionsEl.append(collectBtn, shareBtn);
    this.overlay.appendChild(actionsEl);

    // Wait for close
    return new Promise((resolve) => {
      const onClose = () => {
        this.close();
        resolve(cards);
      };
      collectBtn.addEventListener("click", onClose);
    });
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private renderPackModel(packType: PackType): HTMLElement {
    const colors = PACK_COLORS[packType];
    const wrap = document.createElement("div");
    wrap.className = "po-pack-wrap";

    const pack = document.createElement("div");
    pack.className = "po-pack";
    pack.style.setProperty("--pk-p", colors.primary);
    pack.style.setProperty("--pk-s", colors.secondary);
    pack.style.setProperty("--pk-a", colors.accent);

    // Stars decoration
    const stars = document.createElement("div");
    stars.className = "po-pack-stars";
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("i");
      s.style.left = `${10 + Math.random() * 80}%`;
      s.style.top = `${10 + Math.random() * 80}%`;
      s.style.animationDelay = `${Math.random() * 2}s`;
      stars.appendChild(s);
    }

    const front = document.createElement("div");
    front.className = "po-pack-face po-pack-front";
    front.innerHTML = `<span class="po-pack-label">${packType}</span>`;
    front.appendChild(stars.cloneNode(true));

    const back = document.createElement("div");
    back.className = "po-pack-face po-pack-back";
    back.innerHTML = `<span class="po-pack-label" style="opacity:.3">BM</span>`;

    const top = document.createElement("div");
    top.className = "po-pack-top";

    const right = document.createElement("div");
    right.className = "po-pack-right";

    pack.append(front, back, top, right);
    wrap.appendChild(pack);
    return wrap;
  }

  // -------------------------------------------------------------------------
  // Animations
  // -------------------------------------------------------------------------

  private animateShake(packEl: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const pack = packEl.querySelector(".po-pack") as HTMLElement;
      if (!pack) { resolve(); return; }
      pack.classList.add("po-shake");
      setTimeout(() => {
        pack.classList.remove("po-shake");
        resolve();
      }, 1500);
    });
  }

  private animateExplosion(packType: PackType): Promise<void> {
    return new Promise((resolve) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const colors = PACK_COLORS[packType];

      // Multi-phase explosion
      this.spawnParticles(40, colors.primary);
      this.spawnParticles(30, colors.accent);
      this.spawnParticles(20, "#ffffff");

      // Center flash
      if (this.particles) {
        this.particles.burst(cx, cy, 60, colors.accent);
        this.particles.burst(cx, cy, 40, "#ffffff");
      }

      setTimeout(resolve, 600);
    });
  }

  private spawnParticles(count: number, color: string): void {
    if (!this.particles) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.particles.burst(cx, cy, count, color);
  }

  // -------------------------------------------------------------------------
  // Card fan
  // -------------------------------------------------------------------------

  private createCardFan(cards: RevealedCard[]): HTMLElement[] {
    return cards.map((card, i) => {
      const slot = document.createElement("div");
      slot.className = "po-card-slot";
      slot.style.animationDelay = `${i * 0.1}s`;

      const cardEl = document.createElement("div");
      cardEl.className = "po-card-el";
      cardEl.dataset.tier = card.tier;
      cardEl.dataset.revealed = "false";

      // Front (card back — face-down)
      const front = document.createElement("div");
      front.className = "po-card-face po-card-front";
      front.innerHTML = cardBackHTML();

      // Back (card face — revealed)
      const back = document.createElement("div");
      back.className = "po-card-face po-card-back";
      back.style.setProperty("--rarity-c", RARITY_COLORS[card.tier]);
      back.innerHTML = `
        <div class="po-reveal-glow"></div>
        <div class="po-rarity-icon">${this.tierIcon(card.tier)}</div>
        <div class="po-rarity-name">${card.tier}</div>
        <div class="po-char-name">${card.characterName}</div>
        <div class="po-moment-name">${card.momentName}</div>
        ${card.isNew ? '<div class="po-new-badge">New</div>' : ""}
      `;

      cardEl.append(front, back);
      slot.appendChild(cardEl);

      // Click to reveal
      cardEl.addEventListener("click", () => {
        if (cardEl.dataset.revealed === "true") return;
        cardEl.dataset.revealed = "true";
        void this.animateCardReveal(cardEl, card.tier);
      });

      return slot;
    });
  }

  private tierIcon(tier: RarityReveal): string {
    const icons: Record<RarityReveal, string> = {
      common: "&#9679;", rare: "&#9670;", epic: "&#9733;", legendary: "&#9733;", mythic: "&#9670;",
    };
    return icons[tier];
  }

  private async animateCardReveal(cardEl: HTMLElement, tier: RarityReveal): Promise<void> {
    // Flip
    cardEl.classList.add("flipped");

    // Rarity-specific effects
    await new Promise((r) => setTimeout(r, 300)); // half-way through flip

    switch (tier) {
      case "common":
        // Simple flip — no extra effects
        break;
      case "rare":
        cardEl.classList.add("po-glow-rare");
        break;
      case "epic":
        cardEl.classList.add("po-glow-epic");
        if (this.particles) {
          const rect = cardEl.getBoundingClientRect();
          this.particles.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 30, RARITY_COLORS.epic);
        }
        break;
      case "legendary":
        this.overlay?.classList.add("po-flash-legendary");
        cardEl.classList.add("po-glow-epic");
        if (this.particles) {
          const rect = cardEl.getBoundingClientRect();
          this.particles.rainbowBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 50);
        }
        setTimeout(() => this.overlay?.classList.remove("po-flash-legendary"), 600);
        break;
      case "mythic":
        this.overlay?.classList.add("po-shake-mythic");
        cardEl.classList.add("po-glow-mythic");
        if (this.particles) {
          const rect = cardEl.getBoundingClientRect();
          this.particles.rainbowBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 80);
          this.particles.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 40, "#ff2e4d");
        }
        setTimeout(() => this.overlay?.classList.remove("po-shake-mythic"), 1500);
        break;
    }

    this.revealedCount++;
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  private setupRevealInteraction(cardEls: HTMLElement[], cards: RevealedCard[], _instrEl: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const checkAllRevealed = () => {
        const allRevealed = cardEls.every((slot) => {
          const card = slot.querySelector(".po-card-el") as HTMLElement;
          return card?.dataset.revealed === "true";
        });
        if (allRevealed) {
          // Auto-reveal any remaining after 2s
          resolve();
        }
      };

      // Poll for all revealed
      const interval = setInterval(() => {
        const allDone = cardEls.every((slot) => {
          const card = slot.querySelector(".po-card-el") as HTMLElement;
          return card?.dataset.revealed === "true";
        });
        if (allDone) {
          clearInterval(interval);
          resolve();
        }
      }, 200);

      // Also resolve after 8 seconds regardless (timeout)
      setTimeout(() => {
        clearInterval(interval);
        // Auto-flip any unrevealed
        cardEls.forEach((slot) => {
          const card = slot.querySelector(".po-card-el") as HTMLElement;
          if (card && card.dataset.revealed !== "true") {
            const idx = cardEls.indexOf(slot);
            card.dataset.revealed = "true";
            void this.animateCardReveal(card, cards[idx]?.tier ?? "common");
          }
        });
        setTimeout(resolve, 500);
      }, 8000);

      cardEls.forEach((slot) => {
        const card = slot.querySelector(".po-card-el") as HTMLElement;
        card?.addEventListener("click", checkAllRevealed);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  private renderSummary(cards: RevealedCard[]): string {
    const counts: Partial<Record<RarityReveal, number>> = {};
    for (const c of cards) counts[c.tier] = (counts[c.tier] ?? 0) + 1;

    return (Object.entries(counts) as [RarityReveal, number][])
      .sort((a, b) => tierRank(b[0]) - tierRank(a[0]))
      .map(([tier, count]) => {
        const col = RARITY_COLORS[tier];
        return `<div class="po-summary-chip"><span class="dot" style="background:${col};box-shadow:0 0 6px ${col}"></span>${tier.charAt(0).toUpperCase() + tier.slice(1)} x${count}</div>`;
      })
      .join("");
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  private close(): void {
    if (!this.overlay) return;
    this.overlay.classList.add("closing");
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
      this.particles?.unmount();
      this.particles = null;
      this.isOpening = false;
    }, 400);
  }
}
