// Solmar Bay — music sequencer. A 16-step loop at 112 BPM.
// The pattern logic is pure (works headless); sound only plays when a
// WebAudio context exists, so the game never crashes without audio.

export const STEP_COUNT = 16;
export const BPM = 112;

// 16-step patterns. Bass/lead hold scale degrees (minor) or null = rest.
// Kick on the four beats, hats on the off-beats.
export const KICK_PATTERN = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
export const HAT_PATTERN = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1];
export const BASS_PATTERN = [0, null, 0, null, 3, null, 0, null, 5, null, 3, null, 7, null, 5, 3];
export const LEAD_PATTERN = [null, null, 12, null, null, 10, null, null, 12, null, null, 14, null, 12, 10, null];

// Minor scale, A2 root (110 Hz). Degree -> frequency.
const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33];

export function stepFreq(degree) {
  if (degree === null || degree === undefined) return null;
  return SCALE[degree % SCALE.length] ?? null;
}

// What plays on step i: { kick, hat, bass, lead } (frequencies or null).
export function stepAt(i) {
  const s = ((i % STEP_COUNT) + STEP_COUNT) % STEP_COUNT;
  return {
    kick: KICK_PATTERN[s] ? 1 : 0,
    hat: HAT_PATTERN[s] ? 1 : 0,
    bass: stepFreq(BASS_PATTERN[s]),
    lead: stepFreq(LEAD_PATTERN[s]),
  };
}

export function makeMusic() {
  let audio = null;
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AC) audio = new AC();
  } catch {
    audio = null;
  }
  const master = audio ? audio.createGain() : null;
  if (master) {
    master.gain.value = 0.16;
    master.connect(audio.destination);
  }

  let step = 0;
  let muted = false;
  let timer = null;

  function blip(freq, dur, type, vol) {
    if (!audio || muted || freq === null) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(audio.currentTime + dur);
  }

  function playStep(notes) {
    if (notes.kick) blip(55, 0.14, 'sine', 0.9);
    if (notes.hat) blip(5200, 0.03, 'square', 0.08);
    if (notes.bass !== null) blip(notes.bass, 0.22, 'triangle', 0.5);
    if (notes.lead !== null) blip(notes.lead, 0.18, 'sawtooth', 0.12);
  }

  // Advance one step and return its notes. Pure: safe to call headless.
  function tick() {
    const notes = stepAt(step);
    step = (step + 1) % STEP_COUNT;
    playStep(notes);
    return notes;
  }

  function start() {
    if (timer !== null || !audio) return;
    const ms = (60 / BPM / 4) * 1000;
    timer = setInterval(tick, ms);
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    STEP_COUNT,
    BPM,
    get step() {
      return step;
    },
    get muted() {
      return muted;
    },
    tick,
    stepAt,
    start,
    stop,
    setMuted(m) {
      muted = !!m;
    },
  };
}
