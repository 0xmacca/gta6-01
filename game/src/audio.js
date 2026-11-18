// audio.js — all sound is synthesized with WebAudio: no audio files, no
// network. Engine hum, police siren, gunshots, pickups, UI clicks and a
// quiet bassline loop. Everything starts on the first user gesture.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenTimer = null;
    this._musicTimer = null;
    this._musicStep = 0;
  }

  // Call from a click / key handler: browsers need a gesture first.
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return !!this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.suspend();
    if (!m && this.ctx) this.ctx.resume();
  }

  _tone(freq, dur, type = 'sine', vol = 0.15, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol = 0.2, lowpass = 3000) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start();
  }

  click() { this._tone(660, 0.07, 'square', 0.06); }
  pickup() { this._tone(880, 0.12, 'sine', 0.14); this._tone(1320, 0.18, 'sine', 0.12, 0.09); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.14, i * 0.11));
  }
  punch() { this._noise(0.12, 0.25, 900); }
  gunshot() { this._noise(0.16, 0.3, 2500); this._tone(140, 0.12, 'sine', 0.2); }
  crash() { this._noise(0.3, 0.3, 700); }
  busted() { this._tone(220, 0.5, 'sawtooth', 0.12); this._tone(174, 0.7, 'sawtooth', 0.12, 0.3); }

  // Continuous engine hum while driving; speed01 is 0..1.
  setEngine(speed01, driving) {
    if (!this.ctx || this.muted) return;
    if (!driving) {
      if (this._engineGain) this._engineGain.gain.value = 0;
      return;
    }
    if (!this._engineOsc) {
      this._engineOsc = this.ctx.createOscillator();
      this._engineOsc.type = 'sawtooth';
      this._engineGain = this.ctx.createGain();
      this._engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 700;
      this._engineOsc.connect(f).connect(this._engineGain).connect(this.ctx.destination);
      this._engineOsc.start();
    }
    this._engineOsc.frequency.value = 55 + speed01 * 130;
    this._engineGain.gain.value = 0.03 + speed01 * 0.05;
  }

  // Two-tone police siren while any police car is near.
  setSiren(on) {
    if (!this.ctx || this.muted) return;
    if (!on) {
      if (this._sirenTimer) { clearInterval(this._sirenTimer); this._sirenTimer = null; }
      if (this._sirenGain) this._sirenGain.gain.value = 0;
      return;
    }
    if (!this._sirenOsc) {
      this._sirenOsc = this.ctx.createOscillator();
      this._sirenOsc.type = 'square';
      this._sirenGain = this.ctx.createGain();
      this._sirenGain.gain.value = 0.02;
      this._sirenOsc.connect(this._sirenGain).connect(this.ctx.destination);
      this._sirenOsc.start();
      let hi = false;
      this._sirenTimer = setInterval(() => {
        if (!this._sirenOsc) return;
        hi = !hi;
        this._sirenOsc.frequency.value = hi ? 960 : 720;
      }, 380);
    }
    if (this._sirenGain) this._sirenGain.gain.value = 0.02;
  }

  // Quiet bassline loop: A minor walk, one note per beat at 96 bpm.
  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    const bass = [110, 0, 130.81, 0, 98, 0, 130.81, 146.83];
    this._musicTimer = setInterval(() => {
      if (!this.musicOn || this.muted) { this._musicStep++; return; }
      const f = bass[this._musicStep % bass.length];
      if (f) this._tone(f, 0.5, 'triangle', 0.05);
      if (this._musicStep % 4 === 2) this._noise(0.03, 0.02, 8000);
      this._musicStep++;
    }, 625);
  }
}
