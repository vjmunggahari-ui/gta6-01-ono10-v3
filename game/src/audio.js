// Solmar Bay — sound, synthesized, nothing fetched.
// One job: make the city hum, wail and thud without any audio files.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this._sirenLfo = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopEngine();
      this.stopSiren();
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq || 660;
      gain.gain.setValueAtTime(vol || 0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (dur || 0.08));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + (dur || 0.08));
    } catch {
      // Silence is always acceptable.
    }
  }

  thud() {
    this.blip(90, 0.15, 'sine', 0.12);
  }

  pickup() {
    this.blip(880, 0.1, 'sine', 0.08);
    this.blip(1320, 0.12, 'sine', 0.06);
  }

  cash() {
    this.blip(1046, 0.09, 'triangle', 0.08);
    this.blip(1568, 0.14, 'triangle', 0.07);
  }

  busted() {
    this.blip(220, 0.4, 'sawtooth', 0.1);
    this.blip(110, 0.5, 'sawtooth', 0.1);
  }

  // Engine hum, 0 (silent) to 1 (flat out). Called every frame while driving.
  engine(level) {
    if (!this.ctx || this.muted || !level || level <= 0.01) {
      if (!level || level <= 0.01) this.stopEngine();
      return;
    }
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0.02;
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 50 + level * 180;
      this.engineGain.gain.value = 0.015 + level * 0.04;
    } catch {
      // Silence is always acceptable.
    }
  }

  stopEngine() {
    try {
      if (this.engineOsc) {
        this.engineOsc.stop();
        this.engineOsc = null;
        this.engineGain = null;
      }
    } catch {
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // Police siren, on or off.
  siren(on) {
    if (!this.ctx || this.muted) {
      if (!on) this.stopSiren();
      return;
    }
    if (!on) {
      this.stopSiren();
      return;
    }
    try {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain.gain.value = 0.015;
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.8;
        lfoGain.gain.value = 250;
        lfo.connect(lfoGain);
        lfoGain.connect(this.sirenOsc.frequency);
        lfo.start();
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);
        this.sirenOsc.start();
        this._sirenLfo = lfo;
      }
    } catch {
      // Silence is always acceptable.
    }
  }

  stopSiren() {
    try {
      if (this.sirenOsc) {
        this.sirenOsc.stop();
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      if (this._sirenLfo) {
        this._sirenLfo.stop();
        this._sirenLfo = null;
      }
    } catch {
      this.sirenOsc = null;
      this._sirenLfo = null;
    }
  }
}
