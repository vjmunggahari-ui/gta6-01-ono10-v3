// Solmar Bay — deterministic city generation + spatial queries.
import {
  SEED,
  WORLD,
  WATERLINE,
  ROAD_W,
  VERTICAL_ROADS,
  HORIZONTAL_ROADS,
  PLAZA,
  TOWER,
  FOUNTAINS,
  COUNTS,
} from './config.js';
import { makeRng } from './random.js';

const NEON_SIGNS = ['HOTEL', 'PIER', 'TACOS', '24H', 'BAR', 'SURF', 'GYM', 'NOODLE'];
const NEON_COLORS = ['#ff2d78', '#00e5ff', '#ffd23e', '#7cff4f', '#ff7a1a', '#c26bff'];

// True when (x, y) lies on a road band (center +/- ROAD_W/2).
export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const rx of VERTICAL_ROADS) {
    if (Math.abs(x - rx) <= half) return true;
  }
  for (const ry of HORIZONTAL_ROADS) {
    if (Math.abs(y - ry) <= half) return true;
  }
  return false;
}

// True when (x, y) is in the bay (south of the waterline).
export function inWater(x, y) {
  return y >= WATERLINE;
}

function rectHitsRoad(x, y, w, h) {
  const half = ROAD_W / 2 + 8;
  for (const rx of VERTICAL_ROADS) {
    if (x < rx + half && x + w > rx - half) return true;
  }
  for (const ry of HORIZONTAL_ROADS) {
    if (y < ry + half && y + h > ry - half) return true;
  }
  return false;
}

function rectHitsPlaza(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const d = Math.hypot(cx - PLAZA.x, cy - PLAZA.y);
  return d < PLAZA.r + Math.max(w, h) / 2 + 12;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Build the whole city deterministically from SEED.
export function buildWorld() {
  const rng = makeRng(SEED);

  // --- buildings: 20, kept off roads, out of the water, clear of the plaza.
  const buildings = [];
  let guard = 0;
  while (buildings.length < COUNTS.buildings && guard++ < 4000) {
    const w = rng.int(90, 220);
    const h = rng.int(70, 180);
    const x = rng.int(40, WORLD.w - w - 40);
    const y = rng.int(40, WATERLINE - h - 60);
    const cand = { x, y, w, h };
    if (rectHitsRoad(x, y, w, h)) continue;
    if (rectHitsPlaza(x, y, w, h)) continue;
    if (buildings.some((b) => rectsOverlap(cand, b))) continue;
    // Keep a clear strip in front of the tower so the landmark stays visible.
    if (cand.x < TOWER.x + TOWER.w + 40 && cand.x + w > TOWER.x - 40 &&
        cand.y < TOWER.y + TOWER.h + 40 && cand.y + h > TOWER.y - 40) continue;
    cand.hue = rng.int(0, 359);
    cand.storeys = rng.int(2, 9);
    cand.neon = rng.pick(NEON_COLORS);
    cand.sign = rng.pick(NEON_SIGNS);
    buildings.push(cand);
  }

  // --- trees: 103, on land, off roads and building footprints.
  const trees = [];
  guard = 0;
  while (trees.length < COUNTS.trees && guard++ < 8000) {
    const x = rng.int(30, WORLD.w - 30);
    const y = rng.int(30, WATERLINE - 30);
    if (onRoad(x, y)) continue;
    if (buildings.some((b) => x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6)) continue;
    if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r - 8) continue;
    trees.push({ x, y, r: rng.int(9, 15), shade: rng.int(0, 2) });
  }

  // --- lamps: 30, lining the roads.
  const lamps = [];
  for (let i = 0; i < COUNTS.lamps; i++) {
    if (i % 2 === 0) {
      const rx = rng.pick(VERTICAL_ROADS);
      const y = rng.int(60, WATERLINE - 60);
      lamps.push({ x: rx + (rng.next() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 8), y });
    } else {
      const ry = rng.pick(HORIZONTAL_ROADS);
      const x = rng.int(60, WORLD.w - 60);
      lamps.push({ x, y: ry + (rng.next() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 8) });
    }
  }

  // --- benches: 19, ringed around the plaza plus a few on the main drag.
  const benches = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rng.range(-0.08, 0.08);
    benches.push({
      x: PLAZA.x + Math.cos(a) * (PLAZA.r + 22),
      y: PLAZA.y + Math.sin(a) * (PLAZA.r + 22),
      angle: a + Math.PI / 2,
    });
  }
  for (let i = 12; i < COUNTS.benches; i++) {
    benches.push({
      x: rng.int(300, 2900),
      y: HORIZONTAL_ROADS[2] + (ROAD_W / 2 + 10),
      angle: 0,
    });
  }

  // --- boats: 6, drifting in the bay.
  const boats = [];
  for (let i = 0; i < COUNTS.boats; i++) {
    boats.push({
      x: 250 + i * 480 + rng.int(-60, 60),
      y: WATERLINE + rng.int(70, 220),
      angle: rng.range(-0.25, 0.25),
      speed: rng.range(4, 12),
      phase: rng.range(0, Math.PI * 2),
    });
  }

  // --- parked cars: 10, nose-in along road edges.
  const parkedCars = [];
  const CAR_COLORS = ['#d23b3b', '#3b7dd2', '#e8c832', '#e8e8e8', '#2b2b2b', '#3fae6a'];
  for (let i = 0; i < COUNTS.parkedCars; i++) {
    if (i % 2 === 0) {
      const rx = rng.pick(VERTICAL_ROADS);
      parkedCars.push({
        x: rx + (rng.next() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 12),
        y: rng.int(120, WATERLINE - 120),
        angle: Math.PI / 2,
        color: rng.pick(CAR_COLORS),
      });
    } else {
      const ry = rng.pick(HORIZONTAL_ROADS);
      parkedCars.push({
        x: rng.int(120, WORLD.w - 120),
        y: ry + (rng.next() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 12),
        angle: 0,
        color: rng.pick(CAR_COLORS),
      });
    }
  }

  // --- drifting cloud shadows (visual only).
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: rng.int(0, WORLD.w),
      y: rng.int(100, 1900),
      r: rng.int(180, 320),
      speed: rng.range(6, 14),
    });
  }

  return {
    seed: SEED,
    buildings,
    tower: { ...TOWER, landmark: true },
    trees,
    lamps,
    benches,
    boats,
    parkedCars,
    fountains: FOUNTAINS.map((f) => ({ ...f })),
    plaza: { ...PLAZA },
    clouds,
  };
}

// Building (or tower) containing point (x, y), or null.
export function buildingAt(world, x, y) {
  if (x >= world.tower.x && x <= world.tower.x + world.tower.w &&
      y >= world.tower.y && y <= world.tower.y + world.tower.h) {
    return world.tower;
  }
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Walkable: on land, not inside a building/tower, not in a fountain basin.
export function isWalkable(world, x, y) {
  if (inWater(x, y)) return false;
  if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return false;
  if (buildingAt(world, x, y)) return false;
  for (const f of world.fountains) {
    if (Math.hypot(x - f.x, y - f.y) < 26) return false;
  }
  return true;
}
