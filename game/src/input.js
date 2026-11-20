// Solmar Bay — input: keyboard + mouse + gamepad.
// The gamepad is polled every frame inside poll(); keyboard state is kept
// in a Set of codes. All browser globals are guarded so the module imports
// cleanly in Node for tests.

export function makeInput() {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    pad: { connected: false, steer: 0, throttle: 0, brake: false, action: false },
    attached: false,

    attach(target) {
      if (input.attached || typeof window === 'undefined') return;
      input.attached = true;
      window.addEventListener('keydown', (e) => {
        input.keys.add(e.code);
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
      });
      window.addEventListener('keyup', (e) => input.keys.delete(e.code));
      window.addEventListener('blur', () => input.keys.clear());
      if (target) {
        target.addEventListener('mousemove', (e) => {
          const r = target.getBoundingClientRect();
          input.mouse.x = e.clientX - r.left;
          input.mouse.y = e.clientY - r.top;
        });
        target.addEventListener('mousedown', () => {
          input.mouse.down = true;
          input.mouse.clicked = true;
        });
        target.addEventListener('mouseup', () => {
          input.mouse.down = false;
        });
      }
    },

    isDown(code) {
      return input.keys.has(code);
    },

    // Movement vector from keys or the left stick. y is down-positive.
    moveVector() {
      let x = 0;
      let y = 0;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) x -= 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) x += 1;
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) y -= 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) y += 1;
      if (input.pad.connected) {
        x += input.pad.steer;
        y += input.pad.throttle;
      }
      return { x, y };
    },

    // True on the frame the E key (or pad A) is pressed.
    actionPressed() {
      if (input.pad.action) {
        input.pad.action = false;
        return true;
      }
      if (input.keys.has('KeyE')) {
        input.keys.delete('KeyE');
        return true;
      }
      return false;
    },

    honkPressed() {
      if (input.keys.has('KeyH')) {
        input.keys.delete('KeyH');
        return true;
      }
      return false;
    },

    // Poll the gamepad every frame. Sticks drive movement, A is action.
    poll() {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      let found = false;
      for (const p of pads) {
        if (!p || !p.connected) continue;
        found = true;
        const dead = (v) => (Math.abs(v) < 0.18 ? 0 : v);
        input.pad.steer = dead(p.axes[0] || 0);
        input.pad.throttle = dead(p.axes[1] || 0);
        input.pad.brake = (p.buttons[6] && p.buttons[6].pressed) || false;
        if (p.buttons[0] && p.buttons[0].pressed) input.pad.action = true;
        break;
      }
      input.pad.connected = found;
      if (!found) {
        input.pad.steer = 0;
        input.pad.throttle = 0;
      }
    },
  };
  return input;
}
