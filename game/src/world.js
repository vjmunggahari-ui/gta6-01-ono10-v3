// Solmar Bay (v6) — the city itself: districts, blocks, buildings, trees,
// boats, parked cars, lamps, benches, fountains and piers.
// One job: build the same city from the same seed, every time.
//
// v6 vs v5: two plaza blocks carry fountains instead of buildings (an Old
// Town square and a Downtown square, with benches and trees around the
// water); the tallest downtown tower is flagged as the Solmar Tower
// landmark; some tall downtown facades carry neon signs. Collisions still
// run against the coarse grid index, and a body whose centre lands inside
// a building is pushed out along the shallowest side.

import { BEACH_TOP, COLORS, DISTRICTS, MARINA_LEFT, PIER, PLACES, ROADS_X, ROADS_Y, ROAD_HALF, SEA_TOP, WORLD } from './config.js';
import { int, mulberry32, pick, range } from './random.js';

const PALETTES = {
  city: ['#7d9bb5', '#8fae8b', '#a08bb5', '#c9a86a', '#6a8a9b'],
  brick: ['#c97b4a', '#b56a6a', '#d99a5b', '#a86a4a'],
  suburb: ['#d9c9a0', '#b5c9a0', '#c9b5a0', '#e8e6da'],
  industrial: ['#8a8f98', '#6a7078', '#7a6a5a', '#5a6a7a'],
  marina: ['#e8e6da', '#a0c9d9', '#d9d9c9'],
  sand: ['#d9c27a'],
};
const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#4ad97b', '#e8e6da', '#7a5fd9', '#e07b39'];
const GRID_CELL = 256;

// Blocks that become open plazas instead of building plots: [column, row]
// in the road grid. Old Town square (ix 0, iy 1) and Downtown square
// (ix 1, iy 1) each get a fountain at the block centre.
const PLAZAS = [
  { ix: 0, iy: 1 },
  { ix: 1, iy: 1 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

function gridKey(cx, cy) {
  return `${cx},${cy}`;
}

function isPlaza(ix, iy) {
  return PLAZAS.some((p) => p.ix === ix && p.iy === iy);
}

// Index buildings into coarse grid cells so collideBuildings only tests the
// handful of buildings near a body instead of all of them.
function indexBuildings(buildings) {
  const grid = new Map();
  buildings.forEach((b, i) => {
    const x0 = Math.floor(b.x / GRID_CELL);
    const x1 = Math.floor((b.x + b.w) / GRID_CELL);
    const y0 = Math.floor(b.y / GRID_CELL);
    const y1 = Math.floor((b.y + b.h) / GRID_CELL);
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const k = gridKey(cx, cy);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    }
  });
  return grid;
}

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const benches = [];
  const fountains = [];
  // One or two buildings per block, kept off the roads, the beach and the marina.
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_HALF + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_HALF - 14;
      const y0 = ROADS_Y[iy] + ROAD_HALF + 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_HALF - 14;
      if (x1 <= x0 + 60 || y1 <= y0 + 60) continue;
      if (x0 > MARINA_LEFT - 100) continue;
      if (y0 > BEACH_TOP - 100) continue;
      // A plaza block gets a fountain and greenery, no buildings.
      if (isPlaza(ix, iy)) {
        const cx = Math.round((x0 + x1) / 2);
        const cy = Math.round((y0 + y1) / 2);
        fountains.push({ x: cx, y: cy, r: 42 });
        for (let t = 0; t < 8; t += 1) {
          const ang = (t / 8) * Math.PI * 2 + range(rng, -0.2, 0.2);
          const dist = range(rng, 70, 120);
          trees.push({
            x: Math.round(cx + Math.cos(ang) * dist),
            y: Math.round(cy + Math.sin(ang) * dist),
            r: Math.round(range(rng, 10, 16)),
          });
        }
        for (let b = 0; b < 3; b += 1) {
          benches.push({
            x: Math.round(cx + range(rng, -90, 90)),
            y: Math.round(cy + range(rng, -90, 90)),
            angle: rng() < 0.5 ? 0 : Math.PI / 2,
          });
        }
        continue;
      }
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      const palette = PALETTES[district.palette] || PALETTES.city;
      const count = district.density >= 2 && rng() < 0.6 ? 2 : 1;
      for (let n = 0; n < count; n += 1) {
        const w = range(rng, 90, Math.min(220, (x1 - x0) / count - 20));
        const h = range(rng, 80, Math.min(200, y1 - y0 - 20));
        const bx = n === 0 ? x0 + range(rng, 0, 20) : x1 - w - range(rng, 0, 20);
        const by = y0 + range(rng, 0, Math.max(1, y1 - y0 - h));
        const stories = district.id === 'downtown' ? int(rng, 6, 18) : district.id === 'oldtown' ? int(rng, 2, 4) : int(rng, 1, 3);
        // Tall downtown facades sometimes carry a neon sign after dark.
        let neon = null;
        if (district.id === 'downtown' && stories >= 6 && rng() < 0.45) {
          neon = pick(rng, COLORS.neon);
        }
        buildings.push({
          x: Math.round(bx),
          y: Math.round(by),
          w: Math.round(w),
          h: Math.round(h),
          color: pick(rng, palette),
          roof: rng() < 0.18 ? 'pool' : rng() < 0.3 ? 'garden' : 'flat',
          district: district.id,
          stories,
          neon,
          landmark: false,
        });
      }
      // Trees along the block edges, plus a bench or two where people linger.
      const treeCount = 3 + Math.floor(rng() * 4);
      for (let t = 0; t < treeCount; t += 1) {
        trees.push({
          x: Math.round(range(rng, x0, x1)),
          y: Math.round(range(rng, y0, y1)),
          r: Math.round(range(rng, 9, 16)),
        });
      }
      if (rng() < 0.5) {
        benches.push({ x: Math.round(range(rng, x0, x1)), y: Math.round(range(rng, y0, y1)), angle: rng() < 0.5 ? 0 : Math.PI / 2 });
      }
    }
  }
  // The Solmar Tower: the tallest downtown building, raised to 24 storeys
  // and flagged so the renderer gives it a beacon and a rooftop sign.
  let tower = null;
  for (const b of buildings) {
    if (b.district !== 'downtown') continue;
    if (!tower || b.stories > tower.stories) tower = b;
  }
  if (tower) {
    tower.stories = 24;
    tower.landmark = true;
    tower.neon = null;
  }
  // Street lamps at every intersection, on alternating corners.
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      lamps.push({
        x: rx + (ROAD_HALF + 8) * (lamps.length % 2 === 0 ? 1 : -1),
        y: ry + (ROAD_HALF + 8) * (lamps.length % 3 === 0 ? 1 : -1),
      });
    }
  }
  // Boats moored in slips in the marina, east of the last road.
  const boats = [];
  for (let i = 0; i < 6; i += 1) {
    boats.push({
      x: Math.round(range(rng, MARINA_LEFT + 60, WORLD.w - 80)),
      y: Math.round(range(rng, 200, BEACH_TOP - 200)),
      angle: (rng() - 0.5) * 0.4,
      color: pick(rng, CAR_COLORS),
      slip: i,
    });
  }
  // Parked cars along the roads, waiting to be borrowed.
  const parked = [];
  for (let i = 0; i < 10; i += 1) {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? ROADS_X : ROADS_Y);
    const along = range(rng, 200, vertical ? WORLD.h - 200 : WORLD.w - 200);
    const side = rng() < 0.5 ? -ROAD_HALF - 16 : ROAD_HALF + 16;
    parked.push({
      x: vertical ? Math.round(road + side) : Math.round(along),
      y: vertical ? Math.round(along) : Math.round(road + side),
      angle: vertical ? (rng() < 0.5 ? -Math.PI / 2 : Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      color: pick(rng, CAR_COLORS),
    });
  }
  return {
    buildings, trees, lamps, benches, boats, parked, fountains,
    places: { ...PLACES },
    pier: { ...PIER },
    grid: indexBuildings(buildings),
  };
}

