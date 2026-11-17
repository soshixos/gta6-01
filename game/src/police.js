// Wanted system: stars 0-5, police response, decay, BUSTED/WASTED outcomes.
import { WORLD_W, WORLD_H, clamp, dist } from './config.js';
import { makeCar } from './vehicles.js';
import { makePed } from './peds.js';
import { resolveOutOfBuildings } from './city.js';

export const CRIME = { STEAL_WITNESSED: 1, JACK: 2, HIT_PED: 1, KILL_PED: 2, SHOOT_AT_COP: 1, KILL_COP: 3 };

export function addWanted(state, n, reason) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.timeSinceCrime = 0;
  if (state.wanted > before) state.toast = 'WANTED LEVEL UP — ' + state.wanted + ' STAR' + (state.wanted > 1 ? 'S' : '');
  void reason;
  return state.wanted;
}

export function updateWanted(state, dt) {
  state.timeSinceCrime += dt;
  if (state.wanted > 0 && state.timeSinceCrime > 12) {
    state.decayT = (state.decayT || 0) + dt;
    if (state.decayT >= 7) {
      state.decayT = 0;
      state.wanted -= 1;
      if (state.wanted === 0) state.toast = 'YOU LOST THE COPS';
    }
  } else state.decayT = 0;
  // Spawn police to match the wanted level.
  const wantCars = Math.min(1 + state.wanted, 5);
  const wantCops = Math.min(state.wanted, 4);
  while (state.policeCars.length < wantCars && state.wanted > 0) {
    const a = Math.random() * Math.PI * 2;
    const x = clamp(state.player.x + Math.cos(a) * 620, 60, WORLD_W - 60);
    const y = clamp(state.player.y + Math.sin(a) * 620, 60, WORLD_H - 60);
    const c = makeCar(x, y, a, { police: true, color: '#1c4ed8' });
    c.speed = 200;
    state.policeCars.push(c);
  }
  while (state.footCops.length < wantCops && state.wanted > 0) {
    const a = Math.random() * Math.PI * 2;
    const x = clamp(state.player.x + Math.cos(a) * 420, 60, WORLD_W - 60);
    const y = clamp(state.player.y + Math.sin(a) * 420, 60, WORLD_H - 60);
    state.footCops.push(makePed(x, y, 'cop'));
  }
  // Despawn police when far away and wanted is 0.
  if (state.wanted === 0) {
    state.policeCars = state.policeCars.filter((c) => dist(c.x, c.y, state.player.x, state.player.y) < 900);
    state.footCops = state.footCops.filter((c) => dist(c.x, c.y, state.player.x, state.player.y) < 700);
  }
}

// Police car chase: steer toward the player and ram.
export function updatePoliceCar(car, player, dt, city) {
  const a = Math.atan2(player.y - car.y, player.x - car.x);
  let diff = a - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += clamp(diff, -2.8 * dt, 2.8 * dt);
  const d = dist(car.x, car.y, player.x, player.y);
  const target = d > 60 ? 480 : 260;
  car.speed += clamp(target - car.speed, -400 * dt, 320 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, WORLD_H - 30);
  // Never let a ram leave a police car inside a building.
  resolveOutOfBuildings(city, car, 14);
}
