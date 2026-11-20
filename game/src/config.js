// Solmar Bay — world constants. Plain data only, no imports.
// All numbers are design decisions for a sun-soaked coastal city:
// a road grid, a waterfront at the south edge, a central plaza.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const SEED = 424242;
export const VIEW_W = 1280;
export const VIEW_H = 720;

// South of this y the map is water (marina, boats, pier).
export const WATERLINE = 2100;

// Road grid: 6 north-south avenues, 5 east-west streets, 96px wide.
export const ROADS = {
  width: 96,
  vertical: [350, 850, 1350, 1850, 2350, 2850],
  horizontal: [350, 750, 1150, 1550, 1950],
};

// The landmark tower. x/y is its centre; w/h its footprint.
export const TOWER = { x: 1377, y: 978, w: 155, h: 85, storeys: 24, name: 'SOLMAR' };

// Two plaza fountains; the plaza itself is centred between them.
export const FOUNTAINS = [{ x: 570, y: 990 }, { x: 1070, y: 990 }];
export const PLAZA = { x: 820, y: 990, r: 150 };

// Low afternoon sun: shadows fall long toward the south-west.
export const SUN = { angle: 2.45, length: 46, color: 'rgba(40,24,8,0.28)' };

// Drifting cloud shadows that slide across the city.
export const CLOUDS = { count: 8, speed: 7, minR: 90, maxR: 210 };

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  sand: '#e3d194',
  water: '#2e7fa8',
  waterDeep: '#1f5f86',
  road: '#3c3f46',
  roadLine: '#e8e4c8',
  sidewalk: '#b9b3a4',
  plaza: '#c9bfa5',
  facades: ['#c96f4a', '#d9a441', '#7d9bb5', '#b56a7e', '#8a9a5b', '#a980c9', '#5b8a8a'],
  glass: '#2c3e50',
  glassLit: '#ffd97a',
  neon: ['#ff5da2', '#37e0ff', '#ffe14d', '#7dff5e', '#ff7a3d'],
  tower: '#8a6d3b',
  towerGlass: '#3d5a74',
  tree: '#3f7a37',
  treeDark: '#2f6129',
  trunk: '#6b4a2b',
  lampGlow: '#ffe9a8',
  bench: '#8a6a45',
  fountain: '#4db2d8',
  fountainDeep: '#2b7ea3',
  cloud: 'rgba(20,30,10,0.10)',
  shadow: 'rgba(30,18,6,0.30)',
};
