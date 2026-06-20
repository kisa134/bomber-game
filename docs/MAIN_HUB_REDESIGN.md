# Main Hub / Main Menu — Redesign Proposal

Rebuild the main screen from a centered narrow web-card into a real **online-game
main hub** — a spatial screen with a clear primary CTA and secondary navigation.
On our vanilla TS/CSS stack, full-screen, consistent with the new Glass-Terminal
lobby browser and lobby room.

> Guiding line: **the main screen must be a spatial online hub with one obvious
> primary CTA and secondary navigation — not a form centered on a background.**

---

## 1. Why the current main screen is weak (UX)

- **It's a narrow centered card** (`.menu-panel`, ~400px) floating over the scene.
  It reads as a web modal / mobile card, not the home of a real online game.
- **Everything is one column:** logo, wallet, balances, nickname, Play, Practice,
  and the Profile/Leaderboard/Invite links are all stacked at equal-ish weight.
- **No screen architecture / hierarchy.** Primary (Play), secondary (Practice)
  and meta (profile/economy/social) aren't spatially separated — the eye has no
  anchor and no sense of "a system behind the game."
- **The beautiful background is wasted** — the card sits on top of it instead of
  the UI living *in* the scene.
- **No sense of liveness:** no friends/online, no season/featured, no "you're
  part of something" — just buttons.

---

## 2. New architecture

A **full-screen hub** built on a fixed spatial grid, with the background scene
(and hero character) as part of the composition — not a card on top of it:

- **Top status bar** (full width) — identity + economy + meta icons.
- **Central hero / action zone** (left-weighted) — the meme hero + the giant
  **PLAY ONLINE** CTA and **Practice** under it. This is the focal point.
- **Right side modules** (a column of *distinct, varied* widgets, not identical
  cards) — Featured/Season, Friends/online, Top-this-week, Loadout.
- **Bottom utility bar** — quiet meta nav (Profile / Leaderboard / Invite /
  How to play / Settings).

The hero zone owns the left/center; modules frame the right; status + utility cap
top and bottom. No central narrow column, no wall of identical rounded cards.

---

## 3. Per-zone breakdown

