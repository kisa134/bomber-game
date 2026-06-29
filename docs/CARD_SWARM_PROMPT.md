# BomberMeme Card System v2 — Swarm Agent Prompt

## Mission
Upgrade the existing fighter card system from "Shop skins" to a full **Collectible Card Game experience** with Inspect View, Collection Binder, Market (P2P trading), Pack Opening ritual, Card Aging, Set System, Card Fusion, and Share Card feature.

## CRITICAL RULES
- **NEVER break existing card visual system** — the 20+ layer card (holo, tilt, flip, card backs, foil, edge sweep, stars) must ALL continue working
- **NEVER modify arena gameplay code** (`apps/client/src/arena/`, `apps/server/src/arena/`)
- Use **Canvas 2D / CSS only** — no WebGL, no Three.js
- Project is **ESM** (`"type": "module"`) — all imports need `.js` suffix
- TypeScript strict mode
- All new UI uses existing glass-morphism design language (`.panel`, glass buttons, backdrop-filter)

## What Already Exists (Study Before Building)

The current card system is in:
- `apps/client/src/main.ts` — `fighterCardHTML(skin)` function creates 20+ layered DOM cards
- `apps/client/src/style.css` — all card CSS (`.fighter-card`, `.fc-tilt`, `.fc-holo`, `.fc-back`, etc.)
- `fighterCardHTML()` returns HTML string with: art layer, rays, cloud, haze, grain, hero sprite, 5 holo finishes (silver/pearl/gold/holo/prismatic), scan lines, gloss, sheen sweep, cursor light, frame, corners, badge, stamp, edge sweep, stars, name row
- Card back: guilloche weave, meme glyphs, bomb seal, serial number, wax seal, foil sweep
- Interactions: 3D tilt to cursor, flip (opacity cross-fade), deck mode carousel, charging mythic
- Existing shop at `#shop` screen with grid + detail panel

**Read these files completely before writing any code.**

---

## Agent Assignments

### Agent 1: Inspect View + Card Aging + New Layers
**Goal:** Create the deep card inspection experience + visual aging system + 3 new card layers

**Files to create:**
- `apps/client/src/cards/InspectView.ts` — full-screen inspect mode
- `apps/client/src/cards/CardAging.ts` — aging system logic
- `apps/client/src/cards/CardLayers.ts` — new layer generators (rarity seal v2, edition mark, set badge)

**Files to modify:**
- `apps/client/src/main.ts` — add inspect trigger (click on active fighter card in hub)
- `apps/client/src/style.css` — add inspect styles, aging styles, new layer styles

**InspectView.ts specification:**
```typescript
export class InspectView {
  // Opens full-screen overlay with card render enlarged
  open(cardInstance: CardInstance, template: CardTemplate): void;
  
  // Zoom: wheel (1x -> 5x)
  // Pan: drag when zoomed > 1x
  // Tilt: still follows mouse (same as hub card)
  // Flip: button or swipe to show back
  // Close: X button or ESC or click outside
  
  // Right panel shows:
  // - Character name + moment name
  // - Tier badge (coloured)
  // - Set name + set number
  // - Serial number (for limited editions)
  // - Age status (Mint/Seasoned/Veteran/Legend/Immortal)
  // - Lore text (1-2 sentences)
  // - Collectible stats (meme rank, prestige, collector appeal, volatility, liquidity)
  // - Market data (floor price, last sale, 24h change, volume)
  // - Action buttons: Sell, Trade, Stake
  // - Share Card button
  
  // Bottom strip: thumbnails of other moments for same character
  // Click thumbnail -> animate transition to that moment
}
```

**CardAging.ts specification:**
```typescript
export interface AgingStage {
  name: string;       // "Mint" | "Seasoned" | "Veteran" | "Legend" | "Immortal"
  minMatches: number; // 0, 10, 50, 100, 500
  cssClass: string;   // "card-mint", "card-seasoned", etc.
}

export function getAgingStage(matchCount: number): AgingStage;
export function applyAgingToCard(cardEl: HTMLElement, matchCount: number): void;
```

