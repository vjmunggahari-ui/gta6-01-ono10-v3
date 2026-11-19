// Solmar Bay — keyboard and mouse, as one small object.
// One job: remember what is held down, and report each fresh press once.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.onFirstGesture = null;
    this._gestured = false;
  }

  attach(target) {
    target.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.key)) this.pressed.add(e.key);
      this.keys.add(e.key);
      this.gesture();
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.key));
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.pressed.clear();
    });
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
    canvas.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  gesture() {
    if (!this._gestured) {
      this._gestured = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  down(...keys) {
    return keys.some((k) => this.keys.has(k));
  }

  hit(...keys) {
    return keys.some((k) => this.pressed.has(k));
  }

  axis() {
    let steer = 0;
    let drive = 0;
    if (this.down('a', 'A', 'ArrowLeft')) steer -= 1;
    if (this.down('d', 'D', 'ArrowRight')) steer += 1;
    if (this.down('w', 'W', 'ArrowUp')) drive += 1;
    if (this.down('s', 'S', 'ArrowDown')) drive -= 1;
    return { steer, drive };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
