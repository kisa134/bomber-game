// Optional art/sound loader. Everything here is best-effort: if a file is
// missing the game falls back to the built-in canvas drawing / silence, so the
// build and deploy never depend on these assets existing.
//
// Drop files into apps/client/public/sprites and apps/client/public/sounds with
// the exact names below (see those folders' README.md).

// Sprite base paths (no extension). The loader tries .webp then .png, so new
// art can be dropped in as PNG with no conversion needed.
export const SPRITE_FILES: Record<string, string> = {
  floor: "/sprites/floor",
  hard: "/sprites/hard",
  soft: "/sprites/soft",
  soft_mobile: "/sprites/soft_mobile", // meme crate used on phones (lowFx)
  // Arena-theme block variants (selectable in Settings → Arena). Same 2.5D
  // structure as the base hard/soft/floor; only the surface/material differs.
  hard_gold: "/sprites/hard_gold",
  hard_stone: "/sprites/hard_stone",
  hard_obsidian: "/sprites/hard_obsidian",
  hard_sand: "/sprites/hard_sand",
  soft_ammo: "/sprites/soft_ammo",
  soft_tech: "/sprites/soft_tech",
  soft_meme: "/sprites/soft_meme",
  soft_sand: "/sprites/soft_sand",
  floor_grate: "/sprites/floor_grate",
  floor_neon: "/sprites/floor_neon",
  floor_void: "/sprites/floor_void",
  floor_sand: "/sprites/floor_sand",
  floor_grass: "/sprites/floor_grass", // static grass texture (Classic floor alternative)
  soft_cyberglass: "/sprites/soft_cyberglass", // Cyber soft (translucent glass)
  soft_obsidian: "/sprites/soft_obsidian",
  soft_void1: "/sprites/soft_void1",
  soft_void2: "/sprites/soft_void2",
  soft_void3: "/sprites/soft_void3",
  soft_void4: "/sprites/soft_void4",
  hard_meme: "/sprites/hard_meme",
  soft_meme2: "/sprites/soft_meme2",
  hard_degen: "/sprites/hard_degen",
  soft_degen: "/sprites/soft_degen",
  floor_degen: "/sprites/floor_degen",
  floor_meme: "/sprites/floor_meme",
  hard_industrial: "/sprites/hard_industrial",
  floor_industrial: "/sprites/floor_industrial",
  soft_industrial: "/sprites/soft_industrial",
  soft_chappie2: "/sprites/soft_chappie2",
  hard_chappie: "/sprites/hard_chappie",
  soft_chappie: "/sprites/soft_chappie",
  floor_chappie: "/sprites/floor_chappie",
  bomb: "/sprites/bomb",
  // Explosion animation frames (ignite -> expand -> peak -> collapse -> fade).
  // A single explosion is used as a fallback if frames are absent.
  explosion0: "/sprites/explosion_0",
  explosion1: "/sprites/explosion_1",
  explosion2: "/sprites/explosion_2",
  explosion3: "/sprites/explosion_3",
  explosion4: "/sprites/explosion_4",
  explosion: "/sprites/explosion",
  pu_bomb: "/sprites/powerup_bomb",
  pu_fire: "/sprites/powerup_fire",
  pu_speed: "/sprites/powerup_speed",
  pu_kick: "/sprites/powerup_kick",
  pu_wall: "/sprites/powerup_wall",
  pu_health: "/sprites/powerup_health",
  skin0: "/sprites/skin_0",
  skin1: "/sprites/skin_1",
  skin2: "/sprites/skin_2",
  skin3: "/sprites/skin_3",
  skin4: "/sprites/skin_4",
  skin5: "/sprites/skin_5",
  skin6: "/sprites/skin_6",
  skin7: "/sprites/skin_7",
  skin8: "/sprites/skin_8",
  skin9: "/sprites/skin_9",
  skin10: "/sprites/skin_10",
};

// Image formats tried in order (first that loads wins). PNG support means new
// assets need no conversion.
const IMG_EXTS = [".webp", ".png"];

// Cache-buster for sprite URLs. The PWA caches sprites by URL (CacheFirst), so a
// REPLACED file with the same name would otherwise be served stale forever.
// BUMP THIS whenever you change any sprite art so clients fetch the new version.
export const ASSET_VER = "60";

// Hard (indestructible) block damage: 6 accumulating stages × 2 visual variants
// (so neighbouring blocks crack differently). Missing -> pristine block.
for (let s = 1; s <= 6; s++) {
  for (let v = 1; v <= 2; v++) {
    SPRITE_FILES[`hard_dmg${s}_v${v}`] = `/sprites/hard_dmg${s}_v${v}`;
  }
}
// Blood baked onto the block sprites (in the block's perspective): 2 intensities
// x 2 variants for both hard and soft blocks. Shown when a block is bloodied.
for (const b of ["hard", "soft"]) {
  for (let i = 1; i <= 2; i++) {
    for (let v = 1; v <= 2; v++) {
      SPRITE_FILES[`${b}_blood${i}_v${v}`] = `/sprites/${b}_blood${i}_v${v}`;
    }
  }
}

