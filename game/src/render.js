// Solmar Bay — Canvas 2D renderer. Imports config + random only.
// Everything draws in world coordinates; the camera clips to the viewport.
import { WORLD_W, WORLD_H, WATERLINE, ROADS, PLAZA, SUN, CLOUDS, COLORS } from './config.js';
import { makeRng, hashSeed } from './random.js';

// Cloud shadows are seeded too, so they drift identically every run.
const CLOUD_SEED = makeRng(hashSeed('solmar-clouds'));
const CLOUD_LIST = [];
for (let i = 0; i < CLOUDS.count; i++) {
  CLOUD_LIST.push({
    x: CLOUD_SEED.float(0, WORLD_W),
    y: CLOUD_SEED.float(0, WATERLINE),
    r: CLOUD_SEED.float(CLOUDS.minR, CLOUDS.maxR),
    speed: CLOUD_SEED.float(0.6, 1.4),
  });
}

export function makeCamera(w, h) {
  return {
    x: 0,
    y: 0,
    w,
    h,
    // Centre the view on a world point, clamped inside the map.
    follow(tx, ty) {
      this.x = Math.max(0, Math.min(WORLD_W - this.w, tx - this.w / 2));
      this.y = Math.max(0, Math.min(WORLD_H - this.h, ty - this.h / 2));
    },
  };
}

function shadowOffset() {
  return { dx: Math.cos(SUN.angle) * SUN.length, dy: Math.sin(SUN.angle) * SUN.length };
}

function drawShadowRect(ctx, x, y, w, h) {
  const o = shadowOffset();
  ctx.fillStyle = SUN.color;
  ctx.fillRect(x - w / 2 + o.dx, y - h / 2 + o.dy, w, h);
}

