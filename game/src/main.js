// Solmar Bay — game loop, HUD (minimap, wanted stars, cash, job tracker),
// enter/exit + steal cars, heat decay, and the createGame boot entry.
import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, WATERLINE, SEED, COLORS } from './config.js';
import { buildWorld, onRoad, inWater, buildingAt } from './world.js';
import { drawWorld, drawMinimap, makeCamera } from './render.js';
import { makeRng } from './random.js';
import { makeMusic } from './audio.js';
import { makeInput } from './input.js';
import {
  makePlayer, makeTraffic, makePedestrians, makePolice,
  stealCar, updatePolice, updateRoadblocks, updateTraffic, updatePedestrians,
} from './entities.js';
import { makeMissions } from './missions.js';
import { applyShot } from './shots.js';

const HEAT_DECAY_DIST = 450; // no cruiser within this range…
const HEAT_DECAY_TIME = 25; // …for this long drops one star

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function makeGameState() {
  const rng = makeRng(SEED);
  const world = buildWorld();
  const player = makePlayer(820, 1050);
  const state = {
    world, rng,
    player,
    traffic: makeTraffic(world, rng),
    pedestrians: makePedestrians(world, rng),
    parked: world.parkedCars.map((c) => ({ ...c, taken: false })),
    police: makePolice(),
    music: makeMusic(),
    input: makeInput(),
    camera: makeCamera(VIEW_W, VIEW_H),
    time: 0,
    heatT: 0, // seconds since any cruiser was close
    message: 'Welcome to Solmar Bay — press M for a job',
    missionsApi: null,
    policeApi: null,
  };
  const missions = makeMissions(state);
  state.missionsApi = {
    defs: missions.defs,
    startMission: (id) => missions.startMission(id),
    jobsDone: () => missions.jobsDone(),
  };
  state.policeApi = {
    spawnCruiser: (x, y) => { state.police.cruisers.push({ x, y, angle: 0, speed: 0, pitT: 0, color: '#1b2631', light: 0 }); },
    setWanted: (n) => { state.player.wanted = clamp(n, 0, 5); },
    makePolice: () => state.police,
  };
  state.missions = missions;
  return state;
}

function tryEnterExit(state) {
  const p = state.player;
  if (p.onFoot) {
    const car = stealCar(p, state.parked.filter((c) => !c.taken), 70)
      || stealCar(p, state.parked.filter((c) => !c.taken), 120);
    if (car) {
      car.taken = true;
      p.onFoot = false;
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.wanted = Math.max(p.wanted, 2);
      state.message = 'Car stolen — the Solmar PD is on you';
    }
  } else if (p.car) {
    p.car.taken = false;
    p.car.x = p.x;
    p.car.y = p.y;
    p.car = null;
    p.onFoot = true;
    p.speed = 0;
  }
}

export function updateGame(state, dt) {
  const p = state.player;
  state.time += dt;
  const snap = state.input.poll();
  // M key cycles to the next unfinished job.
  if (state.input.keyDown('KeyM') && !state.mPressed) {
    state.mPressed = true;
    const next = state.missions.defs.find((m) => !state.missions.done[m.id]);
    if (next) state.missions.startMission(next.id);
  }
  if (!state.input.keyDown('KeyM')) state.mPressed = false;
  if (snap.action && !state.actionPressed) {
    state.actionPressed = true;
    tryEnterExit(state);
  }
  if (!snap.action) state.actionPressed = false;

  // Movement: on foot (walk) or in a car (drive with steering + spin).
  if (p.spin !== 0) {
    p.angle += p.spin * dt;
    p.spin *= Math.pow(0.25, dt);
    if (Math.abs(p.spin) < 0.05) p.spin = 0;
  }
  if (p.onFoot) {
    const speed = 170;
    p.x += Math.cos(p.angle) * snap.throttle * speed * dt;
    p.y += Math.sin(p.angle) * snap.throttle * speed * dt;
    p.angle += snap.steer * 2.6 * dt;
    p.speed = Math.abs(snap.throttle) * speed;
  } else {
    const accel = snap.throttle * 320;
    p.speed = clamp(p.speed + accel * dt, -120, 300);
    if (snap.brake) p.speed *= Math.pow(0.2, dt);
    p.speed *= Math.pow(0.4, dt * (snap.throttle === 0 ? 1 : 0.15));
    p.angle += snap.steer * (p.speed / 300) * 2.2 * dt;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
  }
  // Collisions with buildings + water keep the player on land.
  if (buildingAt(state.world, p.x, p.y) || inWater(p.x, p.y)) {
    p.x -= Math.cos(p.angle) * (p.onFoot ? 4 : Math.abs(p.speed) * dt + 2);
    p.y -= Math.sin(p.angle) * (p.onFoot ? 4 : Math.abs(p.speed) * dt + 2);
    p.speed *= 0.4;
  }
  p.x = clamp(p.x, 20, WORLD_W - 20);
  p.y = clamp(p.y, 20, WORLD_H - 20);

  updateTraffic(state.traffic, p, dt);
  updatePedestrians(state.pedestrians, state.world, dt, state.rng);
  updatePolice(state.world, state.police.cruisers, p, dt, state.time, state.rng);
  updateRoadblocks(state.police, p, state.rng);

  // Heat decay: one star drops after 25s with no cruiser within 450px.
  const near = state.police.cruisers.some(
    (c) => Math.hypot(c.x - p.x, c.y - p.y) < HEAT_DECAY_DIST,
  );
  if (near || p.wanted === 0) {
    state.heatT = 0;
  } else {
    state.heatT += dt;
    if (state.heatT >= HEAT_DECAY_TIME) {
      p.wanted = Math.max(0, p.wanted - 1);
      state.heatT = 0;
      state.message = 'Heat cooling off…';
    }
  }

  // Missions pay out here.
  const pay = state.missions.update(p, p.wanted, dt);
  if (pay > 0) {
    p.cash += pay;
    state.message = state.missions.banner;
  } else if (state.missions.active) {
    state.message = state.missions.currentText();
  }

  state.camera.follow(p.x, p.y);
  state.music.tick(dt);
}

