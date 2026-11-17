// All canvas drawing: world, entities, HUD, minimap and full-screen cards.
import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, AVENUES, STREETS, ROAD_W, PALETTE, DISTRICTS, LANDMARKS, clamp, fmtMoney, fmtTime } from './config.js';
import { isOnRoad, isBeach } from './city.js';
import { missionTarget, objectiveText, currentMission } from './missions.js';

export function drawWorld(ctx, state) {
  const cam = state.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // Ground: grass, then sand + ocean on the south edge.
  ctx.fillStyle = '#8fae62'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, 1760, WORLD_W, WORLD_H - 1760);
  ctx.fillStyle = PALETTE.ocean; ctx.fillRect(0, 1860, WORLD_W, WORLD_H - 1860);
  ctx.fillStyle = PALETTE.oceanDeep;
  for (let x = 0; x < WORLD_W; x += 90) ctx.fillRect(x, 1870 + ((x * 7) % 23), 46, 5);
  // Roads.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2 - 8, 0, ROAD_W + 16, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2 - 8, WORLD_W, ROAD_W + 16);
  ctx.fillStyle = PALETTE.asphalt;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Dashed yellow centre lines.
  ctx.fillStyle = PALETTE.lane;
  for (const ax of AVENUES) for (let y = 0; y < WORLD_H; y += 44) ctx.fillRect(ax - 3, y, 6, 24);
  for (const sy of STREETS) for (let x = 0; x < WORLD_W; x += 44) ctx.fillRect(x, sy - 3, 24, 6);
  // Buildings.
  for (const b of state.city.buildings) {
    ctx.fillStyle = '#00000033'; ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#00000055'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#ffffff22';
    for (let f = 1; f < b.floors; f++) ctx.fillRect(b.x + 6, b.y + f * (b.h / (b.floors + 0.5)), b.w - 12, 2);
    if (b.sign) {
      ctx.fillStyle = '#fff8e0'; ctx.fillRect(b.x + b.w / 2 - 26, b.y + 6, 52, 16);
      ctx.fillStyle = '#222'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + 17);
    }
  }
  // Palms, benches, hydrants.
  for (const p of state.city.palms) drawPalm(ctx, p.x, p.y);
  ctx.fillStyle = '#8d6e63';
  for (const b of state.city.benches) ctx.fillRect(b.x - 14, b.y - 4, 28, 8);
  ctx.fillStyle = '#d32f2f';
  for (const h of state.city.hydrants) { ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, 7); ctx.fill(); }
  // District + landmark labels.
  ctx.textAlign = 'center'; ctx.font = 'bold 26px sans-serif';
  for (const d of DISTRICTS) {
    ctx.fillStyle = '#ffffff2e';
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
  ctx.font = 'bold 13px sans-serif';
  for (const k of Object.keys(LANDMARKS)) {
    const l = LANDMARKS[k];
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0008'; ctx.lineWidth = 3;
    ctx.strokeText(l.name, l.x, l.y - 18); ctx.fillText(l.name, l.x, l.y - 18);
  }
  // Mission marker / target ring.
  const target = missionTarget(state);
  if (target && state.screen === 'play') {
    const pulse = 26 + 8 * Math.sin(state.time * 4);
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffd400';
    ctx.beginPath(); ctx.arc(target.x, target.y, 6, 0, 7); ctx.fill();
  }
  // Cars.
  for (const c of state.allCars()) drawCar(ctx, c);
  // Peds.
  for (const p of state.walkers) if (p.alive) drawPed(ctx, p);
  for (const g of state.gangsters) if (g.alive) drawPed(ctx, g);
  for (const c of state.footCops) if (c.alive) drawPed(ctx, c);
  // Player.
  if (!state.player.car) drawPlayer(ctx, state.player);
  // Tracers / muzzle flashes.
  for (const t of state.tracers) {
    ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  ctx.restore();
  // Warm sunset vignette.
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  g.addColorStop(0, 'rgba(255,140,60,0)');
  g.addColorStop(1, 'rgba(255,110,40,0.22)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawPalm(ctx, x, y) {
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 14); ctx.stroke();
  ctx.fillStyle = '#2e9e5b';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath(); ctx.ellipse(x + 3 + Math.cos(a) * 8, y - 14 + Math.sin(a) * 6, 10, 4, a, 0, 7); ctx.fill();
  }
}

