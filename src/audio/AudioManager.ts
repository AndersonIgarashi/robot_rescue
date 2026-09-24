import { SFX_RECIPES, type NoiseOptions, type SfxId, type Synth, type ToneOptions } from './sfx';

const STORAGE_KEY = 'bya.muted';

type AudioContextConstructor = typeof AudioContext;

/**
 * WebAudio synthesiser. The context is created lazily on the first user
 * gesture (autoplay policy), every call is exception-safe, and the playable
 * behaves identically when audio is unavailable or muted.
 */
export class AudioManager implements Synth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private mutedValue: boolean;
  private failed = false;

  constructor(enabled: boolean) {
    this.mutedValue = !enabled || this.readStoredMute();
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  /** Call from a user gesture. Creates or resumes the AudioContext. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.context) {
        const Ctor: AudioContextConstructor | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        this.context = new Ctor();
        this.master = this.context.createGain();
        this.master.gain.value = this.mutedValue ? 0 : 0.7;
        this.master.connect(this.context.destination);
        this.noiseBuffer = this.createNoise(this.context);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch {
      this.failed = true;
    }
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* storage unavailable (private mode / sandboxed ad iframe) */
    }
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.context.currentTime, 0.02);
  }

  /** Pause/resume with page visibility (ad networks require silence when hidden). */
  setSuspended(suspended: boolean): void {
    if (!this.context) return;
    const action = suspended ? this.context.suspend() : this.context.resume();
    void action.catch(() => undefined);
  }

  play(id: SfxId, variant = 0): void {
    if (this.mutedValue || !this.context || this.context.state !== 'running') return;
    try {
      SFX_RECIPES[id](this, variant);
    } catch {
      /* a failed sound must never break the playable */
    }
  }

  tone({ freq, to, duration, type = 'sine', gain = 0.2, delay = 0, attack = 0.008 }: ToneOptions): void {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    osc.onended = () => env.disconnect();
  }

  noise({ duration, filter, freq, to, q = 1, gain = 0.2, delay = 0 }: NoiseOptions): void {
    const ctx = this.context;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(freq, start);
    if (to) biquad.frequency.exponentialRampToValueAtTime(to, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(biquad).connect(env).connect(this.master);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.02);
    source.onended = () => env.disconnect();
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private readStoredMute(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
