import type { GadgetDef } from './types';

/**
 * Gadget = the racer's special ability (defense / speed / attack).
 * It drives the paint job, face, accessory kit and idle attitude.
 * To add a gadget, append an entry here (reusing or registering accessories).
 */
export const GADGETS = [
  {
    id: 'SHIELD',
    label: 'SHIELD',
    icon: 'shield',
    card: { top: '#52b6ff', bottom: '#2f5bff', edge: '#1b3aae' },
    theme: { bgTop: '#3d4fe6', bgBottom: '#36c8ff', glow: '#b3f5ff' },
    article: 'A',
    adjective: 'shielded',
    paint: { primary: 0xf4f7ff, secondary: 0x3d6bff, accent: 0xffcf3f },
    energy: 0x3fe0ff,
    face: { eyes: 'sparkle', mouth: 'smile', blush: true },
    accessories: ['armShield', 'shieldOrbit', 'chestEmblem'],
    animationSet: 'steady',
    heroPose: 'hero',
    stats: { speed: 58, armor: 93, power: 60 },
  },
  {
    id: 'TURBO',
    label: 'TURBO',
    icon: 'rocket',
    card: { top: '#ff9a45', bottom: '#ff4b2b', edge: '#b3261a' },
    theme: { bgTop: '#4636d6', bgBottom: '#3a9dff', glow: '#ffd8b0' },
    article: 'A',
    adjective: 'turbo-charged',
    paint: { primary: 0xff5a36, secondary: 0xffc93c, accent: 0x2e3350 },
    energy: 0xff8a2a,
    face: { eyes: 'sharp', mouth: 'grin', blush: false },
    accessories: ['headFin', 'jetBoosters', 'speedStripes'],
    animationSet: 'zippy',
    heroPose: 'power',
    stats: { speed: 94, armor: 55, power: 61 },
  },
  {
    id: 'BLASTER',
    label: 'BLASTER',
    icon: 'blaster',
    card: { top: '#b48dff', bottom: '#6a3df0', edge: '#3f1fa8' },
    theme: { bgTop: '#0fb3ae', bgBottom: '#3f78ff', glow: '#e2ffd6' },
    article: 'A',
    adjective: 'hard-hitting',
    paint: { primary: 0x9b7bff, secondary: 0x2e3350, accent: 0x6cf06a },
    energy: 0x7dff5a,
    face: { eyes: 'focus', mouth: 'line', blush: false },
    accessories: ['armCannon', 'missilePods', 'scopeVisor'],
    animationSet: 'bouncy',
    heroPose: 'aim',
    stats: { speed: 60, armor: 57, power: 94 },
  },
] as const satisfies readonly GadgetDef[];

export type GadgetId = (typeof GADGETS)[number]['id'];
