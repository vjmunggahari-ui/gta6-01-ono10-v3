// Solmar Bay — Canvas 2D rendering: city, camera, minimap.
import { WORLD, WATERLINE, ROAD_W, VERTICAL_ROADS, HORIZONTAL_ROADS, VIEW, MINIMAP, SUN } from './config.js';

// makeCamera() -> { x, y, w, h, follow(target) }
// follow centers the view on {x, y}, clamped inside the world.
export function makeCamera() {
  const cam = { x: 0, y: 0, w: VIEW.w, h: VIEW.h };
  cam.follow = (target) => {
    cam.x = Math.max(0, Math.min(WORLD.w - cam.w, target.x - cam.w / 2));
    cam.y = Math.max(0, Math.min(WORLD.h - cam.h, target.y - cam.h / 2));
  };
  return cam;
}

const SHADOW_DX = Math.cos(SUN.angle) * SUN.length;
const SHADOW_DY = Math.sin(SUN.angle) * SUN.length;

function drawGround(ctx, world, cam) {
  // Land: warm sun-baked ground.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
  // Bay: deep blue water with a sand strip at the shoreline.
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(cam.x, WATERLINE - 18, cam.w, 18);
  ctx.fillStyle = '#1f6f9f';
  ctx.fillRect(cam.x, WATERLINE, cam.w, WORLD.h - WATERLINE);
  // Water shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = WATERLINE + 30; y < WORLD.h; y += 70) {
    ctx.beginPath();
    ctx.moveTo(cam.x + 20, y);
    ctx.lineTo(cam.x + cam.w - 20, y);
    ctx.stroke();
  }
}

function drawRoads(ctx, cam) {
  ctx.fillStyle = '#3a3a40';
  for (const rx of VERTICAL_ROADS) {
    ctx.fillRect(rx - ROAD_W / 2, cam.y, ROAD_W, cam.h);
  }
  for (const ry of HORIZONTAL_ROADS) {
    ctx.fillRect(cam.x, ry - ROAD_W / 2, cam.w, ROAD_W);
  }
  // Center dashes.
  ctx.fillStyle = '#f5d76e';
  for (const rx of VERTICAL_ROADS) {
    for (let y = Math.floor(cam.y / 48) * 48; y < cam.y + cam.h; y += 48) {
      ctx.fillRect(rx - 2, y, 4, 24);
    }
  }
  for (const ry of HORIZONTAL_ROADS) {
    for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + cam.w; x += 48) {
      ctx.fillRect(x, ry - 2, 24, 4);
    }
  }
}

function drawPlaza(ctx, world) {
  const p = world.plaza;
  ctx.fillStyle = '#d8cfc0';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b8ab90';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r - 14, 0, Math.PI * 2);
  ctx.stroke();
  // Fountains: stone ring + blue water.
  for (const f of world.fountains) {
    ctx.fillStyle = '#9a938a';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fb3e8';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8f2ff';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuilding(ctx, b, isTower, time) {
  // Long low-sun shadow.
  ctx.fillStyle = 'rgba(60,40,20,0.30)';
  ctx.fillRect(b.x + SHADOW_DX, b.y + SHADOW_DY, b.w, b.h);
  // Body + roof.
  ctx.fillStyle = isTower ? '#8a7a5c' : `hsl(${b.hue}, 32%, 62%)`;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = isTower ? '#6d5f45' : `hsl(${b.hue}, 32%, 48%)`;
  ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  // Windows.
  ctx.fillStyle = 'rgba(255,244,180,0.85)';
  const cols = Math.max(1, Math.floor(b.w / 26));
  const rows = Math.max(1, Math.floor(b.h / 24));
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if ((c * 7 + r * 3) % 4 === 0) continue; // some windows dark
      ctx.fillRect(b.x + 10 + c * 26, b.y + 10 + r * 24, 12, 12);
    }
  }
  if (isTower) {
    // Gold SOLMAR sign across the tower face.
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR', b.x + b.w / 2, b.y + 34);
    // Beacon ring, pulsing.
    const pulse = 1 + 0.12 * Math.sin(time * 2);
    ctx.strokeStyle = '#ff2d78';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y - 10, 16 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  } else if (b.sign) {
    // Neon sign on the roofline.
    ctx.fillStyle = b.neon;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.sign, b.x + b.w / 2, b.y - 6);
  }
}

