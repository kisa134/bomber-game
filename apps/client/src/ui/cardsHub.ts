// Cards hub — mounts the v2 card system into the game hub with instance-based
// ownership (so duplicates + Forge work), card aging, and a Cards↔Skins bridge
// (owning a character card unlocks its arena skin). Arena + hub fighter cards untouched.
import { CollectionView, buildCollection, injectCollectionStyles, skinIndexForCharacter } from "../cards/CollectionView.js";
import { MarketView } from "../cards/MarketView.js";
import { PackOpening, type PackType } from "../cards/PackOpening.js";
import { InspectView, getInspectCSS, type InspectCardData } from "../cards/InspectView.js";
import { CardFusion, type FusionCard } from "../cards/CardFusion.js";
import { getAgingCSS } from "../cards/CardAging.js";
import { SETS, getSetCharacters, getCharacterSet, type SetId, type CardInSet } from "../cards/SetDefinitions.js";
import { MOCK_LISTINGS, MOCK_MY_LISTINGS, MOCK_HISTORY, MOCK_FLOOR_DATA, MOCK_FEATURED_DROPS, MOCK_NEW_RELEASES } from "../cards/MarketMockData.js";
import { cardsApi, type CardInstance } from "../cards/api.js";
import { unlockSkinFromCard } from "../main.js";

let cssInjected = false;
let overlay: HTMLDivElement | null = null;
let activeTab: "collection" | "market" | "forge" | "packs" = "collection";
let inspectView: InspectView | null = null;

function injectCSS(): void {
  if (cssInjected) return;
  cssInjected = true;
  injectCollectionStyles(); // Market/Pack/Fusion self-inject on construct
  const style = document.createElement("style");
  style.id = "cards-hub-css";
  style.textContent = [getInspectCSS(), getAgingCSS()].join("\n");
  document.head.appendChild(style);
}

// ── ownership derived from card instances ───────────────────────────────────
function ownedIds(): Set<string> { return new Set(cardsApi.getInstances().map((i) => i.characterId)); }
function ownedMomentsMap(): Map<string, number> {
  const m = new Map<string, Set<string>>();
  for (const i of cardsApi.getInstances()) (m.get(i.characterId) ?? m.set(i.characterId, new Set()).get(i.characterId)!).add(i.momentId);
  const out = new Map<string, number>();
  for (const [k, v] of m) out.set(k, v.size);
  return out;
}
function matchCountMap(): Map<string, number> {
  const out = new Map<string, number>();
  for (const i of cardsApi.getInstances()) out.set(i.characterId, Math.max(out.get(i.characterId) ?? 0, i.matchCount));
  return out;
}
function foilSet(): Set<string> { return new Set(cardsApi.getInstances().filter((i) => i.isFoil).map((i) => i.characterId)); }

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

/** Grant a card for a character: mint an instance + unlock its arena skin (bridge C). */
function grantCharacter(characterId: string, momentId: string, tier: string, isFoil = false, isGoldFrame = false): void {
  const setId = getCharacterSet(characterId) ?? "genesis";
  cardsApi.grant([{ characterId, momentId, tier, setId, isFoil, isGoldFrame, matchCount: 0 }]);
  const skin = skinIndexForCharacter(characterId);
  if (skin >= 0) unlockSkinFromCard(skin);
}

function simpleCardHTML(card: CardInSet): string {
  return (
    `<div class="hub-inspect-card" data-tier="${card.tier}">` +
    `<div class="hub-inspect-card-name">${card.characterName}</div>` +
    `<div class="hub-inspect-card-tier">${card.tier.toUpperCase()}</div></div>`
  );
}

function openInspect(characterId: string): void {
  const found = findCard(characterId);
  if (!found) return;
  const { card, setId } = found;
  const set = SETS[setId];
  const m = card.moments[0];
  const mc = matchCountMap().get(characterId) ?? 0;
  const data: InspectCardData = {
    cardInstance: { id: characterId, matchCount: mc, isFoil: foilSet().has(characterId) },
    template: { id: characterId, name: card.characterName, tier: card.tier, setId, setNumber: 1, lore: set?.description ?? "" },
    moment: { momentId: m?.momentId ?? "classic", name: m?.name ?? "Classic", description: m?.description ?? "" },
    market: { floorPrice: 0, lastSale: 0, change24h: 0, volume: 0 },
  };
  if (!inspectView) inspectView = new InspectView();
  inspectView.open(data, simpleCardHTML(card), card.moments);
}

