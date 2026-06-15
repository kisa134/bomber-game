// Deterministic seeded PRNG (xmur3 seed -> mulberry32 stream). Used for map
// generation and powerup drops so a match is reproducible from its seed, which
// makes the result verifiable (provably fair): the server commits to a hash of
// the seed at match start and reveals the seed at the end. Anyone can re-run
// makeRng(seed) and regenerate the same map to confirm it wasn't rigged.

export function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
