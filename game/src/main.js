// Porto Verde — game loop, rules, screens, input wiring.
import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, SEED, clamp, lerp, dist, angleTo } from './config.js';
import { RNG } from './random.js';
import { generateCity, buildingAt, resolveOutOfBuildings } from './city.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { makeCar, spawnTraffic, spawnParked, updatePlayerCar, updateTraffic, resolveCarCollisions } from './vehicles.js';
import { makePed, spawnWalkers, updateWalker, updateGangster, updateCop } from './peds.js';
import { addWanted, updateWanted, updatePoliceCar } from './police.js';
import { currentMission, markerPos, startMission, updateMission } from './missions.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { drawWorld, drawHUD, drawScreen } from './render.js';
import { setupShot } from './shots.js';

export function createState() {
  const rng = new RNG(SEED);
  const city = generateCity(SEED);
  const state = {
    city, rng, time: 0, screen: 'title',
    player: { x: 1000, y: 840, hp: 100, aim: 0, car: null, shootCd: 0, punchCd: 0 },
    money: 250, pistol: false, wanted: 0, timeSinceCrime: 0, decayT: 0,
    traffic: spawnTraffic(rng, 34),
    parked: spawnParked(rng, 26),
    walkers: spawnWalkers(rng, 40),
    gangsters: [], footCops: [], policeCars: [],
    mission: null, missionIndex: 0, missionsDone: [], storyComplete: false,
    camera: { x: 0, y: 0 }, tracers: [], toast: '', toastT: 0,
    hint: '', muted: false, hasSave: hasSave(), jobDone: null, failReason: '', lastFine: 0,
    saveT: 0, audio: new AudioSys(),
  };
  state.allCars = () => [...state.traffic, ...state.parked, ...state.policeCars];
  state.save = () => saveGame(state);
  return state;
}

function newGame(state) {
  const fresh = createState();
  Object.keys(fresh).forEach((k) => { state[k] = fresh[k]; });
  state.screen = 'play';
  state.hasSave = hasSave();
}

function continueGame(state) {
  const data = loadGame();
  if (!data) { newGame(state); return; }
  state.money = data.money; state.player.hp = data.hp; state.pistol = data.pistol;
  state.player.x = data.x; state.player.y = data.y;
  state.missionIndex = data.missionIndex; state.missionsDone = data.missionsDone || [];
  state.storyComplete = !!data.storyComplete;
  state.screen = 'play';
}

function setToast(state, msg) { state.toast = msg; state.toastT = 3; }

function nearestCar(state, maxD) {
  let best = null, bd = maxD;
  for (const c of state.allCars()) {
    if (c.wrecked) continue;
    const d = dist(state.player.x, state.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function witnessNear(state, r) {
  for (const p of state.walkers) if (p.alive && dist(state.player.x, state.player.y, p.x, p.y) < r) return true;
  for (const c of state.footCops) if (c.alive && dist(state.player.x, state.player.y, c.x, c.y) < r) return true;
  for (const c of state.policeCars) if (dist(state.player.x, state.player.y, c.x, c.y) < r) return true;
  return false;
}

function enterCar(state, car) {
  if (car.police) { setToast(state, 'You cannot steal a police car'); return; }
  if (car.parked) {
    if (witnessNear(state, 460)) addWanted(state, 1, 'steal witnessed');
    car.parked = false;
  } else if (car.traffic) {
    // Jacking: the driver flees on foot.
    const d = makePed(car.x + 20, car.y + 20, 'walker');
    state.walkers.push(d);
    car.traffic = false;
    addWanted(state, 2, 'jack');
  }
  state.player.car = car;
  state.player.x = car.x; state.player.y = car.y;
  state.audio.blip();
}

function exitCar(state) {
  const car = state.player.car;
  if (!car) return;
  state.player.car = null;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  resolveOutOfBuildings(state.city, state.player, 10);
}

function shoot(state) {
  const p = state.player;
  if (!state.pistol || p.shootCd > 0) return;
  p.shootCd = 0.28;
  state.audio.gunshot();
  const range = 520;
  const ex = p.x + Math.cos(p.aim) * range, ey = p.y + Math.sin(p.aim) * range;
  let hit = null, hd = range;
  const targets = [...state.gangsters, ...state.footCops];
  for (const t of targets) {
    if (!t.alive) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > range) continue;
    const a = angleTo(p.x, p.y, t.x, t.y);
    let diff = a - p.aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.18 && d < hd) { hd = d; hit = t; }
  }
  const tx = hit ? hit.x : ex, ty = hit ? hit.y : ey;
  state.tracers.push({ x1: p.x, y1: p.y, x2: tx, y2: ty, t: 0.25 });
  if (hit) {
    hit.hp -= 34;
    if (hit.hp <= 0) {
      hit.alive = false;
      if (hit.kind === 'gangster') {
        if (state.mission) state.mission.kills = (state.mission.kills || 0) + 1;
      } else if (hit.kind === 'cop') addWanted(state, 3, 'kill cop');
    }
  }
  // Shooting in front of a cop adds heat.
  for (const c of state.footCops) if (c.alive && dist(p.x, p.y, c.x, c.y) < 500) { addWanted(state, 1, 'shoot at cop'); break; }
}

function punch(state) {
  const p = state.player;
  if (p.punchCd > 0) return;
  p.punchCd = 0.35;
  state.audio.punch();
  for (const t of [...state.gangsters, ...state.footCops, ...state.walkers]) {
    if (!t.alive) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > 44) continue;
    const a = angleTo(p.x, p.y, t.x, t.y);
    let diff = a - p.aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.2) continue;
    t.hp -= 26;
    if (t.hp <= 0) {
      t.alive = false;
      if (t.kind === 'gangster' && state.mission) state.mission.kills = (state.mission.kills || 0) + 1;
      if (t.kind === 'cop') addWanted(state, 3, 'kill cop');
    }
  }
}

