# BomberMeme Card System v2 — Visual & Market Upgrade Spec

## Current State (What Already Exists — DO NOT Break)

The current fighter card system in `apps/client/src/main.ts` + `style.css` is already one of the most advanced web-based card visual systems. **Preserve all of this:**

### Existing 20+ Card Layers (front face)
| # | Layer | CSS Class | Description |
|---|-------|-----------|-------------|
| 1 | Base art | `.fc-art` | Radial gradient background tinted to tier |
| 2 | Rays | `.fc-ray` | Conic repeating gradient rays, blurred |
| 3 | Cloud | `.fc-cloud` | Soft glow character stands against |
| 4 | Haze | `.fc-haze` | Cosmic mist at bottom |
| 5 | Grain | `.fc-grain` | SVG fractalNoise texture overlay |
| 6 | Hero sprite | `.fc-hero` | Character sprite, pixel-art crisp |
| 7 | Holo foil | `.fc-holo` | 5 finishes: silver/pearl/gold/holo/prismatic |
| 8 | Scan lines | `.fc-scan` | Horizontal scan line overlay |
| 9 | Gloss | `.fc-gloss` | Top-left glossy reflection |
| 10 | Sheen sweep | `.fc-sheen` | Animated glint sweep (5.5s alternate) |
| 11 | Cursor light | `.fc-light` | 3D light/shadow following mouse position |
| 12 | Frame | `.fc-frame` | Inner thin border frame |
| 13 | Corners | `.fc-corner` | Corner accent marks (TL/TR/BL/BR) |
| 14 | Badge | `.fc-badge` | Hexagonal holographic rarity seal with letter |
| 15 | Stamp | `.fc-stamp` | Bomb logo foil-stamped into surface |
| 16 | Edge sweep | `.fc-edge` | Animated conic border (Legendary/Mythic only) |
| 17 | Stars | `.fc-stars` | Twinkling 4-point star sparkles |
| 18 | Top row | `.fc-toprow` | Rarity text + serial number |
| 19 | Name | `.fc-name` | Character name with tier-specific animations |
| 20 | Gems | `.fc-gems` | Price in gems |

