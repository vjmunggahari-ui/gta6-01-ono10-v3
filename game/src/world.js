// Solmar Bay — seeded world builder.
// Produces the whole city deterministically from SEED: 20 buildings (the
// Solmar Tower landmark first), 103 trees, 30 lamps, 19 benches, 6 boats,
// 10 parked cars, 2 fountains. No props on roads or water, no building or
// parked-car overlaps, every boat in the water.

import {
  WORLD_W, WORLD_H, SEED, WATERLINE, ROADS, TOWER, FOUNTAINS, PLAZA, COLORS,
} from './config.js';
import { makeRng } from './random.js';

// --- geometry helpers -------------------------------------------------------

export function onRoad(x, y) {
  const half = ROADS.width / 2;
  for (const vx of ROADS.vertical) {
    if (Math.abs(x - vx) <= half) return true;
  }
  for (const hy of ROADS.horizontal) {
    if (Math.abs(y - hy) <= half) return true;
  }
  return false;
}

export function inWater(x, y) {
  return y >= WATERLINE;
}

function rectsOverlap(a, b, pad) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w + pad * 2 &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h + pad * 2
  );
}

function distToRect(px, py, r) {
  const dx = Math.max(Math.abs(px - r.x) - r.w / 2, 0);
  const dy = Math.max(Math.abs(py - r.y) - r.h / 2, 0);
  return Math.hypot(dx, dy);
}

export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2) return b;
  }
  return null;
}

// --- buildings --------------------------------------------------------------
// Blocks are the cells between roads. One building per chosen cell, inset from
// the road edges by road half-width + sidewalk. The tower cell and the plaza
// cell are skipped; the tower is placed at its spec position instead.

function buildBuildings(rng) {
  const tower = {
    x: TOWER.x, y: TOWER.y, w: TOWER.w, h: TOWER.h,
    storeys: TOWER.storeys, facade: COLORS.tower, glass: COLORS.towerGlass,
    neon: null, neonColor: null, tower: true,
  };
  const list = [tower];

  const xEdges = [0, ...ROADS.vertical, WORLD_W];
  const yEdges = [0, ...ROADS.horizontal, WORLD_H];
  const inset = ROADS.width / 2 + 14;
  const cells = [];
  for (let i = 0; i < xEdges.length - 1; i++) {
    for (let j = 0; j < yEdges.length - 1; j++) {
      const x0 = xEdges[i] + inset;
      const x1 = xEdges[i + 1] - inset;
      const y0 = yEdges[j] + inset;
      const y1 = Math.min(yEdges[j + 1], WATERLINE) - inset;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 70) continue;
      const cell = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w, h };
      // Keep the plaza clear.
      if (distToRect(PLAZA.x, PLAZA.y, cell) < PLAZA.r + 30) continue;
      // Keep the tower footprint clear.
      if (rectsOverlap(cell, tower, 24)) continue;
      cells.push(cell);
    }
  }
  // Deterministic shuffle.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  for (const cell of cells) {
    if (list.length >= 20) break;
    const w = Math.min(cell.w - 20, rng.int(90, 220));
    const h = Math.min(cell.h - 20, rng.int(70, 160));
    const b = {
      x: cell.x + rng.float(-1, 1) * Math.max(0, (cell.w - w) / 2 - 4),
      y: cell.y + rng.float(-1, 1) * Math.max(0, (cell.h - h) / 2 - 4),
      w, h,
      storeys: rng.int(3, 14),
      facade: rng.pick(COLORS.facades),
      glass: COLORS.glass,
      neon: rng.chance(0.4),
      neonColor: rng.pick(COLORS.neon),
      tower: false,
    };
    list.push(b);
  }
  return list;
}

// --- props ------------------------------------------------------------------

function scatterTrees(rng, buildings) {
  const trees = [];
  const ok = (x, y) => {
    if (onRoad(x, y) || inWater(x, y)) return false;
    if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 12) return false;
    for (const f of FOUNTAINS) {
      if (Math.hypot(x - f.x, y - f.y) < 42) return false;
    }
    for (const b of buildings) {
      if (Math.abs(x - b.x) <= b.w / 2 + 10 && Math.abs(y - b.y) <= b.h / 2 + 10) return false;
    }
    return true;
  };
  let tries = 0;
  while (trees.length < 103 && tries < 8000) {
    tries++;
    const x = rng.float(40, WORLD_W - 40);
    const y = rng.float(40, WATERLINE - 40);
    if (!ok(x, y)) continue;
    trees.push({ x, y, r: rng.float(13, 22), shade: rng.chance(0.5) });
  }
  // Deterministic lattice fallback: guarantees the exact count.
  for (let gy = 60; trees.length < 103 && gy < WATERLINE - 40; gy += 46) {
    for (let gx = 60; trees.length < 103 && gx < WORLD_W - 40; gx += 46) {
      const x = gx + ((gy * 7) % 23);
      const y = gy + ((gx * 5) % 19);
      if (!ok(x, y)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 26)) continue;
      trees.push({ x, y, r: 16, shade: false });
    }
  }
  return trees;
}

