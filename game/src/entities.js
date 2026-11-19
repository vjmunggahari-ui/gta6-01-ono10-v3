// Solmar Bay — the people and the cars: player, traffic, pedestrians, police.
// One job: move everything, collide it, and price every crime in wanted stars.

import { CAR, MAX_POLICE, PED_COUNT, PLAYER, TRAFFIC_COUNT, WANTED, WORLD } from './config.js';
import { mulberry32, rpick, rrange } from './random.js';
import { collideBuildings, clampToWorld, isOnRoad, roadAngleAt, snapToRoad } from './world.js';

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
    brake: false,
    wrecked: false,
  };
}

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rrange(rng, 0, Math.PI * 2),
    speed: rrange(rng, 45, 75),
    state: 'walk',
    downT: 0,
    color: rpick(rng, ['#e8e6da', '#c96f4a', '#7d9bb5', '#d9a05b', '#8a8f98', '#5f8f6e']),
    tx: x,
    ty: y,
  };
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = snapToRoad(rrange(rng, 120, WORLD.w - 120), rrange(rng, 120, WORLD.h - 320));
    const car = makeCar(spot.x, spot.y, roadAngleAt(spot.x, spot.y), rpick(rng, ['#c94f42', '#4a7fb5', '#e0c53f', '#8a8f98', '#5f9e6a', '#d97b2f', '#e8e6da']), 'traffic');
    car.cruise = rrange(rng, 150, 230);
    car.wp = nextWaypoint(world, rng, car);
    cars.push(car);
  }
  return cars;
}

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const spot = snapToRoad(rrange(rng, 120, WORLD.w - 120), rrange(rng, 120, WORLD.h - 320));
    const ped = makePed(spot.x + rrange(rng, -50, 50), spot.y + rrange(rng, -50, 50), rng);
    ped.tx = spot.x;
    ped.ty = spot.y;
    peds.push(ped);
  }
  return peds;
}

function nextWaypoint(world, rng, car) {
  const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
  if (vertical) {
    const dir = Math.sin(car.angle) >= 0 ? 1 : -1;
    return { x: car.x, y: car.y + dir * rrange(rng, 350, 900) };
  }
  const dir = Math.cos(car.angle) >= 0 ? 1 : -1;
  return { x: car.x + dir * rrange(rng, 350, 900), y: car.y };
}

function turnToward(car, tx, ty, dt, rate) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-rate * dt, Math.min(rate * dt, diff));
  return Math.abs(diff);
}

function driveCar(car, dt, throttle, steer) {
  if (car.wrecked) { car.speed *= 0.9; return; }
  const target = throttle * car.maxSpeed;
  if (throttle > 0) car.speed += CAR.accel * dt * throttle;
  else if (throttle < 0) car.speed += CAR.reverseAccel * dt * throttle;
  else car.speed *= Math.max(0, 1 - 1.6 * dt);
  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const grip = Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * CAR.turnRate * grip * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (Math.abs(car.speed) > 260 && Math.abs(steer) > 0.6) {
    car.skid = true;
  }
}

// The player on foot, and getting in and out of cars.
export function stepPlayer(game, dt, input) {
  const p = game.player;
  const sfx = game.sfx;
  if (p.punchT > 0) p.punchT -= dt;
  if (p.onFoot) {
    const axis = input.axis();
    const run = input.down('Shift') ? PLAYER.runSpeed : PLAYER.walkSpeed;
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
    if (input.hit('e', 'E')) tryEnterCar(game);
    if (input.hit('f', 'F') || input.mouse.clicked) punch(game);
  } else if (p.car) {
    const car = p.car;
    const axis = input.axis();
    const handbrake = input.down(' ');
    driveCar(car, dt, axis.drive, axis.steer);
    if (handbrake) {
      car.speed *= Math.max(0, 1 - 4 * dt);
      car.angle += axis.steer * CAR.turnRate * 0.4 * dt * (car.speed >= 0 ? 1 : -1);
    }
    if (collideBuildings(game.world, car)) {
      if (Math.abs(car.speed) > 200) { car.health -= 12; sfx.thud(); addWanted(game, 0.2, 'crash'); }
      car.speed *= 0.45;
    }
    clampToWorld(car, 24);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      sfx.thud();
      game.message('Your ride is wrecked — get out and run!', '#ffb02e');
      exitCar(game);
    } else if (input.hit('e', 'E')) {
      exitCar(game);
    }
    if (Math.abs(car.speed) > 300 && car.skid) {
      game.skid.push({ x: car.x, y: car.y, angle: car.angle, t: 0.6 });
      car.skid = false;
    }
    sfx.engine(Math.min(1, Math.abs(car.speed) / CAR.maxSpeed));
  }
  if (game.skid.length > 220) game.skid.splice(0, game.skid.length - 220);
}

function tryEnterCar(game) {
  const p = game.player;
  let best = null;
  let bestD = 48;
  for (const car of game.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  if (best.kind === 'traffic' && best.driver === 'ai') {
    best.driver = null;
    const rng = mulberry32((Math.random() * 1e9) | 0);
    const ped = makePed(best.x + 30, best.y + 30, rng);
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
    let diff = Math.atan2(dy, dx) - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PLAYER.punchArc) continue;
    ped.state = 'down';
    ped.downT = 2.5;
    ped.x += (dx / (d || 1)) * 26;
    ped.y += (dy / (d || 1)) * 26;
    addWanted(game, WANTED.punchAdd, 'assault');
    game.message('You decked a pedestrian!', '#ff8a5c');
    break;
  }
}

