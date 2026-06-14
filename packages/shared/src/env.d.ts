// Minimal ambient declarations so shared code can use the WHATWG text codecs
// without pulling in the full DOM or Node lib (they exist at runtime in both).
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  constructor(label?: string);
  decode(input?: ArrayBufferView | ArrayBuffer): string;
}
