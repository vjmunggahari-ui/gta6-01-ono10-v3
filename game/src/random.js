// Solmar Bay — tiny deterministic RNG helpers. No imports.
// Everything in the world is generated from one seed so two builds of the
// same city are byte-identical.

// FNV-1a string hash -> unsigned 32-bit integer.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32: small fast PRNG. Returns a function yielding [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convenience wrapper with the helpers placement code actually wants.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    float(min, max) {
      return min + next() * (max - min);
    },
    // Inclusive on both ends.
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}
