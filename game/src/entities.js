// Solmar Bay (v6, Session B3) — everyone who moves, and the price of crime.
//
// This module owns the living city: the player on foot and behind the
// wheel, the traffic that shares the roads, the pedestrians on the
// sidewalks, the police who answer wanted stars, and the wanted level
// itself. It reads the constants from config.js and the geometry helpers
// from world.js, and it never touches the DOM or the canvas — the game
// object is the one piece of state every step function shares.
//
// v6 (B3) keeps the whole v5/v6 contract — same factories, same step
// functions, same fields the renderer reads — and deepens the chase:
// at four stars and up, a cruiser that pulls alongside Jax's car tries
// a PIT move, shoving the car sideways and cutting its speed, so the
// top of the wanted scale feels different from the bottom instead of
// just faster.

// Shortest signed turn from `from` to `to`, in (-PI, PI].
export function angleDiff(to, from) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clampNum(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

import {
  CAR, ECONOMY, PED, PED_COUNT, PLAYER, POLICE,
  ROADS_X, ROADS_Y, SKID_MAX, TRAFFIC, TRAFFIC_COUNT, WANTED, WORLD,
} from './config.js';
import { pick, range } from './random.js';
import {
  clampToWorld, collideBuildings, isInSea, isOnRoad, pointInBuilding,
  randomRoadPoint, roadAngleAt, snapToRoad,
} from './world.js';

// --- factories --------------------------------------------------------------
// The renderer reads exactly these fields: cars carry x/y/angle/speed/
// color/kind/wrecked, peds carry x/y/angle/color/state, the player
// carries x/y/angle/onFoot/car/health/cash/moving/punchT. Fields added
// here are additive — nothing the renderer reads is renamed or dropped.

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
    // Roadblock duty (police only): a point the cruiser drives to and
    // parks across the road at, or null while it is chasing instead.
    block: null,
    // Horn cooldown for traffic Jax crowds from behind.
    hornT: 0,
    // PIT cooldown (police only): seconds until this cruiser may try
    // another PIT shove on the player's car.
    pitT: 0,
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

const PAINT_JOBS = ['#c94f42', '#4a7fb5', '#e0c53f', '#8a8f98', '#5f9e6a', '#d97b2f', '#e8e6da'];

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = snapToRoad(range(rng, 120, WORLD.w - 120), range(rng, 120, WORLD.h - 320));
    const car = makeCar(spot.x, spot.y, roadAngleAt(spot.x, spot.y), pick(rng, PAINT_JOBS), 'traffic');
    car.cruise = range(rng, TRAFFIC.cruiseMin, TRAFFIC.cruiseMax);
    car.wp = pickWaypoint(world, rng, car);
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

// --- driving helpers --------------------------------------------------------

// Nearest road line ahead of `pos` along `dir`; null when no line lies
// in front (the map's edge), in which case the caller picks a point
// 400 ahead instead.
function crossingAhead(pos, dir, lines) {
  let best = null;
  let bestD = Infinity;
  for (const line of lines) {
    const along = dir.x === 0 ? (line - pos.y) / dir.y : (line - pos.x) / dir.x;
    if (along < 60 || along > bestD) continue;
    bestD = along;
    best = line;
  }
  return best === null ? null : { d: bestD, line: best };
}

function pickWaypoint(world, rng, car) {
  // Pick a road point some distance away, biased to keep going the same
  // way: a car that turns at every crossing looks lost, one that never
  // turns looks like a train.
  const ahead = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const crossX = crossingAhead({ x: car.x, y: car.y }, ahead, ROADS_X);
  const crossY = crossingAhead({ x: car.x, y: car.y }, ahead, ROADS_Y);
  const options = [];
  if (crossX) options.push({ x: crossX.line, y: car.y + ahead.y * crossX.d });
  if (crossY) options.push({ x: car.x + ahead.x * crossY.d, y: crossY.line });
  if (options.length && rng() > TRAFFIC.turnChance) {
    return pick(rng, options);
  }
  const p = randomRoadPoint(rng);
  return { x: p.x, y: p.y };
}

function steerToward(car, tx, ty, dt, rate) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  const turn = clampNum(diff, -rate * dt, rate * dt);
  car.angle += turn;
  return Math.abs(diff);
}

