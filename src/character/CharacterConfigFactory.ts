import { getBodyType, getGadget, getPower, type Selections } from '../data/catalog';
import { DEFAULT_THEME, DEFAULT_TUNING, NEUTRAL_FACE, NEUTRAL_PALETTE } from '../data/theme';
import type { ThemeColors } from '../data/types';
import type { CharacterConfig, VisualTuning } from './CharacterConfig';

/**
 * Pure function: selections (+ optional AI tuning) -> CharacterConfig.
 * No Three.js here, so it is trivially testable and shared by the live
 * preview and the AI generator.
 */
export function resolveCharacterConfig(selections: Selections, tuning: VisualTuning = DEFAULT_TUNING): CharacterConfig {
  const gadget = getGadget(selections.gadget);
  const power = getPower(selections.power);
  const body = getBodyType(selections.bodyType);

  return {
    gadget: gadget?.id ?? null,
    power: power?.id ?? null,
    bodyType: body.id,
    rig: body.rig,
    color: {
      primary: gadget?.paint.primary ?? NEUTRAL_PALETTE.primary,
      secondary: gadget?.paint.secondary ?? NEUTRAL_PALETTE.secondary,
      accent: gadget?.paint.accent ?? NEUTRAL_PALETTE.accent,
      energy: power?.energy ?? gadget?.energy ?? NEUTRAL_PALETTE.energy,
      energyAlt: power?.energyAlt ?? NEUTRAL_PALETTE.energyAlt,
    },
    face: gadget ? { ...gadget.face } : { ...NEUTRAL_FACE },
    accessories: gadget?.accessories ?? [],
    effects: power?.effects ?? [],
    animationSet: gadget?.animationSet ?? 'steady',
    tuning,
  };
}

/** Background theme follows the most recent "strong" choice: power, then gadget. */
export function resolveTheme(selections: Selections): ThemeColors {
  return getPower(selections.power)?.theme ?? getGadget(selections.gadget)?.theme ?? DEFAULT_THEME;
}
