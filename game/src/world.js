// Solmar Bay — the city itself: blocks, buildings, trees, boats, parked cars.
// One job: build the same city from the same seed, every time.

import { BEACH_TOP, MARINA_LEFT, ROADS_X, ROADS_Y, ROAD_HALF, WORLD } from './config.js';
import { mulberry32, pick, range } from './random.js';

const BUILDING_COLORS = ['#c97b4a', '#d99a5b', '#7d9bb5', '#8fae8b', '#b56a6a', '#a08bb5', '#c9a86a'];
const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#4ad97b', '#e8e6da', '#7a5fd9', '#e07b39'];

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
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
      const count = rng() < 0.6 ? 2 : 1;
      for (let n = 0; n < count; n += 1) {
        const w = range(rng, 90, Math.min(220, (x1 - x0) / count - 20));
        const h = range(rng, 80, Math.min(200, y1 - y0 - 20));
        const bx = n === 0 ? x0 + range(rng, 0, 20) : x1 - w - range(rng, 0, 20);
        const by = y0 + range(rng, 0, Math.max(1, y1 - y0 - h));
        buildings.push({
          x: Math.round(bx),
          y: Math.round(by),
          w: Math.round(w),
          h: Math.round(h),
          color: pick(rng, BUILDING_COLORS),
          roof: rng() < 0.18 ? 'pool' : rng() < 0.3 ? 'garden' : 'flat',
        });
      }
      // Trees along the block edges.
      const treeCount = 3 + Math.floor(rng() * 4);
      for (let t = 0; t < treeCount; t += 1) {
        trees.push({
          x: Math.round(range(rng, x0, x1)),
          y: Math.round(range(rng, y0, y1)),
          r: Math.round(range(rng, 9, 16)),
        });
      }
    }
  }
  // Boats in the marina, east of the last road.
  const boats = [];
  for (let i = 0; i < 6; i += 1) {
    boats.push({
      x: Math.round(range(rng, MARINA_LEFT + 60, WORLD.w - 80)),
      y: Math.round(range(rng, 200, BEACH_TOP - 200)),
      angle: (rng() - 0.5) * 0.4,
      color: pick(rng, CAR_COLORS),
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
  const places = {
    downtown: { x: 1320, y: 760 },
    marina: { x: 2980, y: 1220 },
    docks: { x: 2920, y: 1680 },
    hospital: { x: 320, y: 1220 },
    safehouse: { x: 320, y: 300 },
  };
  return { buildings, trees, boats, parked, places };
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

export function roadAngleAt(a, b) {
  const { x, y } = pointOf(a, b);
  // The angle of the nearest road centreline: vertical roads run north-south.
  let best = Infinity;
  let angle = 0;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < best) {
      best = d;
      angle = Math.PI / 2;
    }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best) {
      best = d;
      angle = 0;
    }
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
    if (d < best) {
      best = d;
      point = { x: rx, y };
    }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best) {
      best = d;
      point = { x, y: ry };
    }
  }
  return point;
}

// Pushes a body out of any building it overlaps; true when it pushed.
export function collideBuildings(world, body) {
  if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) return false;
  const r = body.radius || 12;
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r || d2 < 0.001) continue;
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