// Arcade drive model: throttle builds speed, steering bites harder the
// faster you go, the handbrake kills grip and leaves skid marks.
function drive(car, dt, throttle, steer) {
  const top = car.maxSpeed;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) car.speed += (car.speed > 0 ? -CAR.brake : -CAR.reverseAccel) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  car.speed = clampNum(car.speed, -CAR.maxReverse, top);
  const grip = car.skid ? 0.45 : 1;
  car.angle += steer * CAR.turnRate * grip * dt * clampNum(Math.abs(car.speed) / 220, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

export function damageCar(car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
  }
}

export function nearestCar(cars, x, y, maxD, kinds) {
  let best = null;
  let bestD = maxD;
  for (const car of cars) {
    if (kinds && !kinds.includes(car.kind)) continue;
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function leaveSkid(game, x, y, angle) {
  game.skid.push({ x, y, angle, t: 4 });
  if (game.skid.length > SKID_MAX) game.skid.splice(0, game.skid.length - SKID_MAX);
}

function burst(game, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    game.particles.push({
      x: x + (game.rng() - 0.5) * 20,
      y: y + (game.rng() - 0.5) * 20,
      vx: (game.rng() - 0.5) * 60,
      vy: (game.rng() - 0.5) * 60 - 20,
      t: 0.5 + game.rng() * 0.4,
      color,
    });
  }
}

// --- the player -------------------------------------------------------------

export function stepPlayer(game, dt, input) {
  const p = game.player;
  if (p.punchT > 0) p.punchT -= dt;
  const axis = input.axis();
  if (p.onFoot) {
    const run = input.actionDown('run');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = axis.steer;
    const my = -axis.drive;
    const len = Math.hypot(mx, my);
    p.moving = len > 0.05;
    if (p.moving) {
      const nx = mx / (len || 1);
      const ny = my / (len || 1);
      p.angle = Math.atan2(ny, nx);
      p.x += nx * speed * dt;
      p.y += ny * speed * dt;
      collideBuildings(game.world, p);
      clampToWorld(p, 20);
    }
    if (input.actionHit('punch')) throwPunch(game);
    if (input.actionHit('action')) stealCar(game);
  } else if (p.car) {
    const car = p.car;
    const handbrake = input.actionDown('handbrake');
    car.skid = handbrake && Math.abs(car.speed) > 120;
    drive(car, dt, axis.drive, axis.steer);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.moving = Math.abs(car.speed) > 5;
    game.sfx.engine(Math.min(1, Math.abs(car.speed) / CAR.maxSpeed));
    if (car.skid) {
      leaveSkid(game, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
      if (game.rng() < 0.3) game.sfx.skid();
    }
    const hitWall = collideBuildings(game.world, car);
    if (hitWall) {
      if (Math.abs(car.speed) > CAR.crashDamageSpeed) {
        damageCar(car, CAR.crashDamage);
        addWanted(game, WANTED.crashAdd, 'Crash');
        burst(game, car.x, car.y, '#c9c4b2', 6);
      }
      game.sfx.thud();
      car.speed *= -0.25;
    }
    clampToWorld(car, 30);
    p.x = car.x;
    p.y = car.y;
    if (isInSea(car.x, car.y)) {
      game.sfx.splash();
      car.speed *= 0.5;
      damageCar(car, 4 * dt);
    }
    // Running a pedestrian over is a crime the whole street sees.
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.radius + 6 && Math.abs(car.speed) > 60) {
        ped.state = 'down';
        ped.downT = PED.hitDownTime;
        addWanted(game, WANTED.hitPedAdd, 'Hit and run');
        game.sfx.thud();
        burst(game, ped.x, ped.y, '#ff8a5c', 5);
      }
    }
    if (car.wrecked) {
      game.sfx.stopEngine();
      game.message('Your ride is wrecked.', '#ff5c5c');
      leaveCar(game);
    }
    if (input.actionHit('action')) leaveCar(game);
  }
}