/** One fusion candidate per OWNED INSTANCE (so 3 dupes of one character are selectable). */
function fusionCards(): FusionCard[] {
  return cardsApi.getInstances().map((i) => {
    const f = findCard(i.characterId);
    return {
      instanceId: i.instanceId,
      characterId: i.characterId,
      characterName: f?.card.characterName ?? i.characterId,
      momentId: i.momentId,
      tier: i.tier,
      isFoil: i.isFoil,
      matchCount: i.matchCount,
      thumbnailHTML: `<div class="fusion-thumb">${f?.card.characterName ?? i.characterId}</div>`,
    };
  });
}

function renderTab(content: HTMLElement): void {
  content.innerHTML = "";
  if (activeTab === "collection") {
    new CollectionView(content).render(buildCollection(ownedIds(), ownedMomentsMap(), matchCountMap(), foilSet()));
  } else if (activeTab === "market") {
    const mv = new MarketView(content);
    mv.render();
    mv.setListings(MOCK_LISTINGS);
    mv.setMyListings(MOCK_MY_LISTINGS);
    mv.setHistory(MOCK_HISTORY);
    mv.setFloorData(MOCK_FLOOR_DATA);
    mv.setFeaturedDrops(MOCK_FEATURED_DROPS);
    mv.setNewReleases(MOCK_NEW_RELEASES);
  } else if (activeTab === "forge") {
    const cf = new CardFusion(content, {
      onComplete: (recipe, consumedIds) => {
        const first = cardsApi.getInstances().find((i) => i.instanceId === consumedIds[0]);
        cardsApi.burn(consumedIds); // burn the 3 inputs
        if (first) grantCharacter(first.characterId, first.momentId, recipe.output.tier, recipe.output.isFoil, recipe.output.isGoldFrame);
        renderTab(content); // refresh Forge with the updated inventory
      },
    });
    cf.render(fusionCards());
  } else {
    content.innerHTML =
      `<div class="cards-packs">` +
      `<p class="cards-packs-intro">Open a pack to add real cards to your collection (and unlock their arena skins).</p>` +
      `<div class="cards-pack-row">` +
      `<button class="cards-pack-btn" data-pack="basic">📦 Basic Pack</button>` +
      `<button class="cards-pack-btn" data-pack="premium">✨ Premium Pack</button>` +
      `<button class="cards-pack-btn" data-pack="legendary">👑 Legendary Pack</button>` +
      `</div></div>`;
    content.querySelectorAll<HTMLButtonElement>(".cards-pack-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = (btn.dataset.pack || "basic") as PackType;
        void new PackOpening().open(type).then((cards) => {
          for (const c of cards) { const id = idForName(c.characterName); if (id) grantCharacter(id, c.momentId, c.tier); }
        });
      });
    });
  }
}

/** Open the cards hub overlay. Safe to call repeatedly. */
export function openCardsHub(): void {
  injectCSS();
  if (overlay) { overlay.classList.remove("hidden"); return; }
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
  body.addEventListener("click", (e) => {
    const cardEl = (e.target as HTMLElement).closest("[data-id]") as HTMLElement | null;
    if (cardEl?.dataset.id) openInspect(cardEl.dataset.id);
  });
  const syncTabs = (): void => {
    overlay!.querySelectorAll<HTMLButtonElement>(".cards-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === activeTab));
  };
  overlay.querySelectorAll<HTMLButtonElement>(".cards-tab").forEach((b) => {
    b.addEventListener("click", () => { activeTab = (b.dataset.tab as typeof activeTab) || "collection"; syncTabs(); renderTab(body); });
  });
  overlay.querySelector(".cards-hub-close")?.addEventListener("click", () => overlay?.classList.add("hidden"));
  syncTabs();
  renderTab(body);
}