export function drawGame(state, ctx, t) {
  const cam = state.camera;
  // The world is drawn in world coordinates: shift it into screen space
  // so the ground, roads and buildings sit under the camera-relative
  // entities instead of sliding down-right by the camera offset.
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, state.world, state.camera, t);
  ctx.restore();
  const p = state.player;
  // Player + car.
  ctx.save();
  ctx.translate(p.x - cam.x, p.y - cam.y);
  ctx.rotate(p.angle);
  if (p.onFoot) {
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-16, -8, 32, 16);
    ctx.fillStyle = '#aed6f1';
    ctx.fillRect(-6, -7, 10, 14);
  }
  ctx.restore();
  // Parked cars.
  for (const car of state.parked) {
    if (car.taken) continue;
    ctx.save();
    ctx.translate(car.x - cam.x, car.y - cam.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = car.color;
    ctx.fillRect(-15, -7, 30, 14);
    ctx.restore();
  }
  // Traffic.
  for (const car of state.traffic) {
    ctx.save();
    ctx.translate(car.x - cam.x, car.y - cam.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = car.color;
    ctx.fillRect(-15, -7, 30, 14);
    if (car.honk > 0) {
      ctx.fillStyle = '#f7dc6f';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('!', 18, -10);
    }
    ctx.restore();
  }
  // Pedestrians.
  for (const f of state.pedestrians) {
    ctx.fillStyle = `hsl(${f.hue}, 60%, 55%)`;
    ctx.beginPath();
    ctx.arc(f.x - cam.x, f.y - cam.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cruisers + roadblocks.
  for (const c of state.police.cruisers) {
    ctx.save();
    ctx.translate(c.x - cam.x, c.y - cam.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = '#1b2631';
    ctx.fillRect(-16, -8, 32, 16);
    ctx.fillStyle = Math.floor(t * 4) % 2 ? '#e74c3c' : '#2e86c1';
    ctx.fillRect(-4, -9, 8, 4);
    ctx.restore();
  }
  for (const b of state.police.roadblocks) {
    ctx.save();
    ctx.translate(b.x - cam.x, b.y - cam.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(-40, -5, 80, 10);
    ctx.restore();
  }
  drawHud(state, ctx);
}

function drawHud(state, ctx) {
  const p = state.player;
  ctx.save();
  // Top-left: cash + jobs.
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  ctx.fillRect(14, 12, 300, 64);
  ctx.fillStyle = '#f7dc6f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${p.cash}`, 26, 40);
  ctx.fillStyle = '#ecf0f1';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Jobs done ${state.missions.jobsDone()}/7`, 26, 64);
  // Wanted stars, top-right.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#f1c40f' : 'rgba(236,240,241,0.25)';
    ctx.font = '26px sans-serif';
    ctx.fillText('★', VIEW_W - 170 + i * 30, 40);
  }
  // Mission banner, bottom.
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  ctx.fillRect(14, VIEW_H - 44, Math.min(900, 40 + state.message.length * 8), 30);
  ctx.fillStyle = '#fdebd0';
  ctx.font = '15px sans-serif';
  ctx.fillText(state.message, 26, VIEW_H - 24);
  // Minimap, bottom-right.
  drawMinimap(ctx, state.world, p.x, p.y, VIEW_W - 214, VIEW_H - 164, 200, 150);
  ctx.restore();
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const state = makeGameState();
  state.input.attach(typeof window !== 'undefined' ? window : null);
  state.music.start();
  // ?shot=<id> staging for the screenshot pipeline.
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  );
  const shot = params.get('shot');
  if (shot) applyShot(state, shot);
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    updateGame(state, dt);
    drawGame(state, ctx, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return state;
}
