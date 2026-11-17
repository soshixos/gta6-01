// Pedestrians: walkers, gangsters, foot cops.
// Walkers stroll on sidewalks; gangsters close in and shoot; cops chase and grab.
import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, clamp, dist, angleTo } from './config.js';
import { RNG } from './random.js';
import { buildingAt, resolveOutOfBuildings } from './city.js';

let _id = 1;
export function makePed(x, y, kind = 'walker') {
  return {
    id: _id++, x, y, kind, // walker | gangster | cop | driver
    angle: 0, speed: kind === 'cop' ? 205 : 55,
    hp: kind === 'gangster' ? 60 : 30, alive: true,
    shootCd: 0, grabT: 0, targetX: x, targetY: y, waitT: 0,
    color: kind === 'cop' ? '#1c4ed8' : kind === 'gangster' ? '#7f1d1d' : ['#e5e7eb', '#f59e0b', '#10b981', '#ec4899'][(_id * 7) % 4],
  };
}

export function spawnWalkers(rng, city, count = 40) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = rng.range(60, WORLD_W - 60);
    const y = rng.range(60, WORLD_H - 60);
    const p = makePed(x, y, 'walker');
    p.targetX = x; p.targetY = y;
    peds.push(p);
  }
  return peds;
}

export function updateWalker(p, dt, rng, city) {
  if (!p.alive) return;
  p.waitT -= dt;
  if (dist(p.x, p.y, p.targetX, p.targetY) < 12 || p.waitT <= 0) {
    // Pick a nearby sidewalk-ish target.
    p.targetX = clamp(p.x + (rng ? rng.range(-260, 260) : 100), 40, WORLD_W - 40);
    p.targetY = clamp(p.y + (rng ? rng.range(-260, 260) : 100), 40, WORLD_H - 40);
    p.waitT = rng ? rng.range(2, 6) : 4;
  }
  const a = angleTo(p.x, p.y, p.targetX, p.targetY);
  p.angle = a;
  const nx = p.x + Math.cos(a) * p.speed * dt;
  const ny = p.y + Math.sin(a) * p.speed * dt;
  if (!buildingAt(city, nx, ny, 6)) { p.x = nx; p.y = ny; }
  resolveOutOfBuildings(city, p, 8);
}

// Gangster: close to 130-420 px of the player and shoot (~55% hit, 12 dmg).
export function updateGangster(g, player, dt, rng, onShoot) {
  if (!g.alive) return;
  const d = dist(g.x, g.y, player.x, player.y);
  g.shootCd -= dt;
  let move = 0;
  if (d > 420) move = 1; else if (d < 130) move = -1;
  if (move !== 0) {
    const a = angleTo(g.x, g.y, player.x, player.y);
    g.angle = a;
    g.x += Math.cos(a) * move * 120 * dt;
    g.y += Math.sin(a) * move * 120 * dt;
  }
  if (d < 520 && g.shootCd <= 0) {
    g.shootCd = rng ? rng.range(0.9, 1.6) : 1.2;
    const hit = rng ? rng.chance(0.55) : false;
    if (onShoot) onShoot(g, hit);
  }
}

// Foot cop: run at the player; grabbing for 1.1 s within 26 px busts them.
export function updateCop(c, player, dt) {
  if (!c.alive) return;
  const d = dist(c.x, c.y, player.x, player.y);
  const a = angleTo(c.x, c.y, player.x, player.y);
  c.angle = a;
  if (d > 26) {
    c.x += Math.cos(a) * c.speed * dt;
    c.y += Math.sin(a) * c.speed * dt;
    c.grabT = 0;
  } else {
    c.grabT += dt;
  }
  return c.grabT >= 1.1;
}
