import type { BodyTypeId } from './bodyTypes';
import type { PersonalityId } from './personalities';
import type { PowerId } from './powers';

/**
 * A rule matches when every field it specifies equals the request.
 * The most specific matching rule wins, so designers can add broad
 * defaults and targeted overrides without touching code.
 */
export interface NameRule {
  readonly personality?: PersonalityId;
  readonly power?: PowerId;
  readonly bodyType?: BodyTypeId;
  readonly name: string;
}

export const NAME_RULES: readonly NameRule[] = [
  // Targeted overrides (3 fields).
  { bodyType: 'DRONE', power: 'FIRE', personality: 'FAST', name: 'COMET' },

  // Personality x power matrix (2 fields).
  { power: 'FIRE', personality: 'SMART', name: 'EMBER' },
  { power: 'FIRE', personality: 'FAST', name: 'BLAZE' },
  { power: 'FIRE', personality: 'CREATIVE', name: 'SPARK' },
  { power: 'ICE', personality: 'SMART', name: 'FROST' },
  { power: 'ICE', personality: 'FAST', name: 'FLURRY' },
  { power: 'ICE', personality: 'CREATIVE', name: 'AURORA' },
  { power: 'LIGHTNING', personality: 'SMART', name: 'FLUX' },
  { power: 'LIGHTNING', personality: 'FAST', name: 'VOLT' },
  { power: 'LIGHTNING', personality: 'CREATIVE', name: 'NEON' },

  // Per-power fallbacks (1 field) — used when a new personality has no pairing yet.
  { power: 'FIRE', name: 'IGNIS' },
  { power: 'ICE', name: 'GLACIER' },
  { power: 'LIGHTNING', name: 'ZAP' },

  // Global fallback.
  { name: 'NOVA' },
];
