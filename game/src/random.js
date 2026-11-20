// Solmar Bay (v6) — deterministic randomness: the same seed, the same city.
// One job: hand out numbers that never change between runs.
//
// Every draw comes from a seeded stream, never from Math.random or the
// clock, so a city built from seed 1337 is the same city on every machine
// and every run. Subsystems fork their own streams from one master stream
// so traffic, pedestrians and the world never eat each other's numbers.

// mulberry32 — small, fast, good-enough PRNG for a game. Same seed, same
// sequence, on every engine.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over a string, so 'solmar-bay' is a seed too. Any string maps to a
// stable 32-bit seed; the same string always builds the same city.
export function seedFromString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A 2D value hash: stable per (x, y) cell, no stream needed. Handy for
// speckles, pavement cracks, or anything placed by coordinate alone.
export function hash01(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Draw a fresh, independent stream from the current position of `rng`.
// Forking keeps subsystems from eating each other's numbers: the world can
// fork a traffic stream and a ped stream and all three stay deterministic.
export function fork(rng) {
  return mulberry32(Math.floor(rng() * 4294967296));
}

// --- draws ------------------------------------------------------------------

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function int(rng, min, max) {
  // Inclusive on both ends: int(rng, 1, 6) is a die.
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function bool(rng, p) {
  return rng() < (p === undefined ? 0.5 : p);
}

// Weighted pick: entries are [value, weight]; heavier entries win more often.
// Weights need not sum to 1.
export function weighted(rng, entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = rng() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Fisher–Yates; returns a NEW array, the input is untouched.
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Box–Muller: roughly normal, mean 0, spread 1. Stateless on purpose — a
// cached spare would make the sequence depend on call parity.
export function gauss(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
