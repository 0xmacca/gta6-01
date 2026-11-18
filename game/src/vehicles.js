// vehicles.js — cars: the box-built car mesh, city traffic that follows the
// road graph, parked cars to steal, and the arcade driving model the player
// and the police share.
import * as THREE from 'three';
import { CONFIG, clamp, angleDiff, pick } from './config.js';
import { resolveCircleCollision, onRoad } from './city.js';

// Build one car from boxes: body, cabin, wheels, lights. Faces +z locally.
export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55; body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), dark);
  cabin.position.set(0, 1.1, -0.25); cabin.castShadow = true;
  g.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e10 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.36, z);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({
    color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.7,
  });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    h.position.set(x, 0.62, 2.21); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xb02020, emissive: 0x801010, emissiveIntensity: 0.5 }));
    t.position.set(x, 0.62, -2.21); g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    bar.position.set(0, 1.5, -0.25); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 }));
    red.position.set(-0.28, 1.62, -0.25); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 }));
    blue.position.set(0.28, 1.62, -0.25); g.add(blue);
    g.userData.flash = { red, blue };
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0xa88400, emissiveIntensity: 0.4 }));
    sign.position.set(0, 1.5, -0.25); g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

// Arcade driving state shared by the player car and police cars.
export class DriveCar {
  constructor(mesh, topSpeed = CONFIG.CAR_TOP_SPEED) {
    this.mesh = mesh;
    this.pos = mesh.position;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.topSpeed = topSpeed;
    this.damage = 0;      // 0..100, at 100 the car dies
    this.dead = false;
  }

  // input: {throttle -1..1, steer -1..1}; others: DriveCars to bump.
  update(dt, input, colliders, others = []) {
    if (this.dead) return;
    const accel = input.throttle > 0 ? CONFIG.CAR_ACCEL * input.throttle
      : input.throttle < 0 ? CONFIG.CAR_BRAKE * input.throttle : 0;
    this.speed += accel * dt;
    // drag, stronger off-road
    const drag = onRoad(this.pos.x, this.pos.z) ? 0.25 : 0.9;
    this.speed -= this.speed * drag * dt;
    if (this.speed > this.topSpeed) this.speed = this.topSpeed;
    if (this.speed < -CONFIG.CAR_REVERSE_SPEED) this.speed = -CONFIG.CAR_REVERSE_SPEED;
    if (Math.abs(this.speed) < 0.05 && input.throttle === 0) this.speed = 0;
    this.steer = input.steer;
    const turn = this.steer * 1.9 * clamp(Math.abs(this.speed) / 8, 0, 1) * Math.sign(this.speed || 1);
    this.heading += turn * dt;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    if (resolveCircleCollision(this.pos, 2.1, colliders)) {
      if (Math.abs(this.speed) > 6) this.damage += Math.abs(this.speed) * 0.4;
      this.speed *= 0.5;
    }
    // bump other cars
    for (const o of others) {
      if (o === this || o.dead) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 4.4 * 4.4 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (4.4 - d) / 2;
        this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push;
        o.pos.x -= (dx / d) * push; o.pos.z -= (dz / d) * push;
        if (Math.abs(this.speed) > 5) this.damage += 4;
        this.speed *= 0.7;
      }
    }
    if (this.damage >= 100) { this.dead = true; this.speed = 0; }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// Traffic: cars that follow the road graph, plus parked cars to steal.
export class TrafficSystem {
  constructor(scene, graph, colliders, rng) {
    this.scene = scene;
    this.graph = graph;
    this.colliders = colliders;
    this.rng = rng;
    this.cars = [];    // moving traffic: {mesh, from, to, t, speed, color}
    this.parked = [];  // {mesh, pos, heading, color, taken, drive}
    this.colors = [0xb02020, 0x2050b0, 0xe0c020, 0x30a060, 0x808890, 0xd07020, 0x7030a0, 0xc0c8d0];
    this.spawnInitial();
  }

  spawnInitial() {
    for (let n = 0; n < CONFIG.TRAFFIC_COUNT; n++) this.spawnTrafficCar();
    // Parked cars along road edges.
    const { PITCH, GRID } = CONFIG;
    for (let n = 0; n < CONFIG.PARKED_COUNT; n++) {
      const k = Math.floor(this.rng() * (2 * GRID + 1)) - GRID;
      const along = (this.rng() * 2 - 1) * GRID * PITCH;
      const horiz = this.rng() < 0.5;
      const color = pick(this.rng, this.colors);
      const mesh = makeCarMesh(color);
      const x = horiz ? along : k * PITCH + 5;
      const z = horiz ? k * PITCH + 5 : along;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = horiz ? Math.PI / 2 : 0;
      this.scene.add(mesh);
      this.parked.push({ mesh, pos: mesh.position, heading: mesh.rotation.y, color, taken: false, drive: null });
    }
  }

  spawnTrafficCar() {
    const { nodes, neighbours } = this.graph;
    const from = Math.floor(this.rng() * nodes.length);
    const to = pick(this.rng, neighbours[from]);
    const color = pick(this.rng, this.colors);
    const mesh = makeCarMesh(color, { taxi: this.rng() < 0.18 });
    const a = nodes[from], b = nodes[to];
    mesh.position.set(a.x, 0, a.z);
    mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    this.scene.add(mesh);
    this.cars.push({ mesh, from, to, t: this.rng() * 0.9, speed: 0, color });
  }

  // Nearest parked car within range of a point, for the steal prompt.
  // A car the player already stole (taken, with a drive) stays enterable.
  nearestParked(pos, range = 4) {
    let best = null, bestD = range;
    for (const p of this.parked) {
      if (p.taken && !p.drive) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  // Turn a parked car into a driven one (player just stole it).
  // Re-entering a car the player already stole reuses its DriveCar.
  stealParked(p) {
    if (p.drive) return p.drive;
    p.taken = true;
    const drive = new DriveCar(p.mesh);
    drive.heading = p.heading;
    drive.pos.copy(p.pos);
    p.drive = drive;
    return drive;
  }

  update(dt) {
    const { nodes, neighbours } = this.graph;
    for (const c of this.cars) {
      const a = nodes[c.from], b = nodes[c.to];
      const segLen = Math.hypot(b.x - a.x, b.z - a.z);
      // slow down for the car ahead on the same edge
      let target = CONFIG.TRAFFIC_SPEED;
      for (const o of this.cars) {
        if (o === c || o.to !== c.to || o.from !== c.from) continue;
        if (o.t > c.t && (o.t - c.t) * segLen < 10) target = 0;
      }
      c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
      c.t += (c.speed * dt) / segLen;
      if (c.t >= 1) {
        c.from = c.to;
        const next = neighbours[c.to].filter((n) => n !== c.from);
        c.to = next.length ? pick(this.rng, next) : c.from;
        c.t = 0;
      }
      const na = nodes[c.from], nb = nodes[c.to];
      c.mesh.position.set(
        na.x + (nb.x - na.x) * c.t,
        0,
        na.z + (nb.z - na.z) * c.t,
      );
      c.mesh.rotation.y = Math.atan2(nb.x - na.x, nb.z - na.z);
      const spin = (c.speed * dt) / 0.36;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
    }
  }

  // All driven cars (player + police) for collision checks.
  drivenCars() {
    return this.parked.filter((p) => p.drive).map((p) => p.drive);
  }
}