// The road helpers take either a body ({x, y}) or plain (x, y) coordinates.
function pointOf(a, b) {
  if (a !== null && typeof a === 'object') return { x: a.x, y: a.y };
  return { x: a, y: b };
}

export function isOnRoad(a, b) {
  const { x, y } = pointOf(a, b);
  for (const rx of ROADS_X) {
    if (Math.abs(x - rx) <= ROAD_HALF) return true;
  }
  for (const ry of ROADS_Y) {
    if (Math.abs(y - ry) <= ROAD_HALF) return true;
  }
  return false;
}

export function isOnBeach(x, y) {
  return y >= BEACH_TOP && y < SEA_TOP;
}

export function isInSea(x, y) {
  return y >= SEA_TOP;
}

export function roadAngleAt(a, b) {
  const { x, y } = pointOf(a, b);
  // The angle of the nearest road centreline: vertical roads run north-south.
  let best = Infinity;
  let angle = 0;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < best) { best = d; angle = Math.PI / 2; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best) { best = d; angle = 0; }
  }
  return angle;
}

export function snapToRoad(a, b) {
  const { x, y } = pointOf(a, b);
  // The nearest point on a road centreline to (x, y).
  let best = Infinity;
  let point = { x, y };
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < best) { best = d; point = { x: rx, y }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best) { best = d; point = { x, y: ry }; }
  }
  return point;
}

// A random point on a random road, for spawns that must start on tarmac.
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, ROADS_X), y: range(rng, 120, WORLD.h - 320) };
  }
  return { x: range(rng, 120, WORLD.w - 120), y: pick(rng, ROADS_Y) };
}

// The grid cells a body may touch: its own cell plus the eight around it,
// so a body straddling a cell edge still tests the buildings next door.
function nearbyCells(world, x, y) {
  const cx = Math.floor(x / GRID_CELL);
  const cy = Math.floor(y / GRID_CELL);
  const out = [];
  for (let ox = -1; ox <= 1; ox += 1) {
    for (let oy = -1; oy <= 1; oy += 1) {
      const cell = world.grid.get(gridKey(cx + ox, cy + oy));
      if (cell) out.push(...cell);
    }
  }
  return out;
}

// True when (x, y) sits inside any building. Used by spawns and missions.
export function pointInBuilding(world, x, y) {
  for (const i of nearbyCells(world, x, y)) {
    const b = world.buildings[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// Pushes a body out of any building it overlaps; true when it pushed.
// Only the grid cells around the body are tested now, not the whole city.
// A body whose centre is inside a building is pushed out along the
// shallowest side.
export function collideBuildings(world, body) {
  if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) return false;
  const r = body.radius || 12;
  let hit = false;
  for (const i of nearbyCells(world, body.x, body.y)) {
    const b = world.buildings[i];
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < 0.001) {
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = b.x - r;
      else if (min === right) body.x = b.x + b.w + r;
      else if (min === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
      hit = true;
      continue;
    }
    if (d2 >= r * r) continue;
    const d = Math.sqrt(d2);
    body.x = cx + (dx / d) * r;
    body.y = cy + (dy / d) * r;
    hit = true;
  }
  return hit;
}

export function clampToWorld(body, margin) {
  if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) return;
  const m = margin || 0;
  body.x = Math.max(m, Math.min(WORLD.w - m, body.x));
  body.y = Math.max(m, Math.min(WORLD.h - m, body.y));
}
