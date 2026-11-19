// Solmar Bay — everything the player sees: the city, the cars, the HUD.
// One job: draw one frame of the game, including its start screen, its
// minimap and its wanted stars, from the game state alone.

import { BEACH_TOP, COLORS, MARINA_LEFT, ROADS_X, ROADS_Y, ROAD_HALF, SEA_TOP, VIEW, WORLD } from './config.js';
import { hash01 } from './random.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, game) {
  const cam = game.camera;
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  // Mown stripes, so the grass reads as a place and not a flat colour.
  ctx.fillStyle = COLORS.grassDark;
  const stripe = 120;
  const x0 = Math.max(0, Math.floor(cam.x / stripe) * stripe);
  for (let x = x0; x < cam.x + VIEW.w; x += stripe * 2) {
    ctx.fillRect(x - cam.x, 0, stripe, VIEW.h);
  }
  // Beach and sea along the south edge.
  if (cam.y + VIEW.h > BEACH_TOP) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, BEACH_TOP - cam.y, VIEW.w, SEA_TOP - BEACH_TOP);
    const grad = ctx.createLinearGradient(0, SEA_TOP - cam.y, 0, WORLD.h - cam.y);
    grad.addColorStop(0, COLORS.sea);
    grad.addColorStop(1, COLORS.seaDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(0, SEA_TOP - cam.y, VIEW.w, WORLD.h - SEA_TOP);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let x = 0; x < VIEW.w; x += 90) {
      const wx = x + cam.x;
      const wave = Math.sin(wx * 0.01 + game.time * 1.5) * 3;
      ctx.beginPath();
      ctx.moveTo(x, SEA_TOP - cam.y + wave);
      ctx.lineTo(x + 46, SEA_TOP - cam.y + wave);
      ctx.stroke();
    }
  }
  // Marina water on the east edge.
  if (cam.x + VIEW.w > MARINA_LEFT) {
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(MARINA_LEFT - cam.x, 0, VIEW.w - (MARINA_LEFT - cam.x), VIEW.h);
  }
}

function drawRoads(ctx, game) {
  const cam = game.camera;
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF - 10 - cam.x, 0, ROAD_HALF * 2 + 20, VIEW.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_HALF - 10 - cam.y, VIEW.w, ROAD_HALF * 2 + 20);
  ctx.fillStyle = COLORS.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF - cam.x, 0, ROAD_HALF * 2, VIEW.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_HALF - cam.y, VIEW.w, ROAD_HALF * 2);
  // Centre dashes.
  ctx.fillStyle = COLORS.lane;
  for (const rx of ROADS_X) {
    for (let y = Math.floor(cam.y / 48) * 48; y < cam.y + VIEW.h; y += 48) {
      ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 24);
    }
  }
  for (const ry of ROADS_Y) {
    for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + VIEW.w; x += 48) {
      ctx.fillRect(x - cam.x, ry - 2 - cam.y, 24, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(232,227,200,0.85)';
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(rx + i * 12 - 4 - cam.x, ry - ROAD_HALF - 8 - cam.y, 8, 16);
        ctx.fillRect(rx + i * 12 - 4 - cam.x, ry + ROAD_HALF - 8 - cam.y, 8, 16);
      }
    }
  }
}

