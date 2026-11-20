// Solmar Bay — game loop, state, HUD.
// createGame(canvas) boots the game in the browser. makeGameState /
// updateGame / drawGame are exported for the screenshot pipeline and tests.

import {
  WORLD_W, WORLD_H, VIEW_W, VIEW_H, PLAZA,
} from './config.js';
import { makeRng } from './random.js';
import { buildWorld } from './world.js';
import { makeCamera, drawWorld, drawMinimap } from './render.js';
import { makeMusic } from './audio.js';
import {
  makePlayer, movePlayer, stealCar, exitCar,
  makeTraffic, updateTraffic, makePedestrians, updatePedestrians,
  makePolice, updatePolice, spawnCruiser, setWanted,
} from './entities.js';
import { makeInput } from './input.js';
import { makeMissionsApi } from './missions.js';
import { applyShot } from './shots.js';

export function makeGameState() {
  const world = buildWorld();
  const rng = makeRng(770011 ^ 0x51ab);
  const player = makePlayer(PLAZA.x, PLAZA.y + 120);
  const police = makePolice();
  police.wanted = 0;
  const state = {
    world,
    player,
    traffic: makeTraffic(world, rng, 10),
    peds: makePedestrians(world, rng, 14),
    police,
    cam: makeCamera(VIEW_W, VIEW_H),
    input: makeInput(),
    music: makeMusic(),
    cash: 0,
    now: 0,
    rng,
    lastPaid: null,
  };
  state.missionsApi = makeMissionsApi(state);
  state.policeApi = {
    spawnCruiser,
    setWanted: (n) => setWanted(state.police, n),
    makePolice,
  };
  return state;
}

export function updateGame(state, dt) {
  state.now += dt;
  const input = state.input;
  input.poll();
  const now = state.now;

  // Mission keys 1-7.
  for (let i = 1; i <= 7; i++) {
    if (input.isDown(`Digit${i}`)) {
      input.keys.delete(`Digit${i}`);
      state.missionsApi.startMission(`m${i}`);
    }
  }
  if (input.isDown('KeyM')) {
    input.keys.delete('KeyM');
    state.music.toggle();
  }

  // Enter / exit / steal with E.
  if (input.actionPressed()) {
    if (!state.player.onFoot) {
      const car = exitCar(state.player);
      if (car) state.world.parkedCars.push(car);
    } else {
      const taken = stealCar(state.player, state.world.parkedCars, 70);
      if (taken) {
        state.world.parkedCars = state.world.parkedCars.filter((c) => c !== taken);
      } else {
        const far = stealCar(state.player, state.world.parkedCars, 120);
        if (far) {
          state.world.parkedCars = state.world.parkedCars.filter((c) => c !== far);
        }
      }
    }
  }
  if (input.honkPressed()) state.player.honkAt = now;

  const mv = input.moveVector();
  movePlayer(state.player, state.world, mv, dt);
  updateTraffic(state.traffic, state.player, dt, now);
  updatePedestrians(state.peds, state.world, dt, now, state.rng);
  updatePolice(state.world, state.police, state.player, dt, now, state.rng);
  const paid = state.missionsApi.update(dt, now);
  if (paid === 'complete' && state.missionsApi.lastPaid) {
    state.lastPaid = state.missionsApi.lastPaid;
  }
  state.music.tick(dt);
  state.cam.follow(state.player.x, state.player.y);
}

// --- drawing ----------------------------------------------------------------

function drawCarShape(ctx, x, y, angle, w, h, color, glass) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = glass;
  ctx.fillRect(-6, -h / 2 + 3, 12, h - 6);
  ctx.restore();
}

function drawMarker(ctx, x, y, color, t) {
  const pulse = 10 + Math.sin(t / 250) * 3;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, pulse + 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGame(state, ctx, t) {
  const { world, cam, player } = state;
  drawWorld(ctx, world, cam, t);

  // Entities in world space.
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const c of state.traffic) {
    drawCarShape(ctx, c.x, c.y, c.angle, c.w, c.h, c.color, '#2f4a63');
    if (c.honk > state.now) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('HONK!', c.x - 20, c.y - 22);
    }
  }
  for (const c of world.parkedCars) {
    drawCarShape(ctx, c.x, c.y, c.angle, c.w, c.h, c.color, '#2f4a63');
  }
  for (const p of state.peds) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of state.police.roadblocks) {
    drawCarShape(ctx, b.x, b.y, b.angle, 46, 22, '#f2f2f2', '#1c2733');
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PD', b.x - 8, b.y - 16);
  }
  for (const c of state.police.cruisers) {
    drawCarShape(ctx, c.x, c.y, c.angle, 46, 22, '#f2f2f2', '#1c2733');
    ctx.fillStyle = '#c23b2e';
    ctx.fillRect(c.x - 20, c.y - 14, 12, 4);
    ctx.fillStyle = '#2e6fc2';
    ctx.fillRect(c.x + 8, c.y - 14, 12, 4);
  }
  // Player.
  if (player.onFoot) {
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
      player.x + Math.cos(player.angle) * 14,
      player.y + Math.sin(player.angle) * 14,
    );
    ctx.stroke();
  } else if (player.car) {
    drawCarShape(ctx, player.x, player.y, player.angle, 46, 22, player.car.color, '#2f4a63');
  }
  // Mission markers.
  const job = state.missionsApi.active;
  if (job) {
    if (job.stage === 'pickup' || job.stage === 'fuel') {
      drawMarker(ctx, job.def.start.x, job.def.start.y, '#ffe14d', t);
    } else {
      drawMarker(ctx, job.def.finish.x, job.def.finish.y, '#7dff6a', t);
    }
  }
  ctx.restore();

  // HUD in screen space.
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 16, 0.72)';
  ctx.fillRect(12, 12, 300, 86);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${state.cash}`, 24, 38);
  ctx.font = '15px sans-serif';
  ctx.fillText(`Jobs done ${state.missionsApi.jobsDone()}/7`, 24, 62);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(state.missionsApi.statusText(), 24, 84);
  // Wanted stars, top right.
  const wanted = state.police.wanted || 0;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#ffd94d';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < wanted ? '★' : '☆';
  ctx.fillText(stars, VIEW_W - 150, 40);
  if (state.lastPaid) {
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(
      `${state.lastPaid.name} complete — $${state.lastPaid.payout} banked.`,
      24, 118,
    );
  }
  drawMinimap(ctx, world, player.x, player.y, VIEW_W - 212, VIEW_H - 152, 200, 140);
  ctx.restore();
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const state = makeGameState();
  state.input.attach(canvas);

  // Screenshot staging: ?shot=cover|roam|mission|chase
  let shot = null;
  try {
    shot = new URLSearchParams(window.location.search).get('shot');
  } catch (e) {
    shot = null;
  }
  if (shot) applyShot(state, shot);

  // Music starts on the first key press (browsers need a gesture).
  window.addEventListener('keydown', () => state.music.start(), { once: true });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateGame(state, dt);
    drawGame(state, ctx, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return state;
}
