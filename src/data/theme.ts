import type { CharacterPalette, FaceConfig, VisualTuning } from '../character/CharacterConfig';
import type { ThemeColors } from './types';

/** The "blank" AI shown on the intro, before any choice is made. */
export const NEUTRAL_PALETTE: CharacterPalette = {
  primary: 0xf3f5fb,
  secondary: 0x8f9cc4,
  accent: 0x6d7cff,
  energy: 0x45f0df,
  energyAlt: 0xc8fff7,
};

export const NEUTRAL_FACE: FaceConfig = { eyes: 'round', mouth: 'smile', blush: false };

export const DEFAULT_TUNING: VisualTuning = { glow: 1, idleTempo: 1, fxDensity: 1, heroPose: 'hero' };

export const DEFAULT_THEME: ThemeColors = { bgTop: '#6a5cff', bgBottom: '#36c2ff', glow: '#bdf4ff' };

/** Fixed colours of the character materials that never change with choices. */
export const CHARACTER_BASE_COLORS = {
  screen: 0x1b1f3b,
  joint: 0x3c4466,
  highlight: 0xffffff,
  blush: 0xff7fb8,
  ice: 0xc4f6ff,
  iceGlow: 0x3fc8ff,
} as const;

export const STAGE_COLORS = {
  pedestalTop: 0xf6f7ff,
  pedestalSide: 0x5b5fe8,
  pedestalTrim: 0x3d3fb8,
  backdrop: [0xeef0ff, 0xcfd8ff, 0xbdefff, 0xffd6ef],
  hemiSky: 0xdcecff,
  hemiGround: 0x6b5cff,
  key: 0xfff4e8,
} as const;
