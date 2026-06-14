// Optional art/sound loader. Everything here is best-effort: if a file is
// missing the game falls back to the built-in canvas drawing / silence, so the
// build and deploy never depend on these assets existing.
//
// Drop files into apps/client/public/sprites and apps/client/public/sounds with
// the exact names below (see those folders' README.md).

export const SPRITE_FILES: Record<string, string> = {
  floor: "/sprites/floor.webp",
  hard: "/sprites/hard.webp",
  soft: "/sprites/soft.webp",
  bomb: "/sprites/bomb.webp",
  // Explosion animation frames (flash -> expanding core -> max). A single
  // explosion.webp is used as a fallback if frames are absent.
  explosion0: "/sprites/explosion_0.webp",
  explosion1: "/sprites/explosion_1.webp",
  explosion2: "/sprites/explosion_2.webp",
  explosion: "/sprites/explosion.webp",
  pu_bomb: "/sprites/powerup_bomb.webp",
  pu_fire: "/sprites/powerup_fire.webp",
  pu_speed: "/sprites/powerup_speed.webp",
  pu_kick: "/sprites/powerup_kick.webp",
  pu_wall: "/sprites/powerup_wall.webp",
  skin0: "/sprites/skin_0.webp",
  skin1: "/sprites/skin_1.webp",
  skin2: "/sprites/skin_2.webp",
  skin3: "/sprites/skin_3.webp",
};

// One-shot sound effects (extension-agnostic: .mp3/.ogg/.wav all work).
export const SOUND_KEYS = [
  "place",
  "explode",
  "pickup",
  "death",
  "block_break",
  "kick",
  "countdown",
  "go",
  "victory",
  "defeat",
  "draw",
  "sudden_death",
  "ui",
  "join",
] as const;

// Map sfx key -> base filename (no extension).
const SOUND_BASE: Record<string, string> = {
  place: "place",
  explode: "explode",
  pickup: "pickup",
  death: "death",
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

export class Assets {
  private images = new Map<string, HTMLImageElement>();
  private sounds = new Map<string, string>();
  private music = new Map<string, HTMLAudioElement>();

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

  play(key: string, volume = 0.5): void {
    if (!this.sfxEnabled) return;
    const url = this.sounds.get(key);
    if (!url) return;
    const a = new Audio(url);
    a.volume = volume;
    void a.play().catch(() => {});
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
  playMusic(key: string, volume = 0.35): void {
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

  private startDesired(volume = 0.35): void {
    if (!this.desiredMusic) return;
    const a = this.music.get(this.desiredMusic);
    if (!a) return;
    a.volume = volume;
    a.loop = true;
    void a.play().catch(() => {});
  }

  // -- loading --------------------------------------------------------------

  private tryImage(key: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
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
