// Solmar Bay (v5) — every number the game agrees on, in one place.
// One job: hold the constants so the modules never disagree about the city.
//
// v5 vs v4: fills the holes v4 referenced but never defined (reverse accel,
// steal/punch wanted, punch cooldown and arc), adds a per-star wanted table,
// mission timers, a day/night cycle, named districts, and a camera model.

export const VIEW = { w: 1280, h: 720 };
export const WORLD = { w: 3200, h: 2400 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmarbay-save-v2';
export const SEEDS = { world: 1337, traffic: 9001, peds: 4242 };

// --- road network -----------------------------------------------------------
export const ROADS_X = [320, 820, 1320, 1820, 2320, 2820];
export const ROADS_Y = [300, 760, 1220, 1680, 2140];
export const ROAD_HALF = 34;
export const LANE_OFFSET = 17; // right-hand lane centre, measured from the centreline
export const BEACH_TOP = 2140;
export const SEA_TOP = 2240;
export const MARINA_LEFT = 2900;
export const PIER = { x: 2960, y: 2140, w: 120, h: 190 };

// --- districts --------------------------------------------------------------
// Each block of the city belongs to one district; the world builder picks
// building palettes and density from the district under the block. The seven
// districts tile the whole map with no gaps, so every lookup finds one.
export const DISTRICTS = [
  { id: 'oldtown', name: 'Old Town', x0: 0, y0: 0, x1: 820, y1: 1220, palette: 'brick', density: 2 },
  { id: 'downtown', name: 'Downtown', x0: 820, y0: 0, x1: 1820, y1: 1220, palette: 'city', density: 2 },
  { id: 'hillside', name: 'Hillside', x0: 1820, y0: 0, x1: 3200, y1: 1220, palette: 'suburb', density: 1 },
  { id: 'southside', name: 'Southside', x0: 0, y0: 1220, x1: 2320, y1: 2140, palette: 'suburb', density: 1 },
  { id: 'docks', name: 'The Docks', x0: 2320, y0: 1220, x1: 2820, y1: 2140, palette: 'industrial', density: 1 },
  { id: 'marina', name: 'Marina', x0: 2820, y0: 1220, x1: 3200, y1: 2140, palette: 'marina', density: 1 },
  { id: 'beach', name: 'Beachfront', x0: 0, y0: 2140, x1: 3200, y1: 2400, palette: 'sand', density: 0 },
];

export const PLACES = {
  downtown: { x: 1320, y: 760, label: 'Downtown' },
  marina: { x: 2980, y: 1220, label: 'Marina' },
  docks: { x: 2920, y: 1680, label: 'The Docks' },
  hospital: { x: 320, y: 1220, label: 'St. Anselm Hospital' },
  safehouse: { x: 320, y: 300, label: "Jax's Safehouse" },
  beach: { x: 1200, y: 2280, label: 'Solmar Beach' },
};

// --- palette ----------------------------------------------------------------
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
  danger: '#ff5c5c',
  money: '#7ddb8a',
};

// --- day / night ------------------------------------------------------------
// One full day lasts DAY.lengthSec seconds of play. Phase 0 = midnight.
export const DAY = {
  lengthSec: 240,
  dawn: 0.24,
  noon: 0.5,
  dusk: 0.76,
  nightTint: 'rgba(10, 14, 42, 0.34)',
  duskTint: 'rgba(64, 32, 16, 0.18)',
};

// --- player -----------------------------------------------------------------
export const PLAYER = {
  health: 100,
  radius: 13,
  walkSpeed: 175,
  runSpeed: 285,
  punchDamage: 25,
  punchRange: 36,
  punchArc: 1.1, // radians either side of facing; v4 used this but never defined it
  punchCooldown: 0.45,
  enterRange: 52,
};

// --- cars -------------------------------------------------------------------
export const CAR = {
  maxSpeed: 560,
  accel: 430,
  brake: 780,
  reverseAccel: 300, // v4 drove backwards with an undefined constant
  maxReverse: 170,
  turnRate: 2.7,
  radius: 24,
  health: 100,
  crashDamageSpeed: 200,
  crashDamage: 12,
};

// --- traffic & pedestrians --------------------------------------------------
export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const TRAFFIC = {
  cruiseMin: 150,
  cruiseMax: 230,
  followGap: 70,
  waypointMin: 350,
  waypointMax: 900,
  turnChance: 0.35, // odds a waypoint turns onto the crossing road
};
export const PED = {
  walkMin: 45,
  walkMax: 78,
  fleeSpeed: 150,
  panicRadius: 130,
  punchPanicRadius: 60,
  downTime: 2.5,
  hitDownTime: 3,
  idleChance: 0.2, // odds a ped pauses to idle instead of walking on
};

// --- wanted -----------------------------------------------------------------
export const MAX_POLICE = 5;
export const WANTED = {
  max: 5,
  decayPerSec: 0.25, // drains only once the heat is off; see entities.stepWanted
  decayDelaySec: 6, // seconds after the last crime before decay may start
  stealAdd: 1, // v4 added this to wanted but never defined the value
  punchAdd: 1,
  hitPedAdd: 1,
  crashAdd: 0.2,
  // Per-star police response: cruisers on the road, their top speed, ram damage.
  levels: [
    null,
    { police: 1, speed: 470, ram: 8 },
    { police: 2, speed: 500, ram: 10 },
    { police: 3, speed: 520, ram: 12 },
    { police: 4, speed: 545, ram: 14 },
    { police: 5, speed: 570, ram: 16 },
  ],
};

// --- police -----------------------------------------------------------------
export const POLICE = {
  spawnDistance: 650,
  despawnDistance: 1100,
  chaseTurn: 2.8,
  ramRange: 34,
  ramSpeed: 120,
  ramDamagePerSec: 14,
  sirenAtStars: 1,
  giveUpDistance: 1400, // a cruiser that falls this far behind gives up
};

// --- missions ---------------------------------------------------------------
export const MISSIONS = {
  fareTimeoutSec: 75, // street fares expire if you dawdle
  jobTimeoutSec: 240, // crew jobs give you four minutes
  farePayMin: 40,
  farePayMax: 120,
  jobPay: 350,
};

// --- camera, effects, economy ----------------------------------------------
export const SKID_MAX = 220;
export const CAMERA = { lookahead: 0.35, smoothing: 6 };
export const ECONOMY = { startCash: 50 };
