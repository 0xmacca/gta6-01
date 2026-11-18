// pedestrians.js — the people of Costa Verde: they stroll the sidewalks,
// flee gunfire and speeding cars, and go down when hit. Hitting one is a
// crime, and the police notice.
import * as THREE from 'three';
import { CONFIG, mulberry32, pick } from './config.js';
import { makeCharacterMesh } from './player.js';
import { onRoad } from './city.js';

const SHIRTS = [0xd06040, 0x40a060, 0xd0b040, 0x8040a0, 0x40a0c0, 0xc0c0c0, 0x303030];

export class PedestrianSystem {
  constructor(scene, colliders, rng) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = rng;
    this.peds = [];   // {mesh, pos, heading, speed, state, downT, walkPhase}
    this.spawnInitial();
  }

  spawnInitial() {
    const { PITCH, GRID } = CONFIG;
    for (let n = 0; n < CONFIG.PED_COUNT; n++) {
      const k = Math.floor(this.rng() * (2 * GRID + 1)) - GRID;
      const along = (this.rng() * 2 - 1) * GRID * PITCH;
      const horiz = this.rng() < 0.5;
      const side = this.rng() < 0.5 ? 1 : -1;
      const mesh = makeCharacterMesh(pick(this.rng, SHIRTS), 0x3a3f45, 0xc98d64);
      const x = horiz ? along : k * PITCH + side * (CONFIG.ROAD / 2 + 1.5);
      const z = horiz ? k * PITCH + side * (CONFIG.ROAD / 2 + 1.5) : along;
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.peds.push({
        mesh, pos: mesh.position,
        heading: horiz ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
        speed: 1.2 + this.rng() * 0.8,
        state: 'walk', downT: 0, walkPhase: this.rng() * 6,
        horiz, side, roadK: k,
      });
    }
  }

  // A ped at this position, within range, that is still standing.
  nearest(pos, range = 3) {
    let best = null, bestD = range;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  knockDown(ped) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downT = 0;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.35;
  }

  // Scare every ped near a point: they run away from it.
  scare(pos, radius = 25) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius) {
        p.state = 'flee';
        p.fleeFrom = { x: pos.x, z: pos.z };
        p.fleeT = 0;
      }
    }
  }

  update(dt, playerPos, playerCar) {
    for (const p of this.peds) {
      if (p.state === 'down') {
        p.downT += dt;
        if (p.downT > 6) {
          p.state = 'walk';
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
        }
        continue;
      }
      let speed = p.speed;
      if (p.state === 'flee') {
        p.fleeT += dt;
        speed = 5;
        const dx = p.pos.x - p.fleeFrom.x, dz = p.pos.z - p.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / d, dz / d);
        if (p.fleeT > 4) p.state = 'walk';
      } else if (playerCar && Math.hypot(p.pos.x - playerCar.pos.x, p.pos.z - playerCar.pos.z) < 6
        && Math.abs(playerCar.speed) > 8) {
        // A speeding car is coming: step aside, fast.
        p.state = 'flee';
        p.fleeFrom = { x: playerCar.pos.x, z: playerCar.pos.z };
        p.fleeT = 0;
      }
      // Walk along the sidewalk line, turning at the city edge.
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      p.pos.x += fx * speed * dt;
      p.pos.z += fz * speed * dt;
      const lim = CONFIG.GRID * CONFIG.PITCH + 10;
      if (Math.abs(p.pos.x) > lim || Math.abs(p.pos.z) > lim) {
        p.heading += Math.PI;
      }
      // Stay on the sidewalk: nudge back onto the line.
      if (p.state === 'walk') {
        if (p.horiz) {
          const targetZ = p.roadK * CONFIG.PITCH + p.side * (CONFIG.ROAD / 2 + 1.5);
          p.pos.z += (targetZ - p.pos.z) * Math.min(1, dt * 2);
        } else {
          const targetX = p.roadK * CONFIG.PITCH + p.side * (CONFIG.ROAD / 2 + 1.5);
          p.pos.x += (targetX - p.pos.x) * Math.min(1, dt * 2);
        }
      }
      p.walkPhase += speed * dt * 2.2;
      const s = Math.sin(p.walkPhase);
      p.mesh.userData.legL.rotation.x = s * 0.6;
      p.mesh.userData.legR.rotation.x = -s * 0.6;
      p.mesh.userData.armL.rotation.x = -s * 0.5;
      p.mesh.userData.armR.rotation.x = s * 0.5;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
    }
  }
}
