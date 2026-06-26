/**
 * Esports Audio Manager — procedural Web Audio API synthesis.
 * No audio files required. Howler (installed) can be layered in later
 * by replacing the `play*` methods with Howl instances pointed at
 * /public/audio/*.webm files.
 *
 * Usage:
 *   import { audioManager } from "@/lib/audioManager";
 *   audioManager.playClick();
 */

type AudioCtxGlobal = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

class AudioManager {
  private ctx: AudioContext | null = null;
  private _muted = false;
  private _unlocked = false;

  get muted() { return this._muted; }

  setMuted(val: boolean) {
    this._muted = val;
    if (this.ctx) {
      this.ctx.suspend().catch(() => {});
    }
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /** Must be called from a user gesture to unlock AudioContext on iOS */
  unlock() {
    if (this._unlocked || typeof window === "undefined") return;
    try {
      const ctx = this.getCtx();
      ctx.resume().catch(() => {});
      this._unlocked = true;
    } catch {}
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = (globalThis as AudioCtxGlobal).AudioContext ??
                  (globalThis as AudioCtxGlobal).webkitAudioContext;
      if (!Ctx) throw new Error("Web Audio API not available");
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private safe(fn: (ctx: AudioContext) => void) {
    if (this._muted || typeof window === "undefined") return;
    try { fn(this.getCtx()); } catch {}
  }

  /** Short mechanical click — nav links, copy buttons */
  playClick() {
    this.safe((ctx) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(380, t + 0.07);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.start(t); osc.stop(t + 0.09);
    });
  }

  /** Soft hover blip — tab highlights, icon hovers */
  playHover() {
    this.safe((ctx) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, t);
      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      osc.start(t); osc.stop(t + 0.035);
    });
  }

  /** Dramatic "MATCH FOUND" impact chord — staggered sawtooth burst */
  playMatchFound() {
    this.safe((ctx) => {
      const freqs  = [110, 165, 220, 330, 440, 660];
      const t      = ctx.currentTime;
      // Master compressor to prevent clipping
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const dt   = i * 0.042;
        osc.connect(gain); gain.connect(comp);
        osc.type = i < 3 ? "sawtooth" : "square";
        osc.frequency.setValueAtTime(freq, t + dt);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.02, t + dt + 0.12);
        gain.gain.setValueAtTime(0.10, t + dt);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.55);
        osc.start(t + dt); osc.stop(t + dt + 0.55);
      });
    });
  }

  /** Ascending blip — bottom nav tab switches */
  playTabSwitch() {
    this.safe((ctx) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(500, t);
      osc.frequency.exponentialRampToValueAtTime(1000, t + 0.11);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.start(t); osc.stop(t + 0.13);
    });
  }

  /** Ultra-short tick — prize pool counter increment */
  playPrizeTick() {
    this.safe((ctx) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(2200, t);
      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
      osc.start(t); osc.stop(t + 0.022);
    });
  }

  /** Low-frequency hum — ambient arena atmosphere (call once) */
  playAmbientHum() {
    this.safe((ctx) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(55, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 1.5);
      gain.gain.linearRampToValueAtTime(0.025, t + 3);
      gain.gain.linearRampToValueAtTime(0, t + 4.5);
      osc.start(t); osc.stop(t + 4.5);
    });
  }

  /** Connect wallet success — ascending arpeggio */
  playWalletConnect() {
    this.safe((ctx) => {
      const notes  = [261, 329, 392, 523];
      const t      = ctx.currentTime;
      const comp   = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const dt   = i * 0.10;
        osc.connect(gain); gain.connect(comp);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + dt);
        gain.gain.setValueAtTime(0.12, t + dt);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.3);
        osc.start(t + dt); osc.stop(t + dt + 0.3);
      });
    });
  }
}

export const audioManager = new AudioManager();