**New layers to add to fighterCardHTML:**
1. **Rarity Seal v2** — embossed SVG seal in bottom-right (unique shape per tier: circle/shield/star/crown/phoenix)
2. **Edition Mark** — small plaque showing serial number (e.g., "BM-S01-0042 / 100") for limited editions, "Unlimited" for others. Only show if the card instance has a serial.
3. **Set Badge** — 16x16 icon in top-right showing which set the card belongs to. Create simple SVG icons for 9 sets.

**HTML structure additions inside `.fc-tilt`:**
```html
<!-- Add inside fc-tilt, before closing div -->
<div class="fc-rarity-seal">{SVG_SEAL}</div>
<div class="fc-edition-mark">BM-S01-0042 / 100</div>
<div class="fc-set-badge">{SET_ICON_SVG}</div>
```

### Agent 2: Collection Binder
**Goal:** Create the collection browsing screen where players see all their cards organized by sets

**Files to create:**
- `apps/client/src/cards/CollectionView.ts` — collection screen logic
- `apps/client/src/cards/SetDefinitions.ts` — 9 set definitions with card assignments

**Files to modify:**
- `apps/client/src/ui/lobby.ts` — add `"collection"` to ScreenName if not already there
- `apps/client/index.html` — add `<section id="collection">` HTML
- `apps/client/src/style.css` — collection grid styles

**CollectionView.ts specification:**
```typescript
export class CollectionView {
  render(container: HTMLElement): void;
  
  // Grid of all 100 characters
  // Each cell: small card thumbnail (simplified render)
  // Owned: full colour + holo shimmer
  // Unowned: black silhouette (keep existing mechanic!)
  // Click -> opens InspectView
  
  // Filters: All Tiers, All Sets, Sort (A-Z, Tier, Recently Acquired)
  // Set sections with progress bars
  // "Missing 1" indicator (strongest collecting trigger)
  // Completion rewards shown per set
}
```

**SetDefinitions.ts:**
```typescript
export interface CardSet {
  id: string;
  name: string;
  description: string;
  cardIds: string[];        // character IDs in this set
  totalCards: number;
  reward: { type: 'back_skin' | 'emote' | 'title'; name: string; };
}

// 9 sets defined in the Master Spec document:
// Genesis Archive, Crypto Degenerates, Frog Dynasty, Meme Pantheon,
// Election Chaos, Pump Circuit, Animal Kingdom, Crypto Twitter, Seasonal Drop
// Each set has which characters belong to it (refer to MASTER SPEC Part 9)
```

**Important:** Use the existing `showScreen("collection")` pattern. Add collection entry point to hub (a new rail button or bottom bar icon).

### Agent 3: Market UI (Primary + Secondary)
**Goal:** Transform Shop into a full Market with P2P trading

**Files to create:**
- `apps/client/src/cards/MarketView.ts` — market screen
- `apps/client/src/cards/MarketTypes.ts` — type definitions

**Files to modify:**
- `apps/client/src/main.ts` — replace or extend shop logic with market
- `apps/client/index.html` — update shop HTML to market layout
- `apps/client/src/style.css` — market styles (listings, price displays, charts)

**MarketView.ts specification:**
```typescript
export class MarketView {
  // Tabs: Primary (buy from system) | Secondary (P2P) | My Listings | History
  
  // Primary tab:
  // - Featured drops grid
  // - New releases
  // - Flash sales with countdown timer
  // - Buy button triggers mint transaction
  
  // Secondary tab:
  // - Filter bar: Tier, Set, Price range, Sort
  // - Listing cards: card thumbnail + name + price + seller + serial + [Buy] button
  // - Floor price badge on each card type
  // - 24h change indicator (arrow with colour)
  
  // My Listings tab:
  // - Cards I'm selling with price, listed date, [Cancel] button
  // - [Sell Card] button -> opens sell modal with price input
  
  // History tab:
  // - My purchases and sales
  // - Date, price, buyer/seller
  
  // Price display format:
  // "17,600 BM" (large)
  // "~ $1,248.50" (small, muted)
  // "+12%" (colour: green for up, red for down)
}
```

