import type { PersonalityDef } from './types';

/**
 * Personality = paint job + face + accessory kit + idle attitude.
 * To add a personality, append an entry here (reusing or registering accessories).
 */
export const PERSONALITIES = [
  {
    id: 'SMART',
    label: 'SMART',
    icon: 'brain',
    card: { top: '#52b6ff', bottom: '#2f5bff', edge: '#1b3aae' },
    theme: { bgTop: '#3d4fe6', bgBottom: '#36c8ff', glow: '#b3f5ff' },
    article: 'A',
    adjective: 'brilliant',
    paint: { primary: 0xf4f7ff, secondary: 0x3d6bff, accent: 0xffcf3f },
    energy: 0x3fe0ff,
    face: { eyes: 'focus', mouth: 'line', blush: false },
    accessories: ['glasses', 'headset', 'dataOrbit'],
    animationSet: 'steady',
    heroPose: 'hero',
    stats: { brain: 92, speed: 58, style: 55 },
  },
  {
    id: 'FAST',
    label: 'FAST',
    icon: 'rocket',
    card: { top: '#ff9a45', bottom: '#ff4b2b', edge: '#b3261a' },
    theme: { bgTop: '#4636d6', bgBottom: '#3a9dff', glow: '#ffd8b0' },
    article: 'A',
    adjective: 'hyper-fast',
    paint: { primary: 0xff5a36, secondary: 0xffc93c, accent: 0x2e3350 },
    energy: 0xff8a2a,
    face: { eyes: 'sharp', mouth: 'grin', blush: false },
    accessories: ['headFin', 'jetBoosters', 'speedStripes'],
    animationSet: 'zippy',
    heroPose: 'power',
    stats: { brain: 60, speed: 93, style: 62 },
  },
  {
    id: 'CREATIVE',
    label: 'CREATIVE',
    icon: 'palette',
    card: { top: '#c97dff', bottom: '#ff5fb0', edge: '#9b2e86' },
    theme: { bgTop: '#0fb3ae', bgBottom: '#3f78ff', glow: '#ffd0f2' },
    article: 'An',
    adjective: 'imaginative',
    paint: { primary: 0xb99bff, secondary: 0xff5fa8, accent: 0xffd23f },
    energy: 0xff5fd2,
    face: { eyes: 'sparkle', mouth: 'smile', blush: true },
    accessories: ['beret', 'paintBrush', 'shapeOrbit'],
    animationSet: 'bouncy',
    heroPose: 'cheer',
    stats: { brain: 66, speed: 57, style: 94 },
  },
] as const satisfies readonly PersonalityDef[];

export type PersonalityId = (typeof PERSONALITIES)[number]['id'];
