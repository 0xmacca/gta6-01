// combat.js — the pistol and the punch: hitscan shooting from the crosshair
// with a tracer and muzzle flash, and a short-range punch that drops peds.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.lastShotAt = -99;
    this.flash = new THREE.PointLight(0xffd080, 0, 18);
    this.scene.add(this.flash);
    // Tracer: a thin line from the muzzle to the hit point, shown briefly.
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.tracer.visible = false;
    this.tracerAt = -99;
    scene.add(this.tracer);
  }

  canShoot(now) {
    return now - this.lastShotAt >= CONFIG.PISTOL_FIRE_RATE_S;
  }

  // Fire from the camera through the crosshair. targets: [{mesh, kind,
  // onHit(damage)}]. Two rays: the camera ray (what the crosshair covers)
  // and a torso-height ray from the player's shoulder along the camera's
  // forward direction — a third-person camera looks down at the player, so
  // the camera ray alone passes under a close target's torso. Nearest hit wins.
  shoot(now, targets, shooterPos = null) {
    if (!this.canShoot(now)) return null;
    this.lastShotAt = now;
    const meshes = targets.map((t) => t.mesh);
    const findTarget = (obj) => {
      while (obj && !targets.find((t) => t.mesh === obj)) obj = obj.parent;
      return targets.find((t) => t.mesh === obj);
    };
    let best = null; // {dist, point, target}
    const testRay = (raycaster) => {
      raycaster.far = 120;
      const hits = raycaster.intersectObjects(meshes, true);
      if (!hits.length) return;
      const hit = hits[0];
      const target = findTarget(hit.object);
      if (target && (!best || hit.distance < best.dist)) {
        best = { dist: hit.distance, point: hit.point, target };
      }
    };
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    testRay(this.raycaster);
    if (shooterPos) {
      // Torso-height ray from the player's shoulder, horizontal: the camera
      // looks down at the player, so a ray along its forward direction dives
      // under a close target's torso. Horizontal at 1.35 m hits the body.
      const fwd = this.camera.getWorldDirection(new THREE.Vector3());
      fwd.y = 0;
      if (fwd.lengthSq() > 1e-6) fwd.normalize();
      const gunRay = new THREE.Raycaster(
        new THREE.Vector3(shooterPos.x, 1.35, shooterPos.z), fwd, 0, 120);
      testRay(gunRay);
    }
    let end = null;
    let kind = null;
    if (best) {
      end = best.point;
      kind = best.target.kind;
      best.target.onHit(CONFIG.PISTOL_DAMAGE, best.point);
    }
    if (!end) end = this.raycaster.ray.at(120, new THREE.Vector3());
    // Muzzle flash at the camera, tracer to the hit.
    const start = this.camera.position.clone();
    start.add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.2));
    start.y -= 0.25;
    this.flash.position.copy(start);
    this.flash.intensity = 60;
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, start.x, start.y, start.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerAt = now;
    return kind;
  }

  update(now) {
    if (this.flash.intensity > 0) this.flash.intensity *= 0.86;
    if (this.tracer.visible && now - this.tracerAt > 0.07) this.tracer.visible = false;
  }
}
