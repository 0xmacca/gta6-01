// shots.js — deterministic screenshot scenes for ?shot=cover|foot|mission|start.
// Each one stages the game (places the player, sets the wanted level, starts
// a mission, picks the light) so the screenshots are real renders of the
// game's own code, then flags window.__shotReady for the capture script.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function stageShot(game, mode) {
  const { player, traffic, police, missions, places } = game;
  window.__shotReady = false;
  const finish = () => { window.__shotReady = true; };

  if (mode === 'start') {
    // Title screen over the city at golden hour.
    game.setTimeOfDay('golden');
    game.showMenu();
    game.camera.position.set(60, 42, 150);
    game.camera.lookAt(0, 8, 0);
    setTimeout(finish, 900);
    return;
  }

  game.hideMenu();
  game.phase = 'playing';

  if (mode === 'cover') {
    // Driving chase down the x=0 road: player car heading -z on the road
    // (not through a block), one police car head-on in the oncoming lane
    // so it is visible ahead in the chase camera, a second cruiser behind.
    game.setTimeOfDay('sunset');
    const parked = traffic.parked.find((p) => !p.taken);
    const drive = traffic.stealParked(parked);
    drive.pos.set(0, 0, 116);
    drive.heading = Math.PI;
    drive.speed = 22;
    game.enterCar(drive, parked, true);
    police.wanted = 3;
    police.lastCrimeAt = game.now;
    const copAhead = police.spawnCarNear(player.pos);
    copAhead.pos.set(-7, 0, 86);
    copAhead.heading = 0;
    copAhead.speed = 5;
    const copBehind = police.spawnCarNear(player.pos);
    copBehind.pos.set(0, 0, 150);
    copBehind.heading = Math.PI;
    copBehind.speed = 14;
    missions.index = 1; missions.active = true; missions.step = 1;
    missions.showMarkerAt('docks');
    game.hud.showToast('Job 2 — Deliver the package to the docks', game.now);
    // Chase camera behind the car from the first frame: camYaw already at
    // heading + PI (2*PI == 0) so there is no slow ease-around during the
    // screenshot window.
    player.camYaw = 0;
    setTimeout(finish, 1400);
    return;
  }

  if (mode === 'mission') {
    // On foot just south of the pier: the package marker is 12 m ahead in
    // frame, the sea beyond it. Camera south of the player, looking north.
    game.setTimeOfDay('dusk');
    player.resetTo(places.pier.x, places.pier.z + 12);
    player.heading = Math.PI;
    player.camYaw = 0;
    missions.index = 1; missions.active = true; missions.step = 0;
    missions.showMarkerAt('pier');
    game.hud.showToast('Job 2 — Collect the package at the pier', game.now);
    setTimeout(finish, 1200);
    return;
  }

  // mode === 'foot': on foot downtown, traffic and peds around, 1 star.
  game.setTimeOfDay('day');
  player.resetTo(places.spawn.x, places.spawn.z);
  player.camYaw = Math.PI * 1.05;
  police.wanted = 1;
  police.lastCrimeAt = game.now;
  police.spawnCarNear(player.pos);
  missions.index = 0; missions.active = true; missions.step = 0;
  game.hud.showToast('Job 1 — Steal any car', game.now);
  setTimeout(finish, 1400);
}

// Read the shot mode and seed from the URL (?shot=cover&seed=7).
export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: parseInt(q.get('seed') || '7', 10) || 7,
  };
}
