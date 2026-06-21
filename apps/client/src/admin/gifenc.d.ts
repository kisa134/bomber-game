// Minimal typings for gifenc (the package ships no declarations). We only use
// the streaming encoder + palette quantizer for the character-card GIF export.
declare module "gifenc" {
  export interface WriteFrameOpts {
    palette?: number[][];
    delay?: number; // milliseconds
    repeat?: number; // 0 = loop forever, -1 = no loop
    transparent?: boolean;
    dispose?: number;
  }
  export interface Encoder {
    writeFrame(index: Uint8Array | number[], width: number, height: number, opts?: WriteFrameOpts): void;
    finish(): void;
    bytes(): Uint8Array;
    reset(): void;
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;
}
