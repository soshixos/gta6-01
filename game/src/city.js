// City generation: roads, blocks, buildings, palms, benches, hydrants.
// Seeded, so every run shows the same Porto Verde.
import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, PALETTE, SIGNS, SEED } from './config.js';
import { RNG } from './random.js';

export function isOnRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}
export function isBeach(x, y) { return y > 1760; }

export function generateCity(seed = SEED) {
  const rng = new RNG(seed);
  const buildings = [];
  const palms = [];
  const benches = [];
  const hydrants = [];
  const roofColors = [PALETTE.roofTerra, PALETTE.roofTeal, PALETTE.roofMustard, PALETTE.roofSlate];
  const xEdges = [0, ...AVENUES.map((a) => a - ROAD_W / 2), ...AVENUES.map((a) => a + ROAD_W / 2), WORLD_W];
  const yEdges = [0, ...STREETS.map((s) => s - ROAD_W / 2), ...STREETS.map((s) => s + ROAD_W / 2), WORLD_H];
  // Block columns: gaps between road bands.
  const xBands = [];
  const xs = [...new Set(xEdges)].sort((a, b) => a - b);
  const ys = [...new Set(yEdges)].sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i += 2) xBands.push([xs[i], xs[i + 1]]);
  const yBands = [];
  for (let i = 0; i + 1 < ys.length; i += 2) yBands.push([ys[i], ys[i + 1]]);
  for (const [bx0, bx1] of xBands) {
    for (const [by0, by1] of yBands) {
      if (by1 > 1760) continue; // beach strip: no buildings
      const bw = bx1 - bx0, bh = by1 - by0;
      if (bw < 60 || bh < 60) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(70, Math.min(150, bw - 24));
        const h = rng.range(60, Math.min(120, bh - 24));
        const x = bx0 + 12 + rng.range(0, Math.max(1, bw - w - 24));
        const y = by0 + 12 + rng.range(0, Math.max(1, bh - h - 24));
        buildings.push({
          x, y, w, h,
          color: rng.pick(roofColors),
          sign: rng.chance(0.35) ? rng.pick(SIGNS) : null,
          floors: rng.int(1, 4),
        });
      }
      // Street furniture around the block.
      for (let k = 0; k < 3; k++) {
        palms.push({ x: bx0 + rng.range(8, bw - 8), y: by0 + rng.range(8, bh - 8) });
      }
      if (rng.chance(0.6)) benches.push({ x: bx0 + rng.range(10, bw - 10), y: by0 + 6 });
      if (rng.chance(0.5)) hydrants.push({ x: bx0 + 6, y: by0 + rng.range(10, bh - 10) });
    }
  }
  // Beach palms.
  for (let k = 0; k < 26; k++) palms.push({ x: rng.range(40, WORLD_W - 40), y: rng.range(1780, 1900) });
  return { buildings, palms, benches, hydrants };
}

export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}
// Push an entity (with x,y and radius r) out of any building it overlaps,
// along the smallest-penetration axis. Returns true if it was moved.
export function resolveOutOfBuildings(city, ent, r = 10) {
  let moved = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
    const dx = ent.x - cx, dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    // Centre inside the rect: push along smallest penetration axis.
    if (d2 < 0.0001) {
      const pl = ent.x - b.x, pr = b.x + b.w - ent.x;
      const pt = ent.y - b.y, pb = b.y + b.h - ent.y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) ent.x = b.x - r;
      else if (m === pr) ent.x = b.x + b.w + r;
      else if (m === pt) ent.y = b.y - r;
      else ent.y = b.y + b.h + r;
    } else {
      const d = Math.sqrt(d2);
      ent.x = cx + (dx / d) * r;
      ent.y = cy + (dy / d) * r;
    }
    moved = true;
  }
  return moved;
}
