// config.js — Costa Verde: one clear job, every tunable number of the game.
// The city is a grid: blocks of BLOCK metres, roads ROAD wide, pitch PITCH.
// Roads run at x = k*PITCH and z = k*PITCH for k in -GRID..GRID.
export const CONFIG = {
  // City layout
  BLOCK: 44,
  ROAD: 14,
  get PITCH() { return this.BLOCK + this.ROAD; },
  GRID: 4,               // roads at -4..4 -> city about 520 m across
  BUILDING_MARGIN: 7,    // gap between road edge and building face
  // Player on foot
  WALK_SPEED: 6,
  SPRINT_SPEED: 10,
  JUMP_SPEED: 8,
  GRAVITY: 22,
  PLAYER_RADIUS: 0.6,
  PLAYER_HEIGHT: 1.8,
  // Cars
  CAR_TOP_SPEED: 34,
  CAR_ACCEL: 16,
  CAR_BRAKE: 30,
  CAR_REVERSE_SPEED: 10,
  CAR_STEER: 0.55,
  TRAFFIC_COUNT: 14,
  TRAFFIC_SPEED: 9,
  PARKED_COUNT: 10,
  POLICE_TOP_SPEED: 38,
  // People
  PED_COUNT: 22,
  // Wanted
  WANTED_MAX: 5,
  WANTED_DECAY_NO_CRIME_S: 20,
  WANTED_DECAY_STEP_S: 9,
  BUST_TIME_S: 2.0,
  // Combat
  PLAYER_HEALTH: 100,
  HEALTH_REGEN_DELAY_S: 5,
  HEALTH_REGEN_RATE: 3,
  PISTOL_DAMAGE: 34,
  PISTOL_FIRE_RATE_S: 0.22,
  PUNCH_DAMAGE: 20,
  PUNCH_RANGE: 2.2,
  // Missions
  MISSION_REWARDS: [200, 350, 500, 800, 1500],
  // Rendering
  SHADOW_MAP_SIZE: 1024,
  FOG_NEAR: 120,
  FOG_FAR: 420,
  DAY_SKY: 0x87b5d6,
  SUNSET_SKY: 0xff9a56,
};

// mulberry32 — tiny deterministic RNG, seeded from the URL (?seed=) for shots.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with a given rng.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Clamp a value between lo and hi.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Shortest signed angle difference, in radians.
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
