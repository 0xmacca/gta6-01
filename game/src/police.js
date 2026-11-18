// police.js — the wanted system: stars for crimes, police cars that chase
// and ram, foot cops that chase and arrest, and the BUSTED / WASTED outcomes.
import * as THREE from 'three';
import { CONFIG, clamp, angleDiff } from './config.js';
import { makeCarMesh, DriveCar } from './vehicles.js';
import { makeCharacterMesh } from './player.js';

export class PoliceSystem {
  constructor(scene, colliders, traffic, rng) {
    this.scene = scene;
    this.colliders = colliders;
    this.traffic = traffic;
    this.rng = rng;
    this.wanted = 0;
    this.lastCrimeAt = -999;
    this.decayTimer = 0;
    this.cars = [];   // DriveCar police cruisers
    this.cops = [];   // {mesh, pos, heading, arrestT, speed}
    this.flashT = 0;
  }

  addCrime(stars, now) {
    if (this.wanted < CONFIG.WANTED_MAX) {
      this.wanted = Math.min(CONFIG.WANTED_MAX, this.wanted + stars);
    }
    this.lastCrimeAt = now;
    this.decayTimer = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.removeAll();
  }

  removeAll() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.cars = []; this.cops = [];
  }

  // How many police cars / foot cops the current wanted level fields.
  desiredCounts() {
    const w = this.wanted;
    if (w === 0) return { cars: 0, cops: 0 };
    if (w === 1) return { cars: 1, cops: 1 };
    if (w === 2) return { cars: 2, cops: 2 };
    if (w === 3) return { cars: 3, cops: 2 };
    if (w === 4) return { cars: 3, cops: 3 };
    return { cars: 4, cops: 4 };
  }

  spawnCarNear(target) {
    const mesh = makeCarMesh(0x101418, { police: true });
    const a = this.rng() * Math.PI * 2;
    const d = 45 + this.rng() * 25;
    mesh.position.set(target.x + Math.sin(a) * d, 0, target.z + Math.cos(a) * d);
    this.scene.add(mesh);
    const drive = new DriveCar(mesh, CONFIG.POLICE_TOP_SPEED);
    drive.heading = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z);
    this.cars.push(drive);
    return drive;
  }

  spawnCopNear(target) {
    const mesh = makeCharacterMesh(0x1a2a4a, 0x1a2a4a, 0xc98d64);
    const a = this.rng() * Math.PI * 2;
    const d = 18 + this.rng() * 12;
    mesh.position.set(target.x + Math.sin(a) * d, 0, target.z + Math.cos(a) * d);
    this.scene.add(mesh);
    const cop = { mesh, pos: mesh.position, heading: 0, arrestT: 0, speed: 6.5 };
    this.cops.push(cop);
    return cop;
  }

  // dt, now, player state: {pos, inCar, drive, health}. Returns events.
  update(dt, now, player, onBusted, onWasted) {
    const events = [];
    // Wanted decay: quiet for a while and no police close by.
    if (this.wanted > 0 && now - this.lastCrimeAt > CONFIG.WANTED_DECAY_NO_CRIME_S) {
      this.decayTimer += dt;
      if (this.decayTimer > CONFIG.WANTED_DECAY_STEP_S) {
        this.wanted -= 1;
        this.decayTimer = 0;
        events.push('wanted-down');
      }
    }
    // Field the right number of units.
    const want = this.desiredCounts();
    while (this.cars.length < want.cars) this.spawnCarNear(player.pos);
    while (this.cops.length < want.cops) this.spawnCopNear(player.pos);
    while (this.cars.length > want.cars) {
      const c = this.cars.pop(); this.scene.remove(c.mesh);
    }
    while (this.cops.length > want.cops) {
      const c = this.cops.pop(); this.scene.remove(c.mesh);
    }
    // Flash the light bars.
    this.flashT += dt;
    const on = Math.floor(this.flashT * 3) % 2 === 0;
    for (const c of this.cars) {
      const f = c.mesh.userData.flash;
      if (!f) continue;
      f.red.material.emissiveIntensity = on ? 1.6 : 0.15;
      f.blue.material.emissiveIntensity = on ? 0.15 : 1.6;
    }
    const others = [...this.traffic.drivenCars(), ...this.cars];
    // Police cars chase the player and ram.
    for (const pc of this.cars) {
      const dx = player.pos.x - pc.pos.x, dz = player.pos.z - pc.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const steer = clamp(angleDiff(wantHeading, pc.heading) * 1.6, -1, 1);
      const throttle = dist > 6 ? 1 : 0.4;
      pc.update(dt, { throttle, steer }, this.colliders, others);
      // Ram the player's car: damage + shove.
      if (player.inCar && player.drive && dist < 4.5) {
        player.drive.damage += 12 * dt;
        player.drive.speed *= 0.96;
        if (player.drive.damage >= 100) events.push('car-disabled');
      }
      // Ram the player on foot.
      if (!player.inCar && dist < 2.2) {
        player.damage(25 * dt, now);
        if (player.health <= 0) onWasted();
      }
    }
    // Foot cops chase on foot and arrest.
    for (const cop of this.cops) {
      const dx = player.pos.x - cop.pos.x, dz = player.pos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (player.inCar) {
        // Cops cannot catch a car: they hold position, watching.
        cop.arrestT = 0;
        continue;
      }
      if (dist > 1.8) {
        const step = (cop.speed * dt) / Math.max(dist, 0.01);
        cop.pos.x += dx * step; cop.pos.z += dz * step;
        cop.heading = Math.atan2(dx, dz);
        cop.arrestT = 0;
      } else {
        cop.arrestT += dt;
        if (cop.arrestT > CONFIG.BUST_TIME_S) {
          onBusted();
          return events;
        }
      }
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = cop.heading;
      const s = Math.sin(now * 9);
      cop.mesh.userData.legL.rotation.x = s * 0.7;
      cop.mesh.userData.legR.rotation.x = -s * 0.7;
    }
    return events;
  }

  // Distance to the nearest police unit, for the siren and the HUD.
  nearestDistance(playerPos) {
    let best = Infinity;
    for (const c of this.cars) best = Math.min(best, c.pos.distanceTo(playerPos));
    for (const c of this.cops) best = Math.min(best, c.pos.distanceTo(playerPos));
    return best;
  }
}
