// Cars: player driving physics, traffic, parked cars, police cars.
// All physics is plain-object math; no DOM here.
import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, PALETTE, clamp, angleDiff, dist } from './config.js';
import { RNG } from './random.js';
import { buildingAt, resolveOutOfBuildings, isOnRoad } from './city.js';

let _id = 1;
export function makeCar(x, y, angle = 0, opts = {}) {
  return {
    id: _id++, x, y, angle, speed: 0,
    color: opts.color || PALETTE.carColors[0],
    hp: 100, police: !!opts.police, parked: !!opts.parked,
    traffic: !!opts.traffic, wrecked: false, driver: opts.driver !== undefined ? opts.driver : null,
    w: 44, h: 22, siren: !!opts.police,
  };
}

export function spawnTraffic(rng, city, count = 34) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horiz = rng.chance(0.5);
    let x, y, angle;
    if (horiz) { x = rng.range(60, WORLD_W - 60); y = rng.pick(STREETS) + (rng.chance(0.5) ? -24 : 24); angle = rng.chance(0.5) ? 0 : Math.PI; }
    else { x = rng.pick(AVENUES) + (rng.chance(0.5) ? -24 : 24); y = rng.range(60, WORLD_H - 60); angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2; }
    const c = makeCar(x, y, angle, { color: rng.pick(PALETTE.carColors), traffic: true });
    c.speed = rng.range(120, 200);
    cars.push(c);
  }
  return cars;
}

export function spawnParked(rng, count = 26) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horiz = rng.chance(0.5);
    let x, y, angle;
    if (horiz) { x = rng.range(80, WORLD_W - 80); y = rng.pick(STREETS) + (rng.chance(0.5) ? -40 : 40); angle = rng.chance(0.5) ? 0 : Math.PI; }
    else { x = rng.pick(AVENUES) + (rng.chance(0.5) ? -40 : 40); y = rng.range(80, WORLD_H - 80); angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2; }
    cars.push(makeCar(x, y, angle, { color: rng.pick(PALETTE.carColors), parked: true }));
  }
  return cars;
}

// Player driving. input: {up,down,left,right,handbrake}. Returns events.
export function updatePlayerCar(car, input, dt, city, onCrash) {
  const accel = 420, brake = 620, rev = 220, maxF = 560, maxR = 180;
  if (input.up) car.speed += accel * dt;
  if (input.down) car.speed -= (car.speed > 0 ? brake : rev) * dt;
  if (!input.up && !input.down) car.speed *= Math.max(0, 1 - 0.8 * dt);
  if (input.handbrake) car.speed *= Math.max(0, 1 - 3.5 * dt);
  car.speed = clamp(car.speed, -maxR, maxF);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.6 * dir * clamp(Math.abs(car.speed) / 200, 0, 1) * dt;
  const prevSpeed = car.speed;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, WORLD_H - 30);
  const b = buildingAt(city, car.x, car.y, 8);
  if (b) {
    const before = { x: car.x, y: car.y };
    resolveOutOfBuildings(city, car, 14);
    if (Math.abs(prevSpeed) > 200 && onCrash) onCrash(Math.abs(prevSpeed));
    car.speed *= -0.25;
    void before;
  }
  resolveOutOfBuildings(city, car, 14);
}

// Traffic: lane-follow, slow for the car ahead, turn at intersections.
export function updateTraffic(car, dt, city, allCars, rng) {
  if (car.wrecked) return;
  const ahead = carAhead(car, allCars);
  let targetSpeed = 170;
  if (ahead && ahead.d < 75) targetSpeed = Math.max(0, ahead.car.speed - 20);
  car.speed += clamp(targetSpeed - car.speed, -300 * dt, 200 * dt);
  // Snap gently back to the nearest lane centre line.
  const lane = nearestLane(car);
  const steer = angleDiff(car.angle, lane.angle);
  car.angle += clamp(steer, -1.6 * dt, 1.6 * dt);
  // Occasionally turn at an intersection.
  if (rng && rng.chance(0.002) && isOnRoad(car.x, car.y)) {
    car.angle += (rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Turn around at map edges.
  if (car.x < 40 || car.x > WORLD_W - 40 || car.y < 40 || car.y > WORLD_H - 40) {
    car.angle += Math.PI;
    car.x = clamp(car.x, 40, WORLD_W - 40);
    car.y = clamp(car.y, 40, WORLD_H - 40);
  }
  resolveOutOfBuildings(city, car, 14);
}

function nearestLane(car) {
  // Find the closest road centre line and the travel direction along it.
  let best = null;
  for (const ax of AVENUES) {
    const d = Math.abs(car.x - ax);
    if (!best || d < best.d) best = { d, angle: car.y % 2 === 0 ? 0 : 0, axis: 'v', line: ax };
  }
  for (const sy of STREETS) {
    const d = Math.abs(car.y - sy);
    if (!best || d < best.d) best = { d, angle: 0, axis: 'h', line: sy };
  }
  // Keep the car's current heading snapped to the nearest cardinal direction.
  const card = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
  return { angle: card, axis: best.axis };
}

function carAhead(car, allCars) {
  let best = null;
  for (const o of allCars) {
    if (o === car || o.wrecked) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d > 160 || d < 1) continue;
    const a = Math.atan2(o.y - car.y, o.x - car.x);
    if (Math.abs(angleDiff(car.angle, a)) < 0.5) {
      if (!best || d < best.d) best = { d, car: o };
    }
  }
  return best;
}

// Car-vs-car bumps: push apart, damage both.
export function resolveCarCollisions(cars, onBump) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d >= 44 || d < 0.01) continue;
      const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      const push = (44 - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 60) {
        a.hp -= impact * 0.05; b.hp -= impact * 0.05;
        if (onBump) onBump(a, b, impact);
      }
      const tmp = a.speed; a.speed = b.speed * 0.5; b.speed = tmp * 0.5;
    }
  }
}
