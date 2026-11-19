// Solmar Bay (v5) — the people and the cars: player, traffic, pedestrians, police.
// One job: move everything, collide it, and price every crime in wanted stars.
//
// v5 vs v4: fixes the holes v4 drove through — reverse accel and max reverse
// now come from config, steal/punch wanted values exist, the punch sound
// exists, the carjack flee-ped uses the seeded game rng instead of
// Math.random, and wanted finally decays (v4 defined decayPerSec but never
// used it). New: a player factory, named helpers for damage and nearest-car
// lookup, per-star police tuning, lane-offset traffic, idle pedestrians,
// and a shared angle-difference helper.

import { CAR, ECONOMY, LANE_OFFSET, MAX_POLICE, PED, PED_COUNT, PLAYER, POLICE, ROADS_X, ROADS_Y, SKID_MAX, TRAFFIC, TRAFFIC_COUNT, WANTED, WORLD } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { clampToWorld, collideBuildings, isOnRoad, roadAngleAt, snapToRoad } from './world.js';

// Shortest signed turn from `from` to `to`, in (-PI, PI].
export function angleDiff(to, from) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    radius: PLAYER.radius,
    health: PLAYER.health,
    onFoot: true,
    car: null,
    moving: false,
    punchT: 0,
    cash: ECONOMY.startCash,
  };
}

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0,
    color, kind,
    health: CAR.health,
    maxSpeed: CAR.maxSpeed,
    radius: CAR.radius,
    driver: kind === 'traffic' ? 'ai' : null,
    wp: null,
    cruise: 170,
    wrecked: false,
    skid: false,
  };
}

export function makePed(x, y, rng) {
  return {
    x, y,
    radius: 10,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, PED.walkMin, PED.walkMax),
    state: 'walk',
    downT: 0,
    idleT: 0,
    color: pick(rng, ['#e8e6da', '#c96f4a', '#7d9bb5', '#d9a05b', '#8a8f98', '#5f8f6e']),
    tx: x,
    ty: y,
  };
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = snapToRoad(range(rng, 120, WORLD.w - 120), range(rng, 120, WORLD.h - 320));
    const car = makeCar(spot.x, spot.y, roadAngleAt(spot.x, spot.y), pick(rng, ['#c94f42', '#4a7fb5', '#e0c53f', '#8a8f98', '#5f9e6a', '#d97b2f', '#e8e6da']), 'traffic');
    car.cruise = range(rng, TRAFFIC.cruiseMin, TRAFFIC.cruiseMax);
    car.wp = nextWaypoint(world, rng, car);
    cars.push(car);
  }
  return cars;
}

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const spot = snapToRoad(range(rng, 120, WORLD.w - 120), range(rng, 120, WORLD.h - 320));
    const ped = makePed(spot.x + range(rng, -50, 50), spot.y + range(rng, -50, 50), rng);
    ped.tx = spot.x;
    ped.ty = spot.y;
    peds.push(ped);
  }
  return peds;
}

// Nearest road line ahead of `pos` along `dir`; falls back to a point 400
// ahead when no line lies in front (edge of the map).
function nearestCrossing(pos, dir, lines) {
  let best = null;
  let bestD = Infinity;
  for (const l of lines) {
    const d = (l - pos) * dir;
    if (d > 40 && d < bestD) { bestD = d; best = l; }
  }
  return best === null ? pos + dir * 400 : best;
}

// Next waypoint along the car's road; sometimes turns onto the crossing road
// at the next intersection instead of driving straight on.
function nextWaypoint(world, rng, car) {
  const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
  const dist = range(rng, TRAFFIC.waypointMin, TRAFFIC.waypointMax);
  if (rng() < TRAFFIC.turnChance) {
    if (vertical) {
      const dir = Math.sin(car.angle) >= 0 ? 1 : -1;
      const crossY = nearestCrossing(car.y, dir, ROADS_Y);
      const side = rng() < 0.5 ? 1 : -1;
      return { x: car.x + side * dist, y: crossY };
    }
    const dir = Math.cos(car.angle) >= 0 ? 1 : -1;
    const crossX = nearestCrossing(car.x, dir, ROADS_X);
    const side = rng() < 0.5 ? 1 : -1;
    return { x: crossX, y: car.y + side * dist };
  }
  if (vertical) {
    const dir = Math.sin(car.angle) >= 0 ? 1 : -1;
    return { x: car.x, y: car.y + dir * dist };
  }
  const dir = Math.cos(car.angle) >= 0 ? 1 : -1;
  return { x: car.x + dir * dist, y: car.y };
}

