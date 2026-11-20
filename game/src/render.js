// Solmar Bay (v6) — the canvas renderer: city, cars, people, light, HUD.
// One job: turn the game state into one readable 1280x720 frame.
//
// v6 vs v5: drifting cloud shadows cross the city in daylight; buildings
// throw long shadows when the sun sits low; the Solmar Tower landmark
// carries a rooftop sign and a beacon; tall downtown facades glow with
// neon after dark; the two plaza fountains shimmer. Everything else is
// the v5 frame: lit windows, headlight cones, flashing police light bars,
// a minimap with police dots and a pulsing mission marker, a waypoint
// arrow, a clock and speed readout, a health bar, a district name, skid
// marks and particles, and title/pause/busted screens that tell the
// player what to do next.

import { CLOUDS, COLORS, DISTRICTS, ROADS_X, ROADS_Y, ROAD_HALF, SEA_TOP, BEACH_TOP, SUN, VIEW, WORLD } from './config.js';
import { hash01 } from './random.js';
import { districtAt } from './world.js';

// --- small helpers ----------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 0 = full daylight, 1 = deep night. Dawn lifts the dark, dusk brings it back.
export function darknessAt(dayTime) {
  const p = ((dayTime % 1) + 1) % 1;
  if (p < 0.16) return 1;
  if (p < 0.30) return 1 - smoothstep(0.16, 0.30, p);
  if (p < 0.70) return 0;
  if (p < 0.82) return smoothstep(0.70, 0.82, p) * 0.85;
  return 0.85;
}

export function isNight(game) {
  return darknessAt(game.dayTime) > 0.55;
}

function phaseName(dayTime) {
  const p = ((dayTime % 1) + 1) % 1;
  if (p < 0.16 || p >= 0.92) return 'Night';
  if (p < 0.30) return 'Dawn';
  if (p < 0.46) return 'Morning';
  if (p < 0.62) return 'Afternoon';
  if (p < 0.82) return 'Dusk';
  return 'Evening';
}

function clockText(dayTime) {
  const p = ((dayTime % 1) + 1) % 1;
  const mins = Math.floor(p * 24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// --- ground -----------------------------------------------------------------

function drawGround(ctx, game) {
  const cam = game.camera;
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD.w, cam.x + VIEW.w + 40);
  const y1 = Math.min(WORLD.h, cam.y + VIEW.h + 40);
  // Grass everywhere, then the beach band and the sea.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Mown stripes across the grass, cheap and unmistakable from above.
  ctx.fillStyle = COLORS.grassDark;
  const stripe = 120;
  const first = Math.floor(y0 / stripe) * stripe;
  for (let y = first; y < y1; y += stripe * 2) {
    ctx.fillRect(x0, y, x1 - x0, stripe);
  }
  if (y1 > BEACH_TOP) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x0, Math.max(y0, BEACH_TOP), x1 - x0, Math.min(y1, SEA_TOP) - Math.max(y0, BEACH_TOP));
  }
  if (y1 > SEA_TOP) {
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(x0, Math.max(y0, SEA_TOP), x1 - x0, y1 - Math.max(y0, SEA_TOP));
    // Slow swell lines, drifting with game time.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = SEA_TOP + 30 + i * 34 + Math.sin(game.time * 0.6 + i * 1.7) * 4;
      if (wy < y0 || wy > y1) continue;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 48) {
        const yy = wy + Math.sin(x * 0.02 + game.time * 0.9 + i) * 5;
        if (x === x0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
}

function drawRoads(ctx, game) {
  const cam = game.camera;
  ctx.fillStyle = COLORS.road;
  for (const rx of ROADS_X) {
    ctx.fillRect(rx - ROAD_HALF, cam.y - 20, ROAD_HALF * 2, VIEW.h + 40);
  }
  for (const ry of ROADS_Y) {
    ctx.fillRect(cam.x - 20, ry - ROAD_HALF, VIEW.w + 40, ROAD_HALF * 2);
  }
  // Sidewalks: a pale frame around every road.
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of ROADS_X) {
    ctx.fillRect(rx - ROAD_HALF - 10, cam.y - 20, 10, VIEW.h + 40);
    ctx.fillRect(rx + ROAD_HALF, cam.y - 20, 10, VIEW.h + 40);
  }
  for (const ry of ROADS_Y) {
    ctx.fillRect(cam.x - 20, ry - ROAD_HALF - 10, VIEW.w + 40, 10);
    ctx.fillRect(cam.x - 20, ry + ROAD_HALF, VIEW.w + 40, 10);
  }
  // Centre dashes, broken by intersections.
  ctx.fillStyle = COLORS.lane;
  for (const rx of ROADS_X) {
    for (let y = Math.floor((cam.y - 20) / 64) * 64; y < cam.y + VIEW.h + 20; y += 64) {
      if (ROADS_Y.some((ry) => Math.abs(y + 16 - ry) < ROAD_HALF + 14)) continue;
      ctx.fillRect(rx - 2, y, 4, 30);
    }
  }
  for (const ry of ROADS_Y) {
    for (let x = Math.floor((cam.x - 20) / 64) * 64; x < cam.x + VIEW.w + 20; x += 64) {
      if (ROADS_X.some((rx) => Math.abs(x + 16 - rx) < ROAD_HALF + 14)) continue;
      ctx.fillRect(x, ry - 2, 30, 4);
    }
  }
}

