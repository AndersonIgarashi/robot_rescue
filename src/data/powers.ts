import type { PowerDef } from './types';

/**
 * Power = energy colour + attached VFX + activation burst + sound, plus the
 * race rules: the element it must dodge and the element it collects.
 */
export const POWERS = [
  {
    id: 'FIRE',
    label: 'FIRE',
    icon: 'flame',
    card: { top: '#ffb444', bottom: '#ff4b1f', edge: '#b0300f' },
    theme: { bgTop: '#3424b0', bgBottom: '#7a55ff', glow: '#ffb46b' },
    title: 'Fire',
    phrase: 'blazing fire',
    energy: 0xff7a1a,
    energyAlt: 0xffd23f,
    effects: ['flameHands', 'emberAura'],
    burst: { preset: 'fireBurst', count: 70 },
    sfx: 'powerFire',
    stats: { power: 5 },
    hazard: { kind: 'waterJet', label: 'WATER', icon: 'water' },
    pickup: { kind: 'flameOrb', label: 'FLAMES' },
  },
  {
    id: 'ICE',
    label: 'ICE',
    icon: 'snowflake',
    card: { top: '#86efff', bottom: '#3a9cff', edge: '#1c63b0' },
    theme: { bgTop: '#5b36d0', bgBottom: '#c25cff', glow: '#a8f6ff' },
    title: 'Ice',
    phrase: 'arctic ice',
    energy: 0x5fe6ff,
    energyAlt: 0xe6fdff,
    effects: ['iceCrystals', 'snowAura'],
    burst: { preset: 'iceBurst', count: 60 },
    sfx: 'powerIce',
    stats: { armor: 6 },
    hazard: { kind: 'flameJet', label: 'FIRE', icon: 'flame' },
    pickup: { kind: 'snowflake', label: 'SNOWFLAKES' },
  },
  {
    id: 'LIGHTNING',
    label: 'LIGHTNING',
    icon: 'bolt',
    card: { top: '#ffe75c', bottom: '#ffae00', edge: '#b06f00' },
    theme: { bgTop: '#1d1760', bgBottom: '#5638cc', glow: '#fff08a' },
    title: 'Lightning',
    phrase: 'raw lightning',
    energy: 0xffe14a,
    energyAlt: 0xffffff,
    effects: ['lightningArcs', 'sparkAura'],
    burst: { preset: 'lightningBurst', count: 60, strike: true },
    sfx: 'powerLightning',
    stats: { speed: 6 },
    hazard: { kind: 'magnet', label: 'MAGNETS', icon: 'magnet' },
    pickup: { kind: 'battery', label: 'BATTERIES' },
  },
] as const satisfies readonly PowerDef[];

export type PowerId = (typeof POWERS)[number]['id'];
