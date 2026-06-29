// Cards hub — wires the (previously orphaned) card system into the game: a single
// overlay with Collection / Market / Open-Pack tabs. Injects each module's CSS,
// builds the collection from the set definitions, tracks owned cards in localStorage,
// and lets packs grant new cards. This is the "подключение" the card modules needed.
import { CollectionView, getCollectionCSS, type CollectionCard } from "../cards/CollectionView.js";
import { MarketView, getMarketCSS } from "../cards/MarketView.js";
import { PackOpening, getPackOpeningCSS, type PackType } from "../cards/PackOpening.js";
import { InspectView, getInspectCSS, type InspectCardData } from "../cards/InspectView.js";
import { CardFusion, getCardFusionCSS, type FusionCard } from "../cards/CardFusion.js";
import { getAgingCSS } from "../cards/CardAging.js";
import { getAllSetIds, getSetCharacters, getSetDefinition, type CardInSet, type SetId } from "../cards/SetDefinitions.js";

const OWNED_KEY = "bp_cards_owned";
let cssInjected = false;
let overlay: HTMLDivElement | null = null;
let activeTab: "collection" | "market" | "packs" | "forge" = "collection";

function injectCSS(): void {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement("style");
  style.id = "cards-hub-css";
  style.textContent = [getCollectionCSS(), getMarketCSS(), getPackOpeningCSS(), getInspectCSS(), getCardFusionCSS(), getAgingCSS()].join("\n");
  document.head.appendChild(style);
}

function loadOwned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || "[]") as string[]); } catch { return new Set(); }
}
function saveOwned(owned: Set<string>): void {
  try { localStorage.setItem(OWNED_KEY, JSON.stringify([...owned])); } catch { /* ignore */ }
}

/** Build the full collection (every card in every set), marking owned ones. */
function buildCollection(owned: Set<string>): CollectionCard[] {
  const out: CollectionCard[] = [];
  for (const setId of getAllSetIds()) {
    for (const c of getSetCharacters(setId)) {
      const isOwned = owned.has(c.characterName);
      out.push({
        characterId: c.characterId,
        characterName: c.characterName,
        tier: c.tier,
        setId,
        owned: isOwned,
        ownedMoments: isOwned ? c.moments.length : 0,
        totalMoments: c.moments.length,
        matchCount: 0,
        isFoil: false,
      });
    }
  }
  return out;
}

let inspectView: InspectView | null = null;

function findCardInSet(characterId: string): { card: CardInSet; setId: SetId } | null {
  for (const setId of getAllSetIds()) {
    const card = getSetCharacters(setId).find((c) => c.characterId === characterId);
    if (card) return { card, setId };
  }
  return null;
}

function simpleCardHTML(card: CardInSet): string {
  return (
    `<div class="hub-inspect-card" data-tier="${card.tier}">` +
    `<div class="hub-inspect-card-name">${card.characterName}</div>` +
    `<div class="hub-inspect-card-tier">${card.tier.toUpperCase()}</div>` +
    `</div>`
  );
}

/** Open the full-screen inspect view for a card (by characterId). */
function openInspect(characterId: string): void {
  const found = findCardInSet(characterId);
  if (!found) return;
  const { card, setId } = found;
  const set = getSetDefinition(setId);
  const m = card.moments[0];
  const data: InspectCardData = {
    cardInstance: { id: characterId, matchCount: 0, isFoil: false },
    template: { id: characterId, name: card.characterName, tier: card.tier, setId, setNumber: 1, lore: set.description },
    moment: { momentId: m?.momentId ?? "classic", name: m?.name ?? "Classic", description: m?.description ?? "" },
    market: { floorPrice: 0, lastSale: 0, change24h: 0, volume: 0 },
  };
  if (!inspectView) inspectView = new InspectView();
  inspectView.open(data, simpleCardHTML(card)); // moments default to [] for now
}

