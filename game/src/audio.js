// Solmar Bay (v5) — sound, synthesized, nothing fetched.
// One job: make the city hum, wail and thud without any audio files.
//
// v5 vs v4: adds the `punch` cue v4 called but never defined, a two-tone
// siren (square-wave wail instead of a sine wobble), a two-oscillator
// engine with a sub tone, a noise-based skid, a horn, UI clicks, a master
// gain with a persisted mute, and a small procedural music loop (bass +
// pad, A minor) that starts after the first gesture.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = false;
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this._sirenLfo = null;
    this._musicTimer = null;
    this._musicStep = 0;
    try {
      this.muted = typeof window !== 'undefined' && !!window.localStorage
        && window.localStorage.getItem('solmarbay-muted') === '1';
    } catch { this.muted = false; }
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  // Browsers gate audio behind a gesture; call from the first key or click.
  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.musicOn) this.startMusic();
  }

  setMuted(m) {
    this.muted = !!m;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('solmarbay-muted', this.muted ? '1' : '0');
      }
    } catch { /* private mode: mute still works for the session */ }
    if (this.master && this.ctx) this.master.gain.value = this.muted ? 0 : 0.9;
    if (this.muted) {
      this.stopEngine();
      this.stopSiren();
      this.stopMusic();
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // One short tone. `slideTo` glides the pitch; `when` delays the start.
  blip(freq, dur, type, vol, slideTo, when) {
    if (!this.ctx || !this.master || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + (when || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq || 660, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + (dur || 0.08));
      gain.gain.setValueAtTime(vol || 0.05, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.08));
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + (dur || 0.08) + 0.02);
    } catch { /* silence is always acceptable */ }
  }

  // Filtered noise burst — skids, crashes, splashes.
  noise(dur, vol, cutoff) {
    if (!this.ctx || !this.master || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * (dur || 0.15)));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 900;
      const gain = this.ctx.createGain();
      gain.gain.value = vol || 0.1;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch { /* silence is always acceptable */ }
  }

  thud() { this.blip(90, 0.15, 'sine', 0.12); this.noise(0.08, 0.06, 500); }

  punch() { this.blip(160, 0.09, 'square', 0.12, 70); this.noise(0.06, 0.08, 1200); }

  pickup() {
    this.blip(880, 0.1, 'sine', 0.08);
    this.blip(1320, 0.12, 'sine', 0.06, null, 0.07);
  }

  cash() {
    this.blip(1046, 0.09, 'triangle', 0.08);
    this.blip(1568, 0.14, 'triangle', 0.07, null, 0.08);
  }

  busted() {
    this.blip(220, 0.4, 'sawtooth', 0.1, 110);
    this.blip(110, 0.5, 'sawtooth', 0.1, 55, 0.15);
  }

  click() { this.blip(1200, 0.04, 'sine', 0.04); }

  horn() { this.blip(370, 0.22, 'square', 0.07); this.blip(466, 0.22, 'square', 0.05); }

  skid() { this.noise(0.22, 0.07, 1600); }

  splash() { this.noise(0.3, 0.09, 700); }

  // Engine hum, 0 (silent) to 1 (flat out). Called every frame while driving.
  // Two oscillators now: a saw for bite, a sine an octave down for body.
  engine(level) {
    if (!this.ctx || !this.master || this.muted || !level || level <= 0.01) {
      if (!level || level <= 0.01) this.stopEngine();
      return;
    }
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineSub = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineSub.type = 'sine';
        this.engineGain.gain.value = 0.02;
        this.engineOsc.connect(this.engineGain);
        this.engineSub.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.engineSub.start();
      }
      this.engineOsc.frequency.value = 50 + level * 180;
      this.engineSub.frequency.value = 25 + level * 90;
      this.engineGain.gain.value = 0.015 + level * 0.04;
    } catch { /* silence is always acceptable */ }
  }

  stopEngine() {
    try {
      if (this.engineOsc) { this.engineOsc.stop(); this.engineOsc = null; }
      if (this.engineSub) { this.engineSub.stop(); this.engineSub = null; }
      this.engineGain = null;
    } catch {
      this.engineOsc = null;
      this.engineSub = null;
      this.engineGain = null;
    }
  }

  // Police siren, on or off. A square-wave LFO flips the tone between two
  // pitches, which reads as a wail instead of v4's sine wobble.
  siren(on) {
    if (!this.ctx || !this.master || this.muted) {
      if (!on) this.stopSiren();
      return;
    }
    if (!on) { this.stopSiren(); return; }
    try {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 800;
        this.sirenGain.gain.value = 0.02;
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'square';
        lfo.frequency.value = 0.55;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(this.sirenOsc.frequency);
        lfo.start();
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this._sirenLfo = lfo;
      }
    } catch { /* silence is always acceptable */ }
  }

  stopSiren() {
    try {
      if (this.sirenOsc) { this.sirenOsc.stop(); this.sirenOsc = null; this.sirenGain = null; }
      if (this._sirenLfo) { this._sirenLfo.stop(); this._sirenLfo = null; }
    } catch {
      this.sirenOsc = null;
      this.sirenGain = null;
      this._sirenLfo = null;
    }
  }

  // --- procedural music -----------------------------------------------------
  // A slow A-minor groove: a bass line walks the roots while a soft pad
  // holds the chord. Scheduled a step at a time so it costs almost nothing.
  setMusicEnabled(on) {
    this.musicOn = !!on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  startMusic() {
    if (!this.ctx || !this.master || this.muted || this._musicTimer) return;
    const bass = [55, 0, 65.41, 0, 49, 0, 61.74, 0]; // A1 C2 G1 B1, eighth notes
    const pad = [220, 261.63, 329.63]; // A3 C4 E4
    const stepMs = 240;
    this._musicStep = 0;
    this._musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const i = this._musicStep % bass.length;
      const root = bass[i];
      if (root) this.blip(root, 0.22, 'triangle', 0.05);
      if (i === 0) {
        for (const f of pad) this.blip(f, stepMs * 8 / 1000, 'sine', 0.012);
      }
      this._musicStep += 1;
    }, stepMs);
  }

  stopMusic() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }
}
