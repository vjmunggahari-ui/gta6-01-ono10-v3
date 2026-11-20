// Solmar Bay — player, traffic, pedestrians, police.
// Traffic swerves and honks when the player blocks the road. Police chase,
// PIT at 4+ stars only (one shove per cruiser per 5s), roadblocks at 3+.

import { WORLD, VERTICAL_ROADS, HORIZONTAL_ROADS } from './config.js';
import { buildingAt, inWater, isWalkable, onRoad } from './world.js';

const FOOT_SPEED = 230;
const CAR_TOP = 430;
const CAR_ACCEL = 320;
const PIT_RANGE = 70;
const PIT_COOLDOWN = 5;
const MAX_CRUISERS = 4;

const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#8e44ad', '#16a085', '#e67e22'];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------- Player ----------
export function makePlayer(x, y) {
  return { x, y, angle: 0, speed: 0, onFoot: true, car: null, cash: 0 };
}

export function movePlayer(player, input, dt, world) {
  const v = input.axis();
  if (player.onFoot) {
    const nx = player.x + v.x * FOOT_SPEED * dt;
    const ny = player.y + v.y * FOOT_SPEED * dt;
    if (isWalkable(world, nx, player.y)) player.x = nx;
    if (isWalkable(world, player.x, ny)) player.y = ny;
    if (v.x || v.y) player.angle = Math.atan2(v.y, v.x);
    player.speed = Math.hypot(v.x, v.y) * FOOT_SPEED;
    return;
  }
  // Driving: throttle along the car's heading, steering turns it.
  const car = player.car;
  car.speed = clamp(car.speed + v.y * CAR_ACCEL * dt, -120, CAR_TOP);
  car.speed *= Math.pow(0.4, dt); // rolling drag
  if (Math.abs(car.speed) > 8) car.angle += v.x * 2.1 * dt * Math.sign(car.speed);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const blocked = inWater(nx, ny) || buildingAt(world, nx, ny) !== null;
  if (!blocked) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed *= -0.25; // bounce off the obstacle
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
}

