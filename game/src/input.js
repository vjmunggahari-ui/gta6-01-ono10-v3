// Solmar Bay — keyboard, mouse and gamepad input, polled every frame.
// The game reads a plain snapshot { throttle, steer, action, brake } so the
// loop never touches DOM events directly.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: 'action', Space: 'action',
  ShiftLeft: 'brake', ShiftRight: 'brake',
};

export function makeInput() {
  const input = {
    keys: Object.create(null),
    mouse: { x: 0, y: 0, down: false },
    padIndex: null,
    // Test / synthetic feed: pretend a key went down or up.
    feed(code, down) {
      this.keys[code] = !!down;
    },
    attach(target) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
      target.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      target.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
      target.addEventListener('mousedown', () => { this.mouse.down = true; });
      target.addEventListener('mouseup', () => { this.mouse.down = false; });
      target.addEventListener('blur', () => { this.keys = Object.create(null); });
    },
    keyDown(name) {
      for (const code of Object.keys(KEYMAP)) {
        if (KEYMAP[code] === name && this.keys[code]) return true;
      }
      return false;
    },
    // Read the first connected gamepad, if any. Returns null when no pad
    // is present or the environment has no gamepad API.
    readPad() {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);
        return {
          steer: dead(pad.axes[0] || 0),
          throttle: dead(-(pad.axes[1] || 0)),
          brake: (pad.buttons[6] && pad.buttons[6].value) || 0,
          action: !!(pad.buttons[0] && pad.buttons[0].pressed),
        };
      }
      return null;
    },
    // One polled snapshot per frame. Keyboard wins over pad on each axis.
    poll() {
      const snap = { throttle: 0, steer: 0, action: false, brake: false };
      if (this.keyDown('up')) snap.throttle = 1;
      else if (this.keyDown('down')) snap.throttle = -1;
      if (this.keyDown('left')) snap.steer = -1;
      else if (this.keyDown('right')) snap.steer = 1;
      if (this.keyDown('action')) snap.action = true;
      if (this.keyDown('brake')) snap.brake = true;
      const pad = this.readPad();
      if (pad) {
        if (snap.throttle === 0) snap.throttle = pad.throttle;
        if (snap.steer === 0) snap.steer = pad.steer;
        if (pad.action) snap.action = true;
        if (pad.brake > 0.3) snap.brake = true;
      }
      if (this.mouse.down) snap.action = true;
      return snap;
    },
  };
  return input;
}
