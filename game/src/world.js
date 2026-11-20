// Solmar Bay — deterministic city generation from the seed.
// Imports config + random only. Every placement decision is made here, so the
// renderer and the gameplay code never have to guess where things are.
import { WORLD_W, WORLD_H, SEED, WATERLINE, ROADS, TOWER, FOUNTAINS, PLAZA, COLORS } from './config.js';
import { makeRng } from './random.js';

// Point-in-road test. Roads run the full map in their direction; the
// waterfront cuts the vertical avenues at WATERLINE.
export function onRoad(x, y) {
  const half = ROADS.width / 2;
  for (const vx of ROADS.vertical) {
    if (Math.abs(x - vx) < half && y < WATERLINE + half) return true;
  }
  for (const hy of ROADS.horizontal) {
    if (Math.abs(y - hy) < half) return true;
  }
  return false;
}

export function inWater(x, y) {
  return y >= WATERLINE;
}

// Does the axis-aligned rect (centre x,y, size w,h) touch a road?
// `pad` grows the rect so props keep clear of the carriageway.
function rectHitsRoad(x, y, w, h, pad) {
  const half = ROADS.width / 2 + pad;
  for (const vx of ROADS.vertical) {
    if (x + w / 2 > vx - half && x - w / 2 < vx + half && y + h / 2 > 0 && y - h / 2 < WATERLINE + half) return true;
  }
  for (const hy of ROADS.horizontal) {
    if (y + h / 2 > hy - half && y - h / 2 < hy + half) return true;
  }
  return false;
}

function rectsOverlap(a, b, gap) {
  return (
    a.x - a.w / 2 - gap < b.x + b.w / 2 &&
    a.x + a.w / 2 + gap > b.x - b.w / 2 &&
    a.y - a.h / 2 - gap < b.y + b.h / 2 &&
    a.y + a.h / 2 + gap > b.y - b.h / 2
  );
}

function insidePlaza(x, y, pad) {
  const dx = x - PLAZA.x;
  const dy = y - PLAZA.y;
  return dx * dx + dy * dy < (PLAZA.r + pad) * (PLAZA.r + pad);
}

// The building the point stands on, or null. Tower counts as a building.
export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 && y <= b.y + b.h / 2) return b;
  }
  return null;
}

