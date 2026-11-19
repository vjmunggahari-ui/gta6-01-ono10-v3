// Solmar Bay — deterministic randomness: the same seed, the same city.
// One job: hand out numbers that never change between runs.

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

export function hash01(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function rrange(rng, min, max) {
  return range(rng, min, max);
}

export function rpick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function pick(rng, list) {
  return rpick(rng, list);
}