### 3.1 Top area — status bar
Full-width, low-key (doesn't compete with Play):
- **Left:** wordmark "BomberMeme.fun" (small).
- **Center/right:** the economy + rank, read-only at a glance —
  **🌱 League + rating**, **🪙 chips**, **💎 token (+ ≈$ when a price exists)**.
- **Right edge:** **🔗 Wallet** (connect / address), **⚙ Settings**, **❓ Help**,
  and a future **🔔 notifications** dot.
Tapping a balance → Bank; tapping rank → Profile.

### 3.2 Central hero / action zone (the focal point)
- The **meme hero character** rendered large (reuse our skin art — e.g. the
  player's equipped character, idle/looping), anchored left-of-center, lit by the
  scene.
- **Primary CTA: `🌐 PLAY ONLINE`** — the biggest, brightest element on the
  screen; one glance = "this is how I start." → opens the **Lobby Browser**.
- **Secondary: `🤖 Practice vs bots`** — clearly below/smaller than Play, still
  prominent. → opens the Practice flow.
- **Nickname** field tucked just under the CTAs (small), since it's set once.
- Everything else stays OUT of this zone — it's only "how do I play."

### 3.3 Right side modules (the "living game" rail)
Distinct widgets of **varied size/shape** (not a stack of clones):
- **★ Featured / Season** (top, banner-shaped): current season / event / spotlight
  mode. → jumps into that mode. *(stub "Season 1 — Soon" until live)*
- **👥 Friends / online** (list): who's online, who's in a lobby, with inline
  **Join / Invite**. *(needs presence backend — stub now)*
- **🏆 Top this week** (compact 3-row peek of the leaderboard, real data). →
  full Leaderboard.
- **🎭 Loadout** (small): your current character with a quick **Change** → opens
  skin selection. *(secondary module, NOT a primary button)*

### 3.4 Bottom utility / social / economy bar
A quiet horizontal strip of meta entries (icon + label):
**👤 Profile · 🏆 Leaderboard · 👥 Invite & earn · ❓ How to play · ⚙ Settings**.
These are tertiary — present and tidy, never competing with Play.

---

## 4. Action hierarchy

- **Primary (one, dominant):** **PLAY ONLINE** → Lobby Browser.
- **Secondary:** **Practice vs bots** → training flow.
- **Tertiary (meta, ambient):** status-bar economy/rank/wallet; right modules
  (featured / friends-join / top-week / loadout); bottom utility links.

Rule: from across the room you should see exactly **one** glowing button (Play),
with Practice as the obvious runner-up. Everything else is calm.

---

## 5. Wireframe (block layout)

**Desktop (recommended — hero-left + module-rail):**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ BomberMeme.fun       🌱 Champion 1,820   🪙 12,500   💎 0 ≈$0    🔗 Wallet  ⚙  ❓ │
├───────────────────────────────────────────────┬──────────────────────────────┤
│                                               │  ★ SEASON 1 · TOXIC ARENA     │
│         ┌───────────────────────┐             │     live event ▸  (Soon)      │
│         │   (big meme hero —    │             ├──────────────────────────────┤
│         │    your character)    │             │  👥 FRIENDS · 3 online         │
│         └───────────────────────┘             │   🐶 Doge   in lobby   [Join] │
│                                               │   🚀 Musk   online     [Inv]  │
│      ╔════════════════════════════════╗       │   🐸 Pepe   online     [Inv]  │
│      ║       🌐   PLAY ONLINE          ║       ├──────────────────────────────┤
│      ╚════════════════════════════════╝       │  🏆 TOP THIS WEEK             │
│      [      🤖  Practice vs bots      ]        │   1 Vasya   1,920             │
│                                               │   2 Kir     1,740             │
│      nickname [ pumper________ ]              │   3 You     1,610             │
│                                               ├──────────────────────────────┤
│                                               │  🎭 LOADOUT   🐶 Doge  [Change]│
├───────────────────────────────────────────────┴──────────────────────────────┤
│   👤 Profile      🏆 Leaderboard      👥 Invite & earn      ❓ How to play   ⚙  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Mobile (stacked, full-screen, scrolls — never a card):**
```
┌────────────────────────────┐
│ 🌱1,820  🪙12.5k  💎0  🔗 ⚙ │  status
├────────────────────────────┤
│      (hero character)       │
│  ╔══════════════════════╗   │
│  ║   🌐 PLAY ONLINE     ║   │  primary
│  ╚══════════════════════╝   │
│  [  🤖 Practice vs bots ]   │  secondary
│  nickname [ pumper___ ]     │
├────────────────────────────┤
│ ★ Season 1 (Soon)          │  modules
│ 👥 Friends · 3 online ▸    │  (collapsible)
│ 🏆 Top this week ▸         │
│ 🎭 Loadout: Doge [Change]  │
├────────────────────────────┤
│ 👤  🏆  👥  ❓  ⚙          │  utility row
└────────────────────────────┘
```

---

## 6. Navigation logic (hub = start of the whole screen system)

```
MAIN HUB
 ├─ 🌐 PLAY ONLINE        → Lobby Browser (full-screen server browser)
 │                           → Lobby Room → Game → Result → (back to Hub/Lobby)
 ├─ 🤖 Practice vs bots    → Practice setup (difficulty + bots) → Game → Result
 ├─ status: 🔗 Wallet      → connect / Bank (deposit/withdraw)
 ├─ status: rank/🪙/💎     → Profile / Bank
 ├─ module: Featured       → that mode (or Lobby Browser filtered)
 ├─ module: Friends [Join] → join that friend's lobby by code
 ├─ module: Top this week  → Leaderboard
 ├─ module: Loadout        → Skin selection
 └─ utility: Profile / Leaderboard / Invite / Help / Settings → their screens
```

The hub is the root; every other screen is reached from here and returns here.

---

## 7. Visual principles (premium hub, not a modal card)

- **The scene IS the screen.** Hero + UI composed over the full-bleed background
  video; no floating central card. The video isn't wallpaper behind a form — it's
  the stage.
- **One hero, one glow.** PLAY ONLINE is the brightest, largest thing; the status
  bar and modules are quieter (lower contrast, smaller).
- **Varied modules, not clones.** Different shapes/sizes (a wide banner, a list,
  a compact peek, a tiny loadout chip) — avoids the "wall of identical rounded
  cards" web look.
- **Glassmorphism, consistent** with lobby browser/room: frosted panels, thin
  white borders, soft glows, the scene showing through.
- **Generous negative space** on the hero side — space reads as "a screen," not a
  cramped dialog. Adult, calm, confident.
- **Stylized but serious.** Keep the meme-crypto character/vibe in the hero art
  and accents; keep the *layout/typography* clean and grown-up.
- **Motion with restraint:** hero idle/loop, subtle module hover; nothing spins.

---

## 8. Layout directions (pick one)

**A. Hero-left + module rail (RECOMMENDED).** Big hero + Play on the left,
distinct widgets on the right, status top, utility bottom. Best fits our single
dominant CTA + meme hero + existing modal sections; least risky to build on our
stack; reads instantly. → *go with this.*

**B. Top-tabs + center hero (Fortnite-style).** Top tab bar (PLAY / LOADOUT /
LEADERBOARD / SHOP / PROFILE), centered hero + Play, news ticker bottom. Great
when there are many top-level destinations — we don't have enough yet; tabs would
feel empty. Revisit when Shop/Battle-pass exist.

**C. Left nav rail + content (console dashboard).** Vertical icon rail left,
hero center, widgets right. Powerful but heavier/more "app-like"; overkill for
our number of sections today.

**Recommendation: A now**, with a clean path to **B** later once Shop / Season /
Battle-pass are real (the modules become tabs).

---

## 9. What's real vs roadmap (so we build honestly)

| Element | Status |
|---|---|
| PLAY ONLINE → Lobby Browser | ✅ live |
| Practice vs bots | ✅ live |
| Wallet / chips / token / ≈USD / rank | ✅ live |
| Profile / Leaderboard / Invite / Settings / Help | ✅ live |
| Loadout (→ skin selection) | 🟡 wire to existing skins |
| Top-this-week peek | 🟡 real leaderboard data, new widget |
| Friends / online presence | 🔴 needs a presence backend (stub now) |
| Featured / Season / Battle-pass / Quests | 🔴 future (stub "Soon") |

## 10. Build order (incremental, nothing breaks)

1. **Layout shell:** full-screen hub = status bar + hero/CTA zone + utility bar,
   re-using all existing buttons/handlers. *(biggest feel win, pure client/CSS)*
2. **Hero art** anchored in the action zone (equipped character, idle loop).
3. **Module rail:** Top-this-week (real data) + Loadout (→ skins); Featured &
   Friends as clearly-labelled "Soon" stubs.
4. Later: Friends presence (backend), Season/Shop (own features) → optionally
   evolve to layout B (top tabs).

Steps 1–3 are client/CSS on existing data and deliver the AAA-hub feel; 4 are
separate features.
