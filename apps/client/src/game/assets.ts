// Optional art/sound loader. Everything here is best-effort: if a file is
// missing the game falls back to the built-in canvas drawing, so the build and
// deploy never depend on these assets existing.
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
  skin0: "/sprites/skin_0.webp",
  skin1: "/sprites/skin_1.webp",
  skin2: "/sprites/skin_2.webp",
  skin3: "/sprites/skin_3.webp",
};

export const SOUND_FILES: Record<string, string> = {
  place: "/sounds/place.mp3",
  explode: "/sounds/explode.mp3",
  pickup: "/sounds/pickup.mp3",
  death: "/sounds/death.mp3",
};

export class Assets {
  private images = new Map<string, HTMLImageElement>();
  private sounds = new Map<string, string>();

  /** Try to load every known asset; missing ones are silently skipped. */
  async preload(): Promise<void> {
    await Promise.all([
      ...Object.entries(SPRITE_FILES).map(([k, url]) => this.tryImage(k, url)),
      ...Object.entries(SOUND_FILES).map(([k, url]) => this.trySound(k, url)),
    ]);
  }

  img(key: string): HTMLImageElement | null {
    return this.images.get(key) ?? null;
  }

  play(key: string, volume = 0.5): void {
    const url = this.sounds.get(key);
    if (!url) return;
    const a = new Audio(url);
    a.volume = volume;
    void a.play().catch(() => {});
  }

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

  private async trySound(key: string, url: string): Promise<void> {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) this.sounds.set(key, url);
    } catch {
      // no sound file; ignore
    }
  }
}
