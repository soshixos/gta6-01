// Save / load via localStorage. Guarded so importing in Node never touches it.
export const SAVE_KEY = 'porto-verde-save-v1';
export function saveGame(state) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const data = {
      money: state.money, hp: state.player.hp, pistol: state.pistol,
      x: state.player.x, y: state.player.y,
      missionIndex: state.missionIndex, missionsDone: state.missionsDone,
      storyComplete: state.storyComplete, savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
export function loadGame() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasSave() { return loadGame() !== null; }
export function clearSave() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
