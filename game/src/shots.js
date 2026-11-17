// Screenshot scenes (?shot=<name>&seed=1). Each scene steps the real rules
// forward from a fresh world with a scripted driver, then main.js renders
// one frame and sets document.title = 'READY'.
import { WORLD_W, WORLD_H, clamp } from './config.js';
import { makeCar } from './vehicles.js';
import { makePed } from './peds.js';
import { startMission, completeMission } from './missions.js';

function stepWorld(state, steps, dt = 1 / 60) {
  // Advance traffic a little so streets feel alive.
  for (let i = 0; i < steps; i++) {
    state.time += dt;
    for (const c of state.traffic) {
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (c.x < 40 || c.x > WORLD_W - 40 || c.y < 40 || c.y > WORLD_H - 40) c.angle += Math.PI;
      c.x = clamp(c.x, 40, WORLD_W - 40); c.y = clamp(c.y, 40, WORLD_H - 40);
    }
  }
}

export function setupShot(state, name) {
  const p = state.player;
  if (name === 'start') {
    state.screen = 'title';
    p.x = 1000; p.y = 840;
    state.camera.x = clamp(p.x - 640, 0, WORLD_W - 1280);
    state.camera.y = clamp(p.y - 400, 0, WORLD_H - 800);
    return;
  }
  if (name === 'play') {
    state.screen = 'play';
    p.x = 600; p.y = 520; p.hp = 100;
    // Busy corner: extra traffic and walkers nearby.
    for (let i = 0; i < 6; i++) {
      const c = makeCar(600 + (i % 3) * 90 - 90, 520 + Math.floor(i / 3) * 60 - 30, i % 2 ? 0 : Math.PI / 2, { color: ['#c0392b', '#f1c40f', '#2471a3'][i % 3], traffic: true });
      c.speed = 120; state.traffic.push(c);
    }
    for (let i = 0; i < 8; i++) state.walkers.push(makePed(600 + (i - 4) * 40, 520 + 60, 'walker'));
    state.camera.x = clamp(p.x - 640, 0, WORLD_W - 1280);
    state.camera.y = clamp(p.y - 400, 0, WORLD_H - 800);
    stepWorld(state, 30);
    return;
  }
  if (name === 'chase') {
    state.screen = 'play';
    // Driving south down the avenue at speed, 3 wanted stars, police in pursuit.
    const car = makeCar(1000, 700, Math.PI / 2, { color: '#c0392b' });
    car.speed = 500;
    state.traffic.push(car);
    p.car = car; p.x = car.x; p.y = car.y; p.hp = 100;
    state.wanted = 3; state.timeSinceCrime = 0;
    for (let i = 0; i < 3; i++) {
      const pc = makeCar(1000 + (i - 1) * 60, 700 - 160 - i * 70, Math.PI / 2, { police: true, color: '#1c4ed8' });
      pc.speed = 460;
      state.policeCars.push(pc);
    }
    state.footCops.push(makePed(1150, 900, 'cop'));
    state.camera.x = clamp(p.x - 640, 0, WORLD_W - 1280);
    state.camera.y = clamp(p.y - 400, 0, WORLD_H - 800);
    stepWorld(state, 20);
    return;
  }
  if (name === 'mission') {
    state.screen = 'play';
    p.x = 1000; p.y = 520; p.hp = 100;
    state.money = 250;
    startMission(state);
    // The job is done the honest way: the player stole a car and reached
    // the garage, so finish through the mission module's own completion.
    if (state.mission) state.mission.step = 'garage';
    const car = makeCar(1000, 540, 0, { color: '#c0392b' });
    state.traffic.push(car);
    p.car = car; p.x = car.x; p.y = car.y;
    state.camera.x = clamp(p.x - 640, 0, WORLD_W - 1280);
    state.camera.y = clamp(p.y - 400, 0, WORLD_H - 800);
    completeMission(state);
    return;
  }
  state.screen = 'title';
}
