// Solmar Bay — every number the game agrees on, in one place.
// One job: hold the constants so the modules never disagree about the city.

export const VIEW = { w: 1280, h: 720 };
export const WORLD = { w: 3200, h: 2400 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmarbay-save-v1';
export const SEEDS = { world: 1337 };

export const ROADS_X = [320, 820, 1320, 1820, 2320, 2820];
export const ROADS_Y = [300, 760, 1220, 1680, 2140];
export const ROAD_HALF = 34;
export const BEACH_TOP = 2140;
export const SEA_TOP = 2240;
export const MARINA_LEFT = 2900;

export const COLORS = {
  grass: '#79a854',
  grassDark: '#6d9c49',
  road: '#333a45',
  sidewalk: '#8a8f7a',
  lane: '#e8e3c8',
  sand: '#d9c27a',
  sea: '#2e7fa8',
  seaDeep: '#1d5a7d',
  tree: '#4a7a3a',
  treeDark: '#3a6130',
  player: '#ffd23f',
  accent: '#ffb02e',
  hudBg: 'rgba(12, 16, 24, 0.78)',
  hudText: '#f4f1e6',
};

export const PLAYER = { health: 100, radius: 13, walkSpeed: 175, runSpeed: 280, punchDamage: 25, punchRange: 34 };
export const CAR = { maxSpeed: 560, accel: 420, brake: 760, reverseSpeed: 160, turnRate: 2.7, radius: 24, health: 100 };
export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const MAX_POLICE = 5;
export const WANTED = { max: 5, decayPerSec: 0.25, hitPedAdd: 1 };
