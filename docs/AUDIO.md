# Audio — asset inventory & coverage

Files live in `apps/client/public/sounds/`. Loaded in `apps/client/src/game/assets.ts`.
Player toggles: **Settings → Music** and **Sound effects** (`settings.music`/`sfx`).

## Music (hub plays a 2-track playlist; battle in-match)
| Key | File | Where |
|---|---|---|
| lobby | music_lobby.mp3 | hub / menus |
| lobby2 | music_lobby2.mp3 | hub (plays after lobby, back-to-back) |
| battle | music_battle.mp3 | in-match |

## SFX present
| Event | File |
|---|---|
| Bomb explode | explode.wav |
| Place bomb | place.ogg |
| Crate break | block_break.wav |
| Power-up pickup | pickup.wav |
| Player hit (lose a life) | wound.mp3 / wound2.mp3 |
| Death | death.ogg / die.mp3 |
| Player join | join.wav |
| Countdown ticks | countdown.ogg |
| GO! | go.mp3 |
| First blood | first_blood.mp3 |
| Sudden death | sudden_death.mp3 |
| Win / lose / draw | victory.mp3 / defeat.mp3 / draw.mp3 |
| UI click | ui_click.wav |

## Coverage check
- ✅ Core loop covered: place, explode, break, pickup, hit, death, win/lose/draw.
- ✅ Match flow: countdown, GO, first blood, sudden death.
- ✅ UI click + join.
- ⚠️ **Gaps to consider** (not blockers):
  - No distinct **kick / wall-pass / speed** power-up sounds (all use generic `pickup`).
  - No **emote** sound (reactions are silent).
  - No **daily-reward / level-up / tournament** stingers (currently reuse `victory`).
  - No **coin/chime** for the "gore off → coins" mode beyond the existing ding.
- ✅ **On/off**: `assets.setMusicEnabled` / `setSfxEnabled` honor the Settings
  toggles; music ducks under loud SFX (explosions) via the sidechain in assets.ts.

## Pre-launch checklist
- [ ] Verify each event above actually fires its sound in a live match.
- [ ] Confirm music on/off persists and the 2-track hub rotation works.
- [ ] Decide if the ⚠️ gaps are worth adding before launch (nice-to-have).
