# BomberMeme Audio System v2 -- Swarm Agent Prompt

## Mission
Extend the existing AAA-level audio engine with dynamic/adaptive music, biome-specific ambient soundscapes, character voice lines, card system audio, expanded UI sounds, and 3D positional audio for World Mode.

## CRITICAL RULES
- **NEVER break existing audio system** -- the Web Audio engine (spatial explosions, Shepard tone, sub-bass, sidechain ducking, music visualizer, radio system) must ALL continue working
- **NEVER modify arena gameplay code** (`apps/client/src/arena/`, `apps/server/src/arena/`)
- Project is **ESM** (`"type": "module"`) -- all imports need `.js` suffix
- TypeScript strict mode
- Cache all generated audio files in `/public/sounds/` or `/public/music/` or `/public/voices/`

## What Already Exists (Study Before Building)

The audio engine is in `apps/client/src/game/assets.ts` -- an extremely advanced system:

### Current Features (MUST preserve)
- `Assets` class with Web Audio API backend
- `play(key)` -- one-shot SFX with per-key gain levels
- `playReverb(key)` -- epic reverb + echo via ConvolverNode + feedback delay
- `explosion(power, vol, pan)` -- 3-layer spatial (sample + sub-bass thump + high crack), stereo panned
- `playGore()` -- fully procedural filtered noise + sine thud
- `crateBreak(vol, pan)` -- 3-layer procedural woody smash
- `clatter(vol, pan, bony)` -- filtered noise clicks
- `shepard(level)` -- 6-osc ever-rising pitch illusion
- `subBass(intensity)` -- 20Hz threat hum with throb
- `duck(amount, recoverMs)` -- sidechain music ducking under SFX
- `rewardDing()` -- procedural casino chime (3 rising triangle notes)
- `countBlip(freq)` -- procedural sine tick
- `playMusic(key)` -- radio system with 5-track shuffle bag, skip, repeat-one
- `musicLevel()` -- AnalyserNode for hub visuals
- `setMusicEnabled/setSfxEnabled` -- toggle settings
- `setMusicVolume/setSfxVolume` -- slider controls
- Sidechain mixer with `musicScale` and `duckGain`

### Current audio files (24 total)
```
/sounds/explode.wav, place.ogg, block_break.wav, pickup.wav,
/sounds/death.ogg, die.mp3, wound.mp3, wound2.mp3, join.wav,
/sounds/countdown.ogg, go.mp3, ui_click.wav,
/sounds/first_blood.mp3, sudden_death.mp3, victory.mp3, defeat.mp3, draw.mp3,
/sounds/music_lobby.mp3 x 5, music_battle.mp3
```

**Read `assets.ts` COMPLETELY (800+ lines) before writing any code.**

---

## Agent Assignments

### Agent 1: Dynamic Music System + Biome Themes
**Goal:** Add adaptive music intensity + 8 biome ambient tracks

**Files to create:**
- `apps/client/src/audio/DynamicMusic.ts` -- adaptive music controller
- `apps/client/src/audio/AmbientSystem.ts` -- biome ambient soundscapes
- `apps/client/src/audio/biomeThemes.ts` -- biome-to-music mapping

**Files to modify:**
- `apps/client/src/game/assets.ts` -- add DynamicMusic integration (minimal hooks)

**DynamicMusic.ts specification:**
```typescript
export interface MusicStem {
  key: string;        // e.g. "battle_ambient", "battle_perc", "battle_lead"
  layer: number;      // 1, 2, or 3
  baseGain: number;
}

export class DynamicMusic {
  private stems: Map<string, HTMLAudioElement> = new Map();
  private intensity: number = 0;
  
  // Load stems (3 layers per context: battle, sudden_death, etc.)
  async loadStems(context: string, stems: MusicStem[]): Promise<void>;
  
  // Set intensity 0..1, crossfades layers smoothly (500ms ramp)
  // 0.0-0.3: layer 1 only (ambient)
  // 0.3-0.6: layers 1-2 (add percussion)
  // 0.6-1.0: layers 1-2-3 (full intensity)
  setIntensity(intensity: number): void;
  
  // Start/stop
  play(context: string): void;
  stop(): void;
  
  // Fade to silence (for transitions)
  fadeOut(ms: number): Promise<void>;
  fadeIn(ms: number): Promise<void>;
}
```

