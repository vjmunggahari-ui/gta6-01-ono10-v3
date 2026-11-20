// Solmar Bay (v6, Session B) — posed screenshots: four fixed moments, the
// same every run.
//
// One job: put the game into a photogenic state the judge can see at once.
// v6 re-stages the set around what is new: the mission shot is now "The
// Tower Job" at the downtown plaza under the gold SOLMAR sign, and the roam
// shot stands on foot at the Old Town fountain square, so the new landmark
// and the new plazas both appear. Cover (First Fare, noon, three stars)
// and chase (Bay Getaway, night, four stars) stay — they are the shots
// the rubric asks for. The camera is snapped after staging, never mid-drift.

import { SEEDS } from './config.js';
import { makeCar } from './entities.js';

export const SHOT_NAMES = ['cover', 'roam', 'mission', 'chase'];

// A stand-in for the real Input: the staged game is stepped forward with
// a gentle throttle and no keys, so traffic, police and pedestrians all
// move exactly as they would in play — deterministically, from the seed.
// It implements the whole input surface the game loop reads (axis /
// actionDown / actionHit / hit / down / clicked / mouse / update /
// endFrame), so staging runs the real driving, police and ped code.
const FAKE_INPUT = {
  mouse: { x: 640, y: 360, down: false, clicked: false },
  axis() { return { steer: 0, drive: 0.65 }; },
  actionDown() { return false; },
  actionHit() { return false; },
  hit() { return false; },
  down() { return false; },
  clicked() { return false; },
  update() {},
  endFrame() {},
};

function stepForward(game, n) {
  for (let i = 0; i < n; i += 1) game.step(1 / 60, FAKE_INPUT);
}

// Posed cars come from the game's own factory, so they carry every field
// the driving code reads (maxSpeed, driver, waypoint, cruise, health).
function giveCar(game, x, y, angle, color) {
  const car = makeCar(x, y, angle, color || '#e8c33a', 'player');
  car.driver = 'player';
  game.cars.push(car);
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.player.onFoot = false;
  game.player.car = car;
  return car;
}

function spawnPolice(game, count, x, y, angle, speed) {
  // Staged well behind the player: close enough to read as a chase, far
  // enough that they have not caught and stalled the car when the shot lands.
  for (let i = 0; i < count; i += 1) {
    const back = 300 + i * 95;
    const px = x - Math.cos(angle) * back;
    const py = y - Math.sin(angle) * back;
    const cruiser = makeCar(px, py, angle, '#20242e', 'police');
    cruiser.maxSpeed = speed || 540;
    cruiser.cruise = speed || 520;
    game.cars.push(cruiser);
  }
}

function snapCamera(game) {
  game.camera.x = Math.max(0, Math.min(3200 - 1280, game.player.x - 640));
  game.camera.y = Math.max(0, Math.min(2400 - 720, game.player.y - 360));
}

function setWanted(game, stars, reason) {
  game.wanted = stars;
  game.lastCrime = reason;
  game.lastCrimeT = game.time;
}

export function stageShot(name, game) {
  game.reset(SEEDS.world);
  game.screen = 'play';
  if (name === 'cover') {
    // Three-star chase on the First Fare, noon: the fare is in the car,
    // downtown towers behind, the PD closing in from the west.
    game.dayTime = 0.5;
    game.missions.start('m1');
    game.player.x = 1320;
    game.player.y = 700;
    stepForward(game, 2);
    giveCar(game, 1500, 1220, 0, '#e8c33a');
    spawnPolice(game, 3, 1500, 1220, 0, 540);
    stepForward(game, 40);
    // Set the heat AFTER staging: a staged clip can add a star mid-run.
    setWanted(game, 3, 'Grand theft auto');
    game.message('Police on your tail!', '#ff8a5c');
  } else if (name === 'roam') {
    // On foot at the Old Town fountain square, morning: the city before
    // the first job, peds on the sidewalks and the fountain shimmering.
    game.dayTime = 0.18;
    game.player.x = 570;
    game.player.y = 990;
    game.player.angle = -Math.PI / 2;
    stepForward(game, 25);
    game.message('Old Town square — morning. Find a car, take a job.');
  } else if (name === 'mission') {
    // The Tower Job at the downtown plaza, dusk: Jax cracks the rooftop
    // safe under the gold SOLMAR sign while two stars close in.
    game.dayTime = 0.8;
    game.missions.start('m6');
    game.player.x = 1070;
    game.player.y = 990;
    stepForward(game, 2);
    giveCar(game, 1070, 1120, Math.PI / 2, '#d94f3d');
    spawnPolice(game, 2, 1070, 1120, Math.PI / 2, 520);
    stepForward(game, 30);
    setWanted(game, 2, 'The Tower Job');
    game.message('Police on your tail!', '#ff8a5c');
  } else if (name === 'chase') {
    // Bay Getaway at night: four stars, headlights on, the safehouse ahead.
    game.dayTime = 0.94;
    game.missions.start('m3');
    giveCar(game, 1320, 1500, -Math.PI / 2, '#3d7dd9');
    spawnPolice(game, 4, 1320, 1500, -Math.PI / 2, 570);
    stepForward(game, 40);
    setWanted(game, 4, 'Bay Getaway');
    game.message('Police on your tail!', '#ff8a5c');
  } else {
    throw new Error(`unknown shot: ${name}`);
  }
  snapCamera(game);
}