// Base portraits for the expanded meme roster (11-18); 0-10 are in SPRITE_FILES above.
for (let s = 11; s < 100; s++) {
  SPRITE_FILES[`skin${s}`] = `/sprites/skin_${s}`;
}

// Directional walk frames (optional): skin<id>_<down|up|side>_<0..2>.
// "side" is used for right; left is the same sprite mirrored. Missing frames
// fall back to the static skin sprite, so this is purely additive.
for (let s = 0; s < 100; s++) {
  for (const dir of ["down", "up", "side"]) {
    for (let f = 0; f < 3; f++) {
      SPRITE_FILES[`skin${s}_${dir}_${f}`] = `/sprites/skin_${s}_${dir}_${f}`;
    }
  }
}

// Action-state frames (optional): skin<id>_<place_bomb|hurt|victory>. Missing
// ones fall back to the walk/static sprite, so this is purely additive.
for (let s = 0; s < 100; s++) {
  for (const st of ["place_bomb", "hurt", "victory"]) {
    SPRITE_FILES[`skin${s}_${st}`] = `/sprites/skin_${s}_${st}`;
  }
}

// One-shot sound effects (extension-agnostic: .mp3/.ogg/.wav all work).
// Map sfx key -> base filename (no extension).
const SOUND_BASE: Record<string, string> = {
  place: "place",
  explode: "explode",
  pickup: "pickup",
  death: "death",
  die: "die", // player eliminated (gory death)
  wound: "wound", // non-fatal hit — variant A
  wound2: "wound2", // non-fatal hit — variant B
  first_blood: "first_blood",
  block_break: "block_break",
  kick: "kick",
  countdown: "countdown",
  go: "go",
  victory: "victory",
  defeat: "defeat",
  draw: "draw",
  sudden_death: "sudden_death",
  ui: "ui_click",
  join: "join",
};

const MUSIC_BASE: Record<string, string> = {
  lobby: "music_lobby",
  lobby2: "music_lobby2",
  lobby3: "music_lobby3",
  lobby4: "music_lobby4",
  lobby5: "music_lobby5",
  battle: "music_battle",
};

// The hub cycles through these tracks back-to-back (a mini playlist). Any that
// fail to load are skipped; a single survivor just loops as before.
const HUB_PLAYLIST = ["lobby", "lobby2", "lobby3", "lobby4", "lobby5"];

const AUDIO_EXTS = [".mp3", ".ogg", ".wav"];

// Relative playback mix (0..1). Single source of truth for SFX balance —
// loudest = explode; music sits clearly under all SFX. Tweak here, no DAW needed.
const SFX_GAIN: Record<string, number> = {
  explode: 0.75,
  sudden_death: 0.62,
  go: 0.62,
  death: 0.55,
  die: 0.6,
  wound: 0.5,
  wound2: 0.5,
  victory: 0.55,
  defeat: 0.55,
  draw: 0.55,
  block_break: 0.45,
  place: 0.45,
  kick: 0.45,
  pickup: 0.7, // boosted so the reward chime cuts through the mix
  countdown: 0.38,
  join: 0.38,
  ui: 0.28,
};
const DEFAULT_SFX_GAIN = 0.5;
const MUSIC_GAIN = 0.24;

export class Assets {
  private images = new Map<string, HTMLImageElement>();
  private sounds = new Map<string, string>();
  private music = new Map<string, HTMLAudioElement>();
  private fadeTimers = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>();
  private active = new Map<string, HTMLAudioElement>(); // last-played instance per key
  private audioCtx: AudioContext | null = null; // lazy Web Audio (for fx with reverb)
  // Optional music analyser — drives subtle hub visuals. Hooked only once the audio
  // context is actually running (post-gesture) so it never silences the music.
  private musicAnalyser: AnalyserNode | null = null;
  private musicSourced = new WeakSet<HTMLAudioElement>();
  private musicBuf: Uint8Array<ArrayBuffer> | null = null;
  private musicLvl = 0;