// Traffic: follow the roads, slow for the car ahead.
export function stepTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.kind !== 'traffic' || car.driver !== 'ai') continue;
    if (!car.wp || Math.hypot(car.wp.x - car.x, car.wp.y - car.y) < 60) {
      car.wp = nextWaypoint(game.world, game.rng, car);
    }
    const diff = turnToward(car, car.wp.x, car.wp.y, dt, 2.2);
    let throttle = 0.55;
    for (const other of game.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      if (d < 70 && ahead > 0) { throttle = 0.1; break; }
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
  // Simple car-vs-car bumps.
  for (let i = 0; i < game.cars.length; i += 1) {
    for (let j = i + 1; j < game.cars.length; j += 1) {
      const a = game.cars[i];
      const b = game.cars[j];
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
          pc.health -= 6;
          game.sfx.thud();
        }
      }
    }
  }
}

// Pedestrians: stroll the sidewalks, flee from danger, get up after a punch.
export function stepPeds(game, dt) {
  const p = game.player;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) { ped.state = 'flee'; }
      continue;
    }
    const threat = Math.hypot(ped.x - p.x, ped.y - p.y) < 130 && (!p.onFoot && Math.abs((p.car ? p.car.speed : 0)) > 220);
    const nearPunch = Math.hypot(ped.x - p.x, ped.y - p.y) < 60 && p.punchT > 0.3;
    if (threat || nearPunch) ped.state = 'flee';
    else if (ped.state === 'flee' && Math.hypot(ped.x - p.x, ped.y - p.y) > 420) ped.state = 'walk';
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
    } else {
      if (Math.hypot(ped.tx - ped.x, ped.ty - ped.y) < 24) {
        const spot = snapToRoad(ped.x + rrange(game.rng, -420, 420), ped.y + rrange(game.rng, -420, 420));
        ped.tx = spot.x + rrange(game.rng, -46, 46);
        ped.ty = spot.y + rrange(game.rng, -46, 46);
      }
      const want = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      let diff = want - ped.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.radius = 10;
    collideBuildings(game.world, ped);
    clampToWorld(ped, 16);
    // A fast car that clips a pedestrian knocks them down: a crime.
    if (!p.onFoot && p.car && !p.car.wrecked) {
      const car = p.car;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26 && Math.abs(car.speed) > 60 && ped.state !== 'down') {
        ped.state = 'down';
        ped.downT = 3;
        addWanted(game, WANTED.hitPedAdd, 'pedestrian hit');
        game.sfx.thud();
        game.message('You hit a pedestrian!', '#ff8a5c');
      }
    }
  }
  if (game.peds.length > PED_COUNT + 8) game.peds.splice(0, game.peds.length - (PED_COUNT + 8));
}

// Police: keep the cruisers coming while the heat is on, chase and ram.
export function stepPolice(game, dt) {
  const p = game.player;
  const want = Math.min(MAX_POLICE, Math.ceil(game.wanted * 1.2));
  let have = 0;
  for (const car of game.cars) if (car.kind === 'police') have += 1;
  if (have < want && game.wanted >= 1) {
    const angle = game.rng() * Math.PI * 2;
    const spot = snapToRoad(p.x + Math.cos(angle) * 650, p.y + Math.sin(angle) * 650);
    const cruiser = makeCar(spot.x, spot.y, 0, '#20242e', 'police');
    cruiser.maxSpeed = 540;
    cruiser.cruise = 520;
    game.cars.push(cruiser);
    game.message('Police on your tail!', '#ff5c5c');
  }
  if (have > want) {
    for (const car of game.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) > 1100) {
        game.cars.splice(game.cars.indexOf(car), 1);
        break;
      }
    }
  }
  for (const car of game.cars) {
    if (car.kind !== 'police') continue;
    const diff = turnToward(car, p.x, p.y, dt, 2.8);
    const dist = Math.hypot(p.x - car.x, p.y - car.y);
    const throttle = dist > 90 ? 1 : 0.6;
    car.speed += (car.maxSpeed * throttle - car.speed) * Math.min(1, 2.6 * dt);
    if (diff > 1.4) car.speed *= 0.98;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (collideBuildings(game.world, car)) car.speed *= 0.5;
    clampToWorld(car, 24);
    // Ram the player: on foot it busts them, in a car it wrecks them.
    if (dist < 34) {
      if (p.onFoot) {
        game.busted('The Solmar PD caught you on foot.');
      } else if (p.car && Math.abs(car.speed) > 120) {
        p.car.health -= 14 * dt;
        car.speed *= 0.6;
        p.car.x += Math.cos(car.angle) * 6;
        p.car.y += Math.sin(car.angle) * 6;
        game.sfx.thud();
      }
    }
  }
  game.sfx.siren(game.wanted >= 1 && game.cars.some((c) => c.kind === 'police'));
}

export function addWanted(game, amount, reason) {
  game.wanted = Math.min(WANTED.max, game.wanted + amount);
  game.lastCrimeT = game.time;
  game.heat = 1;
  if (reason) game.lastCrime = reason;
}

export { TRAFFIC_COUNT };