### Existing Back Face
- Guilloche security weave (cross-hatch pattern)
- Meme glyph tile pattern
- Embossed bomb seal with animated bobbing
- "BOMBERMEME" gold wordmark
- Serial number (BM-S01-XXXX format)
- Season wax seal (S1)
- Foil sweep animation (deck mode only)
- Card Back Families (6 families: Vault Classic, Vault Foil, Pump Circuit, Meme Pantheon, Founder's Mark, Season Seal)

### Existing Interactions
- **3D tilt** — card follows mouse cursor with spring physics (zero re-renders)
- **Flip** — opacity cross-fade at 90° midpoint, face↔back
- **Deck mode** — carousel fan layout with perspective, drag to browse
- **Charging** — Mythic cards pulse with red/violet glow on hold
- **Silhouette** — unowned cards show pure black silhouette (intrigue mechanic)
- **Lock overlay** — grayscale + lock icon for unaffordable cards

### Existing Tier System
- Common (silver) → Rare (pearl) → Epic (gold) → Legendary (holographic) → Mythic (prismatic)
- Each tier has: unique holo finish, name animation, edge sweep, star colour

---

## NEW: Card System v2 Additions

### A. New Visual Layers (3 additions)

#### Layer 21: Rarity Seal v2 (`fc-rarity-seal`)
- NOT just the hex badge — a **proper embossed seal** in the bottom-right
- SVG-based, unique shape per tier:
  - Common: simple circle stamp
  - Rare: shield shape
  - Epic: star burst
  - Legendary: crown
  - Mythic: phoenix/wings
- Embossed effect: `filter: drop-shadow(0 1px 0 rgba(255,255,255,0.3)) drop-shadow(0 -1px 0 rgba(0,0,0,0.5))`

#### Layer 22: Edition Mark (`fc-edition-mark`)
- Small plaque below the name: `BM-S01-0042 / 100`
- Only for limited edition cards (Legendary cap 1000, Mythic cap 100)
- Common/Rare/Epic: show "Unlimited" or nothing
- Font: `var(--font-mono)`, 7px, letter-spacing 2px
- Colour: tier-coloured with subtle glow

#### Layer 23: Set Badge (`fc-set-badge`)
- Small icon in top-right corner indicating which Set the card belongs to
- 9 sets: Genesis Archive, Crypto Degenerates, Frog Dynasty, Meme Pantheon, Election Chaos, Pump Circuit, Animal Kingdom, Crypto Twitter, Seasonal Drop
- Each set has a **unique 16×16 SVG icon** (simple, recognisable)
- Example: Frog Dynasty = frog silhouette, Crypto Degenerates = Bitcoin symbol

### B. Card Aging System (Battle-Worn)

A visual evolution based on how much the card has been used in matches.

| Matches | Visual State | Name |
|---------|-------------|------|
| 0 | Pristine, crystal clear | **Mint** |
| 10+ | Slight golden patina on frame corners | **Seasoned** |
| 50+ | Small "Veteran" emblem on frame, faint scratches on holo | **Veteran** |
| 100+ | Subtle glow emanates from card in inspect view, name has soft gold aura | **Legend** |
| 500+ | Darker, richer tint, unique gold border treatment, "Immortal" mark | **Immortal** |

Implementation:
- Store `matchCount` per CardInstance
- Apply CSS class `.card-mint`, `.card-seasoned`, `.card-veteran`, `.card-legend`, `.card-immortal`
- Each class adds subtle visual changes via CSS overlays
- Aging is **prestigious** — aged card looks MORE valuable, not damaged

### C. Card Moments System

Instead of one card per character, create **3-5 Moment variants** per character.

**Concept:** Each "Moment" captures a specific meme/iteration of the character.

Examples:
```
Trump:
- Moment 1: "Campaign Trump" — red cap, pointing
- Moment 2: "President Trump" — Oval Office backdrop
- Moment 3: "Mugshot Trump" — iconic Georgia mugshot pose
- Moment 4: "Rally Trump" — fist pump, crowd behind

Pepe:
- Moment 1: "Sad Frog" — classic sad pose
- Moment 2: "Smug Pepe" — smug grin
- Moment 3: "Apu Apustaja" — childlike innocence
- Moment 4: "PepeHands" — crying hands up
```

**Visual treatment:**
- Each Moment has **unique sprite art** (generated via Wavespeed API)
- Same tier/character base → different pose/expression/background
- Moments share the same CardTemplate but have different `momentId` and `artUrl`
- Completion bonus: own all moments of a character → unlock **Golden Frame** for that character

**Moment rarity distribution:**
- 1 "Classic" moment — always available
- 2-3 "Standard" moments — pack drops
- 1 "Secret" moment — rare drop, special pose

### D. The Inspect View (Deep Card Examination)

A dedicated full-screen mode for examining a single card in extreme detail.

**Layout:**
```
+---------------------------------------------------------+
|  <- Back                              [Share] [Close]   |
|                                                         |
|  +------------------+  +-----------------------------+  |
|  |                  |  |  CHARACTER NAME             |  |
|  |   CARD RENDER    |  |  Moment: "Campaign Trump"   |  |
|  |   (enlarged)     |  |  Tier: Legendary            |  |
|  |                  |  |  Set: Election Chaos        |  |
|  |   3D tilt active |  |  Serial: BM-S01-0042 / 100  |  |
|  |   Zoom: scroll   |  |  Age: Veteran (47 matches)  |  |
|  |   Pan: drag      |  |                             |  |
|  |                  |  |  -- LORE --                 |  |
|  |   [Flip]         |  |  "The face that launched    |  |
|  |                  |  |   a thousand memes."        |  |
|  |                  |  |                             |  |
|  +------------------+  |  -- COLLECTIBLE STATS --    |  |
|                        |  Meme Rank: #2              |  |
|  Controls hint:        |  Prestige: 9/10             |  |
|  Scroll = zoom         |  Collector Appeal: 10/10    |  |
|  Drag = pan            |  Volatility: High           |  |
|  Click+drag card = tilt|  Liquidity: High            |  |
|                        |                             |  |
|  Thumbnail strip:      |  -- MARKET DATA --          |  |
|  [ ][ ][ ][ ]          |  Floor Price: 4,250 BM      |  |
|  (other moments)       |  Last Sale: 3,800 BM        |  |
|                        |  24h Change: +12%           |  |
|                        |  Volume: 1.2M BM            |  |
|                        |  Est. Value: 4,800 BM       |  |
|                        |                             |  |
|                        |  [Sell] [Trade] [Stake]     |  |
+---------------------------------------------------------+
```

**Interactions:**
- **Mouse wheel** — zoom into card (2x → 5x)
- **Click + drag on card** — pan when zoomed
- **Card still tilts** to cursor even when zoomed
- **Flip button** — rotates card to show back
- **Thumbnail strip** at bottom shows other moments of same character
- **Click moment thumbnail** → switches to that moment with transition animation

### E. Collection Binder View

A dedicated screen for browsing your entire collection.

**Layout:**
```
+---------------------------------------------------------+
|  MY COLLECTION                      47 / 100 cards      |
|  [All] [Common] [Rare] [Epic] [Legendary] [Mythic]     |
|  [Sets] [Moments] [A-Z] [Grid] [List]                   |
|                                                         |
|  +----+ +----+ +----+ +----+ +----+ +----+ +----+      |
|  |Pepe| |Doge| |Giga| |Trump| |Musk| |Wojak| |...|    |
|  | #1 | | #4 | | #10| | #2 | | #3 | | #16 | |    |    |
|  | OK | | OK | | OK | | OK | | X  | | OK  | |    |    |
|  +----+ +----+ +----+ +----+ +----+ +----+ +----+      |
|                                                         |
|  Frog Dynasty                    3 / 4 cards  ====     |
|  [Pepe OK] [Rich Pepe X] [Dank Pepe OK] [Brett X]      |
|                                                         |
|  -- SET COMPLETION REWARDS --                           |
|  Complete Frog Dynasty -> Unlock Golden Frog back       |
|                                                         |
+---------------------------------------------------------+
```

**Card grid in collection:**
- Small card thumbnails (showing simplified render)
- **Owned cards** — full colour, holo effect
- **Unowned cards** — silhouette (current mechanic, keep it!)
- **Set completion progress bar** below each set section
- **"Missing 1" indicator** — creates urgency (strongest collecting trigger)

**Click card → opens Inspect View**

### F. Market (Replaces/Upgrades Shop)

Current Shop = buy from system. Market = buy/sell/trade with players.

**Market Architecture:**
```
MARKET
|-- PRIMARY (Buy from System)
|   |-- Featured Drops
|   |-- New Releases
|   
-- Flash Sales
|-- SECONDARY (P2P)
    |-- Browse Listings
    |-- My Listings
    |-- Make Offer
    |-- Trade History
    
-- Floor Analytics
```

**Market UI Layout:**
```
+---------------------------------------------------------+
|  MARKET                               $ 12,450 BM       |
|  [Primary] [Secondary] [My Listings] [History]          |
|                                                         |
|  Filters: [All Tiers] [All Sets] [Price Low->High]     |
|                                                         |
|  Trending Now:                                          |
|  +---------+ +---------+ +---------+ +---------+       |
|  | Trump   | | Pepe    | | Doge    | | Gigachad|       |
|  | $4,250  | | $17,600 | | $16,800 | | $14,400 |       |
|  | +12%    | | +5%     | | -2%     | | +8%     |       |
|  +---------+ +---------+ +---------+ +---------+       |
|                                                         |
|  Listings:                                              |
|  +--------------------------------------------------+   |
|  | [Pepe #1] "Sad Frog" Moment    17,600 BM    [Buy]|   |
|  | Seller: 0x7a3f...  |  Serial: BM-S01-0007       |   |
|  +--------------------------------------------------+   |
|  +--------------------------------------------------+   |
|  | [Trump #2] "Mugshot" Moment     4,250 BM    [Buy]|   |
|  | Seller: 0x9e2b...  |  Serial: BM-S01-0042       |   |
|  +--------------------------------------------------+   |
|                                                         |
+---------------------------------------------------------+
```

**Price display format:**
- Main price in BM tokens
- ≈ USD equivalent below
- 24h change indicator (green/red)
- Floor price badge

**Floor Analytics panel:**
- Mini chart (7-day sparkline)
- Floor price history
- Volume bars
- Unique holders count

### G. Pack Opening Ritual

Opening a pack of cards should be a **ceremonial experience**.

**Flow:**
1. Player clicks "Open Pack"
2. Screen darkens, pack appears centre (3D model or high-quality illustration)
3. Pack shakes with anticipation (1-2 seconds)
4. **Explosion animation** — pack bursts open with particle effects
5. Cards fly out in a fan, face-down (showing card backs)
6. Player clicks each card to **reveal** (flip animation)
7. Rarity determines reveal spectacle:
   - Common: simple flip
   - Rare: flip + soft glow
   - Epic: flip + gold particles
   - Legendary: flip + screen flash + rainbow burst
   - Mythic: flip + screen shake + dramatic glow + red/gold explosion

**After reveal:**
- "Collect All" button
- "Share Pull" — generates image of best card for social media

### H. Card Fusion (Duplicate Utilization)

**Mechanic:** 3 identical Common cards → 1 Foil Common. 3 Foil Common → 1 Gold-Framed Rare (of same character).

**Fusion UI:**
- Select 3 cards → "Preview Fusion" button
- Shows what you'll get
- Beautiful fusion animation: 3 cards swirl together, merge into one with particle effects
- Fusion fee: small BM token cost

### I. Share Card Feature

Generate a shareable image of any card for social media.

**Uses:** Admin/marketing canvas system (already built)
**Output:** 1080×1080 PNG with:
- Card render (large, centred)
- Character name + tier
- Serial number
- "BomberMeme" branding
- QR code linking to card on market

---

## Technical Implementation Notes

### Asset Pipeline (Wavespeed API Integration)

**For generating card art:**
- Input: character name, moment description, art style parameters
- Output: transparent PNG sprite
- Prompt template: `"{character_name} as a pixel-art game character, {moment_description}, transparent background, 128x128 pixels, crisp pixel art style, Bomberman-inspired, vibrant colours"`
- Store generated assets in `/public/sprites/moments/{character_id}_{moment_id}.webp`

**For generating card backs (set-specific):**
- Input: set name, visual theme
- Output: 512×512 card back illustration
- Prompt template: `"Trading card back design, {set_theme} style, ornate border, gold foil accents, dark background, premium collectible card game quality"`

### Data Schema Updates

```typescript
// NEW: Moment variant
interface CardMoment {
  momentId: string;          // "campaign", "president", "mugshot", "rally"
  name: string;              // "Campaign Trump"
  description: string;       // "The original meme that started it all"
  artUrl: string;            // "/sprites/moments/trump_campaign.webp"
  releaseType: 'classic' | 'standard' | 'secret';
}

// UPDATE: CardTemplate (add moments + set)
interface CardTemplate {
  // ... existing fields ...
  moments: CardMoment[];     // 3-5 moments per character
  setId: SetId;              // which set this card belongs to
  setNumber: number;         // "#1 of 8" in the set
}

// UPDATE: CardInstance (add match count + aging)
interface CardInstance {
  // ... existing fields ...
  matchCount: number;        // for aging system
  isFoil: boolean;           // fused foil version
  isGoldFrame: boolean;      // gold-framed (from fusion)
}

// NEW: Set definition
interface CardSet {
  id: SetId;
  name: string;
  description: string;
  cardIds: string[];         // which characters are in this set
  completionReward: {        // reward for completing the set
    type: 'back_skin' | 'emote' | 'title';
    rewardId: string;
  };
}

// NEW: Market listing
interface MarketListing {
  listingId: string;
  cardInstanceId: string;
  sellerId: string;
  price: number;             // BM tokens
  listedAt: Date;
  expiresAt: Date;
}
```

### CSS Architecture

```css
/* Card aging classes */
.card-mint { /* default, no changes */ }
.card-seasoned .fc-frame { border-image: linear-gradient(45deg, #c9a06c, #8b7355) 1; }
.card-veteran::after { content: "VETERAN"; /* small emblem */ }
.card-legend .fc-name { text-shadow: 0 0 20px rgba(255,200,90,0.5); }
.card-immortal { filter: sepia(0.2) saturate(1.2); border: 2px solid #d4af37; }

/* Inspect view */
.inspect-view { position: fixed; inset: 0; z-index: 100; background: rgba(8,10,16,0.95); }
.inspect-card-wrap { transform: scale(var(--zoom, 1)); transition: transform 0.3s ease; }

/* Collection grid */
.collection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.collection-card-thumb { aspect-ratio: 236/332; /* same as full card */ }
.collection-card-thumb.unowned { filter: brightness(0); } /* silhouette */
```

### Performance Considerations

- **Lite mode** (`html.lite`): disable grain, stars, edge sweep, foil animation
- **Card thumbnails** in collection/market use simplified render (no tilt, no animation, reduced layers)
- **Lazy load** card art — only load sprites when card enters viewport
- **Inspect view** loads full-resolution art + all effects
- **Deck mode** only animates active card's foil; others are static

---

## Acceptance Criteria

- [ ] Inspect View: full-screen card examination with zoom (wheel), pan (drag), tilt (mousemove)
- [ ] Card flip works in Inspect View (front/back)
- [ ] Collection Binder: grid view with set grouping, completion progress, silhouette for unowned
- [ ] Market UI: Primary/Secondary tabs, listings with price/floor/volume, buy/sell buttons
- [ ] Pack Opening: ceremonial reveal with rarity-appropriate effects
- [ ] Card Aging: visual changes based on match count (5 stages)
- [ ] Set System: 9 sets defined, completion progress visible, rewards shown
- [ ] Share Card: generates 1080x1080 PNG with card render + branding + QR
- [ ] Card Fusion: UI for combining 3 duplicates into foil version
- [ ] All existing card layers and effects preserved (no regression)
- [ ] Lite mode properly disables heavy effects
- [ ] Mobile: touch-friendly inspect (pinch zoom, drag pan)