function drawBuilding(ctx, b, t) {
  drawShadowRect(ctx, b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.facade;
  ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  // Window grid: some panes catch the sun and glow.
  const cols = Math.max(2, Math.floor(b.w / 22));
  const rows = Math.max(2, Math.floor(b.h / 20));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = b.x - b.w / 2 + 8 + c * ((b.w - 16) / cols);
      const wy = b.y - b.h / 2 + 8 + r * ((b.h - 16) / rows);
      const lit = (c * 7 + r * 13 + b.storeys) % 5 === 0;
      ctx.fillStyle = lit ? COLORS.glassLit : COLORS.glass;
      ctx.fillRect(wx, wy, 9, 11);
    }
  }
  // Neon sign strip along the roofline.
  if (b.neon) {
    ctx.fillStyle = b.neonColor;
    ctx.fillRect(b.x - b.w / 2 + 6, b.y - b.h / 2 - 4, b.w - 12, 5);
  }
  // The tower gets its gold sign and a pulsing beacon ring.
  if (b.landmark) {
    ctx.save();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SOLMAR', b.x, b.y);
    const pulse = 1 + 0.12 * Math.sin(t * 2);
    ctx.strokeStyle = 'rgba(255,217,77,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, (Math.max(b.w, b.h) / 2 + 18) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTree(ctx, tr) {
  const o = shadowOffset();
  ctx.fillStyle = SUN.color;
  ctx.beginPath();
  ctx.ellipse(tr.x + o.dx, tr.y + o.dy, tr.r, tr.r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.trunk;
  ctx.fillRect(tr.x - 2, tr.y - 2, 4, 6);
  ctx.fillStyle = tr.kind === 2 ? COLORS.treeDark : COLORS.tree;
  ctx.beginPath();
  ctx.arc(tr.x, tr.y - 4, tr.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.tree;
  ctx.beginPath();
  ctx.arc(tr.x - tr.r * 0.35, tr.y - tr.r * 0.45, tr.r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoat(ctx, boat, t) {
  const bob = Math.sin(t * 0.9 + boat.bob) * 3;
  const y = boat.y + bob;
  ctx.fillStyle = SUN.color;
  ctx.beginPath();
  ctx.ellipse(boat.x + 6, y + 8, boat.len / 2, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = boat.hue;
  ctx.beginPath();
  ctx.ellipse(boat.x, y, boat.len / 2, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.glass;
  ctx.beginPath();
  ctx.ellipse(boat.x - boat.len * 0.12, y - 2, boat.len * 0.16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wake trailing behind.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(boat.x - boat.len / 2 - 4, y + 4);
  ctx.lineTo(boat.x - boat.len / 2 - 26, y + 10);
  ctx.stroke();
}

function drawParkedCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = SUN.color;
  ctx.fillRect(-17, -8, 36, 18);
  ctx.fillStyle = car.color;
  ctx.fillRect(-18, -10, 36, 20);
  ctx.fillStyle = COLORS.glass;
  ctx.fillRect(-4, -8, 10, 16);
  ctx.fillStyle = COLORS.glassLit;
  ctx.fillRect(12, -8, 3, 16);
  ctx.restore();
}

// Draw the whole scene for camera `cam` at time `t` (seconds).
// `ctx` is a Canvas 2D context. Draws ground, water, roads, plaza,
// buildings, trees, lamps, benches, boats, parked cars, cloud shadows.
export function drawWorld(ctx, world, cam, t) {
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD_W, cam.x + cam.w + 40);
  const y1 = Math.min(WORLD_H, cam.y + cam.h + 40);

  // Ground.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Sand strip, then water.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(x0, WATERLINE - 26, x1 - x0, 26);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0, WATERLINE, x1 - x0, y1 - Math.max(y0, WATERLINE));
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(x0, WATERLINE + 130, x1 - x0, Math.max(0, y1 - (WATERLINE + 130)));

  // Sidewalks under the roads, then the carriageways.
  const half = ROADS.width / 2;
  ctx.fillStyle = COLORS.sidewalk;
  for (const vx of ROADS.vertical) ctx.fillRect(vx - half - 8, y0, ROADS.width + 16, Math.min(y1, WATERLINE) - y0);
  for (const hy of ROADS.horizontal) ctx.fillRect(x0, hy - half - 8, x1 - x0, ROADS.width + 16);
  ctx.fillStyle = COLORS.road;
  for (const vx of ROADS.vertical) ctx.fillRect(vx - half, y0, ROADS.width, Math.min(y1, WATERLINE) - y0);
  for (const hy of ROADS.horizontal) ctx.fillRect(x0, hy - half, x1 - x0, ROADS.width);
  // Dashed centre lines.
  ctx.fillStyle = COLORS.roadLine;
  for (const vx of ROADS.vertical) {
    for (let y = Math.floor(y0 / 44) * 44; y < Math.min(y1, WATERLINE); y += 44) {
      ctx.fillRect(vx - 2, y, 4, 22);
    }
  }
  for (const hy of ROADS.horizontal) {
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
      ctx.fillRect(x, hy - 2, 22, 4);
    }
  }

  // Central plaza.
  ctx.fillStyle = COLORS.plaza;
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.sidewalk;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Fountains with an animated ripple.
  for (const f of world.fountains) {
    ctx.fillStyle = COLORS.fountainDeep;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.fountain;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r - 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 10 + 4 * Math.sin(t * 2 + f.x), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const b of world.buildings) drawBuilding(ctx, b, t);
  for (const tr of world.trees) drawTree(ctx, tr);

  // Lamps: pole plus a warm glow dot.
  for (const l of world.lamps) {
    ctx.fillStyle = '#2c2c30';
    ctx.fillRect(l.x - 1, l.y - 1, 2, 8);
    ctx.fillStyle = COLORS.lampGlow;
    ctx.beginPath();
    ctx.arc(l.x, l.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Benches.
  for (const bn of world.benches) {
    ctx.save();
    ctx.translate(bn.x, bn.y);
    ctx.rotate(bn.rot);
    ctx.fillStyle = COLORS.bench;
    ctx.fillRect(-14, -4, 28, 8);
    ctx.fillStyle = '#6d4f30';
    ctx.fillRect(-14, -4, 28, 3);
    ctx.restore();
  }

  for (const boat of world.boats) drawBoat(ctx, boat, t);
  for (const car of world.parkedCars) drawParkedCar(ctx, car);

  // Drifting cloud shadows over everything.
  ctx.fillStyle = COLORS.cloud;
  for (const c of CLOUD_LIST) {
    const span = WORLD_W + c.r * 4;
    const cx = ((c.x + t * CLOUDS.speed * c.speed) % span) - c.r * 2;
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.r, c.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Minimap into rect (x, y, w, h). px,py = player world position (white dot).
export function drawMinimap(ctx, world, px, py, x, y, w, h) {
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x, y, w, WATERLINE * sy);
  ctx.fillStyle = COLORS.road;
  for (const vx of ROADS.vertical) ctx.fillRect(x + vx * sx - 1, y, 2, WATERLINE * sy);
  for (const hy of ROADS.horizontal) ctx.fillRect(x, y + hy * sy - 1, w, 2);
  for (const b of world.buildings) {
    ctx.fillStyle = b.landmark ? '#ffd94d' : '#e8e4d8';
    ctx.fillRect(x + (b.x - b.w / 2) * sx, y + (b.y - b.h / 2) * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + px * sx, y + py * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + px * sx, y + py * sy, 3, 0, Math.PI * 2);
  ctx.stroke();
}
