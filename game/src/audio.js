// Synthesised WebAudio sound: engine hum, siren, gunshots, crashes, jingles.
// No audio files, no network. Safe to import in Node (no AudioContext touched).
export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false; this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenOn = false; this._sirenT = 0;
  }
  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
  setEngine(speed01) {
    if (!this.ctx || this.muted) { if (this.engineGain) this.engineGain.gain.value = 0; return; }
    this.engineGain.gain.value = 0.02 + speed01 * 0.05;
    this.engineOsc.frequency.value = 50 + speed01 * 160;
  }
  setSiren(on, dt) {
    if (!this.ctx) return;
    this._sirenT += dt;
    if (on && !this.muted) {
      this.sirenGain.gain.value = 0.03;
      this.sirenOsc.frequency.value = 650 + 250 * Math.sin(this._sirenT * 4);
    } else if (this.sirenGain) this.sirenGain.gain.value = 0;
  }
  _tone(freq, dur, type = 'square', vol = 0.08, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }
  _noise(dur, vol = 0.15) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.ctx.destination); src.start();
  }
  gunshot() { this._noise(0.12, 0.2); }
  crash() { this._noise(0.25, 0.22); }
  punch() { this._noise(0.08, 0.12); }
  blip() { this._tone(880, 0.09, 'sine', 0.08); }
  pickup() { this._tone(660, 0.08, 'sine', 0.08); this._tone(990, 0.12, 'sine', 0.08, 0.08); }
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.09, i * 0.12)); }
  fail() { this._tone(220, 0.25, 'sawtooth', 0.08); this._tone(165, 0.4, 'sawtooth', 0.08, 0.2); }
  busted() { this._tone(440, 0.2, 'square', 0.08); this._tone(330, 0.35, 'square', 0.08, 0.18); }
}