function drawBuildings(ctx, game) {
  const cam = game.camera;
  for (const b of game.world.buildings) {
    const x = b.x - cam.x;
    const y = b.y - cam.y;
    if (x + b.w < 0 || x > VIEW.w || y + b.h < 0 || y > VIEW.h) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 6, y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 6, y + 6, b.w - 12, 5);
    if (b.roof === 'garden') {
      ctx.fillStyle = '#4a7a3a';
      ctx.fillRect(x + b.w * 0.2, y + b.h * 0.25, b.w * 0.6, b.h * 0.5);
    } else if (b.roof === 'pool') {
      ctx.fillStyle = '#5fb2d9';
      roundRect(ctx, x + b.w * 0.25, y + b.h * 0.3, b.w * 0.5, b.h * 0.4, 8);
      ctx.fill();
    }
    // Windows: a dotted grid that never flickers.
    ctx.fillStyle = 'rgba(20,24,32,0.45)';
    for (let wx = x + 12; wx < x + b.w - 12; wx += 22) {
      for (let wy = y + 16; wy < y + b.h - 12; wy += 20) {
        if (hash01(wx, wy) < 0.45) ctx.fillRect(wx, wy, 9, 7);
      }
    }
  }
  ctx.fillStyle = COLORS.tree;
  for (const t of game.world.trees) {
    const x = t.x - cam.x;
    const y = t.y - cam.y;
    if (x < -20 || x > VIEW.w + 20 || y < -20 || y > VIEW.h + 20) continue;
    ctx.beginPath();
    ctx.arc(x, y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.treeDark;
    ctx.beginPath();
    ctx.arc(x - t.r * 0.25, y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.tree;
  }
  // Marina boats.
  for (const boat of game.world.boats) {
    const x = boat.x - cam.x;
    const y = boat.y - cam.y;
    if (x < -40 || x > VIEW.w + 40 || y < -40 || y > VIEW.h + 40) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = boat.color;
    roundRect(ctx, -26, -9, 52, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#2c4a5e';
    ctx.fillRect(-8, -5, 16, 10);
    ctx.restore();
  }
}

function drawCarShape(ctx, car, cam, night) {
  const x = car.x - cam.x;
  const y = car.y - cam.y;
  if (x < -60 || x > VIEW.w + 60 || y < -60 || y > VIEW.h + 60) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -20, -11 + 4, 44, 24, 8);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -12, 44, 24, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, -6, -10, 14, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(14, -9, 4, 18);
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-18, -13, 8, 5);
  ctx.fillRect(-18, 8, 8, 5);
  ctx.fillRect(12, -13, 8, 5);
  ctx.fillRect(12, 8, 8, 5);
  if (car.kind === 'police') {
    const flash = Math.floor(gameTime(car) * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-4, -12, 8, 5);
    ctx.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-4, 7, 8, 5);
    ctx.fillStyle = '#e8e6da';
    ctx.fillRect(-22, -3, 10, 6);
  }
  if (car.kind === 'player') {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    roundRect(ctx, -22, -12, 44, 24, 8);
    ctx.stroke();
  }
  if (night) {
    const grad = ctx.createLinearGradient(22, 0, 150, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.35)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(22, -10);
    ctx.lineTo(150, -42);
    ctx.lineTo(150, 42);
    ctx.lineTo(22, 10);
    ctx.closePath();
    ctx.fill();
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(40,40,40,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function gameTime(car) {
  return car._t || 0;
}

function drawCars(ctx, game, night) {
  for (const car of game.cars) {
    car._t = game.time;
    drawCarShape(ctx, car, game.camera, night);
  }
  // Parked cars are scenery until stolen.
  for (const parked of game.world.parked) {
    const x = parked.x - game.camera.x;
    const y = parked.y - game.camera.y;
    if (x < -60 || x > VIEW.w + 60 || y < -60 || y > VIEW.h + 60) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(parked.angle);
    ctx.fillStyle = parked.color;
    roundRect(ctx, -22, -12, 44, 24, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    roundRect(ctx, -6, -10, 14, 20, 4);
    ctx.fill();
    ctx.restore();
  }
}

function drawPeds(ctx, game) {
  const cam = game.camera;
  for (const ped of game.peds) {
    const x = ped.x - cam.x;
    const y = ped.y - cam.y;
    if (x < -20 || x > VIEW.w + 20 || y < -20 || y > VIEW.h + 20) continue;
    ctx.save();
    ctx.translate(x, y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      roundRect(ctx, -11, -6, 22, 12, 6);
      ctx.fill();
    } else {
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(4, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayerOnFoot(ctx, game) {
  const p = game.player;
  if (!p.onFoot) return;
  const x = p.x - game.camera.x;
  const y = p.y - game.camera.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5b00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(7, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  if (p.punchT > 0.25) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26, -0.6, 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, game) {
  const cam = game.camera;
  ctx.strokeStyle = 'rgba(40,36,30,0.5)';
  ctx.lineWidth = 3;
  for (const s of game.skid) {
    const x = s.x - cam.x;
    const y = s.y - cam.y;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(s.angle) * 14, y - Math.sin(s.angle) * 14);
    ctx.lineTo(x + Math.cos(s.angle) * 14, y + Math.sin(s.angle) * 14);
    ctx.stroke();
  }
  for (const pt of game.particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.t / pt.max);
    ctx.beginPath();
    ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawWaypoint(ctx, game) {
  const m = game.missions.current;
  if (!m) return;
  const step = m.def.steps[m.step];
  if (!step || step.kind !== 'reach') return;
  const cam = game.camera;
  const sx = step.x - cam.x;
  const sy = step.y - cam.y;
  const pulse = 1 + Math.sin(game.time * 4) * 0.15;
  if (sx > 40 && sx < VIEW.w - 40 && sy > 40 && sy < VIEW.h - 40) {
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // An edge arrow points at the target when it is off screen.
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const ax = cx + Math.cos(ang) * (VIEW.w / 2 - 50);
    const ay = cy + Math.sin(ang) * (VIEW.h / 2 - 50);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawNight(ctx, game) {
  const t = game.dayTime;
  let alpha = 0;
  if (t > 0.85) alpha = Math.min(0.55, (t - 0.85) * 5);
  else if (t < 0.08) alpha = 0.25;
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(8, 12, 38, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

function drawMinimap(ctx, game) {
  const mw = 220;
  const mh = 165;
  const mx = VIEW.w - mw - 16;
  const my = 16;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(mx + (WORLD.w - 60) * sx, my, 60 * sx, mh);
  ctx.fillRect(mx, my + (BEACH_TOP) * sy, mw, (WORLD.h - BEACH_TOP) * sy);
  ctx.strokeStyle = '#3a3d46';
  ctx.lineWidth = 3;
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
  const m = game.missions.current;
  if (m) {
    const step = m.def.steps[m.step];
    if (step && step.kind === 'reach') {
      ctx.fillStyle = COLORS.accent;
      ctx.save();
      ctx.translate(mx + step.x * sx, my + step.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }
  for (const car of game.cars) {
    if (car.kind === 'police') {
      ctx.fillStyle = '#ff5c5c';
      ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
  }
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5b00';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx, my + mh + 20);
}

function drawHUD(ctx, game) {
  const p = game.player;
  ctx.textAlign = 'left';
  // Health, cash and wanted stars, top left.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 16, 16, 300, 96, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${p.cash}`, 30, 44);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#c9c4b2';
  ctx.fillText(`Health ${Math.max(0, Math.round(p.onFoot ? p.health : (p.car ? p.car.health : p.health)))}`, 30, 68);
  ctx.fillStyle = '#3a3d46';
  roundRect(ctx, 30, 76, 180, 10, 5);
  ctx.fill();
  const hp = Math.max(0, Math.min(1, (p.onFoot ? p.health : (p.car ? p.car.health : p.health)) / 100));
  ctx.fillStyle = hp > 0.5 ? '#7ddc7d' : hp > 0.25 ? '#ffb02e' : '#ff5c5c';
  roundRect(ctx, 30, 76, 180 * hp, 10, 5);
  ctx.fill();
  // Wanted stars.
  for (let i = 0; i < 5; i += 1) {
    const lit = i < Math.ceil(game.wanted);
    ctx.fillStyle = lit ? '#ffd23f' : 'rgba(244,241,230,0.25)';
    drawStar(ctx, 30 + i * 30, 100, 11, lit);
  }
  if (game.wanted >= 1) {
    ctx.fillStyle = '#ff8a5c';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(game.lastCrime || 'Wanted', 180, 104);
  }
  // Speed, bottom right, while driving.
  if (!p.onFoot && p.car) {
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, VIEW.w - 170, VIEW.h - 66, 154, 50, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.18)} mph`, VIEW.w - 30, VIEW.h - 32);
  }
  // Mission objective banner, bottom centre.
  const m = game.missions.current;
  if (m) {
    const step = m.def.steps[m.step];
    if (step) {
      ctx.font = 'bold 17px sans-serif';
      const label = `${m.def.title}: ${step.label}`;
      const w = ctx.measureText(label).width + 36;
      ctx.fillStyle = COLORS.hudBg;
      roundRect(ctx, (VIEW.w - w) / 2, VIEW.h - 52, w, 36, 10);
      ctx.fill();
      ctx.fillStyle = COLORS.accent;
      ctx.textAlign = 'center';
      ctx.fillText(label, VIEW.w / 2, VIEW.h - 28);
      if (step.timer !== undefined) {
        const left = Math.max(0, step.timer - m.timer);
        ctx.fillStyle = left < 20 ? '#ff5c5c' : COLORS.hudText;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`${Math.ceil(left)}s`, VIEW.w / 2, VIEW.h - 62);
      }
    }
  }
  // Message feed, bottom left.
  ctx.textAlign = 'left';
  ctx.font = '15px sans-serif';
  let my = VIEW.h - 90;
  for (const msg of game.messages.slice(-3)) {
    ctx.fillStyle = COLORS.hudBg;
    const w = ctx.measureText(msg.text).width + 20;
    roundRect(ctx, 16, my - 18, w, 26, 8);
    ctx.fill();
    ctx.fillStyle = msg.color || COLORS.hudText;
    ctx.fillText(msg.text, 26, my + 1);
    my -= 32;
  }
  // Controls hint, first seconds of play.
  if (game.time < 14 && game.screen === 'play') {
    ctx.fillStyle = 'rgba(12,16,24,0.6)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD drive / walk · E steal or exit a car · F punch · M next job · Esc pause · H mute', VIEW.w / 2, 136);
  }
}

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
  ctx.fill();
  if (lit) {
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb02e';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR BAY', VIEW.w / 2, 210);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '26px sans-serif';
  ctx.fillText('An open-city crime story', VIEW.w / 2, 258);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#c9c4b2';
  ctx.fillText('Jax Marlowe owes the crew. Work the jobs, dodge the PD, own the bay.', VIEW.w / 2, 300);
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 22px sans-serif';
  const blink = Math.floor(game.time * 2) % 2 === 0;
  if (blink) ctx.fillText('Press ENTER to start', VIEW.w / 2, 380);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD move and drive · E steal or exit a car · F punch · M next job', VIEW.w / 2, 440);
  ctx.fillText('Esc pause · H mute · progress saves on this machine', VIEW.w / 2, 468);
  if (game.save && game.save.cash > 0) {
    ctx.fillStyle = '#7ddc7d';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Saved: $${game.save.cash} earned, ${game.save.done.length} crew jobs done — press ENTER to continue your save`, VIEW.w / 2, 520);
  }
}

function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(10, 14, 24, 0.7)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('Paused', VIEW.w / 2, 300);
  ctx.font = '18px sans-serif';
  ctx.fillText('Esc to keep playing · M next job · H mute', VIEW.w / 2, 350);
}

function drawBusted(ctx, game) {
  ctx.fillStyle = 'rgba(40, 8, 12, 0.82)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5c5c';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('BUSTED', VIEW.w / 2, 300);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '20px sans-serif';
  ctx.fillText(game.bustedReason || 'The Solmar PD caught you.', VIEW.w / 2, 350);
  ctx.font = '17px sans-serif';
  ctx.fillText('Press ENTER to walk out of Bay Hospital and try again.', VIEW.w / 2, 400);
}

export function drawFrame(ctx, game) {
  const night = game.dayTime > 0.85 || game.dayTime < 0.08;
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  drawGround(ctx, game);
  drawRoads(ctx, game);
  drawBuildings(ctx, game);
  drawParticles(ctx, game);
  drawCars(ctx, game, night);
  drawPeds(ctx, game);
  drawPlayerOnFoot(ctx, game);
  drawWaypoint(ctx, game);
  drawNight(ctx, game);
  if (game.screen === 'play' || game.screen === 'pause' || game.screen === 'busted') {
    drawMinimap(ctx, game);
    drawHUD(ctx, game);
  }
  if (game.screen === 'title') drawTitle(ctx, game);
  if (game.screen === 'pause') drawPause(ctx, game);
  if (game.screen === 'busted') drawBusted(ctx, game);
}