**AmbientSystem.ts specification:**
```typescript
export enum BiomeType {
  GRASS, NEON, IRON, WILD, GRATE, INDUSTRIAL, SANDS, VOID
}

export class AmbientSystem {
  private ctx: AudioContext | null = null;
  private currentBiome: BiomeType | null = null;
  private crossfadeGain: { old: GainNode | null; new: GainNode | null } = { old: null, new: null };
  
  // Set biome with 2-second crossfade
  setBiome(biome: BiomeType): void;
  
  // Procedural ambient generators (Web Audio API)
  private windSynth(): AudioNode;      // filtered noise + slow LFO
  private neonHum(): AudioNode;        // sine + slight detune
  private birdChirp(): void;           // FM synthesis occasional
  private dripEcho(): AudioNode;       // rhythmic drop
  private steamHiss(): AudioNode;      // noise + bandpass
  
  // Occasional "sparkle" sounds (procedural, low frequency)
  private scheduleSparkle(biome: BiomeType): void;
  
  stop(): void;
}
```

**Music generation prompts (for Suno AI or similar):**
Generate these tracks and save to `/public/music/`:

| File | Prompt (Suno) |
|------|----------------|
| `music_battle_layer1.mp3` | `"Dark electronic ambient, Bomberman game, minimal synth pad, atmospheric, 120 BPM, seamless loop, no vocals, tension building"` |
| `music_battle_layer2.mp3` | `"Add rhythmic percussion, tribal electronic drums, pulsing bass, same key as layer 1, 120 BPM, game music stem"` |
| `music_battle_layer3.mp3` | `"Full intensity electronic battle music, heavy drums, distorted synth lead, energetic, same key, 120 BPM, game music stem"` |
| `music_grasslands.mp3` | `"Peaceful grassland exploration, acoustic guitar, light synth, serene, 100 BPM, game ambient, seamless loop, no vocals"` |
| `music_neon.mp3` | `"Neon cyberpunk city, synthwave, driving bass, glowing atmosphere, 128 BPM, game ambient, loop"` |
| `music_iron.mp3` | `"Dark industrial church, Gregorian chant echoes, heavy machinery, ominous, 90 BPM, game ambient"` |
| `music_wild.mp3` | `"Tribal nature, wooden drums, pan flute, forest ambience, primal, 110 BPM, game exploration"` |
| `music_grate.mp3` | `"Underground jazz noir, muted trumpet, double bass, mysterious, 95 BPM, game ambient"` |
| `music_industrial.mp3` | `"Heavy industrial factory, clanging metal, dark techno, 130 BPM, game soundtrack"` |
| `music_sands.mp3` | `"Mystical desert, oud, sitar, wind sounds, ancient ruins, 85 BPM, game ambient"` |
| `music_void.mp3` | `"Cosmic void, deep space drone, ethereal choir, mysterious, 70 BPM, dark ambient"` |

**For Phase 1:** Use placeholder MP3s (copy existing music_battle.mp3 with different names) if Suno generation isn't available yet. The code must work with whatever files exist.

### Agent 2: Card System Audio + UI Sounds
**Goal:** Sound design for card experience + expanded UI sounds

**Files to create:**
- `apps/client/src/audio/CardAudio.ts` -- all card-related sounds
- `apps/client/src/audio/UISounds.ts` -- expanded UI sound library
- `apps/client/public/sounds/card/` -- card SFX directory
- `apps/client/public/sounds/ui/` -- UI SFX directory

**CardAudio.ts specification:**
```typescript
export class CardAudio {
  // Hover: soft metallic shimmer (procedural -- filtered high sine cluster)
  cardHover(): void;
  
  // Flip: snappy paper flip sound (can synthesize: short noise burst + pitch drop)
  cardFlip(): void;
  
  // Inspect enter: deep bass hum + zoom
  inspectOpen(): void;
  inspectClose(): void;
  
  // Pack opening sequence:
  packShake(): void;      // cardboard rattle (procedural: filtered noise bursts)
  packBurst(): void;      // explosive tear (existing explosion SFX layered)
  
  // Reveal by rarity -- increasingly epic:
  revealCommon(): void;    // simple flip sound
  revealRare(): void;      // flip + soft chime (rewardDing variant)
  revealEpic(): void;      // flip + gold shimmer (sparkle procedural)
  revealLegendary(): void; // flip + orchestral hit (layer: low thud + rising chime)
  revealMythic(): void;    // flip + explosion + screen shake trigger
  
  // Collect All: rising cascade
  collectAll(): void;      // 5-note rising arpeggio (procedural)
  
  // Fusion:
  fusionStart(): void;     // magical swirl (procedural: rising FM tones)
  fusionComplete(): void;  // transform "shing" (high sine + harmonics)
  
  // Market:
  marketBuy(): void;       // cash register cha-ching (procedural)
  marketSell(): void;      // softer register sound
  
  // Set completion:
  setComplete(): void;     // fanfare (procedural: 4-note major chord)
}
```

