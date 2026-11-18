// player.js — Leo Marlow on foot: third-person movement, jumping, camera
// orbit, and the little box-built character with swinging limbs.
import * as THREE from 'three';
import { CONFIG, clamp } from './config.js';
import { resolveCircleCollision } from './city.js';

export function makeCharacterMesh(shirt = 0x2a6f9e, pants = 0x2e3134, skin = 0xc98d64) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat(shirt));
  body.position.y = 1.08; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), mat(skin));
  head.position.y = 1.68; head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42), mat(0x1c1a18));
  hair.position.y = 1.93;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), mat(pants));
  legL.position.set(-0.16, 0.36, 0); legL.castShadow = true;
  const legR = legL.clone(); legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), mat(shirt));
  armL.position.set(-0.44, 1.1, 0); armL.castShadow = true;
  const armR = armL.clone(); armR.position.x = 0.44;
  g.add(body, head, hair, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene, colliders, start) {
    this.colliders = colliders;
    this.pos = new THREE.Vector3(start.x, 0, start.z);
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;      // facing -z (into the city)
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 7;
    this.onGround = true;
    this.health = CONFIG.PLAYER_HEALTH;
    this.money = 0;
    this.lastDamageAt = -99;
    this.walkPhase = 0;
    this.mesh = makeCharacterMesh();
    scene.add(this.mesh);
    this.camera = null;
  }

  attachCamera(camera) { this.camera = camera; }

  // keys: {forward, back, left, right, sprint, jump}; dt seconds.
  update(dt, keys, now) {
    const speed = keys.sprint ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;
    // Move relative to the camera yaw.
    const f = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const move = new THREE.Vector3();
    if (keys.forward) move.add(f);
    if (keys.back) move.sub(f);
    if (keys.right) move.add(r);
    if (keys.left) move.sub(r);
    const moving = move.lengthSq() > 0;
    if (moving) {
      move.normalize();
      this.pos.addScaledVector(move, speed * dt);
      this.heading = Math.atan2(move.x, move.z);
    }
    if (keys.jump && this.onGround) {
      this.vel.y = CONFIG.JUMP_SPEED;
      this.onGround = false;
    }
    this.vel.y -= CONFIG.GRAVITY * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    resolveCircleCollision(this.pos, CONFIG.PLAYER_RADIUS, this.colliders);
    // Keep inside the city.
    const lim = CONFIG.GRID * CONFIG.PITCH + 30;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim - 40, lim);
    // Health regen after a quiet spell.
    if (now - this.lastDamageAt > CONFIG.HEALTH_REGEN_DELAY_S && this.health > 0) {
      this.health = Math.min(CONFIG.PLAYER_HEALTH, this.health + CONFIG.HEALTH_REGEN_RATE * dt);
    }
    // Animate the limbs.
    this.walkPhase += (moving ? speed : 0) * dt * 1.6;
    const s = moving ? Math.sin(this.walkPhase) : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = s * 0.7; u.legR.rotation.x = -s * 0.7;
    u.armL.rotation.x = -s * 0.55; u.armR.rotation.x = s * 0.55;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.updateCamera(dt);
    return moving;
  }

  updateCamera(dt) {
    if (!this.camera) return;
    const cx = this.pos.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.pos.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = this.pos.y + 1.6 + Math.sin(this.camPitch) * this.camDist;
    this.camera.position.set(cx, Math.max(cy, 0.6), cz);
    this.camera.lookAt(this.pos.x, this.pos.y + 1.4, this.pos.z);
  }

  damage(amount, now) {
    if (this.health <= 0) return;
    this.health -= amount;
    this.lastDamageAt = now;
  }

  resetTo(x, z, health = CONFIG.PLAYER_HEALTH) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.health = health;
    this.mesh.position.copy(this.pos);
  }
}
