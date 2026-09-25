/**
 * Creative-level knobs a UA team would A/B test. Every field can be
 * overridden from the URL (e.g. `?cta=CREATE%20YOUR%20AI&dev=0&sound=0`).
 */
export interface AdConfig {
  /** CTA on the race start line. */
  ctaLabel: string;
  /** CTA after the teaser run freezes on its cliffhanger. */
  ctaFollowUpLabel: string;
  storeUrl: string;
  /** Seconds between a choice and the next step (lets the reaction play). */
  autoAdvanceDelay: number;
  /** Idle seconds before the tutorial hand appears (first question / later ones). */
  hintDelayFirst: number;
  hintDelayChoice: number;
  aiProvider: 'mock' | 'remote';
  aiEndpoint: string;
  aiTimeoutMs: number;
  showDevTools: boolean;
  soundEnabled: boolean;
  maxPixelRatio: number;
}

const DEFAULTS: AdConfig = {
  ctaLabel: 'RUN!',
  ctaFollowUpLabel: 'PLAY NOW',
  storeUrl: 'https://example.com/store/build-your-ai',
  autoAdvanceDelay: 0.85,
  hintDelayFirst: 1.2,
  hintDelayChoice: 2.4,
  aiProvider: 'mock',
  aiEndpoint: '/api/generate-character',
  aiTimeoutMs: 4000,
  showDevTools: true,
  soundEnabled: true,
  maxPixelRatio: 2,
};

const parseFlag = (value: string | null, fallback: boolean): boolean =>
  value === null ? fallback : !['0', 'false', 'off', 'no'].includes(value.toLowerCase());

const parseNumber = (value: string | null, fallback: number, min: number, max: number): number => {
  const parsed = value === null ? NaN : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function loadAdConfig(search: string = window.location.search): AdConfig {
  const params = new URLSearchParams(search);
  const cta = params.get('cta')?.trim().slice(0, 24).toUpperCase();
  return {
    ...DEFAULTS,
    ctaLabel: cta || DEFAULTS.ctaLabel,
    aiProvider: params.get('ai') === 'remote' ? 'remote' : DEFAULTS.aiProvider,
    showDevTools: parseFlag(params.get('dev'), DEFAULTS.showDevTools),
    soundEnabled: parseFlag(params.get('sound'), DEFAULTS.soundEnabled),
    maxPixelRatio: parseNumber(params.get('dpr'), DEFAULTS.maxPixelRatio, 0.5, 3),
  };
}
