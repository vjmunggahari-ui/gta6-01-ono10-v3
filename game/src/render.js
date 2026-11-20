// Solmar Bay — top-down renderer (plain Canvas 2D).
// drawWorld draws the whole city in WORLD coordinates: it translates by the
// camera itself, so callers pass the camera and draw in screen space after.
// Only plain rects, arcs and ellipses are used for shapes.

import {
  WORLD_W, WORLD_H, VIEW_W, VIEW_H, WATERLINE, COLORS, SUN, CLOUDS, ROADS,
  PLAZA, TOWER,
} from './config.js';
import { makeRng } from './random.js';

export function makeCamera(w, h) {
  const cam = {
    x: 0, y: 0, w, h,
    follow(tx, ty) {
      cam.x = Math.max(0, Math.min(WORLD_W - cam.w, tx - cam.w / 2));
      cam.y = Math.max(0, Math.min(WORLD_H - cam.h, ty - cam.h / 2));
    },
  };
  return cam;
}

function sunOffset() {
  return {
    dx: Math.cos(SUN.angle) * SUN.length,
    dy: Math.sin(SUN.angle) * SUN.length,
  };
}

function drawShadow(ctx, x, y, w, h) {
  const o = sunOffset();
  ctx.fillStyle = SUN.color;
  ctx.fillRect(x + o.dx - w / 2, y + o.dy - h / 2, w, h);
}

