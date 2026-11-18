// missions.js — Leo Marlow's story: five jobs for the Harbor Crew, from
// stealing his first wheels to the big score. Each mission is steps; a step
// is go somewhere, collect something, deliver it, or lose the heat.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const MISSIONS = [
  {
    id: 'wheels-up',
    title: 'Job 1 — Wheels Up',
    story: 'Fresh out of county, no car, no cash. The Crew needs wheels. Steal any car and bring it to the garage on Marlin Street.',
    steps: [
      { type: 'steal-car', text: 'Steal any car (walk up to one and press E)' },
      { type: 'goto', place: 'garage', text: 'Drive the car to the garage', radius: 10 },
    ],
  },
  {
    id: 'the-pickup',
    title: 'Job 2 — The Pickup',
    story: 'A package is waiting at the south pier. Walk it over — or drive — but don\'t let the cops see you grab it.',
    steps: [
      { type: 'collect', place: 'pier', text: 'Collect the package at the pier (press E)', radius: 6 },
      { type: 'deliver', place: 'docks', text: 'Deliver the package to the docks', radius: 10 },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'Job 3 — Hot Pursuit',
    story: 'Someone talked. The whole precinct is looking for you. Lose the heat, then lay low at the safehouse.',
    steps: [
      { type: 'evade', text: 'Lose the heat — get your wanted level to zero' },
      { type: 'goto', place: 'safehouse', text: 'Reach the safehouse', radius: 10 },
    ],
    onStart: 'heat',
  },
  {
    id: 'long-haul',
    title: 'Job 4 — The Long Haul',
    story: 'The Crew\'s buyer is waiting at the docks and the clock is running. Drive there in 150 seconds, cops or no cops.',
    steps: [
      { type: 'timed-drive', place: 'docks', text: 'Drive to the docks before time runs out', radius: 10, timeLimit: 150 },
    ],
  },
  {
    id: 'big-score',
    title: 'Job 5 — The Big Score',
    story: 'A gold sedan sits in the plaza, and its owner is not a man you steal from twice. Take it. Bring it to the garage. Retire.',
    steps: [
      { type: 'steal-gold', place: 'plaza', text: 'Steal the gold sedan in the plaza (press E)' },
      { type: 'deliver', place: 'garage', text: 'Deliver the gold sedan to the garage', radius: 10 },
    ],
    onStart: 'guards',
  },
];

export class MissionManager {
  constructor(scene, places) {
    this.scene = scene;
    this.places = places;
    this.index = 0;          // mission index, 0..4; 5 = story done
    this.step = 0;
    this.stepTimer = 0;
    this.active = false;
    this.collected = false;
    // Marker: a light pillar and a floating diamond over the target.
    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.pillar = new THREE.Mesh(pillarGeo, pillarMat);
    this.pillar.visible = false;
    const diamondGeo = new THREE.OctahedronGeometry(1.1);
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    this.diamond = new THREE.Mesh(diamondGeo, diamondMat);
    this.diamond.visible = false;
    scene.add(this.pillar, this.diamond);
    this.markerPos = null;
  }

  current() { return MISSIONS[this.index] || null; }
  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  get done() { return this.index >= MISSIONS.length; }

  objectiveText() {
    if (this.done) return 'Story complete — Costa Verde is yours. Free roam.';
    if (!this.active) return 'Press Enter to start: ' + this.current().title;
    const s = this.currentStep();
    return s ? s.text : '';
  }

  titleText() {
    if (this.done) return 'Story Complete';
    return this.current().title;
  }

  startMission() {
    if (this.done || this.active) return null;
    const m = this.current();
    this.active = true;
    this.step = 0;
    this.stepTimer = 0;
    this.collected = false;
    return m.onStart || null;
  }

  completeStep() {
    this.step += 1;
    this.stepTimer = 0;
    const m = this.current();
    if (this.step >= m.steps.length) {
      const reward = CONFIG.MISSION_REWARDS[this.index];
      this.index += 1;
      this.active = false;
      this.hideMarker();
      return { missionComplete: true, reward };
    }
    return { missionComplete: false, reward: 0 };
  }

  failStep() {
    this.stepTimer = 0;
    return { failed: true };
  }

  showMarkerAt(place) {
    const p = this.places[place];
    if (!p) { this.hideMarker(); return; }
    this.markerPos = new THREE.Vector3(p.x, 0, p.z);
    this.pillar.position.set(p.x, 30, p.z);
    this.diamond.position.set(p.x, 8, p.z);
    this.pillar.visible = true;
    this.diamond.visible = true;
  }

  hideMarker() {
    this.markerPos = null;
    this.pillar.visible = false;
    this.diamond.visible = false;
  }

  // game: {player, police, now}. Returns events for the main loop.
  update(dt, game, now) {
    const events = [];
    if (!this.active || this.done) return events;
    const step = this.currentStep();
    if (!step) return events;
    this.stepTimer += dt;
    // Animate the marker.
    if (this.diamond.visible) {
      this.diamond.rotation.y += dt * 2;
      this.diamond.position.y = 8 + Math.sin(now * 2.5) * 0.8;
    }
    const playerPos = game.player.pos;
    const placePos = step.place ? this.places[step.place] : null;
    if (step.place && step.type !== 'steal-car' && step.type !== 'steal-gold') {
      this.showMarkerAt(step.place);
    } else if (step.type === 'steal-gold') {
      this.showMarkerAt('plaza');
    } else {
      this.hideMarker();
    }
    const distTo = (p) => Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
    switch (step.type) {
      case 'steal-car':
        if (game.player.inCar) events.push(this.completeStep());
        break;
      case 'steal-gold':
        if (game.player.inCar && game.player.inGoldCar) events.push(this.completeStep());
        break;
      case 'goto':
      case 'deliver':
        if (placePos && distTo(placePos) < step.radius) events.push(this.completeStep());
        break;
      case 'collect':
        if (placePos && distTo(placePos) < step.radius && game.interactPressed) {
          this.collected = true;
          events.push(this.completeStep());
        }
        break;
      case 'evade':
        if (game.police.wanted === 0) events.push(this.completeStep());
        break;
      case 'timed-drive':
        if (placePos && distTo(placePos) < step.radius) events.push(this.completeStep());
        else if (this.stepTimer > step.timeLimit) events.push(this.failStep());
        break;
      default:
        break;
    }
    return events;
  }

  // Seconds left on a timed step, or null.
  timeLeft() {
    const step = this.currentStep();
    if (!step || !step.timeLimit) return null;
    return Math.max(0, step.timeLimit - this.stepTimer);
  }

  // Save / restore: mission index and active flag only.
  serialize() { return { index: this.index, active: this.active }; }
  restore(data) {
    if (!data) return;
    this.index = Math.min(data.index || 0, MISSIONS.length);
    this.active = false;
    this.step = 0;
    this.hideMarker();
  }
}