function turnToward(car, tx, ty, dt, rate) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  car.angle += Math.max(-rate * dt, Math.min(rate * dt, diff));
  return Math.abs(diff);
}

function driveCar(car, dt, throttle, steer) {
  if (car.wrecked) { car.speed *= 0.9; return; }
  if (throttle > 0) car.speed += CAR.accel * dt * throttle;
  else if (throttle < 0) car.speed += CAR.reverseAccel * dt * throttle;
  else car.speed *= Math.max(0, 1 - 1.6 * dt);
  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const grip = Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * CAR.turnRate * grip * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.skid = Math.abs(car.speed) > 260 && Math.abs(steer) > 0.6;
}

// Damage a car; returns true the moment it wrecks.
export function damageCar(car, amount) {
  if (car.wrecked) return false;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    return true;
  }
  return false;
}

// Nearest car to (x, y) within maxD, optionally filtered by kind.
// Returns null when nothing qualifies.
export function nearestCar(cars, x, y, maxD, kinds) {
  let best = null;
  let bestD = maxD;
  for (const car of cars) {
    if (kinds && !kinds.includes(car.kind)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

// The player on foot, and getting in and out of cars.
export function stepPlayer(game, dt, input) {
  const p = game.player;
  const sfx = game.sfx;
  if (p.punchT > 0) p.punchT -= dt;
  if (p.onFoot) {
    const axis = input.axis();
    const run = input.actionDown('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = axis.steer;
    const my = -axis.drive;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      p.x += (mx / len) * run * dt;
      p.y += (my / len) * run * dt;
      p.angle = Math.atan2(my, mx);
      p.moving = true;
    } else {
      p.moving = false;
    }
    clampToWorld(p, 20);
    collideBuildings(game.world, p);
    if (input.actionHit('action')) tryEnterCar(game);
    if (input.actionHit('punch') || input.mouse.clicked) punch(game);
  } else if (p.car) {
    const car = p.car;
    const axis = input.axis();
    const handbrake = input.actionDown('handbrake');
    driveCar(car, dt, axis.drive, axis.steer);
    if (handbrake) {
      car.speed *= Math.max(0, 1 - 4 * dt);
      car.angle += axis.steer * CAR.turnRate * 0.4 * dt * (car.speed >= 0 ? 1 : -1);
    }
    if (collideBuildings(game.world, car)) {
      if (Math.abs(car.speed) > CAR.crashDamageSpeed) {
        damageCar(car, CAR.crashDamage);
        sfx.thud();
        addWanted(game, WANTED.crashAdd, 'crash');
      }
      car.speed *= 0.45;
    }
    clampToWorld(car, 24);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (car.wrecked) {
      sfx.thud();
      game.message('Your ride is wrecked — get out and run!', '#ffb02e');
      exitCar(game);
    } else if (input.actionHit('action')) {
      exitCar(game);
    }
    if (car.skid) {
      game.skid.push({ x: car.x, y: car.y, angle: car.angle, t: 0.6 });
      sfx.skid();
    }
    sfx.engine(Math.min(1, Math.abs(car.speed) / CAR.maxSpeed));
  }
  if (game.skid.length > SKID_MAX) game.skid.splice(0, game.skid.length - SKID_MAX);
}

function tryEnterCar(game) {
  const p = game.player;
  const best = nearestCar(game.cars, p.x, p.y, PLAYER.enterRange, ['traffic', 'parked']);
  if (!best) return;
  if (best.kind === 'traffic' && best.driver === 'ai') {
    best.driver = null;
    // The driver bails and flees — drawn from the seeded stream, never Math.random.
    const ped = makePed(best.x + 30, best.y + 30, game.rng);
    ped.state = 'flee';
    game.peds.push(ped);
    addWanted(game, WANTED.stealAdd, 'car stolen');
    game.message('Car stolen — the crew saw that!', '#ff8a5c');
    game.sfx.thud();
  }
  best.kind = 'player';
  best.driver = 'player';
  p.car = best;
  p.onFoot = false;
  game.sfx.pickup();
}

function exitCar(game) {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.car = null;
  p.onFoot = true;
  game.sfx.stopEngine();
}

function punch(game) {
  const p = game.player;
  if (p.punchT > 0) return;
  p.punchT = PLAYER.punchCooldown;
  game.sfx.punch();
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > PLAYER.punchRange) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), p.angle)) > PLAYER.punchArc) continue;
    ped.state = 'down';
    ped.downT = PED.downTime;
    ped.x += (dx / (d || 1)) * 26;
    ped.y += (dy / (d || 1)) * 26;
    addWanted(game, WANTED.punchAdd, 'assault');
    game.message('You decked a pedestrian!', '#ff8a5c');
    break;
  }
}