**UISounds.ts specification:**
```typescript
export enum UISoundType {
  HOVER = 'hover',
  CLICK = 'click',
  CONFIRM = 'confirm',
  CANCEL = 'cancel',
  TOGGLE_ON = 'toggle_on',
  TOGGLE_OFF = 'toggle_off',
  TAB_SWITCH = 'tab_switch',
  SLIDER = 'slider',
  ERROR = 'error',
  SUCCESS = 'success',
  NOTIFICATION = 'notification',
  SCREEN_TRANSITION = 'transition',
}

export class UISounds {
  play(type: UISoundType): void;
  
  // All sounds procedural (Web Audio API synthesis)
  // HOVER: 2kHz sine, 30ms, very quiet (0.04 gain)
  // CLICK: current ui_click.wav (keep!)
  // CONFIRM: two rising notes (1.5kHz->2kHz), triangle, 0.1s
  // CANCEL: low pitch drop (300Hz->100Hz), sine, 0.15s
  // TOGGLE_ON: snappy 1kHz beep, 50ms
  // TOGGLE_OFF: softer 800Hz beep, 50ms
  // TAB_SWITCH: quick "swoosh" (noise sweep 2kHz->500Hz), 0.15s
  // SLIDER: tick-tick (short 2kHz blips at 60Hz rate while dragging)
  // ERROR: low buzz "bzzt" (square wave 150Hz, 0.2s)
  // SUCCESS: 3-note rising major chord (procedural)
  // NOTIFICATION: gentle bell (sine + harmonic decay, 0.3s)
  // SCREEN_TRANSITION: whoosh (noise bandpass sweep), 0.3s
}
```

**Implementation note:** Card and UI sounds should be synthesized procedurally using the existing Web Audio patterns from `assets.ts`. Only use file-based sounds when procedural isn't sufficient.

### Agent 3: Character Voice System + Power-Up Sounds
**Goal:** Voice lines for characters + distinct power-up sounds

**Files to create:**
- `apps/client/src/audio/VoiceSystem.ts` -- voice line player
- `apps/client/src/audio/PowerUpSounds.ts` -- distinct pickup sounds
- `apps/client/src/audio/voiceData.ts` -- voice line definitions for 100 characters
- `apps/client/public/voices/` -- voice line cache directory

**VoiceSystem.ts specification:**
```typescript
export type VoiceLineType = 'spawn' | 'kill' | 'death' | 'ability' | 'taunt' | 'victory' | 'low_hp';

export interface VoiceLine {
  characterId: string;   // "hero_0", "hero_1", etc.
  type: VoiceLineType;
  text: string;          // The spoken text
  audioUrl: string;      // /voices/{characterId}/{type}.mp3
}

export class VoiceSystem {
  private lastPlayTime: Map<string, number> = new Map(); // rate limiting
  private readonly COOLDOWN_MS = 3000;  // min 3 seconds between lines from same character
  
  // Play a voice line (respects SFX enabled, rate-limited)
  playLine(characterId: string, type: VoiceLineType): void;
  
  // Check if voice line exists (for 3 starter heroes, all lines present)
  hasLine(characterId: string, type: VoiceLineType): boolean;
  
  // Preload voice lines for a character
  preloadCharacter(characterId: string): Promise<void>;
}
```

**Voice line definitions for 3 starter heroes (complete):**

```typescript
export const VOICE_DATA: Record<string, Partial<Record<VoiceLineType, string>>> = {
  hero_0: {  // Zero -- Reality Hacker
    spawn: "Time to rewrite the rules.",
    kill: "System override complete.",
    death: "Connection... lost...",
    ability: "Chain reaction initiated!",
    taunt: "Your code is deprecated.",
    victory: "Root access granted.",
    low_hp: "Critical error...",
  },
  hero_28: {  // Wild -- Circle Keeper
    spawn: "Nature always finds a way.",
    kill: "Returned to the earth.",
    death: "The circle... breaks...",
    ability: "Thorns, rise!",
    taunt: "You cannot tame the wild.",
    victory: "The forest remembers.",
    low_hp: "Roots weakening...",
  },
  hero_70: {  // Scorp -- Ghost of Sands
    spawn: "The storm approaches.",
    kill: "Buried in sand.",
    death: "Sand... takes... all...",
    ability: "Sandstorm!",
    taunt: "You are but dust.",
    victory: "The dunes are mine.",
    low_hp: "Storm fading...",
  },
  // Remaining 97 characters: STUBS (empty strings, voice lines not yet generated)
};
```

**Voice generation via ElevenLabs (for 3 starter heroes):**
- Character voices:
  - Zero: Use ElevenLabs "Edward" voice (cocky villain) with lower pitch
  - Wild: Use ElevenLabs "Britney" voice (calm female) with softer settings
  - Scorp: Use ElevenLabs "Malyx" voice (deep demon) with reverb
