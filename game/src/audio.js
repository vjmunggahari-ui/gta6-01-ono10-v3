// Solmar Bay — music sequencer. A 16-step loop (4 bars of 4 steps) built on
// plain WebAudio when available; in a headless / no-audio environment the
// step clock still advances so tests and the screenshot pipeline can drive it.
export const STEPS = 16;
export const STEP_SECONDS = 60 / 112 / 4; // 112 BPM, sixteenth notes

// Per-step patterns, one entry per step (0 = rest). Bass line in semitone
// offsets from A1, hats on/off, lead notes as MIDI numbers.
const BASS = [0, -1, 0, -1, 3, -1, 0, -1, 5, -1, 3, -1, 0, 7, -1, 5];
const HAT = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0];
const LEAD = [69, -1, 72, -1, 74, -1, 72, 69, 76, -1, 74, 72, 71, -1, 69, -1];

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function makeMusic() {
  const music = {
    playing: false,
    step: 0,
    clock: 0,
    bpm: 112,
    // Advance the step clock by dt seconds. Integer step counting: a step
    // boundary is never lost to floating point drift.
    tick(dt) {
      if (!this.playing) return;
      this.clock += dt;
      while (this.clock >= STEP_SECONDS) {
        this.clock -= STEP_SECONDS;
        this.step = (this.step + 1) % STEPS;
        this.playStep(this.step);
      }
    },
    // Sound one step. No-ops when there is no AudioContext (headless).
    playStep(step) {
      const ctx = this.audioCtx;
      if (!ctx) return;
      const t0 = ctx.currentTime;
      if (BASS[step] >= 0) this.tone(midiToFreq(33 + BASS[step]), t0, STEP_SECONDS * 0.9, 'triangle', 0.16);
      if (HAT[step]) this.noise(t0, 0.03, 0.05);
      if (LEAD[step] >= 0) this.tone(midiToFreq(LEAD[step]), t0, STEP_SECONDS * 0.8, 'square', 0.05);
    },
    tone(freq, when, dur, type, gain) {
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + dur);
    },
    noise(when, dur, gain) {
      const ctx = this.audioCtx;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buf;
      g.gain.value = gain;
      src.connect(g).connect(ctx.destination);
      src.start(when);
    },
    // Lazily create the AudioContext on first user gesture; safe to call
    // repeatedly. In Node / headless shells AudioContext is undefined.
    ensureAudio() {
      if (this.audioCtx) return true;
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      this.audioCtx = new AC();
      return true;
    },
    start() {
      this.playing = true;
      this.ensureAudio();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
    },
    stop() {
      this.playing = false;
    },
  };
  return music;
}
