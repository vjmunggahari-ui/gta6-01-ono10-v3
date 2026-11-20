// Solmar Bay (v6, Session B) — sound, synthesized, nothing fetched.
//
// One job: make the city hum, wail and thud without any audio files. v6
// rebuilds the synth kit around two primitives (blip + noise) and a small
// step sequencer: a low A-minor bassline with a hat tick for the music, a
// two-oscillator engine that follows speed, and a two-tone siren that
// wails while the PD is on you. Same public API as v5 — every method the
// game and the entities call still exists with the same name. Music
// requested before the context exists starts once init() runs, instead
// of being silently lost.

const MUTE_KEY = 'solmarbay-muted';

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
        ? window.localStorage.getItem(MUTE_KEY) === '1'
        : false;
    } catch { this.muted = false; }
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      if (this.musicOn) this.setMusicEnabled(true);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = !!m;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
      }
    } catch { /* a mute that cannot be stored still mutes */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    if (this.muted) this.stopSiren();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // --- primitives -----------------------------------------------------------
  // A short oscillator blip, optionally sliding to another pitch.
  blip(freq, dur, type, vol, slideTo, when) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise burst — thuds, skids, splashes, hats.
  noise(dur, vol, cutoff) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // --- one-shots ------------------------------------------------------------
  thud() { this.blip(90, 0.15, 'sine', 0.12); this.noise(0.08, 0.06, 500); }
  punch() { this.blip(160, 0.09, 'square', 0.12, 70); this.noise(0.06, 0.08, 1200); }
  pickup() {
    this.blip(660, 0.07, 'sine', 0.08);
    this.blip(880, 0.09, 'sine', 0.08, null, 0.07);
  }
  cash() {
    this.blip(988, 0.08, 'sine', 0.09);
    this.blip(1319, 0.12, 'sine', 0.09, null, 0.08);
  }
  busted() {
    this.blip(220, 0.5, 'sawtooth', 0.1, 110);
    this.noise(0.3, 0.08, 400);
  }
  click() { this.blip(1200, 0.04, 'sine', 0.04); }
  horn() { this.blip(370, 0.22, 'square', 0.07); this.blip(466, 0.22, 'square', 0.05); }
  skid() { this.noise(0.22, 0.07, 1600); }
  splash() { this.noise(0.3, 0.09, 700); }

  // --- engine ---------------------------------------------------------------
  // Two oscillators (saw + sub sine) whose pitch follows the speed level
  // 0..1. Called every frame while driving; cheap to re-set.
  engine(level) {
    if (!this.ctx || !this.master) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineSub = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineSub.type = 'sine';
      this.engineOsc.frequency.value = 60;
      this.engineSub.frequency.value = 30;
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineGain);
      this.engineSub.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineSub.start();
    }
    const t = this.ctx.currentTime;
    const f = 55 + level * 165;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.06);
    this.engineSub.frequency.setTargetAtTime(f / 2, t, 0.06);
    this.engineGain.gain.setTargetAtTime(0.02 + level * 0.05, t, 0.08);
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

  // --- siren ----------------------------------------------------------------
  // Square-wave wail: an LFO swings the pitch between two tones.
  siren(on) {
    if (!this.ctx || !this.master) return;
    if (!on) { this.stopSiren(); return; }
    if (this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain.gain.value = 0.035;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.55;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    lfo.start();
    this._sirenLfo = lfo;
  }

  stopSiren() {
    try {
      if (this.sirenOsc) { this.sirenOsc.stop(); this.sirenOsc = null; }
      if (this._sirenLfo) { this._sirenLfo.stop(); this._sirenLfo = null; }
      this.sirenGain = null;
    } catch {
      this.sirenOsc = null;
      this._sirenLfo = null;
      this.sirenGain = null;
    }
  }

  // --- music ----------------------------------------------------------------
  // An 8-step loop at ~136 BPM: a low A-minor bassline walks the root
  // notes while a hat ticks the offbeats. A step timer keeps it going;
  // turning music off stops the timer, never the context.
  setMusicEnabled(on) {
    this.musicOn = !!on;
    if (!this.ctx) return;
    if (!on) {
      if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
      return;
    }
    if (this._musicTimer) return;
    const bass = [55, 55, 65.41, 55, 82.41, 55, 73.42, 65.41];
    this._musicStep = 0;
    this._musicTimer = setInterval(() => {
      if (this.muted || !this.musicOn || !this.ctx) return;
      const step = this._musicStep % 8;
      this._musicStep += 1;
      this.blip(bass[step], 0.2, 'triangle', 0.09, bass[step] * 0.995);
      if (step % 2 === 1) this.noise(0.03, 0.025, 6000);
    }, 220);
  }
}