  /** Route a playing music element into an analyser (idempotent, fail-safe). */
  private hookMusicAnalyser(a: HTMLAudioElement): void {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state !== "running" || this.musicSourced.has(a)) return;
    try {
      const src = ctx.createMediaElementSource(a);
      if (!this.musicAnalyser) {
        this.musicAnalyser = ctx.createAnalyser();
        this.musicAnalyser.fftSize = 256;
        this.musicAnalyser.smoothingTimeConstant = 0.8;
        this.musicAnalyser.connect(ctx.destination);
        this.musicBuf = new Uint8Array(this.musicAnalyser.fftSize);
      }
      src.connect(this.musicAnalyser);
      this.musicSourced.add(a);
    } catch {
      /* element already sourced / not allowed — leave music untouched */
    }
  }

  /** 0..~1 smoothed loudness of the music right now (0 if no analyser). */
  musicLevel(): number {
    const an = this.musicAnalyser, buf = this.musicBuf;
    if (!an || !buf) return 0;
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    this.musicLvl += (rms - this.musicLvl) * 0.2; // extra smoothing
    return this.musicLvl;
  }
  private reverbIR: AudioBuffer | null = null;
  private fxBuffers = new Map<string, AudioBuffer>();
  private noiseBuf: AudioBuffer | null = null; // cached white noise for crack transients
  private decoding = new Set<string>(); // keys currently being decoded into fxBuffers

  private sfxEnabled = true;
  private musicEnabled = true;
  private sfxVolume = 1; // 0..1 master SFX multiplier (Settings slider)
  private musicVolume = 1; // 0..1 master music multiplier (Settings slider)
  private desiredMusic: string | null = null;
  // Remembers which hub track was playing so returning from a match resumes that
  // same track (from its paused position) instead of jumping back to the first.
  private lastHubTrack: string | null = null;
  // Shuffle bag of upcoming hub tracks (drained, then reshuffled) so the playlist
  // order varies each cycle instead of looping in a fixed sequence.
  private hubBag: string[] = [];
  // Fires when a new hub track actually starts playing — drives the "now playing"
  // radio chip in the UI. Set by the consumer; null = nobody listening.
  onTrackChange: ((key: string) => void) | null = null;
  private announcedTrack: string | null = null; // dedupe so we announce each track once
  private repeatOne = false; // radio 🔁: loop the current hub track instead of shuffling on

  // Music mixer: sustained scale (e.g. faded under the Shepard tone) * transient
  // sidechain duck (snaps down on a blast, recovers). Effective vol = base*scale*duck.
  private musicScale = 1; // sustained 0..1 (1 = normal)
  private duckGain = 1; // transient 0..1 (recovers to 1)
  private duckFrom = 1;
  private duckT0 = 0;
  private duckRecoverMs = 200;
  private mixing = false;

  // Shepard tone (ever-rising illusion) for round-end tension.
  private shepOsc: OscillatorNode[] = [];
  private shepGain: GainNode[] = [];
  private shepMaster: GainNode | null = null;
  private shepStart = 0;
  private shepTarget = 0; // desired intensity 0..1
  private shepLevel = 0; // smoothed current intensity
  private shepRaf = 0;
  private shepOn = false;

  // Sub-bass threat hum (≈20 Hz) under nearby ticking bombs.
  private subOsc: OscillatorNode[] = [];
  private subMaster: GainNode | null = null;
  private subTarget = 0;
  private subLevel = 0;
  private subStart = 0;
  private subRaf = 0;
  private subOn = false;

  async preload(): Promise<void> {
    await Promise.all([
      ...Object.entries(SPRITE_FILES).map(([k, url]) => this.tryImage(k, url)),
      ...Object.entries(SOUND_BASE).map(([k, base]) => this.trySound(k, base)),
      ...Object.entries(MUSIC_BASE).map(([k, base]) => this.tryMusic(k, base)),
    ]);
  }

  img(key: string): HTMLImageElement | null {
    return this.images.get(key) ?? null;
  }

  // -- sfx ------------------------------------------------------------------

  setSfxEnabled(on: boolean): void {
    this.sfxEnabled = on;
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  play(key: string, volume?: number, rate?: number): void {
    if (!this.sfxEnabled) return;
    const url = this.sounds.get(key);
    if (!url) return;
    const a = new Audio(url);
    a.volume = (volume ?? SFX_GAIN[key] ?? DEFAULT_SFX_GAIN) * this.sfxVolume;
    if (rate && rate > 0) {
      a.playbackRate = rate;
      // Browsers default to preservesPitch=true (time-stretch, pitch unchanged);
      // disable it so the playbackRate actually raises the PITCH (rising reward).
      const ap = a as unknown as { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
      ap.preservesPitch = false;
      ap.mozPreservesPitch = false;
      ap.webkitPreservesPitch = false;
    }
    this.active.set(key, a);
    void a.play().catch(() => {});
  }

  /** A synthesized reverb impulse (exponentially-decaying noise) — no IR file. */
  private makeReverbIR(ctx: AudioContext, seconds = 2.6, decay = 2.4): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return ir;
  }

  /** Play a one-shot with epic echo + reverb (used for FIRST BLOOD). Falls back
   *  to the plain play() if Web Audio or the file isn't available. */
  async playReverb(key: string, volume = 0.95): Promise<void> {
    if (!this.sfxEnabled) return;
    const url = this.sounds.get(key);
    if (!url) return; // file not present yet -> silent (no error)
    if (!this.audioCtx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AC();
      } catch {
        this.play(key, volume);
        return;
      }
    }
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    let buf = this.fxBuffers.get(key);
    if (!buf) {
      try {
        const data = await (await fetch(url)).arrayBuffer();
        buf = await ctx.decodeAudioData(data);
        this.fxBuffers.set(key, buf);
      } catch {
        this.play(key, volume);
        return;
      }
    }
    if (!this.reverbIR) this.reverbIR = this.makeReverbIR(ctx);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Dry signal.
    const dry = ctx.createGain();
    dry.gain.value = volume;
    src.connect(dry).connect(ctx.destination);
    // Reverb tail.
    const conv = ctx.createConvolver();
    conv.buffer = this.reverbIR;
    const wet = ctx.createGain();
    wet.gain.value = volume * 0.85;
    src.connect(conv).connect(wet).connect(ctx.destination);
    // Feedback echo.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const echoWet = ctx.createGain();
    echoWet.gain.value = volume * 0.55;
    src.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(echoWet).connect(ctx.destination);
    src.start();
  }

  /** Synthesized wet "splat / gib" burst for a gory death — a filtered noise
   *  squelch over a short low thud. No audio asset needed; fully procedural. */
  playGore(volume = 0.6): void {
    if (!this.sfxEnabled) return;
    let ctx = this.audioCtx;
    if (!ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = this.audioCtx = new AC();
      } catch {
        return;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    // Wet, MUFFLED squelch: noise through a LOW lowpass (dull, no hiss) + a bandpass that
    // bends downward fast (the squishy "wet" pitch), with a quick squishy decay.
    const dur = 0.3;
    const len = Math.floor(ctx.sampleRate * dur);
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.1); // faster decay = squishier
    const noise = ctx.createBufferSource();
    noise.buffer = nb;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(820, t0); // much lower -> muffled, not bright/hissy
    lp.frequency.exponentialRampToValueAtTime(75, t0 + dur);
    lp.Q.value = 1.5;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; // the WET squelch: a resonant blob that bends down quickly
    bp.frequency.setValueAtTime(520, t0);
    bp.frequency.exponentialRampToValueAtTime(105, t0 + 0.16);
    bp.Q.value = 3.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(volume, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    noise.connect(lp).connect(bp).connect(ng).connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + dur);
    // Deep, DULL thud body (sine, not triangle) — a heavy wet shlap, low and round.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, t0);
    osc.frequency.exponentialRampToValueAtTime(27, t0 + 0.2);
    const og = ctx.createGain();
    og.gain.setValueAtTime(volume * 0.85, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
    osc.connect(og).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.28);
  }

  /** Stop a (possibly long) one-shot sound, e.g. the sudden-death track. */
  stop(key: string): void {
    const a = this.active.get(key);
    if (a) {
      a.pause();
      a.currentTime = 0;
      this.active.delete(key);
    }
  }

  // -- music ----------------------------------------------------------------

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    if (on) {
      this.startDesired();
    } else {
      for (const a of this.music.values()) a.pause();
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    // live-apply to whatever's currently playing so the slider feels instant
    for (const a of this.music.values()) if (!a.paused) a.volume = MUSIC_GAIN * this.musicVolume;
  }

  /** Tracks that actually loaded, in playlist order. */
  private hubTracks(): string[] {
    return HUB_PLAYLIST.filter((k) => this.music.has(k));
  }

  /** Fisher–Yates copy — returns a freshly shuffled array (input untouched). */
  private shuffled(arr: string[]): string[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Next hub track from a shuffle bag: each track plays once per cycle, then the
   *  bag reshuffles. Avoids replaying the just-ended track at the cycle seam. */
  private nextHubTrack(current: string): string {
    const tracks = this.hubTracks();
    if (tracks.length < 2) return current;
    if (this.hubBag.length === 0) {
      this.hubBag = this.shuffled(tracks);
      if (this.hubBag[0] === current && this.hubBag.length > 1) {
        [this.hubBag[0], this.hubBag[1]] = [this.hubBag[1], this.hubBag[0]];
      }
    }
    return this.hubBag.shift() ?? current;
  }

  /** Switch the music. "lobby" selects the hub playlist (two tracks back-to-back);
   *  if a hub track is already playing, it keeps going rather than restarting. */
  playMusic(key: string, volume = MUSIC_GAIN): void {
    const wantHub = HUB_PLAYLIST.includes(key);
    // Already on a hub track and the hub is requested → leave it playing.
    if (wantHub && this.desiredMusic && HUB_PLAYLIST.includes(this.desiredMusic)) {
      if (this.musicEnabled) this.startDesired(volume);
      return;
    }
    if (this.desiredMusic === key) {
      if (this.musicEnabled) this.startDesired(volume);
      return;
    }
    // Pick the hub track: resume the last-played one when returning from a match
    // (continues the same song from its paused spot); otherwise pick at random so
    // the station doesn't always open on the same track.
    let target: string;
    if (wantHub) {
      const tracks = this.hubTracks();
      if (this.lastHubTrack && tracks.includes(this.lastHubTrack)) {
        target = this.lastHubTrack;
      } else if (tracks.length) {
        target = tracks[Math.floor(Math.random() * tracks.length)];
      } else {
        target = key;
      }
      this.lastHubTrack = target;
    } else {
      target = key;
      this.announcedTrack = null; // leaving the hub (e.g. battle) — re-announce on return
    }
    this.desiredMusic = target;
    for (const [k, a] of this.music) {
      if (k !== target) a.pause();
    }
    if (this.musicEnabled) this.startDesired(volume);
  }

  /** A hub track ended → roll to the next one in the playlist (back-to-back). */
  private advanceHub(volume: number): void {
    if (this.hubTracks().length < 2 || !this.desiredMusic) return;
    const next = this.nextHubTrack(this.desiredMusic);
    this.desiredMusic = next;
    this.lastHubTrack = next;
    for (const [k, a] of this.music) if (k !== next) a.pause();
    const a = this.music.get(next);
    if (a) a.currentTime = 0; // start the next song from the top
    if (this.musicEnabled) this.startDesired(volume);
  }

  /** Radio ⏭ — skip to the next hub track right now. No-op outside the hub or with
   *  a single track. Works regardless of the repeat flag (it's an explicit skip). */
  skipNext(): void {
    if (!this.desiredMusic || !HUB_PLAYLIST.includes(this.desiredMusic)) return;
    this.advanceHub(MUSIC_GAIN);
  }

  /** Radio 🔁 — loop the current hub track instead of advancing. Applies to the
   *  track playing right now, and persists for subsequent tracks until toggled off. */
  setRepeat(on: boolean): void {
    this.repeatOne = on;
    const cur = this.desiredMusic;
    if (!cur || !HUB_PLAYLIST.includes(cur)) return;
    const a = this.music.get(cur);
    if (!a) return;
    const multiHub = this.hubTracks().length > 1;
    a.loop = on ? true : !multiHub;
    a.onended = on ? null : multiHub ? () => this.advanceHub(MUSIC_GAIN) : null;
  }

  stopMusic(): void {
    this.desiredMusic = null;
    this.announcedTrack = null;
    for (const a of this.music.values()) a.pause();
  }

  /** Sidechain duck: drop the music under a critical SFX (explosion/kill) and ramp
   *  it back up. `amount` 0.5 ≈ −6 dB, 0.72 ≈ −12 dB; recovery ~150–200 ms (2.3). */
  duck(amount = 0.5, recoverMs = 200): void {
    this.duckFrom = Math.min(this.duckGain, 1 - amount); // snap down (or stay low)
    this.duckGain = this.duckFrom;
    this.duckT0 = performance.now();
    this.duckRecoverMs = recoverMs;
    this.ensureMixer();
  }

  /** Sustained music level 0..1 — used to fade the track UNDER the Shepard tone in
   *  the final seconds so they don't clash (1 = normal). */
  setMusicScale(scale: number): void {
    this.musicScale = Math.max(0, Math.min(1, scale));
    this.ensureMixer();
  }

  private ensureMixer(): void {
    if (this.mixing) return;
    this.mixing = true;
    this.mixTick();
  }

  private currentMusic(): HTMLAudioElement | null {
    return this.desiredMusic ? this.music.get(this.desiredMusic) ?? null : null;
  }

  private mixTick(): void {
    const a = this.currentMusic();
    // Recover the transient duck toward 1.
    const k = (performance.now() - this.duckT0) / this.duckRecoverMs;
    this.duckGain = k >= 1 ? 1 : this.duckFrom + (1 - this.duckFrom) * k;
    if (a && !a.paused && this.musicEnabled) a.volume = MUSIC_GAIN * this.musicScale * this.duckGain;
    // Keep mixing while the music is held down by either control.
    if (this.duckGain < 0.999 || this.musicScale < 0.999) {
      requestAnimationFrame(() => this.mixTick());
    } else {
      if (a && !a.paused && this.musicEnabled) a.volume = MUSIC_GAIN;
      this.mixing = false;
    }
  }

  /** A bright casino-style reward chime (2–4 kHz transients) for YOUR kill — instant
   *  dopamine cue (dopamine doc 2.1). Synthesized, no asset. */
  rewardDing(): void {
    if (!this.sfxEnabled) return;
    if (!this.audioCtx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AC();
      } catch {
        return;
      }
    }
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    // Two quick rising bright notes (~2.6kHz -> ~3.9kHz), short bell-like decays.
    const notes = [2637, 3520, 3951];
    notes.forEach((f, i) => {
      const start = t0 + i * 0.05;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, start);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.16, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.2);
    });
  }

  /** A soft, light blip for count-up "ticking" numbers (result screen). Reuses the
   *  existing audio context; silent until something else has warmed it up. */
  countBlip(freq = 880): void {
    if (!this.sfxEnabled || !this.audioCtx) return;
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.07);
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const len = Math.floor(ctx.sampleRate * 0.25);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    return b;
  }

  private ensureBuffer(key: string): void {
    if (this.fxBuffers.has(key) || this.decoding.has(key) || !this.audioCtx) return;
    const url = this.sounds.get(key);
    if (!url) return;
    this.decoding.add(key);
    void (async (): Promise<void> => {
      try {
        const data = await (await fetch(url)).arrayBuffer();
        const buf = await this.audioCtx!.decodeAudioData(data);
        this.fxBuffers.set(key, buf);
      } catch { /* leave it; HTMLAudio fallback covers playback */ }
      this.decoding.delete(key);
    })();
  }

  /** Multi-layered, spatial explosion: the sample + a sub-bass body thump + a bright
   *  crack transient, all panned by `pan` (−1..1) and scaled by blast `power` (0..1)
   *  and `vol` (0..1, distance falloff). Heavier/closer = louder & punchier. */
  explosion(power: number, vol: number, pan: number): void {
    if (!this.sfxEnabled) return;
    const p = Math.max(0, Math.min(1, power));
    const v = Math.max(0, Math.min(1, vol));
    const pn = Math.max(-1, Math.min(1, pan));
    if (!this.audioCtx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AC();
      } catch {
        this.play("explode", 0.75 * v);
        return;
      }
    }
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const out = ctx.createGain();
    out.gain.value = 1;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) { panner.pan.value = pn; out.connect(panner); panner.connect(ctx.destination); } else { out.connect(ctx.destination); }
    const t0 = ctx.currentTime;
    // Layer 1 — the explode sample (panned via buffer if decoded; else HTMLAudio).
    const buf = this.fxBuffers.get("explode");
    if (buf) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = (0.72 + 0.28 * p) * v; // louder body, less gutted by power
      s.connect(g); g.connect(out); s.start(t0);
    } else {
      this.ensureBuffer("explode"); // decode for next time
      this.play("explode", 0.7 * v);
    }
    // Layer 2 — sub-bass body thump (~80→40 Hz), the weight/power.
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(85, t0);
    o1.frequency.exponentialRampToValueAtTime(40, t0 + 0.2);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.exponentialRampToValueAtTime((0.62 + 0.5 * p) * v, t0 + 0.012); // punchier low-end weight
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    o1.connect(g1); g1.connect(out); o1.start(t0); o1.stop(t0 + 0.38);
    // Layer 3 — bright crack transient (highpassed noise burst), the snap/impact.
    const nb = ctx.createBufferSource();
    nb.buffer = this.getNoise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1700;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime((0.22 + 0.4 * p) * v, t0);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    nb.connect(hp); hp.connect(g2); g2.connect(out); nb.start(t0); nb.stop(t0 + 0.12);
  }

  /** Lazily get the Web-Audio context, or null if unavailable. */
  private ctxOrNull(): AudioContext | null {
    if (!this.audioCtx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AC();
      } catch {
        return null;
      }
    }
    if (this.audioCtx.state === "suspended") void this.audioCtx.resume();
    return this.audioCtx;
  }

  private pannedOut(ctx: AudioContext, pan: number): AudioNode {
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(panner); panner.connect(ctx.destination); } else { out.connect(ctx.destination); }
    return out;
  }

  /** Satisfying woody crate smash for a destroyed soft block, sounded AFTER the
   *  blast peak so it doesn't fight the explosion: a warm woody "tok" + a crisp
   *  splinter crack + a wood-crumble rattle. Fully synth, panned & scaled. */
  crateBreak(vol: number, pan: number): void {
    if (!this.sfxEnabled) return;
    const v = Math.max(0, Math.min(1, vol));
    const ctx = this.ctxOrNull();
    if (!ctx) return;
    const out = this.pannedOut(ctx, pan);
    const t0 = ctx.currentTime + 0.085; // clearly AFTER the explosion transient
    // 1) Warm woody "tok" — a short pitch-dropping tone for a pleasant body.
    const o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(360, t0); o.frequency.exponentialRampToValueAtTime(180, t0 + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.34 * v, t0 + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    const olp = ctx.createBiquadFilter(); olp.type = "lowpass"; olp.frequency.value = 1500;
    o.connect(og); og.connect(olp); olp.connect(out); o.start(t0); o.stop(t0 + 0.16);
    // 2) Crisp splinter crack (short bandpassed noise).
    const nb = ctx.createBufferSource(); nb.buffer = this.getNoise(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 2;
    const g1 = ctx.createGain(); g1.gain.setValueAtTime(0.26 * v, t0); g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    nb.connect(bp); bp.connect(g1); g1.connect(out); nb.start(t0); nb.stop(t0 + 0.07);
    // 3) Wood-crumble rattle — a satisfying little crunch tail.
    const rb = ctx.createBufferSource(); rb.buffer = this.getNoise(ctx); rb.playbackRate.value = 0.6;
    const hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = 2200; hp.Q.value = 0.8;
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.0001, t0 + 0.05);
    for (let k = 0; k < 5; k++) { const tk = t0 + 0.06 + k * 0.045; g3.gain.exponentialRampToValueAtTime(0.12 * v, tk); g3.gain.exponentialRampToValueAtTime(0.02 * v, tk + 0.028); }
    g3.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    rb.connect(hp); hp.connect(g3); g3.connect(out); rb.start(t0 + 0.05); rb.stop(t0 + 0.36);
  }

  /** Dry little clatter for bones/wood being knocked or blown about — a few short
   *  filtered clicks. `bony` = higher/drier (bone) vs lower (wood). Panned. */
  clatter(vol: number, pan: number, bony: boolean): void {
    if (!this.sfxEnabled) return;
    const v = Math.max(0, Math.min(1, vol));
    const ctx = this.ctxOrNull();
    if (!ctx) return;
    const out = this.pannedOut(ctx, pan);
    const t0 = ctx.currentTime;
    const clicks = 3 + (bony ? 1 : 0);
    for (let k = 0; k < clicks; k++) {
      const start = t0 + k * 0.028 + k * 0.006;
      const nb = ctx.createBufferSource(); nb.buffer = this.getNoise(ctx); nb.playbackRate.value = 1.4;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = bony ? 2700 : 1500; bp.Q.value = bony ? 4 : 2.2;
      const g = ctx.createGain(); g.gain.setValueAtTime((bony ? 0.22 : 0.18) * v, start); g.gain.exponentialRampToValueAtTime(0.0001, start + 0.03);
      nb.connect(bp); bp.connect(g); g.connect(out); nb.start(start); nb.stop(start + 0.05);
    }
  }

  /** Shepard tone: drive an ever-rising-pitch illusion at intensity 0..1 (round-end
   *  tension, dopamine doc 2.2). Call with 0 to fade out and tear down. */
  shepard(level: number): void {
    const lv = Math.max(0, Math.min(1, level));
    this.shepTarget = lv;
    if (lv > 0 && !this.shepOn && this.sfxEnabled) this.startShepard();
  }

  private startShepard(): void {
    if (!this.audioCtx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AC();
      } catch {
        return;
      }
    }
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    this.shepOn = true;
    this.shepStart = performance.now();
    this.shepLevel = 0;
    const N = 6;
    this.shepMaster = ctx.createGain();
    this.shepMaster.gain.value = 0;
    this.shepMaster.connect(ctx.destination);
    this.shepOsc = [];
    this.shepGain = [];
    for (let k = 0; k < N; k++) {
      const o = ctx.createOscillator();
      o.type = "sine";
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this.shepMaster);
      o.start();
      this.shepOsc.push(o);
      this.shepGain.push(g);
    }
    this.tickShepard();
  }

  private tickShepard(): void {
    if (!this.shepOn || !this.audioCtx || !this.shepMaster) return;
    const ctx = this.audioCtx;
    const N = this.shepOsc.length;
    const fmin = 70;
    const period = 7; // seconds for one octave cycle (rate of the rise)
    const tt = (((performance.now() - this.shepStart) / 1000) / period) % 1;
    for (let k = 0; k < N; k++) {
      const p = (tt + k / N) % 1; // 0..1 position in the octave span
      const freq = fmin * Math.pow(2, p * N);
      const bell = Math.exp(-Math.pow((p - 0.5) / 0.24, 2)); // loud in the middle, silent at the wrap
      this.shepOsc[k].frequency.setValueAtTime(freq, ctx.currentTime);
      this.shepGain[k].gain.setTargetAtTime(bell, ctx.currentTime, 0.02);
    }
    this.shepLevel += (this.shepTarget - this.shepLevel) * 0.06; // smooth intensity
    this.shepMaster.gain.setValueAtTime(this.shepLevel * 0.13, ctx.currentTime);
    if (this.shepTarget <= 0 && this.shepLevel < 0.01) {
      this.stopShepard();
      return;
    }
    this.shepRaf = requestAnimationFrame(() => this.tickShepard());
  }

  private stopShepard(): void {
    this.shepOn = false;
    if (this.shepRaf) cancelAnimationFrame(this.shepRaf);
    this.shepRaf = 0;
    for (const o of this.shepOsc) { try { o.stop(); o.disconnect(); } catch { /* already gone */ } }
    for (const g of this.shepGain) { try { g.disconnect(); } catch { /* already gone */ } }
    if (this.shepMaster) { try { this.shepMaster.disconnect(); } catch { /* already gone */ } }
    this.shepOsc = [];
    this.shepGain = [];
    this.shepMaster = null;
  }

  /** Sub-bass threat hum at intensity 0..1 (≈20 Hz fundamental + octaves), with a
   *  slow "tick" throb — felt fear under a nearby bomb (dopamine doc 2.1). */
  subBass(intensity: number): void {
    const lv = Math.max(0, Math.min(1, intensity));
    this.subTarget = lv;
    if (lv > 0 && !this.subOn && this.sfxEnabled) this.startSub();
  }

  private startSub(): void {
    if (!this.audioCtx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AC();
      } catch {
        return;
      }
    }
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    this.subOn = true;
    this.subStart = performance.now();
    this.subLevel = 0;
    this.subMaster = ctx.createGain();
    this.subMaster.gain.value = 0;
    this.subMaster.connect(ctx.destination);
    this.subOsc = [];
    // 20 Hz fundamental + quiet harmonics — felt more than heard (was too loud).
    [[20, 1], [40, 0.28], [60, 0.1]].forEach(([f, gain]) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(this.subMaster as GainNode);
      o.start();
      this.subOsc.push(o);
    });
    this.tickSub();
  }

  private tickSub(): void {
    if (!this.subOn || !this.audioCtx || !this.subMaster) return;
    const ctx = this.audioCtx;
    const throb = 0.72 + 0.28 * Math.sin(((performance.now() - this.subStart) / 1000) * 3.2 * Math.PI * 2); // ~3.2 Hz tick
    this.subLevel += (this.subTarget - this.subLevel) * 0.05;
    this.subMaster.gain.setValueAtTime(this.subLevel * 0.2 * throb, ctx.currentTime);
    if (this.subTarget <= 0 && this.subLevel < 0.01) {
      this.stopSub();
      return;
    }
    this.subRaf = requestAnimationFrame(() => this.tickSub());
  }

  private stopSub(): void {
    this.subOn = false;
    if (this.subRaf) cancelAnimationFrame(this.subRaf);
    this.subRaf = 0;
    for (const o of this.subOsc) { try { o.stop(); o.disconnect(); } catch { /* already gone */ } }
    if (this.subMaster) { try { this.subMaster.disconnect(); } catch { /* already gone */ } }
    this.subOsc = [];
    this.subMaster = null;
  }

  private startDesired(volume = MUSIC_GAIN): void {
    if (!this.desiredMusic) return;
    volume *= this.musicVolume; // master music volume (Settings slider)
    const a = this.music.get(this.desiredMusic);
    if (!a) return;
    // Hub tracks chain into each other (loop only if there's a single one);
    // everything else (battle) loops on its own.
    const isHub = HUB_PLAYLIST.includes(this.desiredMusic);
    const multiHub = isHub && this.hubTracks().length > 1;
    if (isHub && this.repeatOne) {
      // Radio "repeat one": loop this track, don't advance to the next.
      a.loop = true;
      a.onended = null;
    } else {
      a.loop = isHub ? !multiHub : true;
      a.onended = multiHub ? () => this.advanceHub(volume) : null;
    }
    if (a.paused) {
      // (Re)starting a paused track — resume from where it left off and fade in
      // smoothly (e.g. the menu theme returning after a match).
      a.volume = 0;
      void a
        .play()
        .then(() => {
          this.hookMusicAnalyser(a); // music is playing + ctx live → safe to analyse
          this.fadeVolume(a, volume, 1200);
          // Announce only once the track truly starts (autoplay may defer it to the
          // first tap), and only for hub tracks — this feeds the "now playing" chip.
          if (isHub && this.desiredMusic && this.desiredMusic !== this.announcedTrack) {
            this.announcedTrack = this.desiredMusic;
            this.onTrackChange?.(this.desiredMusic);
          }
        })
        .catch(() => {});
    } else {
      a.volume = volume; // already playing — keep it steady
    }
  }

  /** Ramp an audio element's volume to `target` over `ms` (cancels any prior fade). */
  private fadeVolume(a: HTMLAudioElement, target: number, ms: number): void {
    const prev = this.fadeTimers.get(a);
    if (prev) clearInterval(prev);
    const start = a.volume;
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = start + (target - start) * k;
      if (k >= 1) {
        clearInterval(id);
        this.fadeTimers.delete(a);
      }
    }, 50);
    this.fadeTimers.set(a, id);
  }

  // -- loading --------------------------------------------------------------

  private tryImage(key: string, base: string): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      const img = new Image();
      const tryNext = () => {
        if (i >= IMG_EXTS.length) {
          resolve(); // none of the formats loaded — fall back to canvas/emoji
          return;
        }
        img.src = `${base}${IMG_EXTS[i++]}?v=${ASSET_VER}`;
      };
      img.onload = () => {
        this.images.set(key, img);
        resolve();
      };
      img.onerror = () => tryNext();
      tryNext();
    });
  }

  // We probe by loading the media element (not HTTP HEAD): the single-origin
  // server answers missing paths with index.html, which fails to decode as
  // audio and resolves to "absent" — exactly what we want.
  private loadAudio(url: string, loop: boolean): Promise<HTMLAudioElement | null> {
    return new Promise((resolve) => {
      const a = new Audio();
      a.loop = loop;
      a.preload = "auto";
      let done = false;
      const ok = () => finish(a);
      const fail = () => finish(null);
      const finish = (val: HTMLAudioElement | null) => {
        if (done) return;
        done = true;
        a.removeEventListener("canplaythrough", ok);
        a.removeEventListener("loadeddata", ok);
        a.removeEventListener("error", fail);
        resolve(val);
      };
      a.addEventListener("canplaythrough", ok);
      a.addEventListener("loadeddata", ok);
      a.addEventListener("error", fail);
      a.src = url;
      setTimeout(() => finish(a.readyState >= 2 ? a : null), 4000);
    });
  }

  private async trySound(key: string, base: string): Promise<void> {
    for (const ext of AUDIO_EXTS) {
      const url = `/sounds/${base}${ext}`;
      const a = await this.loadAudio(url, false);
      if (a) {
        this.sounds.set(key, url);
        return;
      }
    }
  }

  private async tryMusic(key: string, base: string): Promise<void> {
    for (const ext of AUDIO_EXTS) {
      const url = `/sounds/${base}${ext}`;
      const a = await this.loadAudio(url, true);
      if (a) {
        this.music.set(key, a);
        return;
      }
    }
  }
}