**Mock data for Phase 1** (real blockchain integration comes later):
```typescript
const MOCK_LISTINGS: MarketListing[] = [
  { id: '1', cardTemplateId: 'hero_1', momentId: 'classic', seller: '0x7a3f...', price: 17600, serial: 'BM-S01-0007', listedAt: new Date() },
  { id: '2', cardTemplateId: 'hero_2', momentId: 'mugshot', seller: '0x9e2b...', price: 4250, serial: 'BM-S01-0042', listedAt: new Date() },
  // ... more mock listings
];
```

### Agent 4: Pack Opening + Card Fusion + Share Card
**Goal:** Ceremonial pack opening experience + duplicate fusion + social sharing

**Files to create:**
- `apps/client/src/cards/PackOpening.ts` — pack opening ceremony
- `apps/client/src/cards/CardFusion.ts` — fusion UI
- `apps/client/src/cards/ShareCard.ts` — generate shareable image

**PackOpening.ts specification:**
```typescript
export class PackOpening {
  open(packType: PackType): Promise<CardInstance[]>;
  
  // Animation sequence:
  // 1. Darken screen, show pack centre (CSS-animated shaking)
  // 2. Pack bursts with particle explosion (CSS/Canvas particles)
  // 3. Cards fly out face-down in a fan arrangement
  // 4. Player clicks each card to reveal (flip animation)
  // 5. Rarity determines spectacle:
  //    Common: simple flip
  //    Rare: flip + soft glow pulse
  //    Epic: flip + gold particle burst
  //    Legendary: flip + screen flash + rainbow particles
  //    Mythic: flip + screen shake + dramatic glow + particle storm
  // 6. "Collect All" button to finish
  // 7. "Share Pull" — calls ShareCard for the best card pulled
}

export type PackType = 'basic' | 'premium' | 'legendary';
// Basic: 3 cards (mostly Common/Rare)
// Premium: 5 cards (guaranteed Rare+, chance Epic+)
// Legendary: 1 card (guaranteed Epic+, chance Legendary/Mythic)
```

**CardFusion.ts specification:**
```typescript
export class CardFusion {
  // Select 3 identical cards -> preview result
  // Fusion rules:
  // 3 Common (same character, same moment) -> 1 Foil Common
  // 3 Foil Common -> 1 Rare Gold-Framed (same character)
  // 3 Rare -> 1 Epic Gold-Framed
  // 3 Epic -> 1 Legendary Gold-Framed
  
  // UI:
  // - Card selection grid (show duplicates)
  // - "Preview Fusion" shows result card
  // - Fusion animation: 3 cards swirl together, particles converge, merge into result
  // - Fusion fee displayed in BM tokens
  
  fuse(cardInstanceIds: string[]): Promise<CardInstance>;
}
```

**ShareCard.ts specification:**
```typescript
export class ShareCard {
  // Generate 1080x1080 canvas with:
  // - Large card render (centred, tilted)
  // - Character name + tier below
  // - "BomberMeme" branding at top
  // - Serial number if applicable
  // - QR code placeholder (will link to market listing)
  // - Background: dark gradient with subtle pattern
  
  generate(cardInstance: CardInstance, template: CardTemplate): HTMLCanvasElement;
  download(canvas: HTMLCanvasElement, filename: string): void;
}
```

**For QR codes:** Use any lightweight QR code library or a simple data-URI API.

---

## Key Technical Patterns

### Card render reuse
The existing `fighterCardHTML(skin)` generates a card as HTML string. For:
- **Hub carousel**: use full `fighterCardHTML()` with all layers + tilt
- **Collection thumbnails**: simplified — no tilt, no animation, reduce to 8 core layers
- **Market listings**: same as collection thumbnails
- **Inspect view**: full `fighterCardHTML()` enlarged + zoom/pan wrapper

