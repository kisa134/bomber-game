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
  bomb: "/sprites/bomb",
  // Explosion animation frames (flash -> expanding core -> max). A single
  // explosion is used as a fallback if frames are absent.
  explosion0: "/sprites/explosion_0",
  explosion1: "/sprites/explosion_1",
  explosion2: "/sprites/explosion_2",
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
};

// Image formats tried in order (first that loads wins). PNG support means new
// assets need no conversion.
const IMG_EXTS = [".webp", ".png"];

// Cache-buster for sprite URLs. The PWA caches sprites by URL (CacheFirst), so a
// REPLACED file with the same name would otherwise be served stale forever.
// BUMP THIS whenever you change any sprite art so clients fetch the new version.
export const ASSET_VER = "4";

// Directional walk frames (optional): skin<id>_<down|up|side>_<0..2>.
// "side" is used for right; left is the same sprite mirrored. Missing frames
// fall back to the static skin sprite, so this is purely additive.
for (let s = 0; s < 4; s++) {
  for (const dir of ["down", "up", "side"]) {
    for (let f = 0; f < 3; f++) {
      SPRITE_FILES[`skin${s}_${dir}_${f}`] = `/sprites/skin_${s}_${dir}_${f}`;
    }
  }
}

// Action-state frames (optional): skin<id>_<place_bomb|hurt|victory>. Missing
// ones fall back to the walk/static sprite, so this is purely additive.
for (let s = 0; s < 4; s++) {
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
  battle: "music_battle",
};

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
  pickup: 0.38,
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
  private reverbIR: AudioBuffer | null = null;
  private fxBuffers = new Map<string, AudioBuffer>();

  private sfxEnabled = true;
  private musicEnabled = true;
  private desiredMusic: string | null = null;

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

  play(key: string, volume?: number): void {
    if (!this.sfxEnabled) return;
    const url = this.sounds.get(key);
    if (!url) return;
    const a = new Audio(url);
    a.volume = volume ?? SFX_GAIN[key] ?? DEFAULT_SFX_GAIN;
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
    // Wet squelch: white noise through a lowpass that sweeps down fast.
    const dur = 0.34;
    const len = Math.floor(ctx.sampleRate * dur);
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const noise = ctx.createBufferSource();
    noise.buffer = nb;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2200, t0);
    lp.frequency.exponentialRampToValueAtTime(180, t0 + dur);
    lp.Q.value = 6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(volume, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    noise.connect(lp).connect(ng).connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + dur);
    // Low body: a pitch-dropping thud for the "burst" impact.
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.22);
    const og = ctx.createGain();
    og.gain.setValueAtTime(volume * 0.9, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
    osc.connect(og).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
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

  /** Switch the looping track (no-op if it's already playing). */
  playMusic(key: string, volume = MUSIC_GAIN): void {
    if (this.desiredMusic === key) {
      // already selected; ensure it's actually playing if enabled
      if (this.musicEnabled) this.startDesired(volume);
      return;
    }
    this.desiredMusic = key;
    for (const [k, a] of this.music) {
      if (k !== key) a.pause();
    }
    if (this.musicEnabled) this.startDesired(volume);
  }

  stopMusic(): void {
    this.desiredMusic = null;
    for (const a of this.music.values()) a.pause();
  }

  private startDesired(volume = MUSIC_GAIN): void {
    if (!this.desiredMusic) return;
    const a = this.music.get(this.desiredMusic);
    if (!a) return;
    a.loop = true;
    if (a.paused) {
      // (Re)starting a paused track — resume from where it left off and fade in
      // smoothly (e.g. the menu theme returning after a match).
      a.volume = 0;
      void a
        .play()
        .then(() => this.fadeVolume(a, volume, 1200))
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