function scatterLamps(rng, buildings) {
  const lamps = [];
  let tries = 0;
  while (lamps.length < 30 && tries < 3000) {
    tries++;
    const vertical = rng.chance(0.5);
    let x;
    let y;
    if (vertical) {
      const road = rng.pick(ROADS.vertical);
      x = road + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 12);
      y = rng.float(60, WATERLINE - 60);
    } else {
      const road = rng.pick(ROADS.horizontal);
      y = road + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 12);
      x = rng.float(60, WORLD_W - 60);
    }
    if (inWater(x, y) || onRoad(x, y)) continue;
    if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 8) continue;
    if (buildings.some((b) => Math.abs(x - b.x) <= b.w / 2 + 6 && Math.abs(y - b.y) <= b.h / 2 + 6)) continue;
    if (lamps.some((l) => Math.hypot(l.x - x, l.y - y) < 90)) continue;
    lamps.push({ x, y });
  }
  return lamps;
}

function ringBenches(rng, buildings) {
  const benches = [];
  // Seats around the plaza ring. The avenue crosses the plaza, so nudge each
  // seat's angle forward until it clears the road.
  for (let i = 0; i < 19; i++) {
    let angle = (i / 19) * Math.PI * 2 + rng.float(-0.08, 0.08);
    let x = PLAZA.x + Math.cos(angle) * (PLAZA.r + 26);
    let y = PLAZA.y + Math.sin(angle) * (PLAZA.r + 26);
    let guard = 0;
    const blocked = (bx, by) =>
      onRoad(bx, by) || inWater(bx, by) ||
      buildings.some((b) => Math.abs(bx - b.x) <= b.w / 2 + 6 && Math.abs(by - b.y) <= b.h / 2 + 6);
    while (blocked(x, y) && guard < 60) {
      guard++;
      angle += 0.06;
      x = PLAZA.x + Math.cos(angle) * (PLAZA.r + 26);
      y = PLAZA.y + Math.sin(angle) * (PLAZA.r + 26);
    }
    if (blocked(x, y)) continue;
    benches.push({ x, y, angle: angle + Math.PI / 2 });
  }
  return benches;
}

function scatterBoats(rng) {
  const boats = [];
  for (let i = 0; i < 6; i++) {
    boats.push({
      x: 240 + i * 480 + rng.float(-90, 90),
      y: rng.float(WATERLINE + 60, WORLD_H - 70),
      angle: rng.float(-0.4, 0.4),
      len: rng.int(46, 78),
    });
  }
  return boats;
}

function scatterParkedCars(rng, buildings) {
  const cars = [];
  const palette = ['#c23b2e', '#2e6fc2', '#e8c832', '#e8e8e8', '#3a3f46', '#7a4a9e'];
  let tries = 0;
  while (cars.length < 10 && tries < 3000) {
    tries++;
    const vertical = rng.chance(0.5);
    let x;
    let y;
    let angle;
    if (vertical) {
      const road = rng.pick(ROADS.vertical);
      x = road + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 14);
      y = rng.float(80, WATERLINE - 80);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const road = rng.pick(ROADS.horizontal);
      y = road + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 14);
      x = rng.float(80, WORLD_W - 80);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    if (inWater(x, y) || onRoad(x, y)) continue;
    if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 10) continue;
    const car = { x, y, w: 46, h: 22, angle, color: rng.pick(palette) };
    if (buildings.some((b) => rectsOverlap(car, b, 8))) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
    cars.push(car);
  }
  return cars;
}

// --- world ------------------------------------------------------------------

export function buildWorld() {
  const rng = makeRng(SEED);
  const buildings = buildBuildings(rng);
  const trees = scatterTrees(rng, buildings);
  const lamps = scatterLamps(rng, buildings);
  const benches = ringBenches(rng, buildings);
  const boats = scatterBoats(rng);
  const parkedCars = scatterParkedCars(rng, buildings);
  const fountains = FOUNTAINS.map((f) => ({ x: f.x, y: f.y, r: 26 }));
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
