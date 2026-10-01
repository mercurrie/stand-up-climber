import Phaser from 'phaser';

const MUTED_STORAGE_KEY = 'stand-up-climber:muted';
const MASTER_VOLUME = 0.5;

/**
 * Tiny synthesised sound effects, so there are no audio files to load or
 * license. Uses Phaser's Web Audio context, which Phaser unlocks on the first
 * click/key press (browsers block audio before that).
 *
 * Emits 'change' (muted) when mute is toggled.
 */
export class Sfx extends Phaser.Events.EventEmitter {
  constructor(game) {
    super();
    this.game = game;
    this.muted = loadMuted();
    this.master = null;
  }

  /** The audio context, or null if audio isn't available/unlocked yet. */
  get ctx() {
    const ctx = this.game.sound.context;
    if (!ctx || ctx.state !== 'running' || this.muted) return null;
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(ctx.destination);
    }
    return ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    saveMuted(this.muted);
    this.emit('change', this.muted);
  }

  // --- The sounds ---------------------------------------------------------

  /** Auto-jump. Pitch rises with progress (0..1), so climbing sounds like climbing. */
  bounce(progress = 0) {
    const base = 330 + 330 * progress;
    this.tone({ freq: base, endFreq: base * 1.5, duration: 0.09, type: 'triangle', volume: 0.12 });
  }

  hit() {
    this.noise({ duration: 0.18, volume: 0.25 });
    this.tone({ freq: 320, endFreq: 70, duration: 0.35, type: 'sawtooth', volume: 0.12 });
  }

  countdownTick() {
    this.tone({ freq: 440, duration: 0.12, type: 'square', volume: 0.1 });
  }

  go() {
    this.tone({ freq: 880, duration: 0.3, type: 'square', volume: 0.1 });
  }

  /** Reaching the top. */
  finish() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      this.tone({ freq, duration: 0.14, type: 'triangle', volume: 0.15, delay: i * 0.09 });
    });
  }

  /** One results row appearing. */
  reveal(step = 0) {
    this.tone({ freq: 300 + step * 40, duration: 0.07, type: 'triangle', volume: 0.1 });
  }

  victory() {
    const notes = [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [659, 0.78], [784, 0.9], [1047, 1.05]];
    notes.forEach(([freq, delay], i) => {
      const last = i === notes.length - 1;
      this.tone({ freq, duration: last ? 0.6 : 0.14, type: 'square', volume: 0.09, delay });
      this.tone({ freq: freq / 2, duration: last ? 0.6 : 0.14, type: 'triangle', volume: 0.08, delay });
    });
  }

  // --- Building blocks ----------------------------------------------------

  tone({ freq, endFreq = freq, duration, type = 'square', volume = 0.1, delay = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    // Quick attack and exponential decay, so notes don't click.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  noise({ duration, volume = 0.2 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
  }
}

// Remembering mute is a convenience only, so storage failures are ignored.
function loadMuted() {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(muted) {
  try {
    localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
}
