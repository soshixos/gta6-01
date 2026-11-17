// Porto Verde — shared constants, palette and small helpers.
// A sun-soaked top-down open-world crime game in one canvas. All art is
// procedural; the city, cars and people are drawn from these numbers.
export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const SEED = 20261117;

export const AVENUES = [200, 600, 1000, 1400, 1800, 2200];
export const STREETS = [200, 520, 840, 1160, 1480, 1720];
export const ROAD_W = 96;

export const LANDMARKS = {
  garage: { x: 1000, y: 520, name: "Alba's Garage" },
  club: { x: 2200, y: 200, name: 'Club Alba' },
  docks: { x: 1800, y: 1480, name: 'The Docks' },
  warehouse: { x: 600, y: 1160, name: 'Warehouse 9' },
  hideout: { x: 200, y: 840, name: 'Hideout' },
  beach: { x: 1280, y: 1840, name: 'Solmar Beach' },
};

export const DISTRICTS = [
  { name: 'Old Harbour', x: 0, y: 0, w: 800, h: 700 },
  { name: 'Neon Row', x: 1600, y: 0, w: 960, h: 700 },
  { name: 'Palm Heights', x: 800, y: 700, w: 800, h: 700 },
  { name: 'The Docks', x: 1600, y: 1200, w: 960, h: 560 },
  { name: 'Solmar Beach', x: 0, y: 1700, w: 2560, h: 220 },
];

export const PALETTE = {
  sand: '#e8c98a', ocean: '#1f8fa8', oceanDeep: '#146b80',
  grass: '#7fae5a', asphalt: '#3a3a42', sidewalk: '#b9b3a4',
  lane: '#f2c230', roofTerra: '#c96f4a', roofTeal: '#2f8f7a',
  roofMustard: '#d9a441', roofSlate: '#5d6b7a', wall: '#e6dcc8',
  carColors: ['#c0392b', '#2471a3', '#f1c40f', '#7d3c98', '#e67e22', '#16a085', '#ecf0f1', '#2c3e50'],
  police: '#1c4ed8', taxi: '#f5c542',
};

export const SIGNS = ['HOTEL', 'CAFE', 'MARKET', 'CLUB', 'GARAGE', 'PIZZA', 'GYM', 'BANK'];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
