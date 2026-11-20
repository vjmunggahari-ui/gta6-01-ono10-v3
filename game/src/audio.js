// Solmar Bay — music sequencer.
// A 16-step loop: kick on the beat, a walking bass line, hats off the beat,
// and a sparse lead. Headless-safe: where there is no WebAudio, tick() still
// advances the step counter so the loop stays testable.

export const STEP_COUNT = 16;
export const STEP_SECONDS = 0.14;

// Bass line: one note per step, 0 = rest. Frequencies in Hz.
const BASS_LINE = [
  55, 0, 55, 65.41, 0, 55, 0, 49,
  55, 0, 55, 65.41, 73.42, 0, 49, 58.27,
];

// Lead: sparse plucks on a few steps.
const LEAD_LINE = [
  0, 0, 440, 0, 0, 523.25, 0, 0,
  0, 0, 392, 0, 0, 440, 0, 0,
];

export function makeMusic() {
  const music = {
    step: 0,
    stepTime: 0,
    playing: false,
    ctx: null,
    master: null,
    muted: false,

    start() {
      if (music.playing) return;
      music.playing = true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !music.ctx) {
          music.ctx = new AC();
          music.master = music.ctx.createGain();
          music.master.gain.value = 0.12;
          music.master.connect(music.ctx.destination);
        }
        if (music.ctx && music.ctx.state === 'suspended') music.ctx.resume();
      } catch (e) {
        // No audio device (headless): keep counting steps silently.
        music.ctx = null;
      }
    },

    stop() {
      music.playing = false;
      if (music.ctx) music.ctx.suspend().catch(() => {});
    },

    toggle() {
      if (music.playing) music.stop();
      else music.start();
      return music.playing;
    },

    // Advance the sequencer by dt seconds. Integer-counted: the step only
    // moves when a full step duration has elapsed, so the loop is exact.
    tick(dt) {
      if (!music.playing) return;
      music.stepTime += dt;
      while (music.stepTime >= STEP_SECONDS) {
        music.stepTime -= STEP_SECONDS;
        music.step = (music.step + 1) % STEP_COUNT;
        music.playStep(music.step);
      }
    },

    playStep(step) {
      if (!music.ctx || music.muted) return;
      const t0 = music.ctx.currentTime;
      // Kick on steps 0, 4, 8, 12.
      if (step % 4 === 0) music.tone(120, 0.09, 'sine', 0.9, t0);
      // Hats on odd steps.
      if (step % 2 === 1) music.noise(0.03, 0.25, t0);
      const bass = BASS_LINE[step];
      if (bass) music.tone(bass, STEP_SECONDS * 0.9, 'triangle', 0.7, t0);
      const lead = LEAD_LINE[step];
      if (lead) music.tone(lead, STEP_SECONDS * 0.8, 'square', 0.25, t0);
    },

    tone(freq, dur, type, vol, when) {
      const osc = music.ctx.createOscillator();
      const gain = music.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
      osc.connect(gain);
      gain.connect(music.master);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    },

    noise(dur, vol, when) {
      const len = Math.max(1, Math.floor(music.ctx.sampleRate * dur));
      const buf = music.ctx.createBuffer(1, len, music.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = music.ctx.createBufferSource();
      src.buffer = buf;
      const gain = music.ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(music.master);
      src.start(when);
    },
  };
  return music;
}
