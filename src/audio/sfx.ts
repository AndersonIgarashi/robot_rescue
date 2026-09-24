/** Every sound in the playable. All are synthesised at runtime — 0 KB of audio assets. */
export type SfxId =
  | 'tap'
  | 'hover'
  | 'select'
  | 'whoosh'
  | 'pop'
  | 'clank'
  | 'land'
  | 'powerFire'
  | 'powerIce'
  | 'powerLightning'
  | 'powerUp'
  | 'success'
  | 'cta'
  | 'beep'
  | 'go'
  | 'collect';

export interface Synth {
  tone(options: ToneOptions): void;
  noise(options: NoiseOptions): void;
}

export interface ToneOptions {
  freq: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  attack?: number;
}

export interface NoiseOptions {
  duration: number;
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
  gain?: number;
  delay?: number;
}

type SfxRecipe = (synth: Synth, variant: number) => void;

const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];

/** Sound design as data: each recipe layers a few oscillators / filtered noise bursts. */
export const SFX_RECIPES: Record<SfxId, SfxRecipe> = {
  tap: (s) => {
    s.tone({ freq: 620, to: 920, duration: 0.07, type: 'sine', gain: 0.22 });
  },
  hover: (s) => {
    s.tone({ freq: 1250, duration: 0.03, type: 'sine', gain: 0.04 });
  },
  select: (s, variant) => {
    const base = ARPEGGIO[variant % 3];
    s.tone({ freq: base, duration: 0.12, type: 'triangle', gain: 0.2 });
    s.tone({ freq: base * 1.5, duration: 0.16, type: 'triangle', gain: 0.18, delay: 0.07 });
    s.tone({ freq: base * 2, duration: 0.22, type: 'sine', gain: 0.12, delay: 0.14 });
  },
  whoosh: (s) => {
    s.noise({ duration: 0.38, filter: 'bandpass', freq: 380, to: 2600, q: 1.2, gain: 0.26 });
  },
  pop: (s, variant) => {
    s.tone({ freq: 300 + variant * 60, to: 900 + variant * 120, duration: 0.09, type: 'sine', gain: 0.24 });
  },
  clank: (s, variant) => {
    s.noise({ duration: 0.07, filter: 'highpass', freq: 2200, gain: 0.22 });
    s.tone({ freq: 190 - variant * 12, to: 80, duration: 0.14, type: 'triangle', gain: 0.32 });
    s.tone({ freq: 1500 + variant * 110, duration: 0.12, type: 'sine', gain: 0.07, delay: 0.01 });
  },
  land: (s, variant) => {
    s.tone({ freq: 140, to: 60, duration: 0.12, type: 'sine', gain: 0.1 + variant * 0.04 });
  },
  powerFire: (s) => {
    s.noise({ duration: 0.7, filter: 'lowpass', freq: 400, to: 2400, q: 0.8, gain: 0.34 });
    s.tone({ freq: 110, to: 330, duration: 0.5, type: 'sawtooth', gain: 0.08 });
  },
  powerIce: (s) => {
    [1568, 2093, 2637, 3136, 2349].forEach((freq, i) =>
      s.tone({ freq, duration: 0.5, type: 'sine', gain: 0.09, delay: i * 0.045 }),
    );
    s.noise({ duration: 0.5, filter: 'highpass', freq: 5000, gain: 0.08 });
  },
  powerLightning: (s) => {
    for (let i = 0; i < 6; i++) s.noise({ duration: 0.04, filter: 'bandpass', freq: 3000 - i * 250, q: 2, gain: 0.3, delay: i * 0.035 });
    s.tone({ freq: 1400, to: 160, duration: 0.3, type: 'sawtooth', gain: 0.1 });
  },
  powerUp: (s) => {
    s.tone({ freq: 220, to: 1320, duration: 0.45, type: 'triangle', gain: 0.14 });
    s.tone({ freq: 440, to: 1760, duration: 0.45, type: 'sine', gain: 0.08, delay: 0.05 });
  },
  success: (s) => {
    ARPEGGIO.forEach((freq, i) => s.tone({ freq, duration: i === 3 ? 0.55 : 0.14, type: 'triangle', gain: 0.18, delay: i * 0.09 }));
    s.tone({ freq: 2093, duration: 0.4, type: 'sine', gain: 0.06, delay: 0.36 });
  },
  beep: (s) => {
    s.tone({ freq: 660, duration: 0.16, type: 'square', gain: 0.07 });
    s.tone({ freq: 660, duration: 0.16, type: 'sine', gain: 0.12 });
  },
  go: (s) => {
    s.tone({ freq: 1320, duration: 0.45, type: 'square', gain: 0.06 });
    s.tone({ freq: 1320, duration: 0.45, type: 'sine', gain: 0.14 });
    s.noise({ duration: 0.5, filter: 'bandpass', freq: 500, to: 3000, q: 1, gain: 0.22, delay: 0.05 });
  },
  collect: (s, variant) => {
    const base = 988 * Math.pow(1.122, variant % 6);
    s.tone({ freq: base, duration: 0.08, type: 'triangle', gain: 0.16 });
    s.tone({ freq: base * 1.5, duration: 0.14, type: 'sine', gain: 0.12, delay: 0.05 });
  },
  cta: (s) => {
    [784, 988, 1175].forEach((freq) => s.tone({ freq, duration: 0.35, type: 'sine', gain: 0.1 }));
    s.tone({ freq: 500, to: 1400, duration: 0.1, type: 'sine', gain: 0.18 });
  },
};
