// Solmar Bay — engine configuration.
// Every value below is authored for rebuild11 from the design spec.
// City: 3200x2400, sun-soaked coastal city, water along the south edge.

export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Deterministic world seed. Same seed => same city, every run.
export const SEED = 770011;

// Viewport (the game canvas is 1280x720).
export const VIEW_W = 1280;
export const VIEW_H = 720;

// Water starts at this y; everything at y >= WATERLINE is the bay / marina.
export const WATERLINE = 2100;

// Palette. Keys are the full set render.js draws with.
export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  sand: '#d9c48f',
  water: '#2e7fa8',
  waterDeep: '#1d5f86',
  road: '#3a3f46',
  roadLine: '#e8d44f',
  sidewalk: '#9aa0a6',
  plaza: '#b8a88e',
  facades: ['#c9a06a', '#b98a5e', '#8fa3b8', '#a87f7f', '#7f9a8a', '#c2b280', '#9a8fb5'],
  glass: '#2f4a63',
  glassLit: '#ffd97a',
  neon: ['#ff5da2', '#37e0ff', '#ffe14d', '#7dff6a', '#c07bff'],
  tower: '#d8b25e',
  towerGlass: '#3d5a78',
  tree: '#3f7d3a',
  treeDark: '#2f6130',
  trunk: '#6b4a2f',
  lampGlow: '#ffe9a8',
  bench: '#8a5a33',
  fountain: '#7fc4e0',
  fountainDeep: '#2e7fa8',
  cloud: 'rgba(20, 30, 40, 0.20)',
  shadow: 'rgba(30, 22, 10, 0.30)',
};

// Low late-afternoon sun: long shadows pointing down-left.
export const SUN = { angle: 2.45, length: 46, color: 'rgba(30, 22, 10, 0.30)' };

// Drifting cloud shadows.
export const CLOUDS = { count: 8, speed: 7, minR: 90, maxR: 210 };

// Road grid: 6 avenues, 5 streets, 96 px wide.
export const ROADS = {
  width: 96,
  vertical: [350, 850, 1350, 1850, 2350, 2850],
  horizontal: [350, 750, 1150, 1550, 1950],
};

// Solmar Tower landmark: 24 storeys, gold SOLMAR sign, beacon ring.
export const TOWER = { x: 1377, y: 978, w: 155, h: 85, storeys: 24, name: 'SOLMAR' };

// The two plaza fountains flanking the central plaza.
export const FOUNTAINS = [
  { x: 570, y: 990 },
  { x: 1070, y: 990 },
];

// Central plaza (open paved circle between the fountains).
export const PLAZA = { x: 820, y: 990, r: 150 };
