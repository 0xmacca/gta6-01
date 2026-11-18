// save.js — localStorage save: money, story progress, position, health.
// Nothing leaves the browser; Continue on the title screen loads it back.
const KEY = 'costaverde-save-v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: Math.floor(state.money),
      missionIndex: state.missionIndex,
      x: state.x, z: state.z,
      health: state.health,
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* no storage */ }
}
