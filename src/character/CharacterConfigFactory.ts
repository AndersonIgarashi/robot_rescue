import { getBodyType, getPersonality, getPower, type Selections } from '../data/catalog';
import { DEFAULT_THEME, DEFAULT_TUNING, NEUTRAL_FACE, NEUTRAL_PALETTE } from '../data/theme';
import type { ThemeColors } from '../data/types';
import type { CharacterConfig, VisualTuning } from './CharacterConfig';

/**
 * Pure function: selections (+ optional AI tuning) -> CharacterConfig.
 * No Three.js here, so it is trivially testable and shared by the live
 * preview and the AI generator.
 */
export function resolveCharacterConfig(selections: Selections, tuning: VisualTuning = DEFAULT_TUNING): CharacterConfig {
  const personality = getPersonality(selections.personality);
  const power = getPower(selections.power);
  const body = getBodyType(selections.bodyType);

  return {
    personality: personality?.id ?? null,
    power: power?.id ?? null,
    bodyType: body.id,
    rig: body.rig,
    color: {
      primary: personality?.paint.primary ?? NEUTRAL_PALETTE.primary,
      secondary: personality?.paint.secondary ?? NEUTRAL_PALETTE.secondary,
      accent: personality?.paint.accent ?? NEUTRAL_PALETTE.accent,
      energy: power?.energy ?? personality?.energy ?? NEUTRAL_PALETTE.energy,
      energyAlt: power?.energyAlt ?? NEUTRAL_PALETTE.energyAlt,
    },
    face: personality ? { ...personality.face } : { ...NEUTRAL_FACE },
    accessories: personality?.accessories ?? [],
    effects: power?.effects ?? [],
    animationSet: personality?.animationSet ?? 'steady',
    tuning,
  };
}

/** Background theme follows the most recent "strong" choice: power, then personality. */
export function resolveTheme(selections: Selections): ThemeColors {
  return getPower(selections.power)?.theme ?? getPersonality(selections.personality)?.theme ?? DEFAULT_THEME;
}