// Traffic: follow the roads in the right-hand lane, slow for the car ahead.
export function stepTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.kind !== 'traffic' || car.driver !== 'ai') continue;
    if (!car.wp || Math.hypot(car.wp.x - car.x, car.wp.y - car.y) < 60) {
      car.wp = nextWaypoint(game.world, game.rng, car);
    }
    // Steer for the right-hand lane, not the centreline.
    const lx = -Math.sin(car.angle) * LANE_OFFSET;
    const ly = Math.cos(car.angle) * LANE_OFFSET;
    const diff = turnToward(car, car.wp.x + lx, car.wp.y + ly, dt, 2.2);
    let throttle = 0.55;
    for (const other of game.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      if (d < TRAFFIC.followGap && ahead > 0) { throttle = 0.1; break; }
    }
    if (diff > 1.2) throttle = 0.2;
    car.speed += (car.cruise * throttle - car.speed) * Math.min(1, 2.2 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (!isOnRoad(car.x, car.y)) {
      const spot = snapToRoad(car.x, car.y);
      car.x = spot.x;
      car.y = spot.y;
      car.angle = roadAngleAt(car.x, car.y);
    }
    clampToWorld(car, 24);
  }
  separateCars(game);
}

// Simple car-vs-car bumps, run once per frame for every pair.
export function separateCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 36 && d > 0.01) {
        const push = (36 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const hard = Math.abs(a.speed - b.speed) > 180;
        a.speed *= 0.7;
        b.speed *= 0.7;
        if (hard && (a.kind === 'player' || b.kind === 'player')) {
          const pc = a.kind === 'player' ? a : b;
          damageCar(pc, 6);
          game.sfx.thud();
        }
      }
    }
  }
}

// Pedestrians: stroll the sidewalks, pause to idle, flee from danger,
// get up after a punch.
export function stepPeds(game, dt) {
  const p = game.player;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) ped.state = 'flee';
      continue;
    }
    const distP = Math.hypot(ped.x - p.x, ped.y - p.y);
    const speedingCar = !p.onFoot && p.car && Math.abs(p.car.speed) > 220;
    const threat = distP < PED.panicRadius && speedingCar;
    const nearPunch = distP < PED.punchPanicRadius && p.punchT > 0.3;
    if (threat || nearPunch) ped.state = 'flee';
    else if (ped.state === 'flee' && distP > 420) ped.state = 'walk';
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * PED.fleeSpeed * dt;
      ped.y += Math.sin(away) * PED.fleeSpeed * dt;
    } else if (ped.state === 'idle') {
      ped.idleT -= dt;
      if (ped.idleT <= 0) ped.state = 'walk';
    } else {
      if (Math.hypot(ped.tx - ped.x, ped.ty - ped.y) < 24) {
        if (game.rng() < PED.idleChance) {
          ped.state = 'idle';
          ped.idleT = range(game.rng, 1, 3);
        } else {
          const spot = snapToRoad(ped.x + range(game.rng, -420, 420), ped.y + range(game.rng, -420, 420));
          ped.tx = spot.x + range(game.rng, -46, 46);
          ped.ty = spot.y + range(game.rng, -46, 46);
        }
      }
      const want = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      ped.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, angleDiff(want, ped.angle)));
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    collideBuildings(game.world, ped);
    clampToWorld(ped, 16);
    // A fast car that clips a pedestrian knocks them down: a crime.
    if (!p.onFoot && p.car && !p.car.wrecked) {
      const car = p.car;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26 && Math.abs(car.speed) > 60 && ped.state !== 'down') {
        ped.state = 'down';
        ped.downT = PED.hitDownTime;
        addWanted(game, WANTED.hitPedAdd, 'pedestrian hit');
        game.sfx.thud();
        game.message('You hit a pedestrian!', '#ff8a5c');
      }
    }
  }
  if (game.peds.length > PED_COUNT + 8) game.peds.splice(0, game.peds.length - (PED_COUNT + 8));
}