function stealCar(game) {
  const p = game.player;
  const car = nearestCar(game.cars, p.x, p.y, PLAYER.enterRange, ['traffic', 'police']);
  if (!car) return;
  p.onFoot = false;
  p.car = car;
  car.driver = 'player';
  car.wp = null;
  game.sfx.pickup();
  if (car.kind === 'traffic') {
    addWanted(game, WANTED.stealAdd, 'Grand theft auto');
    game.message('Grand theft auto — the PD has been called.', '#ff8a5c');
  } else {
    addWanted(game, WANTED.stealAdd, 'Stolen cruiser');
    game.message('You stole a police cruiser. Bold. Stupid, but bold.', '#ff8a5c');
  }
}

function leaveCar(game) {
  const p = game.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = null;
  car.speed *= 0.3;
  p.y = car.y + 34;
  p.angle = car.angle;
  p.onFoot = true;
  p.car = null;
  game.sfx.stopEngine();
  collideBuildings(game.world, p);
  clampToWorld(p, 20);
}

function throwPunch(game) {
  const p = game.player;
  if (p.punchT > 0) return;
  p.punchT = PLAYER.punchCooldown;
  game.sfx.punch();
  let hit = false;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d > PLAYER.punchRange) continue;
    const want = Math.atan2(ped.y - p.y, ped.x - p.x);
    if (Math.abs(angleDiff(want, p.angle)) > PLAYER.punchArc) continue;
    ped.state = 'down';
    ped.downT = PED.downTime;
    hit = true;
  }
  if (hit) {
    addWanted(game, WANTED.punchAdd, 'Assault');
    game.message('You laid someone out. The street saw it.', '#ff8a5c');
  }
}

// --- traffic ----------------------------------------------------------------

export function stepTraffic(game, dt) {
  const p = game.player;
  for (const car of game.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    if (car.hornT > 0) car.hornT -= dt;
    if (!car.wp || Math.hypot(car.wp.x - car.x, car.wp.y - car.y) < 46) {
      car.wp = pickWaypoint(game.world, game.rng, car);
    }
    // Brake for the car ahead so traffic queues instead of piling up.
    let throttle = 0.7;
    let ahead = null;
    let aheadD = Infinity;
    for (const other of game.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < TRAFFIC.followGap + 40 && side < 30 && along < aheadD) {
        ahead = other;
        aheadD = along;
      }
    }
    if (ahead) {
      throttle = aheadD < TRAFFIC.followGap ? -0.6 : 0.25;
      if (aheadD < 44 && car.hornT <= 0 && game.rng() < 0.02) {
        game.sfx.horn();
        car.hornT = 4;
      }
    }
    // Swerve: when Jax comes up fast behind in a car, traffic pulls to
    // the side and honks — the street reacts to the player, not just to
    // its own waypoints.
    let steerBias = 0;
    if (!p.onFoot && p.car && p.car !== car) {
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const behind = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
      const side = -dx * Math.sin(p.angle) + dy * Math.cos(p.angle);
      if (behind > 0 && behind < 170 && Math.abs(side) < 46 && Math.abs(p.car.speed) > 260) {
        steerBias = side > 0 ? 0.55 : -0.55;
        if (car.hornT <= 0) {
          game.sfx.horn();
          car.hornT = 5;
        }
      }
    }
    steerToward(car, car.wp.x, car.wp.y, dt, 2.1);
    car.angle += steerBias * dt * 1.4;
    const target = Math.min(car.cruise, car.maxSpeed);
    car.speed += (target * throttle - car.speed) * Math.min(1, 1.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(game.world, car);
    clampToWorld(car, 30);
  }
  separateCars(game);
}

export function separateCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius - 6;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        if (Math.abs(a.speed) + Math.abs(b.speed) > 240) {
          game.sfx.thud();
          if (a.kind === 'player' || b.kind === 'player') {
            const pc = a.kind === 'player' ? a : b;
            damageCar(pc, CAR.crashDamage * 0.5);
          }
        }
      }
    }
  }
}

// --- pedestrians ------------------------------------------------------------

