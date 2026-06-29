# BomberMeme Audio System v2 — Music, Sound & Voice Spec

## What Already Exists (AAA-Level Foundation)

The current audio system in `apps/client/src/game/assets.ts` is one of the most advanced indie game audio engines. **Preserve and extend all of this:**

### Existing Audio Assets (24 files)
```
/sounds/
  Music: music_lobby.mp3 x 5, music_battle.mp3
  SFX: explode.wav, place.ogg, block_break.wav, pickup.wav,
       death.ogg, die.mp3, wound.mp3, wound2.mp3, join.wav,
       countdown.ogg, go.mp3, ui_click.wav
  Announcer: first_blood.mp3, sudden_death.mp3, victory.mp3, defeat.mp3, draw.mp3
```

### Existing Audio Engine Features (Assets class)
| Feature | Implementation | Quality |
|---------|---------------|---------|
| **Spatial explosions** | 3-layer: sample + sub-bass thump + high crack, panned by position | AAA |
| **Procedural gore** | Filtered noise squelch + low sine thud, fully synthesized | AAA |
| **Shepard tone** | 6-oscillator ever-rising pitch illusion for round-end tension | AAA |
| **Sub-bass threat** | 20Hz + 40Hz + 60Hz sine with throb, felt not heard | AAA |
| **Sidechain ducking** | Music auto-dips under explosions, recovers in ~200ms | AAA |
| **Music visualizer** | AnalyserNode -> frequency data for hub visuals | AAA |
| **Radio system** | 5-track shuffle-bag playlist, skip, repeat-one, "now playing" chip | AAA |
| **Reverb + echo** | ConvolverNode + feedback delay for first_blood | AAA |
| **Reward ding** | Procedural casino chime (triangle osc, 3 rising notes) | AAA |
| **Crate break** | 3-layer procedural: woody tok + splinter crack + crumble rattle | AAA |
| **Clatter** | Filtered noise clicks for bone/wood debris | AAA |
| **Count blip** | Sine beep for number ticking | AAA |
| **Volume controls** | Separate music/sfx sliders, on/off toggles | Standard |

---

## NEW: Audio System v2

### A. Dynamic Music System (Adaptive Intensity)

Inspired by DOOM (2016) -- music intensity changes based on gameplay state.

**For Arena Mode:**
| Game State | Music Layer | Description |
|------------|-------------|-------------|
| Exploration (no enemies close) | Layer 1 only | Ambient electronic, low energy |
| Tension (bombs placed nearby) | Layers 1-2 | Adds percussion, heartbeat bass |
| Combat (explosions, kills) | Layers 1-2-3 | Full drums, synth leads |
| Sudden Death | Layers 1-2-3 + Shepard | All layers + ever-rising tension |
| Clutch (1v1, low time) | Layer 3 prominent | High energy, cut the ambient |

**Implementation:**
```typescript
interface MusicStem {
  key: string;        // e.g. "battle_ambient", "battle_perc", "battle_lead"
  layer: number;      // 1, 2, or 3
  baseGain: number;
}

class DynamicMusic {
  private intensity: number = 0;  // 0..1
  private stems: Map<string, HTMLAudioElement> = new Map();
  
  setIntensity(intensity: number): void {
    // Crossfade between layers based on intensity
    // 0.0-0.3: layer 1 only
    // 0.3-0.6: layers 1-2
    // 0.6-1.0: layers 1-2-3
    // Smooth transitions (500ms ramp)
  }
}
```

**Generate stems via Suno AI:**
- Prompt: `"Electronic game music, Bomberman-inspired, {layer_description}, 120 BPM, seamless loop, no vocals, game soundtrack"`
- Layer 1: "dark ambient synth pad, minimal, atmospheric"
- Layer 2: "add rhythmic percussion, tribal drums, tension building"
- Layer 3: "full intensity, heavy drums, distorted synth lead, energetic"

### B. World Mode Music -- 7 Biome Themes

Each biome in World Mode gets unique ambient music:

| Biome | Music Style | Suno Prompt |
|-------|------------|-------------|
| Grasslands | Peaceful, acoustic + light electronic | `"Serene grassland exploration music, acoustic guitar, light synth, peaceful, 100 BPM, game ambient, seamless loop"` |
| Neon City | Cyberpunk, synthwave | `"Neon cyberpunk city music, synthwave, driving bass, glowing atmosphere, 128 BPM, game soundtrack, loop"` |
| Iron Church | Dark choral, industrial | `"Dark industrial church music, Gregorian chant, heavy machinery sounds, ominous, 90 BPM, game ambient"` |
| Wild Circle | Tribal drums, nature sounds | `"Tribal nature music, wooden drums, flute, forest ambience, primal energy, 110 BPM, game exploration"` |
| Grate Syndicate | Jazz-noir, underground | `"Underground jazz noir, muted trumpet, double bass, mysterious, 95 BPM, game ambient, loop"` |
| Industrial Clan | Heavy industrial, metal | `"Heavy industrial factory music, clanging metal, steam, dark techno, 130 BPM, game soundtrack"` |
| Sands Eternal | Desert ambient, middle-eastern | `"Mystical desert music, oud, sitar, wind, ancient ruins feel, 85 BPM, game ambient, loop"` |
| Void | Cosmic drone, ethereal | `"Cosmic void music, deep space drone, ethereal choir, mysterious, 70 BPM, dark ambient, seamless loop"` |

