/* Áudio da abertura.
   Grafo: <video> → passa-baixa (o som "abre" ao atravessar o O) → ganho de travessia → ganho de saída → master → analisador → saída.
   O volume é feito por GainNode (no iOS, video.volume é somente leitura). Sem Web Audio, alterna só o "muted". */
import { bus } from './bus.js';
import { clamp } from './env.js';

class OpeningAudio {
  constructor() { this.video = null; this.ctx = null; this.on = false; this.state = 'off'; this._open = 0; this._exit = 1; }
  attach(video) { this.video = video; }
  _graph() {
    if (this.ctx || this.failed) return !!this.ctx;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) throw new Error('sem Web Audio');
      const ctx = new C();
      const src = ctx.createMediaElementSource(this.video);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7; lp.frequency.value = 500 * Math.pow(40, this._open);
      const gOpen = ctx.createGain(); gOpen.gain.value = 0.35 + 0.65 * this._open;
      const gExit = ctx.createGain(); gExit.gain.value = this._exit;
      const master = ctx.createGain(); master.gain.value = 0;
      const an = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.75;
      src.connect(lp); lp.connect(gOpen); gOpen.connect(gExit); gExit.connect(master); master.connect(an); an.connect(ctx.destination);
      Object.assign(this, { ctx, lp, gOpen, gExit, master, an, data: new Uint8Array(an.frequencyBinCount) });
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend(); else if (this.on) this.ctx.resume();
      });
      return true;
    } catch (e) { this.failed = true; return false; }
  }
  /** Precisa ser chamado de forma síncrona dentro do clique (gesto do usuário). */
  enable({ play = true } = {}) {
    if (!this.video) return;
    const ok = this._graph();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* opcional */ }
    this.video.muted = false;
    if (play) { const p = this.video.play(); if (p && p.catch) p.catch(() => {}); }
    if (ok) { this.ctx.resume(); this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.12); }
    this.on = true; this.state = ok ? 'running' : 'element';
    bus.emit('sound', true);
    bus.emit('media:claim', 'opening');
  }
  disable() {
    if (!this.video) return;
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    else this.video.muted = true;
    this.on = false; this.state = this.ctx ? 'muted' : 'off';
    bus.emit('sound', false);
  }
  toggle(opts) { if (this.on) this.disable(); else this.enable(opts); }
  setOpen(e) {
    this._open = e;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lp.frequency.setTargetAtTime(500 * Math.pow(40, e), t, 0.06);
    this.gOpen.gain.setTargetAtTime(0.35 + 0.65 * e, t, 0.06);
  }
  setExit(v) {
    v = clamp(v);
    if (Math.abs(v - this._exit) < 0.004) return;
    this._exit = v;
    if (this.ctx) this.gExit.gain.setTargetAtTime(v, this.ctx.currentTime, 0.06);
    else if (this.video) { try { this.video.volume = v; } catch (e) { /* iOS */ } }
  }
  /** Bandas 40–250 Hz, 250 Hz–2 kHz, 2–8 kHz em 0..1 (ou null sem som). */
  bands() {
    if (!this.ctx || !this.on || !this.video || this.video.paused) return null;
    this.an.getByteFrequencyData(this.data);
    const hz = this.ctx.sampleRate / this.an.fftSize;
    const avg = (a, b) => { const i0 = Math.max(0, Math.floor(a / hz)), i1 = Math.max(i0 + 1, Math.ceil(b / hz)); let s = 0; for (let i = i0; i < i1; i++) s += this.data[i]; return s / (i1 - i0) / 255; };
    return [avg(40, 250), avg(250, 2000), avg(2000, 8000)];
  }
}

export const audio = new OpeningAudio();