/** Owned cards as fusion candidates (group dupes later when ownership has instances). */
function buildFusionCards(owned: Set<string>): FusionCard[] {
  const out: FusionCard[] = [];
  for (const setId of getAllSetIds()) {
    for (const c of getSetCharacters(setId)) {
      if (!owned.has(c.characterName)) continue;
      out.push({
        instanceId: c.characterId,
        characterId: c.characterId,
        characterName: c.characterName,
        momentId: c.moments[0]?.momentId ?? "classic",
        tier: c.tier,
        isFoil: false,
        matchCount: 0,
        thumbnailHTML: `<div class="fusion-thumb">${c.characterName}</div>`,
      });
    }
  }
  return out;
}

function renderTab(content: HTMLElement, owned: Set<string>): void {
  content.innerHTML = "";
  if (activeTab === "collection") {
    new CollectionView(content).render(buildCollection(owned));
  } else if (activeTab === "market") {
    new MarketView(content).render();
  } else if (activeTab === "forge") {
    new CardFusion(content).render(buildFusionCards(owned));
  } else {
    content.innerHTML =
      `<div class="cards-packs">` +
      `<p class="cards-packs-intro">Open a pack to add cards to your collection.</p>` +
      `<div class="cards-pack-row">` +
      `<button class="cards-pack-btn" data-pack="basic">📦 Basic Pack</button>` +
      `<button class="cards-pack-btn" data-pack="premium">✨ Premium Pack</button>` +
      `<button class="cards-pack-btn" data-pack="legendary">👑 Legendary Pack</button>` +
      `</div></div>`;
    content.querySelectorAll<HTMLButtonElement>(".cards-pack-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = (btn.dataset.pack || "basic") as PackType;
        void new PackOpening().open(type).then((cards) => {
          for (const c of cards) owned.add(c.characterName);
          saveOwned(owned);
        });
      });
    });
  }
}

/** Open the cards hub overlay. Safe to call repeatedly. */
export function openCardsHub(): void {
  injectCSS();
  if (overlay) { overlay.classList.remove("hidden"); return; }
  const owned = loadOwned();
  overlay = document.createElement("div");
  overlay.className = "cards-hub";
  overlay.innerHTML =
    `<div class="cards-hub-wrap">` +
    `<div class="cards-hub-top">` +
    `<button class="ghost lobby-icon cards-hub-close">←</button>` +
    `<h2 class="lobby-title">Cards</h2>` +
    `<span class="lobby-icon" style="visibility:hidden">.</span>` +
    `</div>` +
    `<div class="cards-hub-tabs">` +
    `<button class="seg-btn cards-tab" data-tab="collection">🗂 Collection</button>` +
    `<button class="seg-btn cards-tab" data-tab="market">🏪 Market</button>` +
    `<button class="seg-btn cards-tab" data-tab="forge">⚒️ Forge</button>` +
    `<button class="seg-btn cards-tab" data-tab="packs">📦 Open Pack</button>` +
    `</div>` +
    `<div class="cards-hub-body"></div>` +
    `</div>`;
  document.body.appendChild(overlay);
  const body = overlay.querySelector(".cards-hub-body") as HTMLElement;
  // Click a collection card -> open the full-screen Inspect view.
  body.addEventListener("click", (e) => {
    const cardEl = (e.target as HTMLElement).closest(".cv-card") as HTMLElement | null;
    if (cardEl?.dataset.id) openInspect(cardEl.dataset.id);
  });
  const syncTabs = (): void => {
    overlay!.querySelectorAll<HTMLButtonElement>(".cards-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === activeTab));
  };
  overlay.querySelectorAll<HTMLButtonElement>(".cards-tab").forEach((b) => {
    b.addEventListener("click", () => { activeTab = (b.dataset.tab as typeof activeTab) || "collection"; syncTabs(); renderTab(body, owned); });
  });
  overlay.querySelector(".cards-hub-close")?.addEventListener("click", () => overlay?.classList.add("hidden"));
  syncTabs();
  renderTab(body, owned);
}
