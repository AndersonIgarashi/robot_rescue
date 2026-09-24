import type { BodyTypeId } from './bodyTypes';
import type { GadgetId } from './gadgets';
import type { PowerId } from './powers';

/**
 * A rule matches when every field it specifies equals the request.
 * The most specific matching rule wins, so designers can add broad
 * defaults and targeted overrides without touching code.
 */
export interface NameRule {
  readonly gadget?: GadgetId;
  readonly power?: PowerId;
  readonly bodyType?: BodyTypeId;
  readonly name: string;
}

export const NAME_RULES: readonly NameRule[] = [
  // Targeted overrides (3 fields).
  { bodyType: 'DRONE', power: 'FIRE', gadget: 'TURBO', name: 'COMET' },

  // Gadget x power matrix (2 fields).
  { power: 'FIRE', gadget: 'SHIELD', name: 'MAGMA' },
  { power: 'FIRE', gadget: 'TURBO', name: 'BLAZE' },
  { power: 'FIRE', gadget: 'BLASTER', name: 'SPARK' },
  { power: 'ICE', gadget: 'SHIELD', name: 'FROST' },
  { power: 'ICE', gadget: 'TURBO', name: 'FLURRY' },
  { power: 'ICE', gadget: 'BLASTER', name: 'HAIL' },
  { power: 'LIGHTNING', gadget: 'SHIELD', name: 'FLUX' },
  { power: 'LIGHTNING', gadget: 'TURBO', name: 'VOLT' },
  { power: 'LIGHTNING', gadget: 'BLASTER', name: 'ZAPPER' },

  // Per-power fallbacks (1 field) — used when a new gadget has no pairing yet.
  { power: 'FIRE', name: 'IGNIS' },
  { power: 'ICE', name: 'GLACIER' },
  { power: 'LIGHTNING', name: 'ZAP' },

  // Global fallback.
  { name: 'NOVA' },
];