- Generate all 7 lines per character -> save to `/public/voices/{hero_id}/{type}.mp3`
- For remaining 97 characters: leave stubs, generate later

**PowerUpSounds.ts specification:**
```typescript
export class PowerUpSounds {
  // All synthesized procedurally (no audio files needed)
  
  bomb(): void;      // Heavy "thud" + metallic clink (low sine + high tick)
  fire(): void;      // Whoosh + flame crackle (noise sweep + filtered crackle)
  speed(): void;     // Electric zap + rev (FM sweep up)
  kick(): void;      // Spring "boing" + shoe squeak (sine bounce + noise squeak)
  wallPass(): void;  // Ethereal phase + whoosh (sine + filter sweep)
  health(): void;    // Healing chime + heartbeat (3-note chord + low thump)
}
```

### Agent 4: 3D Positional Audio (World Mode)
**Goal:** Extend spatial audio to open world

**Files to create:**
- `apps/client/src/audio/PositionalAudio.ts` -- 3D audio manager
- `apps/client/src/audio/WorldAudio.ts` -- World Mode audio integration

**PositionalAudio.ts specification:**
```typescript
export interface AudioListener {
  x: number;
  y: number;
}

export class PositionalAudio {
  private listener: AudioListener = { x: 0, y: 0 };
  private ctx: AudioContext | null = null;
  
  // Update listener position (call every frame with camera/player pos)
  setListenerPosition(x: number, y: number): void;
  
  // Play a sound at a world position
  // Automatically calculates pan and volume falloff
  playAt(soundKey: string, x: number, y: number, baseVolume?: number): void;
  
  // Specific world sounds:
  playExplosionAt(x: number, y: number, power: number): void;
  playFootstepAt(x: number, y: number, isEnemy: boolean): void;
  playAmbientSource(soundKey: string, x: number, y: number, radius: number): void;
  
  // Internal: calculate stereo pan (-1 to 1) from listener-relative position
  private calcPan(sx: number, sy: number): number;
  
  // Internal: calculate distance falloff (inverse square)
  private calcFalloff(sx: number, sy: number): number;
  
  // Internal: play through existing Assets.spatial system
  private playSpatial(soundKey: string, pan: number, volume: number): void;
}
```

**WorldAudio.ts specification:**
```typescript
export class WorldAudio {
  private dynamicMusic: DynamicMusic;
  private ambient: AmbientSystem;
  private positional: PositionalAudio;
  private voice: VoiceSystem;
  
  // Called on game state changes:
  onBiomeChange(biome: BiomeType): void {
    this.ambient.setBiome(biome);
    // Also switch music if different biome theme
  }
  
  onCombatStart(): void {
    this.dynamicMusic.setIntensity(0.8);
  }
  
  onCombatEnd(): void {
    this.dynamicMusic.setIntensity(0.2);
  }
  
  onExplosion(x: number, y: number, power: number): void {
    this.positional.playExplosionAt(x, y, power);
  }
  
  onCharacterSpawn(characterId: string): void {
    this.voice.playLine(characterId, 'spawn');
  }
  
  onKill(killerId: string): void {
    this.voice.playLine(killerId, 'kill');
  }
  
  onDeath(characterId: string): void {
    this.voice.playLine(characterId, 'death');
  }
  
  update(playerX: number, playerY: number): void {
    this.positional.setListenerPosition(playerX, playerY);
  }
}
```

---

## Integration Points

### Arena Mode (existing)
- `Assets` class handles all arena audio -- no changes needed
- DynamicMusic optionally enhances battle music (new feature, opt-in)

### World Mode (new)
- `WorldAudio` class initialized in `campaign/main.ts`
- Calls `onBiomeChange()` when player enters new biome chunk
- Calls `onCombatStart/End()` based on nearby enemies
- Calls `update()` every frame with player position

### Card System (new)
- `CardAudio` class initialized when opening collection/market
- Called by InspectView, PackOpening, CardFusion UI components

### Hub/UI (existing)
- `UISounds` replaces direct `assets.play("ui")` calls
- Add hover sounds to all interactive elements

---

## Acceptance Criteria

- [ ] DynamicMusic crossfades between 3 layers based on intensity (0..1)
- [ ] AmbientSystem transitions between biome ambients (2-second crossfade)
- [ ] CardAudio: all 15+ card events have distinct sounds
- [ ] UISounds: all 12 interaction types have sounds
- [ ] VoiceSystem: 3 starter heroes have all 7 voice lines each
- [ ] PowerUpSounds: 6 distinct pickup sounds (procedural)
- [ ] PositionalAudio: sounds pan and fade with distance in World Mode
- [ ] All existing audio features preserved (no regression)
- [ ] Settings toggles work for all new audio types
- [ ] No TypeScript build errors
- [ ] Lite mode disables ambient/heavy effects