export function stepPeds(game, dt) {
  const p = game.player;
  const threat = !p.onFoot && p.car ? { x: p.x, y: p.y, speed: Math.abs(p.car.speed) } : null;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        ped.state = 'walk';
        ped.tx = ped.x + (game.rng() - 0.5) * 200;
        ped.ty = ped.y + (game.rng() - 0.5) * 200;
      }
      continue;
    }
    // Flee: a speeding car nearby, or Jax throwing punches next to you.
    let flee = false;
    if (threat && Math.hypot(ped.x - threat.x, ped.y - threat.y) < PED.panicRadius && threat.speed > 120) flee = true;
    if (p.onFoot && p.punchT > 0.2 && Math.hypot(ped.x - p.x, ped.y - p.y) < PED.punchPanicRadius) flee = true;
    if (flee && ped.state !== 'flee') ped.state = 'flee';
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * PED.fleeSpeed * dt;
      ped.y += Math.sin(away) * PED.fleeSpeed * dt;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) > PED.panicRadius * 2.2) ped.state = 'walk';
      collideBuildings(game.world, ped);
      clampToWorld(ped, 16);
      continue;
    }
    if (ped.state === 'idle') {
      ped.idleT -= dt;
      if (ped.idleT <= 0) ped.state = 'walk';
      continue;
    }
    // Walk: drift toward the target, pick a new one on arrival, sometimes
    // just stand and watch the city for a while.
    const d = Math.hypot(ped.tx - ped.x, ped.ty - ped.y);
    if (d < 24) {
      if (game.rng() < PED.idleChance) {
        ped.state = 'idle';
        ped.idleT = 1 + game.rng() * 3;
      } else {
        const spot = snapToRoad(ped.x + (game.rng() - 0.5) * 500, ped.y + (game.rng() - 0.5) * 500);
        ped.tx = spot.x;
        ped.ty = spot.y;
      }
      continue;
    }
    ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    collideBuildings(game.world, ped);
    clampToWorld(ped, 16);
  }
}

// --- police -----------------------------------------------------------------

