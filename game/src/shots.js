// Solmar Bay — screenshot camera definitions for the dossier pipeline.
// applyShot(game, id) stages the game for one of the four shots and
// returns its label. Shots are staged, never scripted: the world keeps
// simulating from the staged state.

import { setWanted, spawnCruiser } from './entities.js';

export const SHOT_IDS = ['cover', 'roam', 'mission', 'chase'];

export const SHOT_LABELS = {
  cover: 'Solmar Bay — the city, the tower, the bay',
  roam: 'Cruising the avenues of Solmar Bay',
  mission: 'Job in progress — Bay Getaway',
  chase: 'Four stars and nowhere to hide',
};

function putPlayerInCar(game, x, y, angle = 0) {
  const { player, world } = game.state;
  const car = { x, y, angle, speed: 0, color: '#e84118', honking: 0, swerve: 0, taken: true, vertical: false };
  world.parkedCars.push(car);
  player.car = car;
  player.onFoot = false;
  player.x = x;
  player.y = y;
  player.angle = angle;
  player.speed = 0;
  return car;
}

export function applyShot(game, id) {
  const { state } = game;
  const { player, police, missions, camera } = state;
  if (!SHOT_IDS.includes(id)) throw new Error(`unknown shot: ${id}`);

  // Reset the stage first.
  setWanted(police, 0);
  police.cruisers = [];
  police.roadblocks = [];
  state.shot = id;

  if (id === 'cover') {
    // On foot in the plaza, tower and bay behind, title moment.
    player.car = null;
    player.onFoot = true;
    player.x = 820;
    player.y = 990;
    player.angle = -Math.PI / 4;
    player.speed = 0;
    camera.follow(player);
    return { id, label: SHOT_LABELS.cover };
  }

  if (id === 'roam') {
    // Behind the wheel on the east avenue.
    putPlayerInCar(game, 2350, 1550, 0);
    camera.follow(player);
    return { id, label: SHOT_LABELS.roam };
  }

  if (id === 'mission') {
    // Bay Getaway in progress: racing for the east pier boat.
    putPlayerInCar(game, 2100, 1900, Math.PI / 4);
    missions.start('m3');
    camera.follow(player);
    return { id, label: SHOT_LABELS.mission };
  }

  // chase: four stars, two cruisers closing in.
  putPlayerInCar(game, 1850, 1550, 0);
  setWanted(police, 4);
  state.wanted = police.wanted;
  spawnCruiser(police, player.x - 260, player.y - 60);
  spawnCruiser(police, player.x + 180, player.y + 220);
  camera.follow(player);
  return { id, label: SHOT_LABELS.chase };
}