// Police: keep the cruisers coming while the heat is on, chase and ram.
// Cruiser count, speed and ram damage all scale with the wanted stars.
export function stepPolice(game, dt) {
  const p = game.player;
  const stars = Math.max(0, Math.min(WANTED.max, Math.floor(game.wanted)));
  const tune = WANTED.levels[stars] || { police: 0, speed: 0, ram: 0 };
  const want = stars >= 1 ? Math.min(MAX_POLICE, tune.police) : 0;
  let have = 0;
  for (const car of game.cars) if (car.kind === 'police') have += 1;
  if (have < want) {
    const angle = game.rng() * Math.PI * 2;
    const spot = snapToRoad(p.x + Math.cos(angle) * POLICE.spawnDistance, p.y + Math.sin(angle) * POLICE.spawnDistance);
    const cruiser = makeCar(spot.x, spot.y, 0, '#20242e', 'police');
    cruiser.maxSpeed = tune.speed;
    cruiser.cruise = tune.speed;
    game.cars.push(cruiser);
    game.message('Police on your tail!', '#ff5c5c');
  }
  if (have > want) {
    for (const car of game.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) > POLICE.despawnDistance) {
        game.cars.splice(game.cars.indexOf(car), 1);
        break;
      }
    }
  }
  const drop = [];
  for (const car of game.cars) {
    if (car.kind !== 'police') continue;
    const diff = turnToward(car, p.x, p.y, dt, POLICE.chaseTurn);
    const dist = Math.hypot(p.x - car.x, p.y - car.y);
    const throttle = dist > 90 ? 1 : 0.6;
    car.speed += (car.maxSpeed * throttle - car.speed) * Math.min(1, 2.6 * dt);
    if (diff > 1.4) car.speed *= 0.98;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (collideBuildings(game.world, car)) car.speed *= 0.5;
    clampToWorld(car, 24);
    // Ram the player: on foot it busts them, in a car it wrecks them.
    if (dist < POLICE.ramRange) {
      if (p.onFoot) {
        game.busted('The Solmar PD caught you on foot.');
      } else if (p.car && Math.abs(car.speed) > POLICE.ramSpeed) {
        damageCar(p.car, tune.ram * dt);
        car.speed *= 0.6;
        p.car.x += Math.cos(car.angle) * 6;
        p.car.y += Math.sin(car.angle) * 6;
        game.sfx.thud();
      }
    }
    // A cruiser that falls far behind gives up the chase.
    if (dist > POLICE.giveUpDistance && stars < 1) drop.push(car);
  }
  if (drop.length) game.cars = game.cars.filter((c) => !drop.includes(c));
  game.sfx.siren(game.wanted >= POLICE.sirenAtStars && game.cars.some((c) => c.kind === 'police'));
}

// Wanted decay: the heat only cools once the last crime is old and no
// cruiser is close enough to see you. v4 defined the rate but never ran it.
export function stepWanted(game, dt) {
  if (game.wanted <= 0) return;
  if (game.time - (game.lastCrimeT || 0) < WANTED.decayDelaySec) return;
  for (const car of game.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - game.player.x, car.y - game.player.y) < 500) return;
  }
  game.wanted = Math.max(0, game.wanted - WANTED.decayPerSec * dt);
  if (game.wanted < 0.01) game.wanted = 0;
}

export function addWanted(game, amount, reason) {
  game.wanted = Math.min(WANTED.max, game.wanted + amount);
  game.lastCrimeT = game.time;
  game.heat = 1;
  if (reason) game.lastCrime = reason;
}

export { PED_COUNT, TRAFFIC_COUNT };
