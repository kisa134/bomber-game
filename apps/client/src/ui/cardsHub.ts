// Cards hub — wires the (previously orphaned) card system into the game: a single
// overlay with Collection / Market / Open-Pack tabs. Injects each module's CSS,
// builds the collection from the set definitions, tracks owned cards in localStorage,
// and lets packs grant new cards. This is the "подключение" the card modules needed.
import { CollectionView, getCollectionCSS, type CollectionCard } from "../cards/CollectionView.js";
import { MarketView, getMarketCSS } from "../cards/MarketView.js";
import { PackOpening, getPackOpeningCSS, type PackType } from "../cards/PackOpening.js";
import { getInspectCSS } from "../cards/InspectView.js";
import { getCardFusionCSS } from "../cards/CardFusion.js";
import { getAgingCSS } from "../cards/CardAging.js";
import { getAllSetIds, getSetCharacters } from "../cards/SetDefinitions.js";

const OWNED_KEY = "bp_cards_owned";
let cssInjected = false;
let overlay: HTMLDivElement | null = null;
let activeTab: "collection" | "market" | "packs" = "collection";

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

function renderTab(content: HTMLElement, owned: Set<string>): void {
  content.innerHTML = "";
  if (activeTab === "collection") {
    new CollectionView(content).render(buildCollection(owned));
  } else if (activeTab === "market") {
    new MarketView(content).render();
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
    `<button class="seg-btn cards-tab" data-tab="packs">📦 Open Pack</button>` +
    `</div>` +
    `<div class="cards-hub-body"></div>` +
    `</div>`;
  document.body.appendChild(overlay);
  const body = overlay.querySelector(".cards-hub-body") as HTMLElement;
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