export function buildWorld() {
  const rng = makeRng(SEED);

  // ---- Buildings: tower fixed first, then 19 seeded blocks. ----
  const buildings = [
    {
      x: TOWER.x,
      y: TOWER.y,
      w: TOWER.w,
      h: TOWER.h,
      storeys: TOWER.storeys,
      facade: COLORS.tower,
      neon: true,
      neonColor: COLORS.neon[2],
      landmark: true,
      name: TOWER.name,
    },
  ];
  let tries = 0;
  while (buildings.length < 20 && tries < 20000) {
    tries++;
    const w = rng.float(70, 150);
    const h = rng.float(60, 120);
    const x = rng.float(90, WORLD_W - 90);
    const y = rng.float(90, WATERLINE - 160);
    if (rectHitsRoad(x, y, w, h, 14)) continue;
    if (insidePlaza(x, y, Math.max(w, h) / 2 + 8)) continue;
    if (buildings.some((b) => rectsOverlap({ x, y, w, h }, b, 18))) continue;
    buildings.push({
      x,
      y,
      w,
      h,
      storeys: rng.int(3, 12),
      facade: rng.pick(COLORS.facades),
      neon: rng.chance(0.45),
      neonColor: rng.pick(COLORS.neon),
      landmark: false,
      name: null,
    });
  }
  // Deterministic sweep fallback: walk a coarse grid until the count is met.
  if (buildings.length < 20) {
    outer: for (let gy = 130; gy < WATERLINE - 160; gy += 170) {
      for (let gx = 130; gx < WORLD_W - 90; gx += 180) {
        if (buildings.length >= 20) break outer;
        const w = 110;
        const h = 80;
        if (rectHitsRoad(gx, gy, w, h, 14)) continue;
        if (insidePlaza(gx, gy, 70)) continue;
        if (buildings.some((b) => rectsOverlap({ x: gx, y: gy, w, h }, b, 18))) continue;
        buildings.push({
          x: gx,
          y: gy,
          w,
          h,
          storeys: 6,
          facade: COLORS.facades[buildings.length % COLORS.facades.length],
          neon: false,
          neonColor: COLORS.neon[0],
          landmark: false,
          name: null,
        });
      }
    }
  }

  // ---- Trees: scattered on grass, never on road/water/building/plaza. ----
  const trees = [];
  tries = 0;
  while (trees.length < 103 && tries < 20000) {
    tries++;
    const x = rng.float(30, WORLD_W - 30);
    const y = rng.float(30, WATERLINE - 30);
    if (onRoad(x, y)) continue;
    if (insidePlaza(x, y, 4)) continue;
    if (buildingAt({ buildings }, x, y)) continue;
    trees.push({ x, y, r: rng.float(11, 17), kind: rng.int(0, 2) });
  }
  if (trees.length < 103) {
    outer2: for (let gy = 60; gy < WATERLINE - 30; gy += 55) {
      for (let gx = 60; gx < WORLD_W - 30; gx += 55) {
        if (trees.length >= 103) break outer2;
        if (onRoad(gx, gy)) continue;
        if (insidePlaza(gx, gy, 4)) continue;
        if (buildingAt({ buildings }, gx, gy)) continue;
        trees.push({ x: gx, y: gy, r: 13, kind: 1 });
      }
    }
  }

  // ---- Lamps: on sidewalk edges beside a road, clear of crossings. ----
  const lamps = [];
  tries = 0;
  while (lamps.length < 30 && tries < 20000) {
    tries++;
    let x;
    let y;
    if (rng.chance(0.5)) {
      const vx = rng.pick(ROADS.vertical);
      x = vx + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 10);
      y = rng.float(40, WATERLINE - 40);
    } else {
      const hy = rng.pick(ROADS.horizontal);
      y = hy + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 10);
      x = rng.float(40, WORLD_W - 40);
    }
    if (onRoad(x, y)) continue;
    if (inWater(x, y)) continue;
    if (buildingAt({ buildings }, x, y)) continue;
    if (lamps.some((l) => Math.abs(l.x - x) < 24 && Math.abs(l.y - y) < 24)) continue;
    lamps.push({ x, y });
  }

  // ---- Benches: a ring in the plaza, the rest along sidewalks. ----
  // The plaza straddles the avenue at x=850, so ring seats are nudged
  // around the circle until they sit clear of the carriageway.
  const benches = [];
  for (let i = 0; i < 8; i++) {
    let a = (i / 8) * Math.PI * 2 + 0.35;
    let bx = PLAZA.x + Math.cos(a) * (PLAZA.r - 26);
    let by = PLAZA.y + Math.sin(a) * (PLAZA.r - 26);
    let guard = 0;
    while (onRoad(bx, by) && guard < 40) {
      guard++;
      a += 0.09;
      bx = PLAZA.x + Math.cos(a) * (PLAZA.r - 26);
      by = PLAZA.y + Math.sin(a) * (PLAZA.r - 26);
    }
    benches.push({ x: bx, y: by, rot: a + Math.PI / 2 });
  }
  tries = 0;
  while (benches.length < 19 && tries < 20000) {
    tries++;
    let x;
    let y;
    if (rng.chance(0.5)) {
      const vx = rng.pick(ROADS.vertical);
      x = vx + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 22);
      y = rng.float(40, WATERLINE - 40);
    } else {
      const hy = rng.pick(ROADS.horizontal);
      y = hy + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 22);
      x = rng.float(40, WORLD_W - 40);
    }
    if (onRoad(x, y)) continue;
    if (inWater(x, y)) continue;
    if (buildingAt({ buildings }, x, y)) continue;
    if (benches.some((b) => Math.abs(b.x - x) < 30 && Math.abs(b.y - y) < 30)) continue;
    benches.push({ x, y, rot: rng.chance(0.5) ? 0 : Math.PI / 2 });
  }

  // ---- Boats: drifting in the water strip at the south edge. ----
  const boats = [];
  for (let i = 0; i < 6; i++) {
    boats.push({
      x: rng.float(120, WORLD_W - 120),
      y: rng.float(WATERLINE + 55, WORLD_H - 70),
      len: rng.float(64, 112),
      hue: rng.pick(['#e8e8e8', '#d95f4b', '#4b8ad9', '#e8c84b']),
      bob: rng.float(0, Math.PI * 2),
    });
  }

  // ---- Parked cars: nose-to-kerb along road edges. ----
  const parkedCars = [];
  tries = 0;
  while (parkedCars.length < 10 && tries < 20000) {
    tries++;
    let x;
    let y;
    let angle;
    if (rng.chance(0.5)) {
      const vx = rng.pick(ROADS.vertical);
      x = vx + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 16);
      y = rng.float(60, WATERLINE - 60);
      angle = Math.PI / 2;
    } else {
      const hy = rng.pick(ROADS.horizontal);
      y = hy + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 16);
      x = rng.float(60, WORLD_W - 60);
      angle = 0;
    }
    if (onRoad(x, y)) continue;
    if (inWater(x, y)) continue;
    if (buildingAt({ buildings }, x, y)) continue;
    if (parkedCars.some((c) => Math.abs(c.x - x) < 46 && Math.abs(c.y - y) < 46)) continue;
    parkedCars.push({ x, y, angle, color: rng.pick(COLORS.facades) });
  }

  const fountains = FOUNTAINS.map((f) => ({ x: f.x, y: f.y, r: 34 }));

  return {
    seed: SEED,
    width: WORLD_W,
    height: WORLD_H,
    buildings,
    trees,
    lamps,
    benches,
    boats,
    parkedCars,
    fountains,
  };
}