function drawTrees(ctx, world, cam) {
  for (const t of world.trees) {
    if (t.x < cam.x - 20 || t.x > cam.x + cam.w + 20) continue;
    if (t.y < cam.y - 20 || t.y > cam.y + cam.h + 20) continue;
    ctx.fillStyle = 'rgba(60,40,20,0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x + 10, t.y + 8, t.r, t.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ['#2f7a3d', '#3d8f4a', '#57a75a'][t.shade];
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStreetProps(ctx, world, cam) {
  // Lamps: pole + warm glow dot.
  for (const l of world.lamps) {
    if (l.x < cam.x - 10 || l.x > cam.x + cam.w + 10) continue;
    if (l.y < cam.y - 10 || l.y > cam.y + cam.h + 10) continue;
    ctx.fillStyle = '#555';
    ctx.fillRect(l.x - 2, l.y - 12, 4, 12);
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath();
    ctx.arc(l.x, l.y - 14, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Benches.
  for (const b of world.benches) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(-14, -4, 28, 8);
    ctx.restore();
  }
  // Parked cars.
  for (const c of world.parkedCars) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = c.color;
    ctx.fillRect(-16, -8, 32, 16);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
}

function drawBoats(ctx, world, time) {
  for (const b of world.boats) {
    const bob = Math.sin(time * 0.8 + b.phase) * 3;
    ctx.save();
    ctx.translate(b.x, b.y + bob);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-22, -7, 44, 14);
    ctx.fillStyle = '#d23b3b';
    ctx.fillRect(-22, -7, 10, 14);
    ctx.restore();
  }
}

function drawCloudShadows(ctx, world, time) {
  ctx.fillStyle = 'rgba(40,40,60,0.14)';
  for (const c of world.clouds) {
    const cx = ((c.x + time * c.speed) % (WORLD.w + 400)) - 200;
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.r, c.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// drawWorld(ctx, world, camera, timeSeconds): paints the visible city slice.
export function drawWorld(ctx, world, camera, time) {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, world, camera);
  drawRoads(ctx, camera);
  drawPlaza(ctx, world);
  for (const b of world.buildings) drawBuilding(ctx, b, false, time);
  drawBuilding(ctx, world.tower, true, time);
  drawTrees(ctx, world, camera);
  drawStreetProps(ctx, world, camera);
  drawBoats(ctx, world, time);
  drawCloudShadows(ctx, world, time);
  ctx.restore();
}

// drawMinimap(ctx, world, player): whole-city thumbnail, 200x140.
// player is optional {x, y} — drawn as a white dot when given.
export function drawMinimap(ctx, world, player) {
  const sx = MINIMAP.w / WORLD.w;
  const sy = MINIMAP.h / WORLD.h;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = '#1f6f9f';
  ctx.fillRect(0, WATERLINE, WORLD.w, WORLD.h - WATERLINE);
  ctx.fillStyle = '#3a3a40';
  for (const rx of VERTICAL_ROADS) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const ry of HORIZONTAL_ROADS) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.w, ROAD_W);
  ctx.fillStyle = '#d8cfc0';
  ctx.beginPath();
  ctx.arc(world.plaza.x, world.plaza.y, world.plaza.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a7a5c';
  ctx.fillRect(world.tower.x, world.tower.y, world.tower.w, world.tower.h);
  ctx.fillStyle = '#7a6a55';
  for (const b of world.buildings) ctx.fillRect(b.x, b.y, b.w, b.h);
  // Boats as white dots in the bay.
  ctx.fillStyle = '#ffffff';
  for (const b of world.boats) ctx.fillRect(b.x - 8, b.y - 8, 16, 16);
  ctx.restore();
  // The player dot is drawn in minimap space, outside the scaled block.
  if (player) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x * sx, player.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