### Simplified thumbnail render
```typescript
function cardThumbnailHTML(skin: number, size: 'sm' | 'md'): string {
  // Returns simplified card with:
  // - base art + hero sprite + holo + frame + badge + name
  // - No tilt, no sheen sweep, no stars, no edge sweep
  // - Size: sm=120px wide, md=180px wide
}
```

### Show/hide pattern (existing in codebase)
```typescript
// All screens use showScreen() from lobby.ts
import { showScreen } from "./ui/lobby.js";
showScreen("collection"); // or "market", "inspect"
```

### CSS glass-morphism pattern (existing)
```css
.glass-panel {
  background: rgba(13, 16, 26, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  backdrop-filter: blur(22px) saturate(1.3);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
}
```

---

## Asset Requirements (Wavespeed API)

The project has access to Wavespeed API for image generation. Cards need:

**Character sprites** (already exist at `/public/sprites/skin_{N}_{dir}_{frame}.webp`)

**Moment variants** (NEW — generate via Wavespeed):
- Prompt template: `"{character_name} from BomberMeme game, {moment_description}, pixel art character sprite, transparent background, full body, front-facing, crisp pixel art, vibrant colours, game asset"`
- Save to: `/public/sprites/moments/{character_id}_{moment_id}.webp`
- Size: 128x128 minimum

**For Phase 1** — agents can use placeholder images:
- Same sprite for all moments (re-use existing `skin_N` sprites)
- Moment differentiation shown via name + description only
- Full art generation is Phase 2

---

## Integration Points

### Hub integration
- Add "Collection" button to hub rails or bottom bar
- Add "Market" button (replace/rename existing Shop)
- Pack Opening triggered from "Open Pack" button in Collection or Market

### Existing data
- Character names: `SKIN_NAMES` array in protocol (or similar)
- Rarity: `rarityOf(skin)` function
- Ownership: `skinOwnership` bitmask (to be replaced with CardInstance model in Phase 2)
- Prices: `SKIN_PRICES` array

### Navigation flow
```
Hub -> Collection -> Inspect Card -> Sell/Trade/Stake/Share
Hub -> Market -> Browse -> Buy -> Inspect
Hub -> Market -> My Listings -> Sell Card (sets price)
Collection -> Select 3 duplicates -> Fuse -> Preview -> Confirm
Pack -> Open -> Reveal animation -> Collect/Share
```

---

## Acceptance Criteria (ALL must pass)

- [ ] Clicking hub fighter card opens Inspect View with enlarged card + details panel
- [ ] Inspect View: zoom (wheel), pan (drag), tilt (mousemove), flip (button)
- [ ] Card Aging: 5 visual stages based on match count (Mint->Immortal)
- [ ] New layers: rarity seal v2, edition mark, set badge visible on cards
- [ ] Collection screen shows grid of all 100 characters with owned/unowned states
- [ ] Set grouping with progress bars in Collection
- [ ] Market screen with Primary/Secondary/My Listings/History tabs
- [ ] Mock listings display with price, serial, seller, [Buy] button
- [ ] Pack opening animation: shake -> burst -> face-down fan -> click to reveal
- [ ] Rarity-specific reveal effects (Common simple -> Mythic dramatic)
- [ ] Card Fusion: select 3 duplicates -> preview result -> fusion animation
- [ ] Share Card: generates 1080x1080 canvas with card + branding
- [ ] All existing card effects preserved (holo, tilt, flip, card backs)
- [ ] Lite mode disables heavy effects
- [ ] Mobile: touch-friendly (pinch zoom, drag pan, swipe flip)
- [ ] No TypeScript build errors

---

## Phase 2 (Do NOT implement now, but design for)

- Blockchain integration for real P2P market transactions
- Wavespeed API art generation for all moments
- Card Fusion smart contract
- Tournament trophy cards (1-of-1 generation)
- "The Bombing" monthly meta system
- Card lore unlocking through gameplay
- Genesis/Founder edition mechanics
