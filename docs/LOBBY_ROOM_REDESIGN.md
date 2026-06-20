# Lobby Room / Pre-Match Room — Redesign Proposal

Full redesign of the staging room (`#room`) into a wide, premium pre-match lobby —
on our vanilla TS/CSS stack, consistent with the new full-screen Glass-Terminal
lobby browser. No central narrow card, no popup-as-screen.

---

## 1. Why the current screen is weak (UX critique)

- **One narrow vertical card.** Everything (title, code, player list, ready,
  raise-stake, start, leave, emotes) is a single stacked column in a ~360px
  `.panel`. It reads like a settings dialog, not a battle-game lobby.
- **No information hierarchy.** Pot, players, and actions all have the same visual
  weight, so nothing is instantly readable. The player can't answer "what's on
  the line / who's ready / what do I press" in 1–2 seconds.
- **Players in a flat list.** A vertical `<ul>` of rows doesn't feel like "seats
  at a table." There's no sense of a 4-player arena filling up.
- **Stakes are a text line in the title.** "💎1,000 table · pot 💎4,000 ≈$312" is
  buried; the single most important fact (what you can win) isn't a hero element.
- **Buttons collide.** Ready / Raise / Start / Leave are stacked together; host
  and player actions aren't separated, so it's noisy and easy to misclick.
- **No skin selection at all here.** Skins are randomly assigned; the player has
  no character identity in the lobby — a big miss for a battle game.
- **No chat, no room-type clarity, no region/ping, no reconnect cue.**

Net: it works, but it feels like a web form, not a place you wait with rivals
before a fight.

---

## 2. New architecture

A **full-screen, multi-zone lobby** (like `#lobby` browser), not a card. One wide
glass shell (`min(1100px, 100%)`) holding a fixed grid of zones so the eye always
finds the same thing in the same place:

- **Top bar** — room identity (public/private, code, invite, region/ping, leave).
- **Center stage** — the two things that matter most, side by side:
  the **player seats** (a 2×2 arena grid) and the **prize/stakes hero**.
- **Left rail** — **your character** (skin stage) + your quick stats.
- **Under the seats** — **match settings** (timer / mode / map).
- **Right rail** — **chat + reactions**.
- **Bottom action bar** — a single, unambiguous primary action (READY / START),
  with host tools grouped to one side.

Desktop = 3 columns (left rail · center · right rail) with the action bar pinned
at the bottom. Mobile = the same zones stacked in priority order (seats → prize →
character → settings → chat), still full-screen and scrollable, never a modal.

Principle: **seats + prize are the hero; everything else frames them.**

---

## 3. Main zones (at a glance)

| Zone | Job | Who edits |
|---|---|---|
| Top bar | Room identity, type, code/invite, region/ping, leave | host toggles type |
| Player seats | Who's here, ready, host, profile, kick | host kicks |
| Prize / stakes | Pot + buy-in in tokens AND $, winner-takes-all | host raises (vote) |
| Match settings | Timer / mode / map | host edits, others read |
| Character stage | Pick & preview your skin | you |
| Chat + reactions | Social, emotes (cooldown) | everyone |
| Action bar | READY / START + host tools | role-dependent |

---

## 4. Per-zone breakdown

### 4.1 Player slots area (the arena table)
- **2×2 seat grid** (matches MAX_PLAYERS_PER_ROOM = 4), not a column. Each seat is
  a card; empty seats render as **"＋ Invite"** / **"Waiting…"** silhouettes so
  the room visibly fills up.
- Each occupied seat shows: **character avatar** (their skin sprite, tinted with
  their player color), **nickname** (+ "(you)"), **READY/▢ status pill**, a
  **👑 HOST** marker, and a **series score** (🏆 wins) when a rematch series is on.
- **Click a seat → player card** (stats/profile) — we already have
  `onOpenProfile`. **Hover (desktop) → quick preview** tooltip (rating, W/L).
- **Host gets a ✕** on every other seat (already built) — placed top-right of the
  seat card, not inline with the name.
- A seat turns **green-bordered when ready**, dim when not — so "who are we
  waiting for" is obvious at a glance.

### 4.2 Stake / info area (prize hero)
- A **big, high-contrast PRIZE block** — the visual anchor of the screen:
  - **POT** as the headline figure: `💎 4,000` (token) or `🪙 4,000` (chips).
  - **USD equivalent** directly under it for real-token tables: **`≈ $312.00`**
    (we have `usdSuffix`/live price). For chips: a small "free play" tag, no $.
  - **Buy-in per player**: `💎 1,000 / player`.
  - **Rule line**: `Winner takes all · 5% rake`. (Pulls the rake % from config.)
- Updates live as players join (pot = buy-in × seated) so value visibly grows.
- For chips vs real token, the block is **color-coded** (gold = chips, toxic-green
  = real token / Arena) to reinforce the two economies.

### 4.3 Match settings area
- A compact **settings strip** under the seats: **⏱ Duration** (3:00 / 5:00),
  **Mode** (Last Man Standing — others "Soon"), **Map/Format** (Soon).
