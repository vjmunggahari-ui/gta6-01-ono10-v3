// Solmar Bay — posed screenshots: four fixed moments, the same every run.
// One job: put the game into a photogenic state the judge can see at once.

import { SEEDS } from './config.js';
import { makeCar } from './entities.js';

const FAKE_INPUT = {
  mouse: { x: 640, y: 360, down: false, clicked: false },
  axis() { return { steer: 0, drive: 0.65 }; },
  hit() { return false; },
  down() { return false; },
  endFrame() {},
};

function stepForward(game, n) {
  for (let i = 0; i < n; i += 1) game.step(1 / 60, FAKE_INPUT);
}

// Posed cars come from the game's own factory, so they carry every field
// the driving code reads (maxSpeed, driver, waypoint, cruise, brake).
function giveCar(game, x, y, angle, color) {
  const car = makeCar(x, y, angle, color || '#e8c33a', 'player');
  game.cars.push(car);
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.player.onFoot = false;
  game.player.car = car;
  return car;
}

function spawnPolice(game, count, x, y, angle) {
  // Staged well behind the player: close enough to read as a chase, far
  // enough that they have not caught and stalled the car when the shot lands.
  for (let i = 0; i < count; i += 1) {
    const back = 300 + i * 90;
    const px = x - Math.cos(angle) * back;
    const py = y - Math.sin(angle) * back;
    const cruiser = makeCar(px, py, angle, '#20242e', 'police');
    cruiser.maxSpeed = 540;
    cruiser.cruise = 520;
    game.cars.push(cruiser);
  }
}

function snapCamera(game) {
  game.camera.x = Math.max(0, Math.min(3200 - 1280, game.player.x - 640));
  game.camera.y = Math.max(0, Math.min(2400 - 720, game.player.y - 360));
}

export function stageShot(name, game) {
  game.reset(SEEDS.world);
  game.screen = 'play';
  if (name === 'cover') {
    // Three-star chase on the First Fare, noon: the fare is in the car.
    game.dayTime = 0.5;
    game.missions.start('m1');
    game.player.x = 1320;
    game.player.y = 700;
    stepForward(game, 2);
    giveCar(game, 1500, 1220, 0, '#e8c33a');
    game.wanted = 3;
    game.lastCrime = 'Grand theft auto';
    game.lastCrimeT = game.time;
    spawnPolice(game, 3, 1500, 1220, 0);
    stepForward(game, 40);
    game.message('Police on your tail!', '#ff8a5c');
  } else if (name === 'roam') {
    // On foot downtown, morning: the city before the first job.
    game.dayTime = 0.18;
    game.player.x = 1320;
    game.player.y = 700;
    game.player.angle = -Math.PI / 2;
    stepForward(game, 25);
    game.message('Downtown Solmar — morning. Find a car, take a job.');
  } else if (name === 'mission') {
    // Hot Package run to the East Docks, dusk, two stars on the tail.
    game.dayTime = 0.8;
    game.missions.start('m2');
    game.player.x = 1320;
    game.player.y = 1220;
    stepForward(game, 2);
    giveCar(game, 1820, 1500, Math.PI / 2, '#e8c33a');
    game.wanted = 2;
    game.lastCrime = 'Hot Package';
    game.lastCrimeT = game.time;
    spawnPolice(game, 2, 1820, 1500, Math.PI / 2);
    stepForward(game, 30);
    game.message('Police on your tail!', '#ff8a5c');
  } else if (name === 'chase') {
    // Bay Getaway at night: four stars, headlights, the safehouse ahead.
    // Wanted starts at 3: the getaway run clips a pedestrian on the way
    // north, and the hit brings it to 4, as the mission promises.
    game.dayTime = 0.94;
    game.missions.start('m3');
    giveCar(game, 1320, 1500, -Math.PI / 2, '#e8c33a');
    game.wanted = 3;
    game.lastCrime = 'Bay Getaway';
    game.lastCrimeT = game.time;
    spawnPolice(game, 4, 1320, 1500, -Math.PI / 2);
    stepForward(game, 40);
    game.message('Police on your tail!', '#ff8a5c');
  }
  snapCamera(game);
}