function drawRoads(ctx) {
  // Sidewalk beds first (slightly wider), then asphalt, then dashes.
  ctx.fillStyle = COLORS.sidewalk;
  for (const vx of ROADS.vertical) {
    ctx.fillRect(vx - ROADS.width / 2 - 10, 0, ROADS.width + 20, WATERLINE);
  }
  for (const hy of ROADS.horizontal) {
    ctx.fillRect(0, hy - ROADS.width / 2 - 10, WORLD_W, ROADS.width + 20);
  }
  ctx.fillStyle = COLORS.road;
  for (const vx of ROADS.vertical) {
    ctx.fillRect(vx - ROADS.width / 2, 0, ROADS.width, WATERLINE);
  }
  for (const hy of ROADS.horizontal) {
    ctx.fillRect(0, hy - ROADS.width / 2, WORLD_W, ROADS.width);
  }
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const vx of ROADS.vertical) {
    ctx.moveTo(vx, 0);
    ctx.lineTo(vx, WATERLINE);
  }
  for (const hy of ROADS.horizontal) {
    ctx.moveTo(0, hy);
    ctx.lineTo(WORLD_W, hy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBuilding(ctx, b, t) {
  drawShadow(ctx, b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.facade;
  ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  // Roof inner panel.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.fillRect(b.x - b.w / 2 + 7, b.y - b.h / 2 + 7, b.w - 14, b.h - 14);
  // Window grid: some windows lit.
  const cols = Math.max(2, Math.floor(b.w / 22));
  const rows = Math.max(2, Math.floor(b.h / 20));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const wx = b.x - b.w / 2 + 12 + i * ((b.w - 24) / Math.max(1, cols - 1));
      const wy = b.y - b.h / 2 + 11 + j * ((b.h - 22) / Math.max(1, rows - 1));
      const lit = ((i * 7 + j * 13 + b.storeys) % 5) === 0;
      ctx.fillStyle = lit ? COLORS.glassLit : b.glass;
      ctx.fillRect(wx - 4, wy - 4, 8, 8);
    }
  }
  if (b.neon) {
    ctx.fillStyle = b.neonColor;
    ctx.fillRect(b.x - b.w / 2 + 10, b.y - b.h / 2 - 5, Math.min(64, b.w - 20), 6);
  }
  if (b.tower) {
    // Landmark block: gold SOLMAR sign + pulsing beacon ring.
    // Save/restore so textAlign/textBaseline never leak into HUD text.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd97a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(TOWER.name, b.x, b.y - 6);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - b.w / 2 + 4, b.y - b.h / 2 + 4, b.w - 8, b.h - 8);
    const pulse = 1 + 0.12 * Math.sin(t / 500);
    ctx.beginPath();
    ctx.arc(b.x, b.y, (b.w / 2 + 16) * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 217, 122, 0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

function drawTree(ctx, tr) {
  const o = sunOffset();
  ctx.fillStyle = SUN.color;
  ctx.beginPath();
  ctx.ellipse(tr.x + o.dx, tr.y + o.dy, tr.r, tr.r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.trunk;
  ctx.fillRect(tr.x - 2, tr.y - 2, 4, 8);
  ctx.fillStyle = tr.shade ? COLORS.treeDark : COLORS.tree;
  ctx.beginPath();
  ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.beginPath();
  ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.3, tr.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

export function drawWorld(ctx, world, cam, t) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Grass base + darker seeded patches.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const patchRng = makeRng(world.seed ^ 0x9e3779b9);
  ctx.fillStyle = COLORS.grassDark;
  for (let i = 0; i < 26; i++) {
    const px = patchRng.float(80, WORLD_W - 80);
    const py = patchRng.float(80, WATERLINE - 80);
    const pr = patchRng.float(50, 150);
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.6, patchRng.float(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }

  // Beach strip + bay.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, WATERLINE - 40, WORLD_W, 40);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(0, WATERLINE, WORLD_W, WORLD_H - WATERLINE);
  ctx.fillStyle = COLORS.waterDeep;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(0, WATERLINE + 60 + i * 52, WORLD_W, 18);
  }
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const wy = WATERLINE + 30 + i * 46 + Math.sin(t / 900 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(0, wy);
    for (let x = 0; x <= WORLD_W; x += 160) {
      ctx.lineTo(x + 80, wy + Math.sin(t / 700 + x / 90 + i) * 5);
      ctx.lineTo(x + 160, wy);
    }
    ctx.stroke();
  }

  drawRoads(ctx);

  // Plaza: paved circle + ring.
  ctx.fillStyle = COLORS.plaza;
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r - 2, 0, Math.PI * 2);
  ctx.stroke();

  // Fountains.
  for (const f of world.fountains) {
    ctx.fillStyle = COLORS.fountainDeep;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.fountain;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 5 + Math.sin(t / 400) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings (tower first, it is buildings[0]).
  for (const b of world.buildings) drawBuilding(ctx, b, t);

  // Trees, lamps, benches.
  for (const tr of world.trees) drawTree(ctx, tr);
  for (const l of world.lamps) {
    ctx.fillStyle = COLORS.trunk;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = COLORS.lampGlow;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const bn of world.benches) {
    ctx.save();
    ctx.translate(bn.x, bn.y);
    ctx.rotate(bn.angle);
    ctx.fillStyle = COLORS.bench;
    ctx.fillRect(-14, -4, 28, 8);
    ctx.restore();
  }

  // Boats in the bay.
  for (const bo of world.boats) {
    ctx.save();
    ctx.translate(bo.x, bo.y);
    ctx.rotate(bo.angle);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.ellipse(0, 0, bo.len / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f4a63';
    ctx.fillRect(-8, -5, 16, 10);
    ctx.restore();
  }

  // Parked cars.
  for (const c of world.parkedCars) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.fillStyle = COLORS.glass;
    ctx.fillRect(-6, -c.h / 2 + 3, 12, c.h - 6);
    ctx.restore();
  }

  // Drifting cloud shadows.
  const cloudRng = makeRng(world.seed ^ 0x51ed27);
  ctx.fillStyle = COLORS.cloud;
  for (let i = 0; i < CLOUDS.count; i++) {
    const baseX = cloudRng.float(0, WORLD_W);
    const baseY = cloudRng.float(0, WATERLINE);
    const r = cloudRng.float(CLOUDS.minR, CLOUDS.maxR);
    const cx = ((baseX + t * CLOUDS.speed / 1000 + 200) % (WORLD_W + 400)) - 200;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawMinimap(ctx, world, px, py, x, y, w, h) {
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 18, 0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x, y + WATERLINE * sy, w, (WORLD_H - WATERLINE) * sy);
  ctx.fillStyle = COLORS.road;
  for (const vx of ROADS.vertical) {
    ctx.fillRect(x + vx * sx - 1, y, 2, WATERLINE * sy);
  }
  for (const hy of ROADS.horizontal) {
    ctx.fillRect(x, y + hy * sy - 1, w, 2);
  }
  ctx.fillStyle = '#ffd97a';
  ctx.fillRect(x + TOWER.x * sx - 2, y + TOWER.y * sy - 2, 4, 4);
  // Viewport frame.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // Player dot.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + px * sx, y + py * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