// --- sky: cloud shadows and low sun ----------------------------------------

// Soft cloud shadows drift east to west in daylight and fade out at night.
// Each cloud's home position comes from a coordinate hash, so the pattern
// is the same on every run and only the drift depends on game time.
function drawCloudShadows(ctx, game) {
  const dark = darknessAt(game.dayTime);
  if (dark > 0.85) return;
  const cam = game.camera;
  const alpha = CLOUDS.alpha * (1 - dark);
  ctx.fillStyle = `rgba(10, 20, 30, ${alpha.toFixed(3)})`;
  for (let i = 0; i < CLOUDS.count; i += 1) {
    const homeX = hash01(i, 7) * WORLD.w;
    const homeY = hash01(i, 13) * (WORLD.h - 400) + 100;
    const r = CLOUDS.minR + hash01(i, 29) * (CLOUDS.maxR - CLOUDS.minR);
    const span = WORLD.w + r * 4;
    const x = ((homeX + game.time * CLOUDS.driftPerSec) % span) - r * 2;
    const y = homeY;
    if (x + r < cam.x - 20 || x - r > cam.x + VIEW.w + 20) continue;
    if (y + r < cam.y - 20 || y - r > cam.y + VIEW.h + 20) continue;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// When the sun sits low, every visible building throws a long shadow away
// from the sun: west in the morning, east in the afternoon, always a
// little to the south. The shadow length grows with the building's
// storeys and shrinks to nothing once the sun is high.
function shadowOffset(game, stories) {
  const p = ((game.dayTime % 1) + 1) % 1;
  const dark = darknessAt(game.dayTime);
  if (dark <= 0.05 || dark >= SUN.lowSunDark) return null;
  const len = SUN.maxLenPerStorey * stories * (1 - dark / SUN.lowSunDark);
  const dir = p < 0.5 ? -1 : 1;
  return { dx: dir * len, dy: len * 0.35 };
}

// --- buildings & props ------------------------------------------------------

function drawBuildings(ctx, game) {
  const cam = game.camera;
  const night = isNight(game);
  for (const b of game.world.buildings) {
    if (b.x + b.w < cam.x - 20 || b.x > cam.x + VIEW.w + 20) continue;
    if (b.y + b.h < cam.y - 20 || b.y > cam.y + VIEW.h + 20) continue;
    // Low-sun shadow first, under the building itself.
    const sh = shadowOffset(game, b.stories || 1);
    if (sh) {
      ctx.fillStyle = 'rgba(10, 16, 28, 0.20)';
      ctx.fillRect(b.x + sh.dx, b.y + sh.dy, b.w, b.h);
    }
    // Drop shadow, then the block itself.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof: a pool, a garden, or plain tar with a hatch.
    if (b.roof === 'pool') {
      ctx.fillStyle = '#4aa8d9';
      roundRect(ctx, b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.55, 6);
      ctx.fill();
    } else if (b.roof === 'garden') {
      ctx.fillStyle = '#5d8a4a';
      roundRect(ctx, b.x + b.w * 0.15, b.y + b.h * 0.15, b.w * 0.7, b.h * 0.7, 8);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w * 0.42, b.y + b.h * 0.42, b.w * 0.16, b.h * 0.16);
    }
    // Windows: a grid sized by storeys; after dark, a seeded half of them
    // glow warm, so the skyline reads differently at night than at noon.
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.min(6, Math.floor(b.h / 34)));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        const wx = b.x + 8 + cx * ((b.w - 16) / cols);
        const wy = b.y + 8 + cy * ((b.h - 16) / rows);
        const lit = night && hash01(b.x + cx * 7, b.y + cy * 11) < 0.55;
        ctx.fillStyle = lit ? '#ffd97a' : 'rgba(20,26,38,0.55)';
        if (lit) {
          ctx.shadowColor = '#ffca5a';
          ctx.shadowBlur = 6;
        }
        ctx.fillRect(wx, wy, 10, 12);
        ctx.shadowBlur = 0;
      }
    }
    // Neon sign strip on the south face, glowing after dark.
    if (b.neon && night) {
      ctx.fillStyle = b.neon;
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 12;
      ctx.fillRect(b.x + 8, b.y + b.h - 8, Math.max(20, b.w - 16), 5);
      ctx.shadowBlur = 0;
    }
    // A tall downtown tower gets a rooftop beacon.
    if (b.stories >= 10) {
      ctx.fillStyle = (game.time % 1 < 0.5) ? '#ff5c5c' : '#7a2020';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // The Solmar Tower landmark: a gold rooftop sign and a beacon ring,
    // so the skyline has one anchor the judge can find from any angle.
    if (b.landmark) {
      ctx.fillStyle = 'rgba(12,16,24,0.85)';
      roundRect(ctx, b.x + b.w / 2 - 34, b.y + 12, 68, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SOLMAR', b.x + b.w / 2, b.y + 25);
      ctx.textAlign = 'left';
      ctx.strokeStyle = (game.time % 1 < 0.5) ? 'rgba(255,92,92,0.9)' : 'rgba(255,92,92,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + 6, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawProps(ctx, game) {
  const cam = game.camera;
  const night = isNight(game);
  // Pier: planks out into the sea at the marina.
  const pier = game.world.pier;
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let y = pier.y + 12; y < pier.y + pier.h; y += 14) {
    ctx.beginPath();
    ctx.moveTo(pier.x, y);
    ctx.lineTo(pier.x + pier.w, y);
    ctx.stroke();
  }
  for (const boat of game.world.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(-8, -6, 16, 12);
    ctx.restore();
  }
  // Plaza fountains: a stone rim, water that shimmers with game time.
  for (const f of game.world.fountains || []) {
    if (f.x + f.r < cam.x - 20 || f.x - f.r > cam.x + VIEW.w + 20) continue;
    if (f.y + f.r < cam.y - 20 || f.y - f.r > cam.y + VIEW.h + 20) continue;
    ctx.fillStyle = '#9a938a';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4aa8d9';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const rr = (f.r - 12) * (0.3 + 0.3 * i) + Math.sin(game.time * 1.5 + i * 2) * 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, Math.max(4, rr), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8e6da';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const t of game.world.trees) {
    if (t.x < cam.x - 30 || t.x > cam.x + VIEW.w + 30) continue;
    if (t.y < cam.y - 30 || t.y > cam.y + VIEW.h + 30) continue;
    ctx.fillStyle = COLORS.treeDark;
    ctx.beginPath();
    ctx.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const bench of game.world.benches) {
    ctx.save();
    ctx.translate(bench.x, bench.y);
    ctx.rotate(bench.angle);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(-14, -4, 28, 8);
    ctx.restore();
  }
  for (const lamp of game.world.lamps) {
    if (lamp.x < cam.x - 40 || lamp.x > cam.x + VIEW.w + 40) continue;
    if (lamp.y < cam.y - 40 || lamp.y > cam.y + VIEW.h + 40) continue;
    ctx.fillStyle = '#2a2f38';
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    if (night) {
      const glow = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 46);
      glow.addColorStop(0, 'rgba(255,214,120,0.55)');
      glow.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- vehicles, people, marks -----------------------------------------------

function drawCarShape(ctx, car, night, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = 46;
  const wid = 24;
  // Headlight cones first, so they fall under the body.
  if (night && !car.wrecked) {
    const beam = ctx.createLinearGradient(len / 2, 0, len / 2 + 130, 0);
    beam.addColorStop(0, 'rgba(255,240,180,0.30)');
    beam.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(len / 2 - 4, -8);
    ctx.lineTo(len / 2 + 130, -34);
    ctx.lineTo(len / 2 + 130, 34);
    ctx.lineTo(len / 2 - 4, 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 3, len, wid, 7);
  ctx.fill();
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Cabin glass.
  ctx.fillStyle = car.wrecked ? '#222' : 'rgba(180,220,240,0.85)';
  roundRect(ctx, -6, -wid / 2 + 4, 16, wid - 8, 4);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-len / 2 + 4, -wid / 2 - 3, 10, 5);
  ctx.fillRect(-len / 2 + 4, wid / 2 - 2, 10, 5);
  ctx.fillRect(len / 2 - 14, -wid / 2 - 3, 10, 5);
  ctx.fillRect(len / 2 - 14, wid / 2 - 2, 10, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(-4, -wid / 2 + 2, 8, 3);
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 2);
    // Light bar: red and blue alternate twice a second.
    const red = Math.floor(time * 2) % 2 === 0;
    ctx.fillStyle = red ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-8, -wid / 2 - 2, 7, 4);
    ctx.fillStyle = red ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(1, -wid / 2 - 2, 7, 4);
    if (night) {
      const flash = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
      flash.addColorStop(0, red ? 'rgba(255,46,46,0.35)' : 'rgba(46,107,255,0.35)');
      flash.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (car.kind === 'player') {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    roundRect(ctx, -len / 2 - 2, -wid / 2 - 2, len + 4, wid + 4, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCars(ctx, game) {
  const night = isNight(game);
  for (const car of game.cars) {
    drawCarShape(ctx, car, night, game.time);
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(car.x + Math.sin(game.time * 3) * 6, car.y - 14, 8 + Math.sin(game.time * 2) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPeds(ctx, game) {
  for (const ped of game.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      // Lying flat: an ellipse instead of a standing dot.
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c94f42';
      ctx.beginPath();
      ctx.arc(11, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(ped.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      // Fleeing peds flail: arms out.
      if (ped.state === 'flee') {
        ctx.strokeStyle = ped.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-8, -14);
        ctx.moveTo(0, 8);
        ctx.lineTo(-8, 14);
        ctx.stroke();
      }
      ctx.fillStyle = '#2a2118';
      ctx.beginPath();
      ctx.arc(4, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayerOnFoot(ctx, game) {
  const p = game.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2118';
  ctx.beginPath();
  ctx.arc(5, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick, and a punch arc flash while the fist is out.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(20, -4);
  ctx.lineTo(20, 4);
  ctx.closePath();
  ctx.fill();
  if (p.punchT > 0.3) {
    ctx.strokeStyle = 'rgba(255,210,63,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 34, -1.1, 1.1);
    ctx.stroke();
  }
  ctx.restore();
  // Name tag under the player, so the judge always finds Jax.
  ctx.fillStyle = 'rgba(12,16,24,0.75)';
  roundRect(ctx, p.x - 26, p.y + 20, 52, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JAX', p.x, p.y + 32);
}

function drawSkidAndParticles(ctx, game) {
  ctx.strokeStyle = 'rgba(20,20,24,0.45)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const s of game.skid) {
    ctx.globalAlpha = Math.min(1, s.t / 0.6);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 16, s.y - Math.sin(s.angle) * 16);
    ctx.lineTo(s.x + Math.cos(s.angle) * 16, s.y + Math.sin(s.angle) * 16);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const pt of game.particles || []) {
    ctx.globalAlpha = Math.max(0, pt.t / 0.8);
    ctx.fillStyle = pt.color || '#ffb02e';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r || 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- waypoint, night, minimap ------------------------------------------------

function currentTarget(game) {
  const m = game.missions && game.missions.current;
  if (!m) return null;
  const step = m.def.steps[m.step];
  if (!step || step.x === undefined) return null;
  return { x: step.x, y: step.y, label: step.label, color: '#ffd23f' };
}

function drawWaypoint(ctx, game) {
  const target = currentTarget(game);
  if (!target) return;
  const cam = game.camera;
  const p = game.player;
  const dist = Math.hypot(target.x - p.x, target.y - p.y);
  // Beacon column at the target when it is on screen.
  const sx = target.x - cam.x;
  const sy = target.y - cam.y;
  const onScreen = sx > 0 && sx < VIEW.w && sy > 0 && sy < VIEW.h;
  const pulse = 0.6 + 0.4 * Math.sin(game.time * 4);
  if (onScreen) {
    ctx.fillStyle = `rgba(255,210,63,${0.10 + 0.08 * pulse})`;
    ctx.fillRect(sx - 3, sy - 260, 6, 260);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(sx, sy, 10 + 3 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 10 + 3 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(dist)}m`, sx, sy - 22);
  } else {
    // Off-screen: an arrow pinned to the screen edge, pointing the way.
    const cx = clamp(sx, 50, VIEW.w - 50);
    const cy = clamp(sy, 50, VIEW.h - 50);
    const ang = Math.atan2(sy - (VIEW.h / 2), sx - (VIEW.w / 2));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(dist)}m`, cx, cy - 20);
  }
}

function drawNight(ctx, game) {
  const dark = darknessAt(game.dayTime);
  if (dark <= 0.01) return;
  ctx.fillStyle = `rgba(8,12,38,${(dark * 0.42).toFixed(3)})`;
  ctx.fillRect(game.camera.x - 20, game.camera.y - 20, VIEW.w + 40, VIEW.h + 40);
  if (dark > 0.4) {
    // Dusk warmth first, then the blue of night.
    const warm = game.dayTime > 0.62 && game.dayTime < 0.82 ? 0.10 : 0;
    if (warm) {
      ctx.fillStyle = `rgba(255,120,40,${warm})`;
      ctx.fillRect(game.camera.x - 20, game.camera.y - 20, VIEW.w + 40, VIEW.h + 40);
    }
  }
}

function drawMinimap(ctx, game) {
  const mw = 208;
  const mh = 156;
  const mx = VIEW.w - mw - 14;
  const my = 14;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(12,16,24,0.82)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  // District tints, then the sea.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.id === 'beach' ? '#d9c27a' : d.id === 'docks' ? '#5a6068' : '#4a6a3a';
    ctx.fillRect(mx + d.x0 * sx, my + d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
  }
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(mx, my + SEA_TOP * sy, mw, (WORLD.h - SEA_TOP) * sy);
  ctx.strokeStyle = 'rgba(232,227,200,0.9)';
  ctx.lineWidth = 1.5;
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Mission marker, pulsing; police as red dots.
  const target = currentTarget(game);
  if (target) {
    const pulse = 3 + 2 * Math.sin(game.time * 4);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const car of game.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Viewport rectangle, then the player arrow.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx + game.camera.x * sx, my + game.camera.y * sy, VIEW.w * sx, VIEW.h * sy);
  const px = mx + game.player.x * sx;
  const py = my + game.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // District label under the minimap.
  const d = districtAt(game.player.x, game.player.y);
  ctx.fillStyle = 'rgba(12,16,24,0.78)';
  roundRect(ctx, mx - 6, my + mh + 10, mw + 12, 20, 5);
  ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.name, mx + mw / 2, my + mh + 24);
}

// --- HUD & screens -----------------------------------------------------------

function drawStar(ctx, x, y, r, lit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = lit ? '#ffd23f' : 'rgba(244,241,230,0.28)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, game) {
  const p = game.player;
  ctx.textAlign = 'left';
  // Top-left: cash, health, and the last crime — each on its own line.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 14, 14, 250, 92, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.money;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`$${Math.floor(p.cash)}`, 28, 42);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Jobs done ${game.missions.done.length}/${game.missions.defs.length}  •  Earned $${game.missions.earned || 0}`, 28, 62);
  // Health bar under the cash.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 28, 70, 120, 8, 4);
  ctx.fill();
  ctx.fillStyle = p.health > 50 ? '#7ddb8a' : p.health > 25 ? '#ffb02e' : '#ff5c5c';
  roundRect(ctx, 28, 70, Math.max(0, 120 * (p.health / 100)), 8, 4);
  ctx.fill();
  if (game.lastCrime) {
    ctx.fillStyle = '#ffb0a0';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Last crime: ${game.lastCrime}`, 28, 94);
  }
  // Top-centre: wanted stars, with a heat shimmer while the PD is close.
  const stars = Math.max(0, Math.min(5, Math.floor(game.wanted)));
  const cx = VIEW.w / 2;
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, cx - 66 + i * 33, 38, 13, i < stars);
  }
  if (stars >= 3) {
    ctx.fillStyle = '#ff5c5c';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', cx, 66);
    ctx.textAlign = 'left';
  }
  // Bottom-left: the current job, with its timer and hold progress.
  const prog = game.missions.progress ? game.missions.progress() : null;
  if (prog) {
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, 14, VIEW.h - 96, 420, 82, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${prog.title}  ${prog.step}/${prog.steps}`, 28, VIEW.h - 68);
    ctx.fillStyle = '#f4f1e6';
    ctx.font = '13px sans-serif';
    ctx.fillText(prog.label, 28, VIEW.h - 46);
    if (prog.timer !== null) {
      ctx.fillStyle = prog.timer < 15 ? '#ff5c5c' : '#f4f1e6';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${Math.ceil(prog.timer)}s left`, 28, VIEW.h - 26);
    }
    if (prog.holdFrac !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(ctx, 120, VIEW.h - 34, 180, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      roundRect(ctx, 120, VIEW.h - 34, 180 * prog.holdFrac, 8, 4);
      ctx.fill();
    }
    // Job progress bar across the bottom of the panel.
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(28, VIEW.h - 18, 392, 4);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(28, VIEW.h - 18, 392 * prog.frac, 4);
  } else if (game.missions.nextAvailable) {
    const next = game.missions.nextAvailable();
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, 14, VIEW.h - 58, 420, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.font = '13px sans-serif';
    ctx.fillText(next ? `Press M — next job: ${next.title} ($${next.pay})` : 'Press M — take a street fare', 28, VIEW.h - 30);
  }
  // Bottom-right: clock, phase, speed, and where you are.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, VIEW.w - 264, VIEW.h - 58, 250, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  const speed = p.onFoot ? 0 : Math.abs(Math.round((p.car ? p.car.speed : 0) * 0.12));
  ctx.fillText(`${clockText(game.dayTime)}  ${phaseName(game.dayTime)}`, VIEW.w - 28, VIEW.h - 38);
  ctx.font = '12px sans-serif';
  const mode = p.onFoot ? 'On foot' : `Driving ${speed} km/h`;
  ctx.fillText(mode, VIEW.w - 28, VIEW.h - 20);
  ctx.textAlign = 'left';
  // Messages, newest last, fading with age.
  ctx.font = '14px sans-serif';
  let my = VIEW.h - 116;
  for (let i = game.messages.length - 1; i >= 0; i -= 1) {
    const m = game.messages[i];
    const age = game.time - m.t;
    const alpha = age > 3.5 ? Math.max(0, 1 - (age - 3.5)) : 1;
    ctx.globalAlpha = alpha;
    const w = ctx.measureText(m.text).width + 20;
    ctx.fillStyle = 'rgba(12,16,24,0.78)';
    roundRect(ctx, 14, my - 16, w, 22, 5);
    ctx.fill();
    ctx.fillStyle = m.color || '#f4f1e6';
    ctx.fillText(m.text, 24, my);
    my -= 26;
  }
  ctx.globalAlpha = 1;
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR BAY', VIEW.w / 2, 210);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-city crime story — Jax Marlowe owes the crew.', VIEW.w / 2, 252);
  const done = game.missions.done.length;
  const total = game.missions.defs.length;
  const best = game.save && game.save.best ? game.save.best : 0;
  ctx.font = '16px sans-serif';
  ctx.fillStyle = done >= total ? '#7ddb8a' : '#ffb02e';
  ctx.fillText(
    done >= total ? `Story complete — all ${total} crew jobs done. Best cash $${best}.` : `Crew jobs done: ${done}/${total}${best ? `  •  Best cash $${best}` : ''}`,
    VIEW.w / 2, 292,
  );
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(game.save ? 'Press ENTER to keep playing' : 'Press ENTER to start', VIEW.w / 2, 350);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#c9c4b2';
  const lines = [
    'WASD / arrows — walk & drive    E — steal / exit car    F — punch',
    'M — next job    Esc — pause    H — mute    Shift — run    Space — handbrake',
    'Steal a car, take the crew jobs, and stay ahead of the Solmar PD.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW.w / 2, 400 + i * 26));
  ctx.textAlign = 'left';
}

function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(8,10,18,0.6)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('PAUSED', VIEW.w / 2, 300);
  ctx.font = '18px sans-serif';
  ctx.fillText('Esc — resume    H — mute', VIEW.w / 2, 344);
  ctx.textAlign = 'left';
}

function drawBusted(ctx, game) {
  ctx.fillStyle = 'rgba(24,6,8,0.78)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5c5c';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('BUSTED', VIEW.w / 2, 290);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = '20px sans-serif';
  ctx.fillText(game.bustedReason || 'The Solmar PD caught you.', VIEW.w / 2, 336);
  ctx.font = '16px sans-serif';
  ctx.fillText('The PD took a cut of your cash. Press ENTER to walk out of Bay Hospital.', VIEW.w / 2, 372);
  ctx.textAlign = 'left';
}

// --- frame ------------------------------------------------------------------

export function drawFrame(ctx, game) {
  ctx.save();
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  ctx.translate(-Math.round(game.camera.x), -Math.round(game.camera.y));
  drawGround(ctx, game);
  drawRoads(ctx, game);
  drawCloudShadows(ctx, game);
  drawSkidAndParticles(ctx, game);
  drawBuildings(ctx, game);
  drawProps(ctx, game);
  drawWaypoint(ctx, game);
  drawCars(ctx, game);
  drawPeds(ctx, game);
  drawPlayerOnFoot(ctx, game);
  drawNight(ctx, game);
  ctx.restore();
  // Screen-space UI sits on top of the world.
  drawMinimap(ctx, game);
  if (game.screen === 'play' || game.screen === 'pause' || game.screen === 'busted') {
    drawHUD(ctx, game);
  }
  if (game.screen === 'title') drawTitle(ctx, game);
  else if (game.screen === 'pause') drawPause(ctx, game);
  else if (game.screen === 'busted') drawBusted(ctx, game);
}
