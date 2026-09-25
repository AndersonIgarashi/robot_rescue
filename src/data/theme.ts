import type { CharacterPalette, FaceConfig, VisualTuning } from '../character/CharacterConfig';
import type { ThemeColors } from './types';

/** The "blank" AI shown on the first question, before any choice is made. */
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

/** The race set: a synthwave dusk over a neon city. */
export const CITY_COLORS = {
  skyZenith: 0x12083a,
  skyMid: 0x47198a,
  /** Also the fog colour, so the road, grid and skyline melt into the horizon. */
  horizon: 0xd9529c,
  horizonGlow: 0xffa56b,
  sunTop: 0xffe45e,
  sunBottom: 0xff3d8f,
  ground: 0x12082e,
  grid: 0xff3fd0,
  building: 0x1a1140,
  buildingTop: 0x33206b,
  roof: 0x0f0a26,
  windows: [0xffc46b, 0x6ff7ff, 0xff7ad9],
  neon: [0x3df2ff, 0xff3fd0, 0xfff05a, 0x7dff5a, 0xff8a3d, 0xa77bff],
  road: '#2b2566',
  roadBand: '#302a70',
  laneLine: '#6ff7ff',
  edgeLine: '#ff4fd8',
  roadSide: 0x3a2d8c,
  rail: 0x272063,
  pillar: 0x1c1548,
  /** Scene lights lerp toward these while racing. */
  hemiSky: 0xd9c4ff,
  hemiGround: 0xff5ca8,
  key: 0xffe2f1,
} as const;

export const CITY_FOG = { near: 30, far: 290 } as const;
