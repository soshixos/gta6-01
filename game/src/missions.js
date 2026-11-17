// The five jobs for Madame Alba, sequential. Each mission is a small state
// machine: marker -> steps -> pay. State lives on the shared game state.
import { LANDMARKS, dist } from './config.js';
import { makePed } from './peds.js';

export const MISSIONS = [
  { id: 1, title: 'WHEELS FOR ALBA', pay: 300, marker: LANDMARKS.garage, desc: 'Steal any car, then drive it to the garage.' },
  { id: 2, title: 'DOCK RUN', pay: 500, marker: LANDMARKS.docks, desc: 'Pick up at the Docks, deliver to Club Alba in 150 s. Pistol unlocked.' },
  { id: 3, title: 'SHAKE THE TAIL', pay: 600, marker: LANDMARKS.hideout, desc: 'Lose a 2-star wanted level, then reach the Hideout.' },
  { id: 4, title: 'WAREHOUSE PAYBACK', pay: 800, marker: LANDMARKS.warehouse, desc: 'Clear Warehouse 9 of 4 armed Vipers, then leave the area.' },
  { id: 5, title: 'THE VERDE SCORE', pay: 1500, marker: LANDMARKS.club, desc: '4 checkpoints in 130 s, then escape to Solmar Beach.' },
];

const CHECKPOINTS = [
  { x: 2200, y: 200, name: 'Neon Row' },
  { x: 200, y: 200, name: 'Old Harbour' },
  { x: 1000, y: 1160, name: 'Palm Heights' },
  { x: 1800, y: 1480, name: 'The Docks' },
];

export function currentMission(state) {
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}
export function markerPos(state) {
  const m = currentMission(state);
  return m ? m.marker : null;
}
// Where the player should go right now (mission target), or null.
export function missionTarget(state) {
  const m = state.mission;
  if (!m || !m.active) return markerPos(state);
  if (m.step === 'toMarker') return m.marker;
  if (m.step === 'pickup') return LANDMARKS.docks;
  if (m.step === 'deliver') return LANDMARKS.club;
  if (m.step === 'loseCops') return LANDMARKS.hideout;
  if (m.step === 'warehouse') return LANDMARKS.warehouse;
  if (m.step === 'leave') return { x: 600, y: 840 };
  if (m.step === 'checkpoint') return CHECKPOINTS[m.cp || 0];
  if (m.step === 'escape') return LANDMARKS.beach;
  if (m.step === 'garage') return LANDMARKS.garage;
  return markerPos(state);
}
export function objectiveText(state) {
  const m = state.mission;
  if (!m || !m.active) {
    const cur = currentMission(state);
    return cur ? 'Go to the yellow marker — ' + cur.title : 'STORY COMPLETE — free roam';
  }
  switch (m.step) {
    case 'steal': return 'JOB: ' + m.title + ' — steal any car';
    case 'garage': return 'JOB: ' + m.title + ' — drive to the garage';
    case 'pickup': return 'JOB: ' + m.title + ' — pick up at the Docks';
    case 'deliver': return 'JOB: ' + m.title + ' — deliver to Club Alba';
    case 'loseCops': return 'JOB: ' + m.title + ' — lose the cops, then reach the Hideout';
    case 'warehouse': return 'JOB: ' + m.title + ' — defeat the Vipers (' + (m.kills || 0) + '/4)';
    case 'leave': return 'JOB: ' + m.title + ' — leave the warehouse area';
    case 'checkpoint': return 'JOB: ' + m.title + ' — checkpoint ' + ((m.cp || 0) + 1) + '/4: ' + CHECKPOINTS[m.cp || 0].name;
    case 'escape': return 'JOB: ' + m.title + ' — escape to Solmar Beach';
    default: return 'JOB: ' + m.title;
  }
}

export function startMission(state) {
  const cur = currentMission(state);
  if (!cur || (state.mission && state.mission.active)) return false;
  const m = { id: cur.id, title: cur.title, pay: cur.pay, active: true, timer: 0, step: 'toMarker', marker: cur.marker, cp: 0, kills: 0 };
  if (cur.id === 1) m.step = 'steal';
  if (cur.id === 2) { m.step = 'pickup'; m.timer = 150; }
  if (cur.id === 3) { m.step = 'loseCops'; state.wanted = 2; state.timeSinceCrime = 0; }
  if (cur.id === 4) {
    m.step = 'warehouse';
    state.gangsters = [];
    for (let i = 0; i < 4; i++) {
      const g = makePed(LANDMARKS.warehouse.x + (i % 2 ? 90 : -90), LANDMARKS.warehouse.y + (i < 2 ? -70 : 70), 'gangster');
      state.gangsters.push(g);
    }
  }
  if (cur.id === 5) { m.step = 'checkpoint'; m.timer = 130; m.cp = 0; }
  state.mission = m;
  state.toast = 'JOB STARTED — ' + cur.title;
  return true;
}

export function failMission(state, reason) {
  if (!state.mission) return;
  state.mission = null;
  state.gangsters = [];
  state.failReason = reason || 'Job failed';
  state.screen = 'failed';
  if (state.audio) state.audio.fail();
}

export function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  state.money += m.pay;
  state.missionsDone.push(m.id);
  state.missionIndex += 1;
  if (m.id === 2) state.pistol = true;
  if (m.id === 5) state.storyComplete = true;
  state.mission = null;
  state.gangsters = [];
  state.jobDone = { title: m.title, pay: m.pay };
  state.screen = 'jobdone';
  if (state.audio) state.audio.jingle();
  if (state.save) state.save();
}

function near(state, p, r = 70) {
  return dist(state.player.x, state.player.y, p.x, p.y) < r;
}

// Called every frame while a mission is active. Returns nothing; mutates state.
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m || !m.active) return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(state, 'Out of time'); return; }
  }
  switch (m.id) {
    case 1:
      if (m.step === 'steal' && state.player.car) m.step = 'garage';
      else if (m.step === 'garage' && near(state, LANDMARKS.garage, 80)) completeMission(state);
      break;
    case 2:
      if (m.step === 'pickup' && near(state, LANDMARKS.docks, 80)) { m.step = 'deliver'; state.toast = 'Package picked up — deliver to Club Alba'; }
      else if (m.step === 'deliver' && near(state, LANDMARKS.club, 80)) completeMission(state);
      break;
    case 3:
      if (m.step === 'loseCops' && state.wanted === 0 && near(state, LANDMARKS.hideout, 80)) completeMission(state);
      break;
    case 4:
      if (m.step === 'warehouse' && (m.kills || 0) >= 4) { m.step = 'leave'; state.toast = 'Warehouse clear — get out of here'; }
      else if (m.step === 'leave' && dist(state.player.x, state.player.y, LANDMARKS.warehouse.x, LANDMARKS.warehouse.y) > 320) completeMission(state);
      break;
    case 5:
      if (m.step === 'checkpoint') {
        const cp = CHECKPOINTS[m.cp || 0];
        if (near(state, cp, 80)) {
          m.cp += 1;
          if (state.audio) state.audio.pickup();
          if (m.cp >= CHECKPOINTS.length) { m.step = 'escape'; state.toast = 'All checkpoints hit — run for the beach'; }
        }
      } else if (m.step === 'escape' && near(state, LANDMARKS.beach, 90)) completeMission(state);
      break;
    default:
      break;
  }
}
