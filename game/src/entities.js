// Solmar Bay — player, traffic, pedestrians and police.
// Traffic swerves around the player and honks; pedestrians stroll the
// sidewalks; cruisers chase and, at 4+ stars only, PIT the player's car.
import { WORLD_W, WORLD_H, ROADS, WATERLINE } from './config.js';
import { onRoad, inWater, buildingAt } from './world.js';
import { makeRng } from './random.js';

export const PIT_COOLDOWN = 5; // seconds between shoves, per cruiser
export const PIT_MIN_SPEED = 150; // cruiser must roughly match the player's speed

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, speed: 0, onFoot: true, car: null,
    cash: 0, wanted: 0, spin: 0, honked: false,
  };
}

export function makeTraffic(world, rng) {
  const cars = [];
  const palette = ['#c0392b', '#2e86c1', '#f1c40f', '#ecf0f1', '#7d3c98', '#16a085'];
  for (let i = 0; i < 14; i++) {
    const vertical = rng.chance(0.5);
    const lane = vertical
      ? ROADS.vertical[rng.int(0, ROADS.vertical.length - 1)]
      : ROADS.horizontal[rng.int(0, ROADS.horizontal.length - 1)];
    const along = vertical ? rng.float(0, WORLD_H) : rng.float(0, WORLD_W);
    cars.push({
      x: vertical ? lane + rng.pick([-22, 22]) : along,
      y: vertical ? along : lane + rng.pick([-22, 22]),
      angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.float(55, 110),
      color: rng.pick(palette),
      honk: 0, swerve: 0,
    });
  }
  return cars;
}

export function makePedestrians(world, rng) {
  const folks = [];
  for (let i = 0; i < 24; i++) {
    const x = rng.float(60, WORLD_W - 60);
    const y = rng.float(60, WATERLINE - 80);
    if (buildingAt(world, x, y) || inWater(x, y)) { i--; continue; }
    folks.push({
      x, y, angle: rng.float(0, Math.PI * 2), speed: rng.float(18, 42),
      hue: rng.int(0, 360), walk: rng.float(0, 10),
    });
  }
  return folks;
}

export function makePolice() {
  return { cruisers: [], roadblocks: [], lastSpawn: 0 };
}

// Steal a parked car: nearest car within maxD (tries 70, then 120 on a
// second press). Returns the car or null. Stealing raises heat to 2 stars.
export function stealCar(player, cars, maxD = 70) {
  let best = null;
  let bestD = Infinity;
  for (const car of cars) {
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d <= maxD && d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function spawnCruiser(cruisers, x, y, rng) {
  cruisers.push({
    x, y, angle: 0, speed: 0, pitT: 0,
    color: '#1b2631', light: rng.chance(0.5) ? 0 : 1,
  });
}

// Police update. Signature: (world, cruisers, player, dt, now, rng) —
// world first. `player` carries wanted + position + speed + onFoot.
// PIT fires ONLY at 4+ stars, only against a car, only alongside at
// matching speed, one shove per cruiser per 5s.
export function updatePolice(world, cruisers, player, dt, now, rng) {
  const want = player.wanted;
  const target = want === 0 ? 0 : want <= 2 ? 1 : want <= 3 ? 2 : 3;
  // Spawn cruisers near the player until the wanted level is matched.
  while (cruisers.length < target) {
    const a = rng.float(0, Math.PI * 2);
    const d = rng.float(420, 620);
    const x = clamp(player.x + Math.cos(a) * d, 40, WORLD_W - 40);
    const y = clamp(player.y + Math.sin(a) * d, 40, WORLD_H - 40);
    spawnCruiser(cruisers, x, y, rng);
  }
  while (cruisers.length > target) cruisers.pop();
  for (const c of cruisers) {
    c.pitT = Math.max(0, c.pitT - dt);
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let da = wantAngle - c.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    c.angle += clamp(da, -2.4 * dt, 2.4 * dt);
    const cruise = 190 + want * 28;
    c.speed += clamp(cruise - c.speed, -260 * dt, 200 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(c.x, 20, WORLD_W - 20);
    c.y = clamp(c.y, 20, WORLD_H - 20);
    // PIT: alongside (close), speeds roughly matched, 4+ stars, player in
    // a car, cooldown elapsed. Shove sideways + spin + speed cut.
    if (
      want >= 4 && !player.onFoot && c.pitT <= 0 &&
      d < 95 && Math.abs(c.speed - Math.abs(player.speed)) < 60
    ) {
      const side = Math.sign(Math.sin(c.angle - player.angle)) || 1;
      player.x += Math.cos(player.angle + Math.PI / 2) * side * 46;
      player.y += Math.sin(player.angle + Math.PI / 2) * side * 46;
      player.spin = 2.6 * side;
      player.speed *= 0.45;
      c.pitT = PIT_COOLDOWN;
    }
  }
  return cruisers;
}

// Roadblocks: two blocks on the roads ahead of the player, active at 3+
// stars, cleared when heat drops. Returns the block list.
export function updateRoadblocks(police, player, rng) {
  if (player.wanted >= 3) {
    if (police.roadblocks.length === 0) {
      const a = player.angle || 0;
      for (const off of [260, 520]) {
        police.roadblocks.push({
          x: clamp(player.x + Math.cos(a) * off, 60, WORLD_W - 60),
          y: clamp(player.y + Math.sin(a) * off, 60, WORLD_H - 60),
          angle: a + Math.PI / 2,
        });
      }
    }
  } else {
    police.roadblocks.length = 0;
  }
  return police.roadblocks;
}

// One traffic tick: cruise along the lane, swerve + honk when the player
// is close ahead, stay inside the city.
export function updateTraffic(cars, player, dt) {
  for (const car of cars) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const d = Math.hypot(dx, dy);
    const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
    if (d < 130 && ahead > 0) {
      car.swerve = clamp(car.swerve + dt * 3, 0, 1);
      if (d < 80 && car.honk <= 0) { car.honk = 0.9; player.honked = true; }
    } else {
      car.swerve = Math.max(0, car.swerve - dt * 2);
    }
    car.honk = Math.max(0, car.honk - dt);
    const lateral = car.swerve * 26;
    car.x += Math.cos(car.angle) * car.speed * dt - Math.sin(car.angle) * lateral * dt;
    car.y += Math.sin(car.angle) * car.speed * dt + Math.cos(car.angle) * lateral * dt;
    if (car.x < 20 || car.x > WORLD_W - 20 || car.y < 20 || car.y > WORLD_H - 20) {
      car.angle += Math.PI;
      car.x = clamp(car.x, 30, WORLD_W - 30);
      car.y = clamp(car.y, 30, WORLD_H - 30);
    }
  }
}

export function updatePedestrians(folks, world, dt, rng) {
  for (const p of folks) {
    p.walk += dt;
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (buildingAt(world, nx, ny) || inWater(nx, ny) || nx < 30 || nx > WORLD_W - 30 || ny < 30 || ny > WATERLINE - 30) {
      p.angle = rng.float(0, Math.PI * 2);
    } else {
      p.x = nx;
      p.y = ny;
    }
  }
}
