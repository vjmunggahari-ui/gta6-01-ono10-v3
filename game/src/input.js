// Solmar Bay (v6, Session B) — keyboard, mouse and gamepad, as one small object.
//
// One job: remember what is held down, and report each fresh press once.
// v6 reorganizes v5 into a binding table (one place lists every action and
// its keys, pad button and stick role) and adds a click accessor the game
// uses to start from the title screen with the mouse. Same edge semantics:
// a held key never re-fires, blur clears everything, the pad polls once
// per frame with a deadzone, and the first gesture wakes the audio.

export const ACTIONS = {
  up: ['w', 'W', 'ArrowUp'],
  down: ['s', 'S', 'ArrowDown'],
  left: ['a', 'A', 'ArrowLeft'],
  right: ['d', 'D', 'ArrowRight'],
  action: ['e', 'E'],
  punch: ['f', 'F'],
  mission: ['m', 'M'],
  pause: ['Escape', 'p', 'P'],
  mute: ['h', 'H'],
  run: ['Shift'],
  handbrake: [' '],
};

// Gamepad buttons, standard mapping: 0 A, 1 B, 2 X, 3 Y, 9 Start.
const PAD_BUTTONS = { action: 0, handbrake: 1, punch: 2, mission: 3, pause: 9 };
const STICK_DEADZONE = 0.22;
// Keys whose default browser behavior would scroll the page or worse.
const PREVENT_DEFAULT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.pad = null;
    this.padButtons = new Set();
    this.padPressed = new Set();
    this.onFirstGesture = null;
    this._gestured = false;
  }

  attach(target) {
    target.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.includes(e.key)) e.preventDefault();
      if (e.repeat) return; // held keys must not re-fire edge presses
      if (!this.keys.has(e.key)) this.pressed.add(e.key);
      this.keys.add(e.key);
      this.gesture();
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.key));
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.pressed.clear();
    });
    if (typeof window !== 'undefined' && 'ongamepadconnected' in window) {
      window.addEventListener('gamepadconnected', (e) => { this.pad = e.gamepad; });
      window.addEventListener('gamepaddisconnected', (e) => {
        if (this.pad && this.pad.index === e.gamepad.index) this.pad = null;
      });
    }
  }

  attachMouse(canvas) {
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 720;
    });
    canvas.addEventListener('mousedown', () => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      this.gesture();
    });
    canvas.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('mouseleave', () => { this.mouse.down = false; });
  }

  gesture() {
    if (!this._gestured) {
      this._gestured = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  // Poll the pad once per frame: edge-detect buttons, keep axes fresh.
  // Safe to call when no pad is connected.
  update() {
    if (!this.pad && typeof navigator !== 'undefined' && navigator.getGamepads) {
      for (const p of navigator.getGamepads()) {
        if (p && p.connected) { this.pad = p; break; }
      }
    }
    if (!this.pad) return;
    let fresh = this.pad;
    try {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        fresh = navigator.getGamepads()[this.pad.index] || this.pad;
      }
    } catch { fresh = this.pad; }
    this.pad = fresh;
    if (!this.pad || !this.pad.buttons) return;
    for (const [name, idx] of Object.entries(PAD_BUTTONS)) {
      const b = this.pad.buttons[idx];
      const isDown = !!(b && (b.pressed || b.value > 0.5));
      if (isDown && !this.padButtons.has(name)) this.padPressed.add(name);
      if (isDown) this.padButtons.add(name);
      else this.padButtons.delete(name);
    }
  }

  // Rumble the pad, where supported. Durations are milliseconds.
  vibrate(durationMs, strong, weak) {
    try {
      const act = this.pad && this.pad.vibrationActuator;
      if (act && act.playEffect) {
        act.playEffect('dual-rumble', {
          duration: durationMs || 120,
          strongMagnitude: strong === undefined ? 0.7 : strong,
          weakMagnitude: weak === undefined ? 0.4 : weak,
        });
      }
    } catch { /* a pad that cannot rumble simply does not */ }
  }

  down(...keys) {
    return keys.some((k) => this.keys.has(k));
  }

  hit(...keys) {
    return keys.some((k) => this.pressed.has(k));
  }

  // True only on the frame the mouse was clicked (cleared by endFrame).
  clicked() {
    return this.mouse.clicked;
  }

  // Named actions: true while held / true only on the frame it was pressed.
  actionDown(name) {
    const keys = ACTIONS[name] || [];
    return keys.some((k) => this.keys.has(k)) || this.padButtons.has(name);
  }

  actionHit(name) {
    const keys = ACTIONS[name] || [];
    return keys.some((k) => this.pressed.has(k)) || this.padPressed.has(name);
  }

  // Steering + throttle, -1..1 each. Keyboard first, left stick if no keys.
  axis() {
    let steer = 0;
    let drive = 0;
    if (this.down('a', 'A', 'ArrowLeft')) steer -= 1;
    if (this.down('d', 'D', 'ArrowRight')) steer += 1;
    if (this.down('w', 'W', 'ArrowUp')) drive += 1;
    if (this.down('s', 'S', 'ArrowDown')) drive -= 1;
    if (steer === 0 && drive === 0 && this.pad && this.pad.axes) {
      const ax = this.pad.axes[0] || 0;
      const ay = this.pad.axes[1] || 0;
      if (Math.abs(ax) > STICK_DEADZONE) steer = ax;
      if (Math.abs(ay) > STICK_DEADZONE) drive = -ay;
    }
    return { steer, drive };
  }

  endFrame() {
    this.pressed.clear();
    this.padPressed.clear();
    this.mouse.clicked = false;
  }
}
