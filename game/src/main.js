// Solmar Bay — game loop, HUD, wanted heat, mission wiring.
// createGame(canvas) -> { state, start(), stop(), update(dt), draw() }.
// The loop runs on requestAnimationFrame in the browser; update/draw are
// also exposed so headless tests can drive the game step by step.

import { SEED, VIEW, MINIMAP, WATERLINE } from './config.js';
import { buildWorld, buildingAt } from './world.js';
import { makeCamera, drawWorld, drawMinimap } from './render.js';
import { makeRng } from './random.js';
import { makePlayer, movePlayer, stealCar, exitCar, makeTraffic, updateTraffic, makePedestrians, updatePedestrians, makePolice, setWanted, updatePolice, drawActors } from './entities.js';
import { makeMissionsApi } from './missions.js';
import { makeInput } from './input.js';
import { makeMusic } from './audio.js';

const HEAT_DECAY_SECONDS = 10;

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const world = buildWorld();
  const rng = makeRng(SEED + 7);
  const camera = makeCamera();
  const input = makeInput(canvas);
  const music = makeMusic();
  const missions = makeMissionsApi();
  const police = makePolice();

  const player = makePlayer(820, 990);
  const traffic = makeTraffic(world, rng);
  const peds = makePedestrians(world, rng);

  const state = {
    world,
    camera,
    input,
    music,
    missions,
    police,
    player,
    traffic,
    peds,
    cash: 0,
    wanted: 0,
    time: 0,
    running: false,
    muted: false,
    message: 'Welcome to Solmar Bay. Press 1-7 to take a job.',
    messageT: 6,
    shot: null,
  };

  let heatT = 0; // seconds since the last crime
  let decayT = 0; // seconds at the current wanted level
  let raf = null;
  let last = 0;

  function setMessage(text, seconds = 4) {
    state.message = text;
    state.messageT = seconds;
  }

  missions.on('pickup', (e) => setMessage(`${e.name}: package picked up — get to the drop-off.`));
  missions.on('boat', () => setMessage('Marina Heist: hold still and fuel the boat — stay under 2 stars!'));
  missions.on('fueled', () => setMessage('Boat fueled. Lose ALL heat, then run for the pier.'));
  missions.on('done', (e) => {
    state.cash += e.payout;
    setMessage(`${e.name} complete — $${e.payout} in the pocket. Jobs done ${missions.jobsDone}/7.`, 5);
  });
  missions.on('failed', (e) => setMessage(`${e.name} failed: ${e.reason}.`, 5));

  function commitCrime(stars) {
    if (police.wanted < stars) setWanted(police, stars);
    heatT = 0;
    decayT = 0;
  }

  function update(dt) {
    if (dt > 0.1) dt = 0.1; // clamp big frame gaps
    state.time += dt;
    heatT += dt;
    input.update();

    // Mission keys 1-7.
    for (let i = 1; i <= 7; i++) {
      if (input.pressed(`Digit${i}`)) {
        const id = `m${i}`;
        if (missions.start(id)) setMessage(`Job started: ${missions.active.def.name}.`);
        else if (missions.active) setMessage('Finish the current job first.');
        else setMessage('That job is already done.');
      }
    }

    // Steal / exit car.
    if (input.pressed('KeyE')) {
      if (player.onFoot) {
        const car = stealCar(player, traffic, world.parkedCars);
        if (car) {
          commitCrime(1);
          setMessage('Car stolen — the cops noticed. Lose them.');
        } else {
          setMessage('No car close enough to steal.');
        }
      } else {
        exitCar(player);
        setMessage('Out of the car.');
      }
    }

    // Horn + mute.
    if (input.pressed('KeyH')) setMessage('Honk!', 1);
    if (input.pressed('KeyM')) {
      state.muted = !state.muted;
      music.setMuted(state.muted);
      setMessage(state.muted ? 'Music muted.' : 'Music on.', 1);
    }

    movePlayer(player, input, dt, world);

    // Bumping a pedestrian is a crime.
    for (const p of peds) {
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 22 && Math.abs(player.speed) > 60) {
        commitCrime(Math.min(5, police.wanted + 1));
        setMessage('You hit a pedestrian! Heat is up.', 3);
        p.x += (p.x - player.x) * 0.5;
        p.y += (p.y - player.y) * 0.5;
      }
    }

    updateTraffic(traffic, dt, world, player);
    updatePedestrians(peds, dt, world);
    updatePolice(police, dt, player, world, state.time);

    // Wanted decays after a quiet stretch.
    if (heatT > HEAT_DECAY_SECONDS && police.wanted > 0) {
      decayT += dt;
      if (decayT >= HEAT_DECAY_SECONDS) {
        decayT = 0;
        setWanted(police, police.wanted - 1);
      }
    }
    state.wanted = police.wanted;

    // Mission progress.
    const snap = { x: player.x, y: player.y, wanted: police.wanted, inCar: !player.onFoot };
    missions.update(dt, snap);

    if (state.messageT > 0) state.messageT -= dt;
    camera.follow(player);
  }

  function drawHud() {
    const w = VIEW.w;
    const h = VIEW.h;
    ctx.save();
    // Cash, top left.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 12, 190, 34);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`$${state.cash}`, 24, 38);

    // Wanted stars, top right.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w - 208, 12, 196, 34);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < state.wanted ? '#fbc531' : 'rgba(255,255,255,0.25)';
      ctx.font = '22px sans-serif';
      ctx.fillText('★', w - 196 + i * 38, 38);
    }

    // Jobs tracker, top center.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(w / 2 - 90, 12, 180, 34);
    ctx.fillStyle = '#f5f6fa';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`Jobs done ${missions.jobsDone}/7`, w / 2 - 72, 36);

    // Message bar.
    if (state.messageT > 0 && state.message) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText ? ctx.measureText(state.message).width : state.message.length * 9;
      ctx.fillRect(w / 2 - tw / 2 - 14, h - 64, tw + 28, 30);
      ctx.fillStyle = '#f5f6fa';
      ctx.font = '15px sans-serif';
      ctx.fillText(state.message, w / 2 - tw / 2, h - 44);
    }

    // Minimap, bottom right.
    ctx.save();
    ctx.translate(w - MINIMAP.w - 16, h - MINIMAP.h - 16);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-6, -6, MINIMAP.w + 12, MINIMAP.h + 12);
    drawMinimap(ctx, world, player);
    ctx.restore();
    ctx.restore();
  }

  function draw() {
    drawWorld(ctx, world, camera, state.time);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawActors(ctx, world, player, traffic, peds, police);
    ctx.restore();
    drawHud();
  }

  function frame(t) {
    if (!state.running) return;
    const dt = Math.min(0.1, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    music.start();
    if (typeof requestAnimationFrame === 'function') {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function stop() {
    state.running = false;
    music.stop();
    if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = null;
    input.detach();
  }

  return { state, start, stop, update, draw };
}
