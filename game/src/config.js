// Solmar Bay — world constants. Single source of truth for every module.
export const SEED = 121212;
export const WORLD = { w: 3200, h: 2400 };
export const WATERLINE = 2100; // y >= WATERLINE is the bay (water)
export const ROAD_W = 64;

export const VERTICAL_ROADS = [350, 850, 1350, 1850, 2350, 2850];
export const HORIZONTAL_ROADS = [350, 750, 1150, 1550, 1950];

export const PLAZA = { x: 820, y: 990, r: 150 };
export const TOWER = { x: 1377, y: 978, w: 155, h: 85, storeys: 24 };
export const FOUNTAINS = [{ x: 570, y: 990 }, { x: 1070, y: 990 }];

export const COUNTS = {
  buildings: 20,
  trees: 103,
  lamps: 30,
  benches: 19,
  boats: 6,
  parkedCars: 10,
};

export const VIEW = { w: 1280, h: 720 };
export const MINIMAP = { w: 200, h: 140 };

export const SUN = { angle: -0.55, length: 90 }; // low sun, long shadows
