// hud.js — the HUD: money, health, wanted stars, mission objective, speed,
// the interaction prompt, and the minimap canvas (roads, player, traffic,
// police, mission marker).
import { CONFIG } from './config.js';

export class HUD {
  constructor() {
    this.moneyEl = document.getElementById('hud-money');
    this.healthFill = document.getElementById('hud-health-fill');
    this.starsEl = document.getElementById('hud-stars');
    this.objectiveEl = document.getElementById('hud-objective');
    this.titleEl = document.getElementById('hud-mission-title');
    this.speedEl = document.getElementById('hud-speed');
    this.promptEl = document.getElementById('hud-prompt');
    this.toastEl = document.getElementById('hud-toast');
    this.vignetteEl = document.getElementById('hud-vignette');
    this.minimap = document.getElementById('hud-minimap');
    this.mm = this.minimap.getContext('2d');
    this._toastAt = -99;
    this._last = {};
  }

  setText(el, key, value) {
    if (this._last[key] !== value) {
      this._last[key] = value;
      if (el) el.textContent = value;
    }
  }

  showToast(text, now) {
    this.setText(this.toastEl, 'toast', text);
    this.toastEl.style.opacity = '1';
    this._toastAt = now;
  }

  showPrompt(text) {
    this.setText(this.promptEl, 'prompt', text);
    this.promptEl.style.display = text ? 'block' : 'none';
  }

  flashDamage() {
    if (this.vignetteEl) {
      this.vignetteEl.style.opacity = '0.55';
      setTimeout(() => { this.vignetteEl.style.opacity = '0'; }, 180);
    }
  }

  update(now, s) {
    // s: {money, health, wanted, objective, missionTitle, speedKmh,
    //     driving, timer, timeLeft}
    this.setText(this.moneyEl, 'money', '$' + Math.floor(s.money).toLocaleString('en-US'));
    if (this.healthFill) {
      const pct = Math.max(0, Math.min(100, s.health));
      this.healthFill.style.width = pct + '%';
      this.healthFill.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
    }
    let stars = '';
    for (let i = 0; i < CONFIG.WANTED_MAX; i++) stars += i < s.wanted ? '★' : '☆';
    this.setText(this.starsEl, 'stars', stars);
    this.starsEl.classList.toggle('hot', s.wanted > 0);
    this.setText(this.objectiveEl, 'objective', s.objective || '');
    this.setText(this.titleEl, 'title', s.missionTitle || '');
    const speed = s.driving ? Math.round(Math.abs(s.speedKmh)) + ' km/h' : '';
    this.setText(this.speedEl, 'speed', speed);
    if (s.timeLeft != null) {
      this.setText(this.objectiveEl, 'objective-timer',
        (s.objective || '') + '  —  ' + Math.ceil(s.timeLeft) + 's');
    }
    if (now - this._toastAt > 3.5) this.toastEl.style.opacity = '0';
  }

  // Draw the minimap: north up, the whole city in the square.
  drawMinimap(state) {
    // state: {half, player:{x,z,heading}, inCar, traffic:[{x,z}],
    //   police:[{x,z}], peds, marker:{x,z}|null, places}
    const ctx = this.mm;
    const W = this.minimap.width, H = this.minimap.height;
    const half = state.half + 20;
    const toX = (x) => ((x + half) / (half * 2)) * W;
    const toZ = (z) => ((z + half) / (half * 2)) * H;
    ctx.fillStyle = 'rgba(12, 20, 16, 0.85)';
    ctx.fillRect(0, 0, W, H);
    // blocks
    ctx.fillStyle = '#2c3a2e';
    const { PITCH, ROAD, GRID } = CONFIG;
    for (let i = -GRID; i < GRID; i++) {
      for (let j = -GRID; j < GRID; j++) {
        const x0 = toX((i + 0.5) * PITCH - CONFIG.BLOCK / 2);
        const z0 = toZ((j + 0.5) * PITCH - CONFIG.BLOCK / 2);
        const w = (CONFIG.BLOCK / (half * 2)) * W;
        ctx.fillRect(x0, z0, w, w);
      }
    }
    // roads
    ctx.strokeStyle = '#5a6a72';
    ctx.lineWidth = Math.max(2, (ROAD / (half * 2)) * W);
    for (let k = -GRID; k <= GRID; k++) {
      ctx.beginPath(); ctx.moveTo(toX(k * PITCH), 0); ctx.lineTo(toX(k * PITCH), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toZ(k * PITCH)); ctx.lineTo(W, toZ(k * PITCH)); ctx.stroke();
    }
    // sea to the south
    ctx.fillStyle = '#1d4e6e';
    ctx.fillRect(0, toZ(-half + 8), W, H - toZ(-half + 8));
    // mission marker: pulsing yellow diamond
    if (state.marker) {
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd23f';
      const mx = toX(state.marker.x), mz = toZ(state.marker.z);
      ctx.beginPath();
      ctx.moveTo(mx, mz - pulse); ctx.lineTo(mx + pulse, mz);
      ctx.lineTo(mx, mz + pulse); ctx.lineTo(mx - pulse, mz);
      ctx.closePath(); ctx.fill();
    }
    // traffic dots
    ctx.fillStyle = '#c8c8c8';
    for (const t of state.traffic || []) {
      ctx.fillRect(toX(t.x) - 1.5, toZ(t.z) - 1.5, 3, 3);
    }
    // police: flashing red/blue
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3030' : '#3080ff';
    for (const p of state.police || []) {
      ctx.beginPath(); ctx.arc(toX(p.x), toZ(p.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const px = toX(state.player.x), pz = toZ(state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    // Arrow drawn pointing up (-y); rotate so it matches the heading:
    // forward (sin h, cos h) on a north-up map is angle atan2(sin h, -cos h).
    ctx.rotate(Math.atan2(Math.sin(state.player.heading), -Math.cos(state.player.heading)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}
