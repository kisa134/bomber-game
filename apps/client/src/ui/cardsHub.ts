// Cards hub — mounts the (richer v2) card system into the game hub: a single overlay
// with Collection / Market / Forge / Open-Pack tabs + click-to-Inspect. Self-contained
// client UI; ownership tracked in localStorage by characterId. Arena + the existing hub
// fighter cards are untouched. Real data/economy come later from the backend.
import { CollectionView, buildCollection, injectCollectionStyles } from "../cards/CollectionView.js";
import { MarketView } from "../cards/MarketView.js";
import { PackOpening, type PackType } from "../cards/PackOpening.js";
import { InspectView, getInspectCSS, type InspectCardData } from "../cards/InspectView.js";
import { CardFusion, type FusionCard } from "../cards/CardFusion.js";
import { getAgingCSS } from "../cards/CardAging.js";
import { SETS, getSetCharacters, type SetId, type CardInSet } from "../cards/SetDefinitions.js";
import { MOCK_LISTINGS, MOCK_MY_LISTINGS, MOCK_HISTORY, MOCK_FLOOR_DATA, MOCK_FEATURED_DROPS, MOCK_NEW_RELEASES } from "../cards/MarketMockData.js";

const OWNED_KEY = "bp_card_ids";
let cssInjected = false;
let overlay: HTMLDivElement | null = null;
let activeTab: "collection" | "market" | "forge" | "packs" = "collection";
let inspectView: InspectView | null = null;

function injectCSS(): void {
  if (cssInjected) return;
  cssInjected = true;
  injectCollectionStyles(); // CollectionView self-injects; Market/Pack/Fusion inject on construct
  const style = document.createElement("style");
  style.id = "cards-hub-css";
  style.textContent = [getInspectCSS(), getAgingCSS()].join("\n");
  document.head.appendChild(style);
}

function loadOwned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || "[]") as string[]); } catch { return new Set(); }
}
function saveOwned(owned: Set<string>): void {
  try { localStorage.setItem(OWNED_KEY, JSON.stringify([...owned])); } catch { /* ignore */ }
}

// Pack reveals give a character NAME; map it back to the character id we store.
let nameToId: Map<string, string> | null = null;
function idForName(name: string): string | undefined {
  if (!nameToId) {
    nameToId = new Map();
    for (const setId of Object.keys(SETS) as SetId[]) for (const c of getSetCharacters(setId)) nameToId.set(c.characterName, c.characterId);
  }
  return nameToId.get(name);
}

function findCard(characterId: string): { card: CardInSet; setId: SetId } | null {
  for (const setId of Object.keys(SETS) as SetId[]) {
    const card = getSetCharacters(setId).find((c) => c.characterId === characterId);
    if (card) return { card, setId };
  }
  return null;
}

function simpleCardHTML(card: CardInSet): string {
  return (
    `<div class="hub-inspect-card" data-tier="${card.tier}">` +
    `<div class="hub-inspect-card-name">${card.characterName}</div>` +
    `<div class="hub-inspect-card-tier">${card.tier.toUpperCase()}</div></div>`
  );
}

/** Open the full-screen inspect view for a card (by characterId). */
function openInspect(characterId: string): void {
  const found = findCard(characterId);
  if (!found) return;
  const { card, setId } = found;
  const set = SETS[setId];
  const m = card.moments[0];
  const data: InspectCardData = {
    cardInstance: { id: characterId, matchCount: 0, isFoil: false },
    template: { id: characterId, name: card.characterName, tier: card.tier, setId, setNumber: 1, lore: set?.description ?? "" },
    moment: { momentId: m?.momentId ?? "classic", name: m?.name ?? "Classic", description: m?.description ?? "" },
    market: { floorPrice: 0, lastSale: 0, change24h: 0, volume: 0 },
  };
  if (!inspectView) inspectView = new InspectView();
  inspectView.open(data, simpleCardHTML(card), card.moments);
}

/** Owned cards as fusion candidates (one per owned character for now — true 3-of-a-kind
 *  fusion needs the instance-level ownership refactor). */
function buildFusionCards(owned: Set<string>): FusionCard[] {
  const out: FusionCard[] = [];
  for (const id of owned) {
    const f = findCard(id);
    if (!f) continue;
    out.push({
      instanceId: id,
      characterId: id,
      characterName: f.card.characterName,
      momentId: f.card.moments[0]?.momentId ?? "classic",
      tier: f.card.tier,
      isFoil: false,
      matchCount: 0,
      thumbnailHTML: `<div class="fusion-thumb">${f.card.characterName}</div>`,
    });
  }
  return out;
}

function renderTab(content: HTMLElement, owned: Set<string>): void {
  content.innerHTML = "";
  if (activeTab === "collection") {
    new CollectionView(content).render(buildCollection(owned));
  } else if (activeTab === "market") {
    // Demo marketplace from mock data (real listings come from the backend later).
    const mv = new MarketView(content);
    mv.render();
    mv.setListings(MOCK_LISTINGS);
    mv.setMyListings(MOCK_MY_LISTINGS);
    mv.setHistory(MOCK_HISTORY);
    mv.setFloorData(MOCK_FLOOR_DATA);
    mv.setFeaturedDrops(MOCK_FEATURED_DROPS);
    mv.setNewReleases(MOCK_NEW_RELEASES);
  } else if (activeTab === "forge") {
    new CardFusion(content).render(buildFusionCards(owned));
  } else {
    content.innerHTML =
      `<div class="cards-packs">` +
      `<p class="cards-packs-intro">Open a pack to add real cards to your collection.</p>` +
      `<div class="cards-pack-row">` +
      `<button class="cards-pack-btn" data-pack="basic">📦 Basic Pack</button>` +
      `<button class="cards-pack-btn" data-pack="premium">✨ Premium Pack</button>` +
      `<button class="cards-pack-btn" data-pack="legendary">👑 Legendary Pack</button>` +
      `</div></div>`;
    content.querySelectorAll<HTMLButtonElement>(".cards-pack-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = (btn.dataset.pack || "basic") as PackType;
        void new PackOpening().open(type).then((cards) => {
          for (const c of cards) { const id = idForName(c.characterName); if (id) owned.add(id); }
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
    const cardEl = (e.target as HTMLElement).closest("[data-id]") as HTMLElement | null;
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
