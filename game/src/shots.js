// Solmar Bay — screenshot camera definitions for the dossier pipeline.
// Each shot stages the game into a scene the judge can read at a glance:
// cover (city + title), roam (on foot / by car), mission (a job in
// progress), chase (police chase at high wanted level).
export const SHOT_DEFS = [
  {
    id: '1-cover', file: '1-cover.png', label: 'Solmar Bay — open-world crime game',
    setup: (state) => {
      state.player.x = 820; state.player.y = 1050; state.player.onFoot = true;
      state.player.wanted = 0;
      state.message = 'SOLMAR BAY — drive, steal cars, dodge the Solmar PD';
    },
  },
  {
    id: '2-roam', file: '2-roam.png', label: 'Roaming Solmar Bay on foot and by car',
    setup: (state) => {
      state.player.x = 1350; state.player.y = 1150; state.player.onFoot = false;
      state.player.car = { x: 1350, y: 1150, angle: 0, taken: true };
      state.player.angle = 0; state.player.speed = 120;
      state.player.wanted = 0;
      state.message = 'Cruising the avenues — traffic, pedestrians, neon';
    },
  },
  {
    id: '3-mission', file: '3-mission.png', label: 'First Fare — a job in progress',
    setup: (state) => {
      state.missionsApi.startMission('m1');
      state.player.x = 820; state.player.y = 990; state.player.onFoot = true;
      state.player.wanted = 1;
      state.message = 'First Fare — reach the plaza pickup';
    },
  },
  {
    id: '4-chase', file: '4-chase.png', label: 'Four-star chase — the Solmar PD closes in',
    setup: (state) => {
      state.policeApi.setWanted(4);
      state.player.x = 1850; state.player.y = 1150; state.player.onFoot = false;
      state.player.car = { x: 1850, y: 1150, angle: 0, taken: true };
      state.player.angle = 0; state.player.speed = 220;
      state.policeApi.spawnCruiser(1790, 1100);
      state.policeApi.spawnCruiser(1930, 1210);
      state.policeApi.spawnCruiser(1850, 1000);
      state.message = '4 stars — PIT maneuver incoming';
    },
  },
];

export function applyShot(state, id) {
  const shot = SHOT_DEFS.find((s) => s.id === id);
  if (!shot) return false;
  shot.setup(state);
  return true;
}