**Dynamic layers per biome:**
- Exploration: ambient layer only
- Enemy nearby: add tension percussion
- Combat: full battle mix
- Boss fight: unique boss theme

### C. Ambient Soundscapes (Per Biome)

Procedural ambient sounds for each biome using Web Audio API synthesis + occasional samples:

| Biome | Ambient Sounds |
|-------|---------------|
| Grasslands | Wind rustling, bird chirps, distant water |
| Neon City | Neon hum, distant traffic, electronic beeps, rain on metal |
| Iron Church | Chains rattling, distant bells, torch crackle, stone echo |
| Wild Circle | Insects, rustling leaves, animal calls, stream flowing |
| Grate Syndicate | Drip echoes, distant machinery, rat squeaks, ventilation |
| Industrial Clan | Steam hiss, metal clang, gear grinding, alarm beeps |
| Sands Eternal | Wind howl, sand shifting, distant thunder, flute echoes |
| Void | Deep space hum, cosmic radiation crackle, distant whale song |

**Implementation:**
```typescript
class AmbientSystem {
  private ctx: AudioContext;
  private activeAmbience: GainNode | null = null;
  
  setBiome(biome: BiomeType): void {
    // Crossfade to new biome ambience (2-second transition)
  }
  
  // Procedural wind (filtered noise + slow LFO)
  private windSynth(): AudioNode { /* ... */ }
  
  // Procedural neon hum (sine + slight detune)
  private neonHum(): AudioNode { /* ... */ }
  
  // Occasional bird chirp (FM synthesis)
  private birdChirp(): void { /* ... */ }
}
```

### D. Character Voice Lines (AI-Generated)

Each of the 100 characters gets 5-10 voice lines via ElevenLabs API.

**Voice line categories:**
| Category | Example | When Played |
|----------|---------|-------------|
| Spawn | "Let's bomb!" | Character spawns |
| Kill | "Boom!" / "Gotcha!" | Player kills opponent |
| Death | "Nooo!" / "How?!" | Player dies |
| Ability | Unique line per skill | Using special ability |
| Taunt | "Too slow!" / "Catch this!" | Random during idle |
| Victory | "I'm the best!" | Winning match |
| Low HP | "Not good..." / "Running low!" | Health below 20% |

**Voice matching per character:**
- Pepe: Wet, amphibious voice, slightly raspy
- Doge: Shiba inu barks + synthesized speech (much wow style)
- Gigachad: Deep, confident, minimal words
- Trump: Recognizable cadence (parody-safe)
- Wojak: Sad, melancholic, hopeless tone

**Implementation:**
```typescript
// Pre-generate via ElevenLabs, cache as MP3
// /sounds/voices/{character_id}/{line_type}.mp3
interface VoiceLine {
  characterId: string;
  type: 'spawn' | 'kill' | 'death' | 'ability' | 'taunt' | 'victory' | 'low_hp';
  text: string;
  url: string;
}

class VoiceSystem {
  playLine(characterId: string, type: VoiceLineType): void;
  // Rate-limited: max 1 line per 3 seconds per character
  // Respects SFX enabled setting
}
```

### E. Card System Audio

Sound design for the collectible card experience:

| Event | Sound | Description |
|-------|-------|-------------|
| Card hover | Soft metallic shimmer | Like brushing against foil |
| Card flip | Snappy paper flip + subtle whoosh | Front->back transition |
| Card inspect | Deep bass hum + card "zoom" | Entering inspect view |
| Pack shake | Cardboard rattle building tension | 1-2 seconds before burst |
| Pack burst | Explosive paper tear + confetti burst | Pack opening climax |
| Card reveal Common | Simple flip | Minimal |
| Card reveal Rare | Flip + soft chime | Satisfying ding |
| Card reveal Epic | Flip + gold shimmer SFX | Sparkle sound |
| Card reveal Legendary | Flip + orchestral hit + flash | BIG moment |
| Card reveal Mythic | Flip + explosion + screen shake | EPIC moment |
| Collect All | Rising chime sequence | Dopamine cascade |
| Fusion start | Magical swirl | 3 cards merging |
| Fusion complete | Transform "shing" + new card chime | Result revealed |
| Market buy | Cash register cha-ching | Transaction complete |
| Market sell | Softer register sound | Listing created |
| Set complete | Fanfare + achievement sound | Celebration |

