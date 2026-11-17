// Keyboard + mouse input. Attach to window/canvas once; read via .keys / .mouse.
export class Input {
  constructor() {
    this.keys = {};
    this.pressed = {}; // edge-triggered, consumed by main loop
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._handlers = [];
  }
  attach(win, canvas) {
    const kd = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    };
    const ku = (e) => { this.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; };
    const mm = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    };
    const md = (e) => { mm(e); this.mouse.down = true; this.mouse.clicked = true; };
    const mu = () => { this.mouse.down = false; };
    win.addEventListener('keydown', kd);
    win.addEventListener('keyup', ku);
    canvas.addEventListener('mousemove', mm);
    canvas.addEventListener('mousedown', md);
    win.addEventListener('mouseup', mu);
    this._handlers = [kd, ku];
  }
  down(k) { return !!this.keys[k]; }
  wasPressed(k) { return !!this.pressed[k]; }
  endFrame() { this.pressed = {}; this.mouse.clicked = false; }
  // Scripted driver support (screenshots / tests): inject a key press.
  injectKey(k) { this.pressed[k] = true; this.keys[k] = true; }
  releaseKey(k) { this.keys[k] = false; }
}
