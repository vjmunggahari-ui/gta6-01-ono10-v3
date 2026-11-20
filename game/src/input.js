// Solmar Bay — keyboard, mouse and gamepad input.
// Gamepad is polled every frame through update(); keyboard edges are
// tracked so a single key press fires one action. Safe headless: every
// browser global is guarded, so Node tests can drive input by hand.

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function makeInput(canvas) {
  const down = new Set();
  const pressedEdge = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let pad = null;
  let padConnected = false;

  function onKeyDown(e) {
    if (!down.has(e.code)) pressedEdge.add(e.code);
    down.add(e.code);
    if (e.code === 'Space') e.preventDefault?.();
  }

  function onKeyUp(e) {
    down.delete(e.code);
  }

  function onMouseMove(e) {
    mouse.x = e.offsetX ?? e.clientX ?? 0;
    mouse.y = e.offsetY ?? e.clientY ?? 0;
  }

  function onMouseDown(e) {
    mouse.down = true;
    onMouseMove(e);
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onPadConnect(e) {
    pad = e.gamepad;
    padConnected = true;
  }

  function onPadDisconnect() {
    pad = null;
    padConnected = false;
  }

  const hasWindow = typeof window !== 'undefined';
  const hasDoc = typeof document !== 'undefined';
  if (hasWindow) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('gamepadconnected', onPadConnect);
    window.addEventListener('gamepaddisconnected', onPadDisconnect);
  }
  if (hasDoc && canvas) {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
  }

  function isDown(code) {
    return down.has(code);
  }

  // Edge-triggered: true once per physical press, then consumed.
  function pressed(code) {
    if (pressedEdge.has(code)) {
      pressedEdge.delete(code);
      return true;
    }
    return false;
  }

  // Test/driver hook: fake a key press without a browser.
  function fakeDown(code) {
    if (!down.has(code)) pressedEdge.add(code);
    down.add(code);
  }

  function fakeUp(code) {
    down.delete(code);
  }

  function pollPad() {
    padConnected = false;
    try {
      const pads = globalThis.navigator?.getGamepads?.();
      if (pads) {
        for (const p of pads) {
          if (p && p.connected) {
            pad = p;
            padConnected = true;
            break;
          }
        }
      }
    } catch {
      pad = null;
    }
  }

  // Movement vector in [-1, 1]^2. Gamepad stick wins over keys.
  function axis() {
    let x = 0;
    let y = 0;
    for (const [code, [dx, dy]] of Object.entries(MOVE_KEYS)) {
      if (down.has(code)) {
        x += dx;
        y += dy;
      }
    }
    if (padConnected && pad) {
      const sx = pad.axes?.[0] ?? 0;
      const sy = pad.axes?.[1] ?? 0;
      if (Math.abs(sx) > 0.18 || Math.abs(sy) > 0.18) {
        x = sx;
        y = sy;
      }
      if (pad.buttons?.[0]?.pressed) fakeDown('KeyE');
      if (pad.buttons?.[9]?.pressed) fakeDown('Enter');
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // Called once per frame: refresh the pad, clear consumed edges.
  function update() {
    pollPad();
  }

  function detach() {
    if (hasWindow) {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('gamepadconnected', onPadConnect);
      window.removeEventListener('gamepaddisconnected', onPadDisconnect);
    }
    if (hasDoc && canvas) {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
    }
  }

  return {
    mouse,
    isDown,
    pressed,
    fakeDown,
    fakeUp,
    axis,
    update,
    detach,
    get padConnected() {
      return padConnected;
    },
  };
}
