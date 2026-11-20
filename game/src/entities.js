// Solmar Bay — entities: player, traffic, pedestrians, police.
// The player walks or drives; traffic follows the road grid and swerves
// (with a honk) when the player's car blocks its lane; pedestrians stroll
// the sidewalks; police cruisers chase and PIT at 4+ stars only.

import { WORLD_W, WORLD_H, WATERLINE, ROADS } from './config.js';
import { buildingAt, onRoad, inWater } from './world.js';

const TRAFFIC_COLORS = ['#c23b2e', '#2e6fc2', '#e8c832', '#e8e8e8', '#3a3f46', '#7a4a9e'];

// --- player -----------------------------------------------------------------

export function makePlayer(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    onFoot: true,
    car: null, // the car object the player is driving, or null
    spin: 0, // remaining spin time after a PIT shove
    honkAt: 0,
  };
}

// Move the player. dir = {x, y} unit-ish input vector, dt seconds.
// On foot: walk speed 190. In a car: accelerate toward top speed 420,
// brake with reverse input. Buildings block, water blocks on foot.
export function movePlayer(player, world, dir, dt) {
  if (player.spin > 0) {
    player.spin -= dt;
    player.angle += 7 * dt;
    player.speed *= 0.9;
  }
  const top = player.onFoot ? 190 : 420;
  const accel = player.onFoot ? 900 : 620;
  if (dir.x !== 0 || dir.y !== 0) {
    const len = Math.hypot(dir.x, dir.y) || 1;
    const nx = dir.x / len;
    const ny = dir.y / len;
    player.speed = Math.min(top, player.speed + accel * dt);
    player.angle = Math.atan2(ny, nx);
    const nx2 = player.x + nx * player.speed * dt;
    const ny2 = player.y + ny * player.speed * dt;
    if (!blocked(world, nx2, player.y)) player.x = nx2;
    if (!blocked(world, player.x, ny2)) player.y = ny2;
  } else {
    player.speed = Math.max(0, player.speed - (player.onFoot ? 700 : 260) * dt);
  }
  player.x = Math.max(12, Math.min(WORLD_W - 12, player.x));
  player.y = Math.max(12, Math.min(WORLD_H - 12, player.y));
}

function blocked(world, x, y) {
  if (buildingAt(world, x, y)) return true;
  // Water stops a walker; a car may not enter the bay either.
  if (inWater(x, y)) return true;
  return false;
}

// --- cars -------------------------------------------------------------------

// Enter the nearest parked car within maxD (default 70). Returns the car or
// null. The car is removed from the parked list by the caller.
export function stealCar(player, cars, maxD = 70) {
  let best = null;
  let bestD = maxD;
  for (const c of cars) {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return null;
  player.onFoot = false;
  player.car = best;
  player.x = best.x;
  player.y = best.y;
  player.angle = best.angle;
  player.speed = 0;
  return best;
}

// Step out of the car: the player stands beside it and the car parks again.
export function exitCar(player) {
  if (player.onFoot || !player.car) return null;
  const car = player.car;
  car.x = player.x;
  car.y = player.y;
  car.angle = player.angle;
  player.car = null;
  player.onFoot = true;
  player.speed = 0;
  player.x += Math.cos(player.angle + Math.PI / 2) * 30;
  player.y += Math.sin(player.angle + Math.PI / 2) * 30;
  return car;
}

// --- traffic ----------------------------------------------------------------

export function makeTraffic(world, rng, count = 10) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < 4000) {
    tries++;
    const vertical = rng.chance(0.5);
    let x;
    let y;
    let angle;
    if (vertical) {
      const road = rng.pick(ROADS.vertical);
      x = road + (rng.chance(0.5) ? 1 : -1) * 16;
      y = rng.float(80, WATERLINE - 80);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const road = rng.pick(ROADS.horizontal);
      y = road + (rng.chance(0.5) ? 1 : -1) * 16;
      x = rng.float(80, WORLD_W - 80);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    cars.push({
      x, y, angle, w: 46, h: 22,
      speed: rng.float(90, 150),
      color: rng.pick(TRAFFIC_COLORS),
      vertical, lane: rng.chance(0.5) ? 1 : -1,
      swerve: 0, honk: 0,
    });
  }
  return cars;
}

// Drive traffic along its road. A car swerves sideways (and honks) when the
// player's car is stopped ahead of it in its lane; it straightens out once
// past. Cars wrap around the world edges.
export function updateTraffic(cars, player, dt, now) {
  for (const c of cars) {
    const aheadX = c.x + Math.cos(c.angle) * 130;
    const aheadY = c.y + Math.sin(c.angle) * 130;
    const playerBlock =
      !player.onFoot &&
      Math.hypot(aheadX - player.x, aheadY - player.y) < 60;
    if (playerBlock) {
      c.swerve = Math.max(c.swerve, 26);
      if (c.honk <= now) c.honk = now + 1.6;
    } else if (c.swerve > 0) {
      c.swerve = Math.max(0, c.swerve - 40 * dt);
    }
    const side = c.angle + Math.PI / 2;
    const lat = c.swerve * (c.lane || 1);
    c.x += (Math.cos(c.angle) * c.speed + Math.cos(side) * lat * 2) * dt;
    c.y += (Math.sin(c.angle) * c.speed + Math.sin(side) * lat * 2) * dt;
    if (c.x < -60) c.x = WORLD_W + 50;
    if (c.x > WORLD_W + 60) c.x = -50;
    if (c.y < -60) c.y = WATERLINE + 50;
    if (c.y > WATERLINE + 60) c.y = -50;
  }
}

