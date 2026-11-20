// Solmar Bay (v6) — deterministic randomness, rewritten for rebuild6.
//
// Every number the city needs comes from here, and only here. Hand the
// same seed in and you get the same city, the same traffic, the same
// crowd — on any machine, on any run. Nothing in this file reads
// Math.random, the clock, or the date. Subsystems fork their own
// streams from one master stream, so the world, the traffic and the
// pedestrians never steal each other's draws.

// mulberry32: a small, fast PRNG. The same seed always yields the same
// sequence, on every engine. The state advances by a golden-ratio
// constant, then gets scrambled twice before it is read out.
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over a string, so a name like 'solmar-bay' works as a seed.
// Any string maps to one stable 32-bit seed; the same string always
// builds the same city.
export function seedFromString(str) {
  let hash = 0x811c9dc5;
  let i = 0;
  while (i < str.length) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    i += 1;
  }
  return hash >>> 0;
}

// A 2D value hash: stable per (x, y) cell, no stream needed. Use it for
// anything placed by coordinate alone — speckles, cracks, cloud homes.
export function hash01(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Draw a fresh, independent stream from the current position of `rng`.
// Forking keeps subsystems from eating each other's numbers: the world
// can fork a traffic stream and a ped stream and all three stay
// deterministic.
export function fork(rng) {
  const childSeed = Math.floor(rng() * 4294967296);
  return mulberry32(childSeed);
}

// --- draws ---------------------------------------------------------------

// Continuous: a float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Whole numbers, inclusive on both ends: int(rng, 1, 6) is a die roll.
export function int(rng, min, max) {
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

// One element of a list, uniformly.
export function pick(rng, list) {
  const index = Math.floor(rng() * list.length);
  return list[index];
}

// True with probability p (0.5 when p is omitted).
export function bool(rng, p) {
  const chance = p === undefined ? 0.5 : p;
  return rng() < chance;
}

// Weighted pick: entries are [value, weight]; heavier entries win more
// often. Weights need not sum to 1.
export function weighted(rng, entries) {
  let total = 0;
  for (const entry of entries) total += entry[1];
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry[1];
    if (roll <= 0) return entry[0];
  }
  return entries[entries.length - 1][0];
}

// Fisher-Yates; returns a NEW array, the input is untouched.
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

// Box-Muller: roughly normal, mean 0, spread 1. Stateless on purpose —
// a cached spare would make the sequence depend on call parity.
export function gauss(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  const radius = Math.sqrt(-2 * Math.log(u));
  const angle = 2 * Math.PI * v;
  return radius * Math.cos(angle);
}