function drawCar(ctx, c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = '#00000044'; ctx.fillRect(-22, -10, 46, 24);
  ctx.fillStyle = c.wrecked ? '#333' : c.color;
  ctx.fillRect(-22, -11, 44, 22);
  ctx.fillStyle = '#bfe3f0'; ctx.fillRect(-4, -9, 12, 18);
  ctx.fillStyle = '#111';
  ctx.fillRect(-16, -12, 8, 4); ctx.fillRect(-16, 8, 8, 4);
  ctx.fillRect(12, -12, 8, 4); ctx.fillRect(12, 8, 8, 4);
  if (c.police) {
    ctx.fillStyle = '#fff'; ctx.fillRect(-2, -11, 10, 22);
    ctx.fillStyle = '#e11'; ctx.fillRect(-8, -11, 6, 6);
    ctx.fillStyle = '#24f'; ctx.fillRect(0, -11, 6, 6);
  }
  if (c.wrecked) { ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(20, 10); ctx.moveTo(20, -10); ctx.lineTo(-20, 10); ctx.stroke(); }
  ctx.restore();
}

function drawPed(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#00000033'; ctx.beginPath(); ctx.ellipse(0, 4, 8, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 4, 0, 7); ctx.fill();
  if (p.kind === 'cop') { ctx.fillStyle = '#0b2a6b'; ctx.fillRect(-6, -3, 12, 4); }
  if (p.kind === 'gangster') { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 16, Math.sin(p.angle) * 16); ctx.stroke(); }
  ctx.restore();
}

function drawPlayer(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#00000044'; ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(Math.cos(p.aim) * 4, Math.sin(p.aim) * 4, 5, 0, 7); ctx.fill();
  // Gun / fist direction tick.
  ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.aim) * 16, Math.sin(p.aim) * 16); ctx.stroke();
  ctx.restore();
}

export function drawHUD(ctx, state) {
  const p = state.player;
  // Top-left: name, cash, health.
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(12, 12, 250, 64);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('DARIO COSTA', 22, 34);
  ctx.fillStyle = '#7ee787'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(fmtMoney(state.money), 22, 55);
  ctx.fillStyle = '#333'; ctx.fillRect(120, 44, 130, 12);
  ctx.fillStyle = p.hp > 40 ? '#4caf50' : '#e53935';
  ctx.fillRect(120, 44, 130 * clamp(p.hp / 100, 0, 1), 12);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
  ctx.fillText(Math.round(p.hp) + ' HP', 122, 54);
  // Top-centre: wanted stars.
  ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
  ctx.fillStyle = state.wanted > 0 ? '#ffd400' : '#ffffff88';
  ctx.fillText(stars, VIEW_W / 2, 40);
  // Objective card.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const obj = objectiveText(state);
  ctx.fillRect(VIEW_W / 2 - 260, 52, 520, 30);
  ctx.fillStyle = '#ffd400'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText(obj, VIEW_W / 2, 72);
  if (state.mission && state.mission.timer > 0) {
    ctx.fillStyle = state.mission.timer < 20 ? '#ff5252' : '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(fmtTime(state.mission.timer), VIEW_W / 2, 100);
  }
  // Minimap top-right.
  drawMinimap(ctx, state);
  // Speedometer bottom-left while driving.
  if (p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(12, VIEW_H - 64, 210, 52);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h', 22, VIEW_H - 32);
    ctx.fillStyle = '#888'; ctx.fillRect(22, VIEW_H - 24, 190, 8);
    ctx.fillStyle = p.car.hp > 40 ? '#4caf50' : '#e53935';
    ctx.fillRect(22, VIEW_H - 24, 190 * clamp(p.car.hp / 100, 0, 1), 8);
  }
  // Context hint bottom-centre.
  if (state.hint) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = ctx.measureText(state.hint).width + 28;
    ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 44, w, 28);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(state.hint, VIEW_W / 2, VIEW_H - 25);
  }
  // Toast.
  if (state.toast && state.toastT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const w = ctx.measureText(state.toast).width + 30;
    ctx.fillRect(VIEW_W / 2 - w / 2, 120, w, 30);
    ctx.fillStyle = '#ffd400'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(state.toast, VIEW_W / 2, 140);
  }
  if (state.muted) {
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('MUTED', VIEW_W - 12, VIEW_H - 12);
  }
}