export function stepPolice(game, dt) {
  const p = game.player;
  const stars = Math.floor(game.wanted);
  const level = stars >= 1 && stars <= 5 ? WANTED.levels[stars] : null;
  const wantCount = level ? level.police : 0;
  const cruisers = game.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  // Spawn: keep the cruisers coming while the heat is on.
  if (cruisers.length < wantCount && game.wanted > 0) {
    const spot = randomRoadPoint(game.rng);
    const d = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (d > POLICE.spawnDistance * 0.6) {
      const cruiser = makeCar(spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), '#20242e', 'police');
      cruiser.maxSpeed = level.speed;
      cruiser.cruise = level.speed;
      game.cars.push(cruiser);
    }
  }
  // Despawn: cruisers that lost the trail drift away and give up.
  for (const cruiser of [...cruisers]) {
    const d = Math.hypot(cruiser.x - p.x, cruiser.y - p.y);
    if (d > POLICE.giveUpDistance || game.wanted <= 0) {
      const idx = game.cars.indexOf(cruiser);
      if (idx >= 0) game.cars.splice(idx, 1);
    }
  }
  // Roadblocks: at three stars the PD stops chasing only and starts
  // cutting Jax off — up to two cruisers park across the road ahead of
  // him, sideways, forcing him to swerve or smash through.
  const blockers = game.cars.filter((c) => c.kind === 'police' && c.block);
  if (stars >= 3 && blockers.length < 2) {
    const free = game.cars.filter((c) => c.kind === 'police' && !c.wrecked && !c.block);
    for (const cruiser of free.slice(0, 2 - blockers.length)) {
      const ahead = 420;
      const hx = Math.cos(p.angle);
      const hy = Math.sin(p.angle);
      const tx = p.x + hx * ahead;
      const ty = p.y + hy * ahead;
      if (!isOnRoad(tx, ty) || pointInBuilding(game.world, tx, ty)) continue;
      const spot = snapToRoad(tx, ty);
      cruiser.block = { x: spot.x, y: spot.y };
    }
  }
  if (stars < 3) {
    for (const c of game.cars) if (c.kind === 'police') c.block = null;
  }
  // Chase and ram — or hold the blockade.
  for (const cruiser of game.cars.filter((c) => c.kind === 'police' && !c.wrecked)) {
    if (cruiser.block) {
      const bd = Math.hypot(cruiser.block.x - cruiser.x, cruiser.block.y - cruiser.y);
      if (bd < 60) {
        cruiser.speed = 0;
        cruiser.angle = roadAngleAt(cruiser.block.x, cruiser.block.y) + Math.PI / 2;
        continue;
      }
      steerToward(cruiser, cruiser.block.x, cruiser.block.y, dt, POLICE.chaseTurn);
      cruiser.speed = Math.min(cruiser.maxSpeed, cruiser.speed + 420 * dt);
      cruiser.x += Math.cos(cruiser.angle) * cruiser.speed * dt;
      cruiser.y += Math.sin(cruiser.angle) * cruiser.speed * dt;
      collideBuildings(game.world, cruiser);
      continue;
    }
    const d = Math.hypot(p.x - cruiser.x, p.y - cruiser.y);
    steerToward(cruiser, p.x, p.y, dt, POLICE.chaseTurn);
    const top = level ? level.speed : 470;
    cruiser.speed = Math.min(top, cruiser.speed + 430 * dt);
    cruiser.x += Math.cos(cruiser.angle) * cruiser.speed * dt;
    cruiser.y += Math.sin(cruiser.angle) * cruiser.speed * dt;
    collideBuildings(game.world, cruiser);
    clampToWorld(cruiser, 30);
    // PIT: at four stars and up, a cruiser that pulls alongside Jax's
    // car at matching speed taps its rear quarter — a sideways shove
    // that spins the car and bleeds its speed. One shove per cruiser
    // every five seconds, so the chase stays a chase, not a spin cycle.
    if (stars >= 4 && !p.onFoot && p.car && d < 120) {
      cruiser.pitT -= dt;
      if (cruiser.pitT <= 0 && Math.abs(cruiser.speed - p.car.speed) < 160) {
        const px = -Math.sin(p.car.angle);
        const py = Math.cos(p.car.angle);
        const side = Math.sign((p.car.x - cruiser.x) * px + (p.car.y - cruiser.y) * py) || 1;
        p.car.x += px * side * 26;
        p.car.y += py * side * 26;
        p.car.angle += side * 0.22;
        p.car.speed *= 0.82;
        cruiser.pitT = 5;
        game.sfx.thud();
        game.message('The PD is PIT-ing your ride — hold it straight!', '#ff8a5c');
      }
    }
    if (d < POLICE.ramRange + 10) {
      if (!p.onFoot && p.car) {
        damageCar(p.car, (level ? level.ram : 10) * dt * 2);
        p.car.speed *= 0.96;
        if (game.rng() < 0.1) game.sfx.thud();
        if (p.car.wrecked) {
          game.busted('Your ride is wrecked — the PD boxed you in.');
          return;
        }
      } else {
        game.busted('The Solmar PD caught you on foot.');
        return;
      }
    }
  }
  game.sfx.siren(game.wanted >= POLICE.sirenAtStars && game.cars.some((c) => c.kind === 'police'));
}

// --- wanted -----------------------------------------------------------------

export function stepWanted(game, dt) {
  if (game.wanted <= 0) {
    game.heat = 0;
    return;
  }
  game.heat = 1;
  // The heat only cools once the last crime is old and no cruiser is
  // close enough to keep the chase alive.
  const recent = game.time - game.lastCrimeT < WANTED.decayDelaySec;
  const chased = game.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - game.player.x, c.y - game.player.y) < 420);
  if (!recent && !chased) {
    game.wanted = Math.max(0, game.wanted - WANTED.decayPerSec * dt);
    if (game.wanted <= 0) game.heat = 0;
  }
}

export function addWanted(game, amount, reason) {
  if (amount <= 0) return;
  const before = Math.floor(game.wanted);
  game.wanted = Math.min(WANTED.max, game.wanted + amount);
  game.lastCrime = reason;
  game.lastCrimeT = game.time;
  game.heat = 1;
  const after = Math.floor(game.wanted);
  if (after > before) {
    game.message(`Wanted: ${'★'.repeat(after)}${'☆'.repeat(WANTED.max - after)} — ${reason}`, '#ff8a5c');
  }
}

export { PED_COUNT, TRAFFIC_COUNT };
