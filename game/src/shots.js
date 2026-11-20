// Solmar Bay — screenshot staging.
// applyShot(state, id) poses the game for one of the four dossier shots:
// cover (city + tower + title framing), roam (on foot in the plaza),
// mission (m1 in progress, fare picked up), chase (4 stars, cruisers on
// the tail, roadblocks ahead). Pure state setup — no rendering here.

import { PLAZA, TOWER } from './config.js';

// Stage a shot by id. Returns true when the id is known.
export function applyShot(state, id) {
  const p = state.player;
  const cam = state.cam;
  const api = state.missionsApi;
  const police = state.policeApi;
  switch (id) {
    case 'cover': {
      // Wide plaza view: player on foot between the fountains, tower behind.
      p.onFoot = true;
      p.car = null;
      p.x = PLAZA.x;
      p.y = PLAZA.y + 130;
      p.angle = -Math.PI / 2;
      p.speed = 0;
      police.setWanted(0);
      cam.follow(p.x, p.y);
      return true;
    }
    case 'roam': {
      // On foot at a far southeast intersection, well away from the plaza,
      // so the frame reads as a different district: traffic passing,
      // pedestrians nearby.
      p.onFoot = true;
      p.car = null;
      p.x = 2350;
      p.y = 1550;
      p.angle = 0;
      p.speed = 0;
      police.setWanted(0);
      cam.follow(p.x, p.y);
      return true;
    }
    case 'mission': {
      // m1 in progress: fare picked up, heading for Solmar Tower.
      api.startMission('m1');
      const job = api.active;
      if (job) {
        job.stage = 'dropoff';
        job.picked = true;
      }
      p.onFoot = false;
      const car = state.world.parkedCars[0];
      if (car) {
        p.car = car;
        state.world.parkedCars = state.world.parkedCars.filter((c) => c !== car);
        p.x = car.x;
        p.y = car.y;
        p.angle = car.angle;
      } else {
        p.x = 850;
        p.y = 1150;
      }
      p.speed = 120;
      police.setWanted(1);
      cam.follow(p.x, p.y);
      return true;
    }
    case 'chase': {
      // 4 stars: three cruisers on the tail, roadblocks ahead.
      p.onFoot = false;
      const car = state.world.parkedCars[1] || state.world.parkedCars[0];
      if (car) {
        p.car = car;
        state.world.parkedCars = state.world.parkedCars.filter((c) => c !== car);
        p.x = car.x;
        p.y = car.y;
        p.angle = car.angle;
      } else {
        p.x = 1350;
        p.y = 1150;
      }
      p.speed = 380;
      police.setWanted(4);
      // Drive the cruisers close so the frame reads as a chase.
      state.now = 0;
      const rng = state.rng;
      for (let i = 0; i < 3; i++) {
        const c = police.spawnCruiser(p.x - 120 - i * 60, p.y + (i - 1) * 70);
        c.speed = 380;
        c.angle = p.angle;
        state.police.cruisers.push(c);
      }
      // One roadblock in view.
      state.police.roadblocks = [{ x: 1850, y: 1150, angle: Math.PI / 2 }];
      cam.follow(p.x, p.y);
      return true;
    }
    default:
      return false;
  }
}

export const SHOT_IDS = ['cover', 'roam', 'mission', 'chase'];