function busted(state) {
  const fine = Math.min(200, state.money);
  state.lastFine = fine;
  state.money -= fine;
  state.wanted = 0;
  state.policeCars = []; state.footCops = [];
  state.screen = 'busted';
  state.audio.busted();
  state.save();
}

function wasted(state) {
  state.money = Math.max(0, state.money - 100);
  state.player.hp = 100;
  if (state.player.car) state.player.car = null;
  state.player.x = 1000; state.player.y = 840;
  state.wanted = 0;
  state.policeCars = []; state.footCops = [];
  state.screen = 'wasted';
  state.audio.fail();
  state.save();
}

function update(state, input, dt) {
  state.time += dt;
  if (state.toastT > 0) state.toastT -= dt; else state.toast = '';
  for (const t of state.tracers) t.t -= dt;
  state.tracers = state.tracers.filter((t) => t.t > 0);
  const p = state.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  // Aim from mouse.
  p.aim = Math.atan2(input.mouse.y + state.camera.y - p.y, input.mouse.x + state.camera.x - p.x);
  state.hint = '';

  if (state.screen === 'play') {
    if (p.car) {
      const car = p.car;
      updatePlayerCar(car, {
        up: input.down('w') || input.down('ArrowUp'),
        down: input.down('s') || input.down('ArrowDown'),
        left: input.down('a') || input.down('ArrowLeft'),
        right: input.down('d') || input.down('ArrowRight'),
        handbrake: input.down(' '),
      }, dt, state.city, (speed) => { car.hp -= (speed - 200) * 0.15; state.audio.crash(); });
      p.x = car.x; p.y = car.y;
      state.audio.setEngine(Math.abs(car.speed) / 560);
      if (input.wasPressed('e')) {
        const marker = markerPos(state);
        if (marker && dist(p.x, p.y, marker.x, marker.y) < 90 && !state.mission) startMission(state);
        else exitCar(state);
      }
      // Run over pedestrians.
      for (const w of [...state.walkers, ...state.footCops, ...state.gangsters]) {
        if (!w.alive) continue;
        if (dist(car.x, car.y, w.x, w.y) < 26 && Math.abs(car.speed) > 60) {
          w.alive = false;
          addWanted(state, 2, 'kill ped');
          state.audio.crash();
        }
      }
      if (car.hp <= 0 && !car.wrecked) {
        car.wrecked = true; car.speed = 0;
        p.car = null; p.hp -= 30;
        p.x = car.x + 30; p.y = car.y + 30;
        setToast(state, 'Car wrecked!');
        if (p.hp <= 0) { wasted(state); return; }
      }
    } else {
      const run = input.down('Shift');
      const speed = run ? 265 : 175;
      let mx = 0, my = 0;
      if (input.down('w') || input.down('ArrowUp')) my -= 1;
      if (input.down('s') || input.down('ArrowDown')) my += 1;
      if (input.down('a') || input.down('ArrowLeft')) mx -= 1;
      if (input.down('d') || input.down('ArrowRight')) mx += 1;
      if (mx || my) {
        const len = Math.hypot(mx, my);
        const nx = p.x + (mx / len) * speed * dt;
        const ny = p.y + (my / len) * speed * dt;
        if (!buildingAt(state.city, nx, p.y, 10)) p.x = nx;
        if (!buildingAt(state.city, p.x, ny, 10)) p.y = ny;
        p.x = clamp(p.x, 20, WORLD_W - 20);
        p.y = clamp(p.y, 20, WORLD_H - 20);
        resolveOutOfBuildings(state.city, p, 10);
      }
      state.audio.setEngine(0);
      if (input.wasPressed('f')) punch(state);
      if (input.mouse.clicked) shoot(state);
      if (input.wasPressed('e')) {
        const marker = markerPos(state);
        if (marker && dist(p.x, p.y, marker.x, marker.y) < 90 && !state.mission) startMission(state);
        else {
          const car = nearestCar(state, 64);
          if (car) enterCar(state, car);
        }
      }
      const car = nearestCar(state, 64);
      if (car) state.hint = car.police ? 'Police car — cannot steal' : 'E — STEAL CAR';
      else {
        const marker = markerPos(state);
        if (marker && dist(p.x, p.y, marker.x, marker.y) < 90 && !state.mission) {
          const m = currentMission(state);
          state.hint = 'E — START JOB: ' + (m ? m.title : '');
        }
      }
    }
    // Traffic + walkers.
    for (const c of state.traffic) updateTraffic(c, dt, state.city, state.allCars(), state.rng);
    for (const w of state.walkers) updateWalker(w, dt, state.rng, state.city);
    resolveCarCollisions(state.allCars(), (a, b) => {
      // A police ram bounces the police car off instead of grinding on the
      // player's car and pinning it in place.
      if (a.police && b === state.player.car) a.speed = -Math.abs(a.speed) * 0.4;
      if (b.police && a === state.player.car) b.speed = -Math.abs(b.speed) * 0.4;
      state.audio.crash();
    });
    for (const c of state.allCars()) resolveOutOfBuildings(state.city, c, 14);
    // Gangsters.
    for (const g of state.gangsters) {
      updateGangster(g, p, dt, state.rng, (gg, hit) => {
        if (hit && !p.car) { p.hp -= 12; state.audio.gunshot(); if (p.hp <= 0) wasted(state); }
        else if (hit && p.car) { p.car.hp -= 12; }
      });
    }
    // Police.
    updateWanted(state, dt);
    for (const c of state.policeCars) {
      updatePoliceCar(c, p, dt, state.city);
      if (dist(c.x, c.y, p.x, p.y) < 46) {
        if (p.car) { p.car.hp -= 12 * dt; if (p.car.hp <= 0) { p.car.wrecked = true; } }
        else { p.hp -= 15 * dt; if (p.hp <= 0) { wasted(state); return; } }
      }
    }
    for (const c of state.footCops) {
      // Only an on-foot player can be grabbed and busted.
      if (!p.car && updateCop(c, p, dt)) { busted(state); return; }
      else if (p.car) updateCop(c, p, dt);
    }
    updateMission(state, dt);
    if (state.screen !== 'play') return; // mission may have flipped the screen
    state.audio.setSiren(state.wanted > 0, dt);
    // Autosave.
    state.saveT += dt;
    if (state.saveT >= 15) { state.saveT = 0; state.save(); }
  }

  // Camera follows the player with a soft lerp, clamped to the world.
  const tx = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  const ty = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  state.camera.x = lerp(state.camera.x, tx, 1 - Math.pow(0.001, dt));
  state.camera.y = lerp(state.camera.y, ty, 1 - Math.pow(0.001, dt));
}