- **Host sees editable controls** (segmented buttons for duration); **everyone
  else sees the same values read-only** with a small "host decides" hint.
- Server already has match length; duration becomes a host-set room option
  (new, small protocol field) — shown here.

### 4.4 Skin selection area (character stage)
- A **left-rail "character stage"**, not a buried button:
  - The player's chosen character shown **large**, with a **slow idle
    animation** (we have directional walk frames `skin_N_*` — cycle them, or a
    gentle bob/rotate of the static `skin_N`).
  - **◀ ▶ arrows** (or a small thumbnail strip) to flip between skins; selecting
    updates your seat avatar instantly.
  - A glow/pedestal behind the character for the "premium splash" feel.
- Selection sends your skin to the server for this match (server still dedupes so
  no two players look identical). Keep it lightweight: one rAF loop, paused when
  the match starts.

### 4.5 Host controls
- Grouped into a **distinct host zone** (right side of the action bar + inline seat
  ✕), never mixed with the player's own buttons:
  - **▶ START** (primary, enabled only when ready-conditions met),
  - **⬆ Raise stake** (opens the vote — with a confirmation),
  - **🔓/🔒 Public/Private** toggle,
  - **⏱ Timer / Mode** (in the settings strip),
  - **✕ Kick** (per seat),
  - **👑 Make host** (transfer — contextual, in a seat's ⋯ menu).
- Host-only controls are visually tagged (a subtle "HOST" chip) so it's clear
  these aren't available to everyone.

### 4.6 Chat / reactions
- **Right rail**: a slim **chat** (message log + input) that doesn't crowd the
  seats. On mobile it collapses to a tab/sheet so it never blocks the lobby.
- **Emoji reactions** sit just above the chat input: a row of quick emotes with
  the **existing cooldown** (buttons dim ~1.5s after use). Reactions float over
  the lobby briefly (tie-in to bug #8 "scatter" so they don't stack).
- Chat is a **separate networked feature** (needs protocol + server + light
  moderation) — ship the layout now with the input present; wire the backend as
  its own task.

---

## 5. Wireframe (block layout)

**Desktop (wide):**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ←Leave    🔒 PRIVATE ARENA · Code TST4  [⧉ Copy] [✦ Invite]        🌍 EU · 38ms │
├───────────────────────┬───────────────────────────────┬────────────────────────┤
│  YOUR CHARACTER        │  PLAYER SEATS                 │  CHAT                   │
│  ┌──────────────────┐  │  ┌────────────┐ ┌──────────┐ │  Doge: gg ez            │
│  │   ◀  (idle anim) ▶│  │  │ 🐶 Doge 👑 │ │ 🚀 Musk  │✕│  Musk: bring it          │
│  │     DOGE          │  │  │ ✅ READY    │ │ ▢ …      │ │  …                      │
│  │   [ Selected ]    │  │  └────────────┘ └──────────┘ │  ───────────────────    │
│  └──────────────────┘  │  ┌────────────┐ ┌──────────┐ │  [ type a message… ][▷] │
│  🌱 1,250 · W 12 / L 4 │  │ ＋ Invite   │ │ Waiting… │ │  😀 😂 🔥 😎 (cooldown) │
│                        │  └────────────┘ └──────────┘ ├────────────────────────┤
│                        ├───────────────────────────────┤  PRIZE                  │
│                        │  MATCH SETTINGS               │  ┌───────────────────┐  │
│                        │  ⏱ [3:00] [5:00]  Mode: Last  │  │  POT  💎 4,000     │  │
│                        │  Man  ·  Map: Soon            │  │       ≈ $312.00    │  │
│                        │  (host decides)               │  │  Buy-in 💎1,000/pl │  │
│                        │                               │  │  Winner takes all  │  │
│                        │                               │  │  · 5% rake         │  │
│                        │                               │  └───────────────────┘  │
├───────────────────────┴───────────────────────────────┴────────────────────────┤
│  STATUS  ⏱ Starting in 7s — 3/4 ready        [ ✅ READY UP ]    HOST [⬆ Raise][▶ START]│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Mobile (stacked, full-screen, scrolls — never a modal):**
```
┌────────────────────────────┐
│ ← 🔒 TST4 [Copy][Invite] EU │
├────────────────────────────┤
│ SEATS (2×2)                 │
│ [🐶Doge👑✅][🚀Musk ▢ ✕]    │
│ [＋Invite ][ Waiting…  ]    │
├────────────────────────────┤
│ PRIZE 💎4,000 ≈$312         │
│ buy-in 💎1,000 · winner all │
├────────────────────────────┤
│ CHARACTER  ◀ DOGE ▶ [pick]  │
├────────────────────────────┤
│ ⏱ 3:00 · Last Man (host)   │
├────────────────────────────┤
│ 💬 chat ▸ (tap to expand)   │
├────────────────────────────┤
│ 3/4 ready  [ ✅ READY UP ]  │
│ HOST: [⬆ Raise] [▶ START]   │
└────────────────────────────┘
```

---

## 6. Action hierarchy

- **Primary (one, unmistakable):** **READY UP** for a player; **START** for the
  host once ready-conditions are met. Big, bottom action bar, accent-filled.
- **Secondary:** Invite / Copy code, Select skin, Raise stake (host),
  Public↔Private (host), Leave. Outlined/ghost, in their zones.
- **Contextual (appear on the target):** Kick ✕ and "Make host" 👑 on a seat
  (host only); Open profile on click; quick-preview on hover; emote cooldown
  state on the reaction buttons.

Rule: exactly **one** filled primary button visible per role at any moment.

---

## 7. Host UX vs regular player UX

| | **Host** | **Player** |
|---|---|---|
| Bottom bar | `[▶ START]` (primary) + `[⬆ Raise]` | `[✅ READY UP]` (primary) |
| Seats | ✕ kick + 👑 make-host on others | click = profile only |
| Room type | 🔓/🔒 toggle | sees the badge (read-only) |
| Settings | editable timer/mode | read-only + "host decides" |
| Stake | can raise (→ vote) | can also propose (→ vote), votes |
| Everything else | same as player | — |

Implementation: a single `state.isHost` flag drives which controls render
(host-only nodes simply aren't created for non-hosts), and host-only elements
carry a small **HOST** chip so the distinction is legible, not guessed. Host
tools live on the **right** of the action bar; the player's own action stays on
the left/center — they never interleave.

---

## 8. Visual principles (premium battle-game, not a web popup)

- **Wide & zoned, never a column.** Fixed grid; the same info always in the same
  place. Empty space is fine — it reads as "a screen," not a cramped dialog.
- **Glassmorphism, consistent with the lobby browser:** frosted panels
  (`backdrop-blur`), thin white borders, soft shadows, accent glows; the live
  background video shows through.
- **One hero, strong contrast.** The PRIZE block and the READY/START button are
  the brightest things on screen; everything else is calmer.
- **Seats feel physical.** Card seats with avatars + pedestals/glow, ready-state
  color (green ready / dim waiting), subtle hover lift — like fighters taking
  their corners.
- **Color-coded economy.** Gold = chips, toxic-green/gold = real-token Arena, so
  the stakes' nature is felt instantly.
- **Motion with restraint.** Character idle animation + reactions floating up;
  no spinning everything. Animation pauses on match start to save CPU/mobile.
- **Readable money.** Big pot number, USD directly beneath, buy-in smaller — a
  glance answers "what can I win and what's it worth."

---

## 9. Recommended additions (what makes it feel like strong online-game UX)

- **Ready-check clarity:** a persistent "X/N ready" + per-seat state, and the
  **auto-start countdown** (already built) shown prominently ("Starting in 7s —
  ready up or you'll be dropped").
- **Reconnect indicator:** if a seated player drops (we have a grace window),
  show their seat as **"Reconnecting…"** with a timer instead of empty, so others
  know to wait, not leave.
- **Region / ping:** show **🌍 region + your ms** in the top bar (we have the
  region groundwork + ping) so players judge fairness before staking.
- **Anti-spam on emotes:** keep the cooldown; visually dim the reaction during it
  (already done) and cap floating reactions on screen.
- **Spectator / reserved slots:** a "👁 N watching" chip for live/public rooms;
  reserved-seat logic for invited friends (hold a slot for a pending invite for a
  few seconds).
- **Raise-stake confirmation:** raising the buy-in is real money — require a
  confirm ("Raise to 💎2,000? Everyone must re-accept") before opening the vote,
  and show the live vote tally (already have the vote; add the confirm).
- **Tooltips** on every host-only control ("Only the host can change this") and
  on the rake/pot ("Winner receives the pot minus a 5% house fee").
- **Player-card preview on hover/click:** click opens the full card (built);
  hover shows a mini-preview (rating, league, W/L) without leaving the lobby.
- **Invite flow:** one **✦ Invite** button → copies the link AND shows the code +
  a QR (we have QR in the share card) so friends can join in one tap/scan.
- **Empty-state guidance:** when alone, the seats prompt "Invite friends or wait
  for matchmaking," so a 1-player room never feels broken.

---

## 10. Suggested build order (incremental, nothing breaks)

1. **Layout shell:** convert `#room` to a full-screen, zoned glass screen (CSS +
   HTML), keep existing controls wired. *(visual win, low risk)*
2. **Player seats grid** (2×2) with avatars, ready/host/kick, click-profile.
3. **Prize hero block** (pot + USD + buy-in + rule), color-coded by currency.
4. **Top bar** (type badge, code, invite/QR, region/ping, leave).
5. **Character stage** (skin pick + idle animation) — wire skin→server.
6. **Match settings strip** (host-editable timer; mode/map "Soon").
7. **Reactions polish** (floating/scatter, cooldown) — ties into bug #8.
8. **Chat** (separate networked feature: protocol + server + moderation).

Items 1–4 are pure client/CSS on existing data and deliver most of the feel.
5–6 need small protocol additions (skin choice, room timer/type). 8 is its own
project.