### F. Power-Up Specific Sounds (Replace Generic Pickup)

Current: all power-ups use `pickup.wav`
New: distinct sound per power-up:

| Power-Up | Sound Design |
|----------|-------------|
| Bomb (+1 bomb) | Heavy "thud" + metallic clink |
| Fire (+range) | Whoosh + flame crackle |
| Speed | Electric zap + revving engine |
| Kick | Spring "boing" + shoe squeak |
| Wall-pass | Ethereal phase + whoosh |
| Health | Healing chime + heartbeat |

### G. UI Sound Expansion

Current: single `ui_click.wav`
New: distinct sounds per interaction type:

| Interaction | Sound |
|-------------|-------|
| Button hover | Soft tick (barely audible) |
| Button click | Current ui_click |
| Confirm/OK | Positive chime |
| Cancel/Back | Soft dismiss "poof" |
| Toggle ON | Snappy switch |
| Toggle OFF | Softer switch |
| Tab switch | Quick slide "swoosh" |
| Slider drag | Subtle tick-tick-tick |
| Error/Invalid | Low buzz "bzzt" |
| Success/Reward | Rising cascade chime |
| Notification | Gentle bell |
| Screen transition | Whoosh wipe |

### H. 3D Positional Audio (World Mode)

Extend existing spatial audio from arena to open world:

```typescript
class PositionalAudio {
  private listener: AudioListener;  // attached to player camera
  
  play3D(soundKey: string, x: number, y: number, volume: number = 1): void {
    // Calculate pan based on relative position to listener
    // Calculate volume falloff based on distance
    // Use existing stereoPanner + gain from Assets class
    const pan = this.calcPan(x, y);
    const dist = this.calcDistance(x, y);
    const falloff = 1 / (1 + dist * 0.01);  // inverse distance
    assets.explosion(1, volume * falloff, pan);
  }
}
```

**3D sounds in World Mode:**
- Enemy footsteps (pan + distance falloff)
- Bomb explosions (spatial, like arena)
- Ambient sources (waterfall, campfire -- positioned in world)
- NPC dialogue (fades with distance)
- Collectible sparkle (close = loud, far = faint)

### I. Music Generation Pipeline (AI Tools)

| Tool | Purpose | Cost | Integration |
|------|---------|------|-------------|
| **Suno AI** | Background music, biome themes, battle music | ~$10/mo | API or manual generation |
| **ElevenLabs** | Character voice lines, announcer voices | ~$5-10/mo for starter | API (real-time or pre-generate) |
| **ElevenLabs SFX** | UI sounds, card sounds, ambient details | Included in plan | API |
| **Wavespeed API** | Sound effects, ambient textures | (User has access) | API |
| **Web Audio API** | Procedural sounds (already used extensively) | Free | Code |

**Workflow:**
1. Generate music stems via Suno (one-shot, download as MP3)
2. Generate voice lines via ElevenLabs (batch, cache as MP3)
3. Generate SFX via ElevenLabs SFX or Wavespeed (batch, cache)
4. Procedural layer via existing Web Audio system (real-time)

---

## Implementation Phases

### Phase 1 -- Dynamic Music + Biome Themes (HIGHEST IMPACT)
- Generate battle music stems (3 layers) via Suno
- Generate 8 biome ambient tracks via Suno
- Implement `DynamicMusic` class in audio engine
- Implement `AmbientSystem` for biome transitions
- Generate voice lines for 3 starter heroes via ElevenLabs

### Phase 2 -- Card Audio + UI Expansion
- Design all card system sounds
- Generate via ElevenLabs SFX or synthesize in Web Audio
- Expand UI sounds (hover, confirm, cancel, etc.)
- Implement `VoiceSystem` for character lines

### Phase 3 -- Full Voice Lines + 3D Audio
- Generate voice lines for all 100 characters via ElevenLabs
- Implement `PositionalAudio` for World Mode
- Add ambient soundscapes per biome (procedural layer)
- Dynamic music integration with World Mode states

---

## Technical Notes

### Audio format strategy
- **Music**: MP3 128kbps (streaming, large files)
- **SFX**: WAV/OGG (short, need fast decode)
- **Voice**: MP3 96kbps (pre-generated, cached)
- **Procedural**: Web Audio API (real-time, zero file size)

### Memory budget
- Lobby music: 5 tracks x ~3MB = 15MB
- Battle stems: 3 layers x ~2MB = 6MB
- Biome music: 8 tracks x ~3MB = 24MB
- SFX: ~20 files x ~50KB = 1MB
- Voice lines: 100 chars x 10 lines x ~20KB = 20MB
- **Total**: ~66MB (acceptable for desktop, lazy-load for mobile)

### Performance
- Use `audio.preload = "metadata"` for music (don't preload full)
- Lazy-load biome music when entering biome
- Pool AudioBufferSourceNode for rapid SFX (explosions)
- Compress voice lines to 64kbps Opus if needed