function drawMinimap(ctx, state) {
  const mw = 208, mh = 156, ox = VIEW_W - mw - 12, oy = 12;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#8fae62'; ctx.fillRect(ox, oy, mw, mh);
  ctx.fillStyle = PALETTE.ocean; ctx.fillRect(ox, oy + 1760 * sy, mw, mh - 1760 * sy);
  ctx.fillStyle = '#555';
  for (const ax of AVENUES) ctx.fillRect(ox + ax * sx - 2, oy, 4, mh);
  for (const sy2 of STREETS) ctx.fillRect(ox, oy + sy2 * sy - 2, mw, 4);
  const dot = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox + x * sx, oy + y * sy, r, 0, 7); ctx.fill(); };
  const t = missionTarget(state);
  if (t) dot(t.x, t.y, 5, '#ffd400');
  for (const c of state.policeCars) dot(c.x, c.y, 3, '#3b82f6');
  for (const g of state.gangsters) if (g.alive) dot(g.x, g.y, 3, '#ef4444');
  dot(state.player.x, state.player.y, 4, '#fff');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, mw, mh);
}

export function drawScreen(ctx, state, kind) {
  ctx.fillStyle = 'rgba(10,10,20,0.82)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (kind === 'title') {
    const g = ctx.createLinearGradient(0, 180, 0, 330);
    g.addColorStop(0, '#ffd54f'); g.addColorStop(0.5, '#ff7043'); g.addColorStop(1, '#7e57c2');
    ctx.fillStyle = g; ctx.font = 'bold 96px sans-serif';
    ctx.fillText('PORTO VERDE', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    ctx.fillText('A sun-soaked open-world crime story — Dario Costa, getaway driver for Madame Alba.', VIEW_W / 2, 350);
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#ffd400';
    ctx.fillText('WASD move · Shift run · Mouse aim · F punch · Click shoot (after pistol) · E enter / steal car · P pause · M mute', VIEW_W / 2, 420);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(state.hasSave ? 'ENTER — Continue   ·   N — New Game' : 'ENTER — New Game', VIEW_W / 2, 480);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#ffffffaa';
    ctx.fillText('Five jobs. Five stars of heat. One score.', VIEW_W / 2, 530);
  } else if (kind === 'paused') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 56px sans-serif'; ctx.fillText('PAUSED', VIEW_W / 2, 360);
    ctx.font = '18px sans-serif'; ctx.fillText('Press P to resume', VIEW_W / 2, 410);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#3b82f6'; ctx.font = 'bold 72px sans-serif'; ctx.fillText('BUSTED', VIEW_W / 2, 360);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    ctx.fillText('The cops took ' + fmtMoney(state.lastFine || 0) + '. The heat is off — for now.', VIEW_W / 2, 410);
    ctx.fillText('Press ENTER to continue', VIEW_W / 2, 450);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#e53935'; ctx.font = 'bold 72px sans-serif'; ctx.fillText('WASTED', VIEW_W / 2, 360);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    ctx.fillText('Dario wakes up at the clinic, $100 lighter.', VIEW_W / 2, 410);
    ctx.fillText('Press ENTER to continue', VIEW_W / 2, 450);
  } else if (kind === 'jobdone') {
    ctx.fillStyle = '#ffd400'; ctx.font = 'bold 56px sans-serif'; ctx.fillText('JOB DONE', VIEW_W / 2, 340);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText((state.jobDone ? state.jobDone.title : '') + '  —  +' + fmtMoney(state.jobDone ? state.jobDone.pay : 0), VIEW_W / 2, 400);
    ctx.font = '18px sans-serif'; ctx.fillText('Press ENTER to continue', VIEW_W / 2, 450);
  } else if (kind === 'failed') {
    ctx.fillStyle = '#e53935'; ctx.font = 'bold 56px sans-serif'; ctx.fillText('JOB FAILED', VIEW_W / 2, 340);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    ctx.fillText(state.failReason || '', VIEW_W / 2, 390);
    ctx.fillText('Return to the yellow marker to retry. Press ENTER.', VIEW_W / 2, 430);
  }
}