// Take the nearest stealable car (traffic or parked) within 80px.
export function stealCar(player, traffic, parkedCars) {
  if (!player.onFoot) return null;
  let best = null;
  let bestD = 80;
  for (const c of traffic) {
    if (c.taken) continue;
    const d = dist(player.x, player.y, c.x, c.y);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  for (const c of parkedCars) {
    if (c.taken) continue;
    const d = dist(player.x, player.y, c.x, c.y);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  if (!best) return null;
  best.taken = true;
  player.car = best;
  player.onFoot = false;
  player.x = best.x;
  player.y = best.y;
  player.angle = best.angle;
  player.speed = 0;
  return best;
}

// Step out: the car stays where it is and becomes stealable again.
export function exitCar(player) {
  if (player.onFoot || !player.car) return null;
  const car = player.car;
  car.speed = 0;
  car.taken = false;
  car.x = player.x + Math.cos(player.angle + Math.PI / 2) * 26;
  car.y = player.y + Math.sin(player.angle + Math.PI / 2) * 26;
  player.car = null;
  player.onFoot = true;
  player.speed = 0;
  return car;
}

// ---------- Traffic ----------
export function makeTraffic(world, rng) {
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const vertical = rng.next() < 0.5;
    const road = vertical
      ? VERTICAL_ROADS[Math.floor(rng.next() * VERTICAL_ROADS.length)]
      : HORIZONTAL_ROADS[Math.floor(rng.next() * HORIZONTAL_ROADS.length)];
    const along = rng.range(80, vertical ? WORLD.h - 80 : WORLD.w - 80);
    cars.push({
      x: vertical ? road : along,
      y: vertical ? along : road,
      angle: vertical ? (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : rng.next() < 0.5 ? 0 : Math.PI,
      speed: rng.range(90, 170),
      color: rng.pick(CAR_COLORS),
      honking: 0,
      swerve: 0,
      taken: false,
      vertical,
    });
  }
  return cars;
}

export function updateTraffic(cars, dt, world, player) {
  for (const c of cars) {
    if (c.taken) continue;
    // Swerve + honk when the player blocks the road ahead.
    const aheadX = c.x + Math.cos(c.angle) * 90;
    const aheadY = c.y + Math.sin(c.angle) * 90;
    const playerAhead = dist(aheadX, aheadY, player.x, player.y) < 70;
    if (playerAhead) {
      c.swerve = 1;
      c.honking = 1;
    } else {
      c.swerve = 0;
      c.honking = Math.max(0, c.honking - dt);
    }
    const side = Math.sin(c.angle) * (c.swerve ? 26 : 0);
    const sideX = -Math.sin(c.angle) * side;
    const sideY = Math.cos(c.angle) * side;
    const nx = c.x + Math.cos(c.angle) * c.speed * dt + sideX * dt * 2;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt + sideY * dt * 2;
    // Wrap around the city edges; stay out of the bay.
    if (nx < 40 || nx > WORLD.w - 40 || ny < 40 || ny > WORLD.h - 40 || inWater(nx, ny)) {
      c.angle += Math.PI;
      c.x = clamp(c.x, 60, WORLD.w - 60);
      c.y = clamp(c.y, 60, WORLD.h - 60);
    } else {
      c.x = nx;
      c.y = ny;
    }
  }
}

// ---------- Pedestrians ----------
export function makePedestrians(world, rng) {
  const peds = [];
  for (let i = 0; i < 24; i++) {
    const x = rng.range(120, WORLD.w - 120);
    const y = rng.range(120, 2000);
    if (!isWalkable(world, x, y)) continue;
    peds.push({
      x,
      y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(35, 70),
      tx: x,
      ty: y,
      color: rng.pick(['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#ecf0f1']),
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, world) {
  for (const p of peds) {
    if (dist(p.x, p.y, p.tx, p.ty) < 24) {
      // Pick a new nearby stroll target on walkable ground.
      for (let tries = 0; tries < 8; tries++) {
        const tx = p.x + (Math.random() - 0.5) * 600;
        const ty = p.y + (Math.random() - 0.5) * 600;
        if (isWalkable(world, tx, ty)) {
          p.tx = tx;
          p.ty = ty;
          break;
        }
      }
    }
    const a = Math.atan2(p.ty - p.y, p.tx - p.x);
    p.angle = a;
    const nx = p.x + Math.cos(a) * p.speed * dt;
    const ny = p.y + Math.sin(a) * p.speed * dt;
    if (isWalkable(world, nx, ny)) {
      p.x = nx;
      p.y = ny;
    }
  }
}

// ---------- Police ----------
export function makePolice() {
  return { wanted: 0, cruisers: [], roadblocks: [], pitCount: 0 };
}

export function setWanted(police, n) {
  police.wanted = clamp(Math.round(n), 0, 5);
  if (police.wanted < 3) police.roadblocks = [];
}

export function spawnCruiser(police, x, y) {
  const c = { x, y, angle: 0, speed: 0, lastPit: -PIT_COOLDOWN };
  police.cruisers.push(c);
  return c;
}

export function updatePolice(police, dt, player, world, time) {
  // Cruiser count follows the wanted level (cap 4).
  const want = Math.min(police.wanted, MAX_CRUISERS);
  while (police.cruisers.length < want) {
    const road = VERTICAL_ROADS[Math.floor(Math.random() * VERTICAL_ROADS.length)];
    spawnCruiser(police, clamp(player.x + (Math.random() < 0.5 ? -420 : 420), 80, WORLD.w - 80), road);
  }
  while (police.cruisers.length > want) police.cruisers.pop();

  // Roadblocks at 3+ stars, set across the nearest road ahead.
  if (police.wanted >= 3 && police.roadblocks.length < 2) {
    const ahead = { x: player.x + Math.cos(player.angle) * 320, y: player.y + Math.sin(player.angle) * 320 };
    const roadX = VERTICAL_ROADS.reduce((a, b) => (Math.abs(b - ahead.x) < Math.abs(a - ahead.x) ? b : a));
    police.roadblocks.push({ x: roadX, y: clamp(ahead.y, 120, 1980), angle: Math.PI / 2 });
    if (police.roadblocks.length === 1) {
      police.roadblocks.push({ x: roadX + 200, y: clamp(ahead.y + 260, 120, 1980), angle: Math.PI / 2 });
    }
  }

  for (const c of police.cruisers) {
    const d = dist(c.x, c.y, player.x, player.y);
    const target = Math.atan2(player.y - c.y, player.x - c.x);
    let diff = target - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    const top = player.onFoot ? 260 : 400;
    c.speed = clamp(c.speed + 260 * dt, 0, top);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;

    // PIT: 4+ stars only, alongside at matching speed, one shove per 5s.
    if (
      police.wanted >= 4 &&
      !player.onFoot &&
      d < PIT_RANGE &&
      Math.abs(c.speed - Math.abs(player.speed)) < 80 &&
      time - c.lastPit >= PIT_COOLDOWN
    ) {
      c.lastPit = time;
      police.pitCount += 1;
      const side = Math.PI / 2;
      player.car.x += Math.cos(player.angle + side) * 42;
      player.car.y += Math.sin(player.angle + side) * 42;
      player.car.angle += 0.6; // spin
      player.car.speed *= 0.6; // speed cut
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
      player.speed = player.car.speed;
    }
  }
}

// ---------- Drawing (world space; call after ctx.translate(-camera)) ----------
export function drawActors(ctx, world, player, traffic, peds, police) {
  // Roadblocks first (under everything).
  ctx.fillStyle = '#f5f6fa';
  for (const r of police.roadblocks) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = '#e84118';
    ctx.fillRect(-34, -8, 68, 16);
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(-34, -8, 12, 16);
    ctx.fillRect(-10, -8, 12, 16);
    ctx.fillRect(14, -8, 12, 16);
    ctx.restore();
  }

  for (const c of traffic) {
    if (c.taken) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = c.color;
    ctx.fillRect(-18, -9, 36, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-8, -9, 12, 18);
    ctx.restore();
    if (c.honking > 0) {
      ctx.fillStyle = '#fbc531';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('!', c.x + 22, c.y - 14);
    }
  }

  for (const p of peds) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const c of police.cruisers) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(-20, -10, 40, 20);
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(-6, -10, 12, 20);
    ctx.fillStyle = c.lastPit > 0 && 0 ? '#e84118' : '#0097e6';
    ctx.fillRect(12, -10, 8, 20);
    ctx.restore();
  }

  // Player: on foot a walker, in a car the car itself.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  if (player.onFoot) {
    ctx.fillStyle = '#e84118';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(6, -2, 8, 4);
  } else {
    ctx.fillStyle = '#e84118';
    ctx.fillRect(-18, -9, 36, 18);
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(-4, -9, 10, 18);
  }
  ctx.restore();
}