export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = createState();
  const input = new Input();
  input.attach(window, canvas);
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = params.get('seed');

  function render() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (state.screen === 'title') {
      drawWorld(ctx, state);
      drawScreen(ctx, state, 'title');
    } else if (state.screen === 'paused') {
      drawWorld(ctx, state); drawHUD(ctx, state); drawScreen(ctx, state, 'paused');
    } else if (state.screen === 'play') {
      drawWorld(ctx, state); drawHUD(ctx, state);
    } else {
      drawWorld(ctx, state); drawHUD(ctx, state);
      drawScreen(ctx, state, state.screen);
    }
  }

  // Test / screenshot hooks (used by the headless playtest driver).
  window.__pv = {
    state, input, newGame: () => newGame(state), continueGame: () => continueGame(state),
    startMission: () => startMission(state),
    teleport: (x, y) => { state.player.x = x; state.player.y = y; state.camera.x = clamp(x - VIEW_W / 2, 0, WORLD_W - VIEW_W); state.camera.y = clamp(y - VIEW_H / 2, 0, WORLD_H - VIEW_H); },
    giveCar: () => { const c = makeCar(state.player.x + 30, state.player.y, 0, { color: '#c0392b' }); state.traffic.push(c); state.player.car = c; return c; },
    setWanted: (n) => { state.wanted = n; state.timeSinceCrime = 0; },
    spawnPolice: () => updateWanted(state, 0),
    enterNearestCar: () => { const c = nearestCar(state, 200); if (c) enterCar(state, c); return !!c; },
    render,
  };

  if (shot) {
    // Screenshot scene: set up from a fresh world, render one frame, signal ready.
    newGame(state);
    setupShot(state, shot);
    render();
    document.title = 'READY';
    return;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (input.wasPressed('m')) { state.muted = state.audio.toggleMute(); }
    if (state.screen === 'title') {
      state.audio.ensure();
      if (input.wasPressed('Enter')) continueGame(state);
      else if (input.wasPressed('n')) newGame(state);
    } else if (state.screen === 'paused') {
      if (input.wasPressed('p') || input.wasPressed('Escape')) state.screen = 'play';
    } else if (state.screen === 'play') {
      if (input.wasPressed('p') || input.wasPressed('Escape')) state.screen = 'paused';
      else update(state, input, dt);
    } else {
      if (input.wasPressed('Enter')) { state.screen = 'play'; if (state.player.hp <= 0) state.player.hp = 100; }
    }
    render();
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
