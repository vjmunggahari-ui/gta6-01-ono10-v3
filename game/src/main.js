// Solmar Bay — the game itself: state, the fixed-step loop, save, screens.
// One job: own the game object and run it, in play and in screenshot poses.

import { CAR, PED_COUNT, PLAYER, SAVE_KEY, SEEDS, STEP, TRAFFIC_COUNT, VIEW, WANTED } from './config.js';
import { mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { spawnPeds, spawnTraffic, stepPeds, stepPlayer, stepPolice, stepTraffic } from './entities.js';
import { createMissions } from './missions.js';
import { drawFrame } from './render.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.sfx = new SoundFX();
    this.save = this.loadSave();
    this.reset(SEEDS.world);
    this.screen = 'title';
    this.bustedReason = '';
    this.shot = null;
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const save = JSON.parse(raw);
      if (typeof save.cash !== 'number' || !Array.isArray(save.done)) return null;
      return save;
    } catch {
      return null;
    }
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash,
        done: this.missions.done,
        best: Math.max(this.save ? this.save.best || 0 : 0, this.player.cash),
      }));
    } catch {
      // A save that cannot be written is a shrug, never a crash.
    }
  }

  reset(seed) {
    this.rng = mulberry32(seed);
    this.world = buildWorld(seed);
    this.time = 0;
    this.dayTime = 0.32;
    this.wanted = 0;
    this.lastCrimeT = -999;
    this.lastCrime = '';
    this.heat = 0;
    this.player = {
      x: this.world.places.downtown.x,
      y: this.world.places.downtown.y + 90,
      angle: 0,
      speed: 0,
      radius: PLAYER.radius,
      onFoot: true,
      car: null,
      health: PLAYER.health,
      cash: this.save ? this.save.cash : 0,
      punchT: 0,
      moving: false,
    };
    this.cars = spawnTraffic(this.world, this.rng, TRAFFIC_COUNT);
    this.peds = spawnPeds(this.world, this.rng, PED_COUNT);
    this.particles = [];
    this.skid = [];
    this.messages = [];
    this.missions = createMissions(this);
    if (this.save) {
      for (const id of this.save.done) {
        if (!this.missions.done.includes(id)) this.missions.done.push(id);
      }
    }
    this.camera = { x: 0, y: 0 };
    this.updateCamera();
  }

  message(text, color) {
    const short = text.length > 110 ? text.slice(0, 107) + '…' : text;
    this.messages.push({ text: short, color: color || '#f4f1e6', t: this.time });
    if (this.messages.length > 5) this.messages.shift();
  }

  updateCamera() {
    const tx = Math.max(0, Math.min(3200 - VIEW.w, this.player.x - VIEW.w / 2));
    const ty = Math.max(0, Math.min(2400 - VIEW.h, this.player.y - VIEW.h / 2));
    this.camera.x += (tx - this.camera.x) * 0.12;
    this.camera.y += (ty - this.camera.y) * 0.12;
  }

  busted(reason) {
    if (this.screen !== 'play') return;
    this.screen = 'busted';
    this.bustedReason = reason;
    this.sfx.busted();
    this.sfx.stopEngine();
    const lost = Math.floor(this.player.cash * 0.25);
    this.player.cash -= lost;
    this.wanted = 0;
    this.saveGame();
  }

  respawn() {
    const hospital = this.world.places.hospital;
    this.player.x = hospital.x;
    this.player.y = hospital.y + 60;
    this.player.angle = 0;
    this.player.onFoot = true;
    this.player.car = null;
    this.player.health = PLAYER.health;
    this.screen = 'play';
    this.message('You walked out of Bay Hospital. The bay is still yours.', '#7ddc7d');
  }

  step(dt, input) {
    if (this.screen !== 'play') return;
    this.time += dt;
    this.dayTime += dt / 300;
    if (this.dayTime >= 1) this.dayTime = 0;
    // Wanted stars cool off when the heat has been quiet a while.
    const policeNear = this.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - this.player.x, c.y - this.player.y) < 520);
    if (this.time - this.lastCrimeT > 12 && !policeNear && this.wanted > 0) {
      this.wanted = Math.max(0, this.wanted - WANTED.decayPerSec * dt);
    }
    stepPlayer(this, dt, input);
    stepTraffic(this, dt);
    stepPeds(this, dt);
    stepPolice(this, dt);
    if (this.missions.current) this.missions.update(dt);
    for (const pt of this.particles) pt.t -= dt;
    this.particles = this.particles.filter((pt) => pt.t > 0);
    for (const s of this.skid) s.t -= dt;
    this.skid = this.skid.filter((s) => s.t > 0);
    this.messages = this.messages.filter((m) => this.time - m.t < 4.5);
    this.updateCamera();
    // Traffic that drove off the map's edge quietly respawns up the road.
    if (this.cars.length < TRAFFIC_COUNT + 1) {
      const fresh = spawnTraffic(this.world, this.rng, 1);
      this.cars.push(fresh[0]);
    }
  }

  render() {
    drawFrame(this.ctx, this);
  }
}

// Boot: a canvas, a loop, and two ways in — play, or a posed screenshot.
const canvas = document.getElementById('game');
const game = new Game(canvas);
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
game.input.attach(window);
game.input.attachMouse(canvas);
game.input.onFirstGesture = () => game.sfx.init();

if (shotName) {
  game.shot = shotName;
  stageShot(shotName, game);
  game.render();
  window.__solmarReady = true;
} else {
  game.render();
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // A staged screenshot pose is frozen: the loop renders it, never steps it,
  // so the captured frame is exactly the pose, at full speed, every time.
  if (!game.shot) {
    if (game.screen === 'title' || game.screen === 'pause' || game.screen === 'busted') game.time += frameDt;
    if (game.screen === 'title') {
      if (game.input.hit('Enter')) {
        game.screen = 'play';
        game.message('Welcome to Solmar Bay. Press M to take the first job.', '#ffb02e');
      }
    } else if (game.screen === 'busted') {
      if (game.input.hit('Enter')) game.respawn();
    } else if (game.screen === 'pause') {
      if (game.input.hit('Escape')) game.screen = 'play';
    } else if (game.screen === 'play') {
      if (game.input.hit('Escape')) {
        game.screen = 'pause';
        game.sfx.stopEngine();
      }
      if (game.input.hit('m', 'M')) {
        if (!game.missions.current) {
          const next = game.missions.nextAvailable();
          if (next) game.missions.start(next.id);
          else game.missions.startTaxi();
        }
      }
      if (game.input.hit('h', 'H')) game.sfx.toggleMute();
      acc += frameDt;
      let guard = 0;
      while (acc >= STEP && guard < 8) {
        game.step(STEP, game.input);
        acc -= STEP;
        guard += 1;
      }
      if (guard >= 8) acc = 0;
    }
  }
  game.render();
  game.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