// --- pedestrians ------------------------------------------------------------

export function makePedestrians(world, rng, count = 14) {
  const peds = [];
  let tries = 0;
  while (peds.length < count && tries < 4000) {
    tries++;
    const x = rng.float(60, WORLD_W - 60);
    const y = rng.float(60, WATERLINE - 60);
    if (onRoad(x, y) || buildingAt(world, x, y)) continue;
    peds.push({
      x, y,
      angle: rng.float(0, Math.PI * 2),
      speed: rng.float(28, 55),
      turnAt: 0,
      color: rng.pick(['#d95f4b', '#4b8fd9', '#e8c832', '#7a4a9e', '#e8e8e8']),
    });
  }
  return peds;
}

// Stroll; turn at random, bounce off buildings and water.
export function updatePedestrians(peds, world, dt, now, rng) {
  for (const p of peds) {
    if (now > p.turnAt) {
      p.angle += rng.float(-1.2, 1.2);
      p.turnAt = now + rng.float(2, 6);
    }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (!buildingAt(world, nx, ny) && !inWater(nx, ny) && !onRoad(nx, ny)) {
      p.x = nx;
      p.y = ny;
    } else {
      p.angle += Math.PI / 2;
    }
  }
}

// --- police -----------------------------------------------------------------

export function makePolice() {
  return { cruisers: [], roadblocks: [], wanted: 0, heatSince: 0 };
}

export function spawnCruiser(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    lastPit: -10, // seconds; a cruiser PITs at most once per 5 s
  };
}

// Chase the player. Cruisers steer toward the player and cap at 460 px/s.
// PIT: at wanted >= 4 ONLY, a cruiser alongside at matching speed shoves
// the player's car sideways, spins it and cuts its speed; one shove per
// cruiser per 5 s. Never on foot, never below 4 stars.
export function updatePolice(world, police, player, dt, now, rng) {
  const wanted = police.wanted || 0;
  // Keep one cruiser per star, spawn on a road near the player.
  while (police.cruisers.length < wanted) {
    const road = rng.pick(ROADS.vertical);
    const sx = road + (rng.chance(0.5) ? 1 : -1) * 60;
    const sy = Math.max(80, Math.min(WATERLINE - 80, player.y + rng.float(-260, 260)));
    police.cruisers.push(spawnCruiser(sx, sy));
  }
  while (police.cruisers.length > wanted) police.cruisers.pop();

  for (const c of police.cruisers) {
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    const target = Math.atan2(dy, dx);
    let diff = target - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
    c.speed = Math.min(460, c.speed + 420 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // PIT at 4+ stars only, matching speed, alongside, 5 s cooldown.
    if (
      wanted >= 4 &&
      !player.onFoot &&
      Math.abs(player.speed - c.speed) < 120 &&
      dist < 90 &&
      now - c.lastPit >= 5
    ) {
      c.lastPit = now;
      const side = Math.sign(Math.sin(target - c.angle)) || 1;
      player.x += Math.cos(c.angle + (Math.PI / 2) * side) * 46;
      player.y += Math.sin(c.angle + (Math.PI / 2) * side) * 46;
      player.speed *= 0.45;
      player.spin = 0.9;
    }
  }

  // Roadblocks at 3+ stars: two cruiser barricades on roads ahead.
  if (wanted >= 3 && police.roadblocks.length === 0) {
    for (let i = 0; i < 2; i++) {
      const road = rng.pick(ROADS.vertical);
      police.roadblocks.push({
        x: road,
        y: Math.max(120, Math.min(WATERLINE - 120, player.y + (i === 0 ? -320 : 320))),
        angle: Math.PI / 2,
      });
    }
  }
  if (wanted < 3) police.roadblocks = [];

  // Heat decay: one star drops after 25 s with no cruiser within 450 px.
  if (wanted > 0) {
    const near = police.cruisers.some(
      (c) => Math.hypot(c.x - player.x, c.y - player.y) < 450,
    );
    if (!near) {
      if (!police.heatSince) police.heatSince = now;
      if (now - police.heatSince >= 25) {
        police.wanted = wanted - 1;
        police.heatSince = 0;
      }
    } else {
      police.heatSince = 0;
    }
  }
  return police;
}

export function setWanted(police, n) {
  police.wanted = Math.max(0, Math.min(5, n));
  police.heatSince = 0;
  return police.wanted;
}
