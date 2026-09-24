import type { BodyTypeDef } from './types';

/** Body type = which modular rig the assembler builds. */
export const BODY_TYPES = [
  {
    id: 'ROBOT',
    label: 'ROBOT',
    icon: 'robot',
    card: { top: '#939bff', bottom: '#5a5ff0', edge: '#3434b8' },
    noun: 'robot',
    rig: 'robot',
    designation: 'MK',
    bounds: { bottom: -0.32, top: 2.34, width: 1.6 },
    stats: { brain: 4 },
  },
  {
    id: 'ANDROID',
    label: 'ANDROID',
    icon: 'android',
    card: { top: '#5ee8c6', bottom: '#1fae8c', edge: '#12735c' },
    noun: 'android',
    rig: 'android',
    designation: 'NX',
    bounds: { bottom: -0.32, top: 2.5, width: 1.4 },
    stats: { style: 6 },
  },
  {
    id: 'DRONE',
    label: 'DRONE',
    icon: 'drone',
    card: { top: '#ff94c4', bottom: '#ee4f94', edge: '#a82763' },
    noun: 'drone',
    rig: 'drone',
    designation: 'SKY',
    bounds: { bottom: -0.32, top: 2.25, width: 2.5 },
    stats: { speed: 6 },
  },
] as const satisfies readonly BodyTypeDef[];

export type BodyTypeId = (typeof BODY_TYPES)[number]['id'];

export const DEFAULT_BODY_TYPE: BodyTypeId = 'ROBOT';
